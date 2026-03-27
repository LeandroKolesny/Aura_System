// Aura System - API de Relatório de Retenção de Pacientes
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

const DEFAULT_INTERVAL_DAYS = 60;
const VALID_PERIODS = [30, 60, 90] as const;

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    if (!user.companyId) {
      return NextResponse.json(
        { error: "Usuário sem empresa" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const rawPeriod = parseInt(searchParams.get("period") ?? "90");
    const professionalId = searchParams.get("professionalId") ?? undefined;

    const period = VALID_PERIODS.includes(
      rawPeriod as (typeof VALID_PERIODS)[number]
    )
      ? rawPeriod
      : 90;

    const now = new Date();
    const periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - period);

    // Busca todos os agendamentos COMPLETED dentro do período
    const appointments = await prisma.appointment.findMany({
      where: {
        companyId: user.companyId,
        status: "COMPLETED",
        date: { gte: periodStart },
        ...(professionalId ? { professionalId } : {}),
      },
      select: {
        date: true,
        patientId: true,
        patient: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        procedure: {
          select: {
            id: true,
            name: true,
            maintenanceIntervalDays: true,
          },
        },
      },
      orderBy: { date: "desc" },
    });

    // Agrupa por paciente, mantém apenas o agendamento mais recente de cada um
    const patientMap = new Map<
      string,
      {
        date: Date;
        patientId: string;
        patient: { id: string; name: string; phone: string };
        procedure: {
          id: string;
          name: string;
          maintenanceIntervalDays: number | null;
        };
      }
    >();

    for (const appt of appointments) {
      if (!patientMap.has(appt.patientId)) {
        patientMap.set(appt.patientId, appt);
      }
    }

    const totalPatients = patientMap.size;

    // Calcula pacientes em atraso
    const overduePatients: {
      id: string;
      name: string;
      phone: string;
      lastProcedure: string;
      lastVisit: string;
      expectedReturn: string;
      daysOverdue: number;
      risk: "attention" | "at_risk" | "lost";
      intervalUsed: number;
      isDefaultInterval: boolean;
    }[] = [];

    for (const appt of patientMap.values()) {
      const intervalDays =
        appt.procedure.maintenanceIntervalDays ?? DEFAULT_INTERVAL_DAYS;
      const lastVisit = new Date(appt.date);
      const expectedReturn = new Date(lastVisit);
      expectedReturn.setDate(expectedReturn.getDate() + intervalDays);

      // Só inclui pacientes cujo retorno esperado já passou
      if (now <= expectedReturn) continue;

      const daysOverdue = Math.floor(
        (now.getTime() - expectedReturn.getTime()) / (1000 * 60 * 60 * 24)
      );

      let risk: "attention" | "at_risk" | "lost";
      if (daysOverdue <= 10) {
        risk = "attention";
      } else if (daysOverdue <= 30) {
        risk = "at_risk";
      } else {
        risk = "lost";
      }

      overduePatients.push({
        id: appt.patient.id,
        name: appt.patient.name,
        phone: appt.patient.phone,
        lastProcedure: appt.procedure.name,
        lastVisit: lastVisit.toISOString().split("T")[0],
        expectedReturn: expectedReturn.toISOString().split("T")[0],
        daysOverdue,
        risk,
        intervalUsed: intervalDays,
        isDefaultInterval: appt.procedure.maintenanceIntervalDays === null,
      });
    }

    // Ordena por dias em atraso (mais crítico primeiro)
    overduePatients.sort((a, b) => b.daysOverdue - a.daysOverdue);

    const attention = overduePatients.filter((p) => p.risk === "attention")
      .length;
    const at_risk = overduePatients.filter((p) => p.risk === "at_risk").length;
    const lost = overduePatients.filter((p) => p.risk === "lost").length;

    const retentionRate =
      totalPatients > 0
        ? Math.round(
            ((totalPatients - overduePatients.length) / totalPatients) * 100
          )
        : 100;

    return NextResponse.json({
      success: true,
      data: {
        summary: { attention, at_risk, lost, retentionRate },
        patients: overduePatients,
      },
    });
  } catch (error) {
    console.error("Erro no relatório de retenção:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
