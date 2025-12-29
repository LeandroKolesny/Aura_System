// Aura System - API de Relatório de Comissões
// REGRA DE NEGÓCIO CRÍTICA - Cálculo no servidor
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { checkModuleAccess } from "@/lib/apiGuards";
import { z } from "zod";

const querySchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  professionalId: z.string().optional(),
});

interface CommissionResult {
  professionalId: string;
  professionalName: string;
  totalRevenue: number;
  commissionRate: number;
  commissionAmount: number;
  appointmentsCount: number;
  remunerationType: string;
  fixedSalary: number;
  totalEarnings: number;
}

// GET - Calcular comissões por período
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    if (!user.companyId) {
      return NextResponse.json({ error: "Usuário sem empresa" }, { status: 403 });
    }

    // GUARD: Verificar acesso ao módulo de relatórios
    const moduleError = await checkModuleAccess(user, "reports");
    if (moduleError) return moduleError;

    // Apenas ADMIN e OWNER podem ver comissões
    if (!["OWNER", "ADMIN"].includes(user.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const validation = querySchema.safeParse({
      startDate: searchParams.get("startDate"),
      endDate: searchParams.get("endDate"),
      professionalId: searchParams.get("professionalId"),
    });

    if (!validation.success) {
      return NextResponse.json(
        { error: "Parâmetros inválidos", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { startDate, endDate, professionalId } = validation.data;
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Buscar profissionais
    const professionalWhere: any = {
      companyId: user.companyId,
      role: "ESTHETICIAN",
      isActive: true,
    };
    if (professionalId) {
      professionalWhere.id = professionalId;
    }

    const professionals = await prisma.user.findMany({
      where: professionalWhere,
      select: {
        id: true,
        name: true,
        commissionRate: true,
        remunerationType: true,
        fixedSalary: true,
      },
    });

    // Buscar transações de receita por profissional no período
    const commissions: CommissionResult[] = [];

    for (const prof of professionals) {
      // Buscar agendamentos concluídos e pagos
      const appointments = await prisma.appointment.findMany({
        where: {
          companyId: user.companyId,
          professionalId: prof.id,
          status: "COMPLETED",
          paid: true,
          date: { gte: start, lte: end },
        },
        select: { id: true, price: true },
      });

      const totalRevenue = appointments.reduce(
        (sum, a) => sum + Number(a.price),
        0
      );
      const commissionRate = Number(prof.commissionRate || 0);
      const commissionAmount = (totalRevenue * commissionRate) / 100;
      const fixedSalary = Number(prof.fixedSalary || 0);

      // Total de ganhos depende do tipo de remuneração
      let totalEarnings = 0;
      switch (prof.remunerationType) {
        case "FIXED":
          totalEarnings = fixedSalary;
          break;
        case "COMMISSION":
          totalEarnings = commissionAmount;
          break;
        case "MIXED":
          totalEarnings = fixedSalary + commissionAmount;
          break;
      }

      commissions.push({
        professionalId: prof.id,
        professionalName: prof.name,
        totalRevenue,
        commissionRate,
        commissionAmount,
        appointmentsCount: appointments.length,
        remunerationType: prof.remunerationType,
        fixedSalary,
        totalEarnings,
      });
    }

    // Totais gerais
    const totals = {
      totalRevenue: commissions.reduce((s, c) => s + c.totalRevenue, 0),
      totalCommissions: commissions.reduce((s, c) => s + c.commissionAmount, 0),
      totalEarnings: commissions.reduce((s, c) => s + c.totalEarnings, 0),
    };

    return NextResponse.json({
      period: { startDate, endDate },
      commissions,
      totals,
    });
  } catch (error) {
    console.error("Erro ao calcular comissões:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

