// Aura System - API de Regras de Indisponibilidade
// Férias, feriados, bloqueios de horário
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { checkWriteAccess } from "@/lib/apiGuards";
import { checkUnavailability, type UnavailabilityRule } from "@/lib/businessHours";
import { Prisma } from "@prisma/client";
import { z } from "zod";

const ACTIVE_APPOINTMENT_STATUSES = ["SCHEDULED", "CONFIRMED", "PENDING_APPROVAL"] as const;

// Schema de validação
const createRuleSchema = z.object({
  description: z.string().max(200).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Formato inválido (HH:mm)"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Formato inválido (HH:mm)"),
  dates: z.array(z.string()).min(1, "Pelo menos uma data é obrigatória"),
  professionalIds: z.array(z.string()).default([]), // vazio = todos
});

// GET - Listar regras de indisponibilidade
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    if (!user.companyId) {
      return NextResponse.json({ error: "Usuário sem empresa" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const professionalId = searchParams.get("professionalId");

    const where: Prisma.UnavailabilityRuleWhereInput = { companyId: user.companyId };

    // Filtrar por profissional se especificado
    if (professionalId) {
      where.OR = [
        { professionalIds: { has: professionalId } },
        { professionalIds: { isEmpty: true } }, // Regras que afetam todos
      ];
    }

    const rules = await prisma.unavailabilityRule.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ rules });
  } catch (error) {
    console.error("Erro ao listar regras:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// POST - Criar nova regra
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    if (!user.companyId) {
      return NextResponse.json({ error: "Usuário sem empresa" }, { status: 403 });
    }

    // GUARD: Verificar permissão de escrita
    const writeError = await checkWriteAccess(user);
    if (writeError) return writeError;

    // Apenas ADMIN e OWNER podem criar regras
    if (!["OWNER", "ADMIN"].includes(user.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const body = await request.json();
    const validation = createRuleSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    // Validar que startTime < endTime
    const { startTime, endTime, dates, professionalIds, description } = validation.data;
    if (startTime >= endTime) {
      return NextResponse.json(
        { error: "Horário inicial deve ser menor que o final" },
        { status: 400 }
      );
    }

    // Validar datas no formato ISO
    for (const date of dates) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json(
          { error: `Data inválida: ${date}. Use formato YYYY-MM-DD` },
          { status: 400 }
        );
      }
    }

    // CONFLITO: não deixar bloquear a agenda "por cima" de agendamentos já
    // marcados — o cliente apareceria num horário que a agenda mostra como
    // fechado. Segue o padrão de 409 já usado no projeto para FK/registros
    // vinculados. A checagem reusa `checkUnavailability` (a MESMA lógica da
    // validação em POST /api/appointments), então o pré-check bate exatamente
    // com o que seria bloqueado depois.
    const sortedDates = [...dates].sort();
    const rangeStart = new Date(`${sortedDates[0]}T00:00:00.000Z`);
    rangeStart.setUTCDate(rangeStart.getUTCDate() - 1);
    const rangeEnd = new Date(`${sortedDates[sortedDates.length - 1]}T00:00:00.000Z`);
    rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 2);

    const candidateAppointments = await prisma.appointment.findMany({
      where: {
        companyId: user.companyId,
        status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
        date: { gte: rangeStart, lte: rangeEnd },
        // Regra específica → só os profissionais afetados. Regra geral
        // (professionalIds vazio) → qualquer profissional da empresa.
        ...(professionalIds.length > 0 ? { professionalId: { in: professionalIds } } : {}),
      },
      select: { id: true, date: true, professionalId: true },
    });

    const draftRule: UnavailabilityRule = {
      id: "__precheck__",
      description,
      startTime,
      endTime,
      dates,
      professionalIds,
    };
    const conflicting = candidateAppointments.filter(
      (appt) => checkUnavailability(appt.date, appt.professionalId, [draftRule]).blocked
    );

    if (conflicting.length > 0) {
      return NextResponse.json(
        {
          error: `Existem ${conflicting.length} agendamento(s) ativo(s) neste período. Cancele ou realoque antes de bloquear a agenda.`,
        },
        { status: 409 }
      );
    }

    const rule = await prisma.unavailabilityRule.create({
      data: {
        companyId: user.companyId,
        description,
        startTime,
        endTime,
        dates,
        professionalIds,
      },
    });

    // Log de atividade
    await prisma.activity.create({
      data: {
        type: "SETTINGS_CHANGED",
        title: `Regra de indisponibilidade criada`,
        description: description || `${dates.length} data(s) bloqueada(s)`,
        userId: user.id,
        metadata: { ruleId: rule.id },
      },
    });

    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar regra:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

