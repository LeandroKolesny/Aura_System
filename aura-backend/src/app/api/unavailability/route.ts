// Aura System - API de Regras de Indisponibilidade
// Férias, feriados, bloqueios de horário
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { checkWriteAccess } from "@/lib/apiGuards";
import { z } from "zod";

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

    const where: any = { companyId: user.companyId };

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

