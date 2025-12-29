// Aura System - API de Regras de Indisponibilidade (por ID)
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { checkWriteAccess } from "@/lib/apiGuards";

interface Params {
  params: Promise<{ id: string }>;
}

// GET - Buscar regra específica
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    if (!user.companyId) {
      return NextResponse.json({ error: "Usuário sem empresa" }, { status: 403 });
    }

    const rule = await prisma.unavailabilityRule.findFirst({
      where: { id, companyId: user.companyId },
    });

    if (!rule) {
      return NextResponse.json({ error: "Regra não encontrada" }, { status: 404 });
    }

    return NextResponse.json({ rule });
  } catch (error) {
    console.error("Erro ao buscar regra:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// DELETE - Remover regra
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
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

    // Apenas ADMIN e OWNER podem deletar
    if (!["OWNER", "ADMIN"].includes(user.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const rule = await prisma.unavailabilityRule.findFirst({
      where: { id, companyId: user.companyId },
    });

    if (!rule) {
      return NextResponse.json({ error: "Regra não encontrada" }, { status: 404 });
    }

    await prisma.unavailabilityRule.delete({ where: { id } });

    // Log de atividade
    await prisma.activity.create({
      data: {
        type: "SETTINGS_CHANGED",
        title: `Regra de indisponibilidade removida`,
        description: rule.description || "Bloqueio removido",
        userId: user.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao deletar regra:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

