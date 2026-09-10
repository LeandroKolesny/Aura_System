// Aura System - API de Usuário/Profissional Individual
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { checkWriteAccess } from "@/lib/apiGuards";
import { updateUserSchema } from "@/lib/validations/user";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const SELECT_FIELDS = {
  id: true,
  email: true,
  name: true,
  avatar: true,
  phone: true,
  role: true,
  title: true,
  isActive: true,
  contractType: true,
  remunerationType: true,
  commissionRate: true,
  fixedSalary: true,
  businessHours: true,
  companyId: true,
  createdAt: true,
} as const;

// PUT - Atualizar profissional
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const authUser = await getAuthUser(request);
    const { id } = await params;

    if (!authUser) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    if (!authUser.companyId) {
      return NextResponse.json({ error: "Usuário sem empresa" }, { status: 403 });
    }
    if (!["ADMIN", "OWNER"].includes(authUser.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const writeError = await checkWriteAccess(authUser);
    if (writeError) return writeError;

    const existing = await prisma.user.findFirst({
      where: { id, companyId: authUser.companyId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Profissional não encontrado" }, { status: 404 });
    }

    const body = await request.json();
    const validation = updateUserSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    if (validation.data.email && validation.data.email !== existing.email) {
      const duplicate = await prisma.user.findUnique({ where: { email: validation.data.email } });
      if (duplicate) {
        return NextResponse.json({ error: "Já existe um usuário com este e-mail" }, { status: 409 });
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: validation.data as never,
      select: SELECT_FIELDS,
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Erro ao atualizar profissional:", error);
    return NextResponse.json({ error: "Erro inesperado." }, { status: 500 });
  }
}

// DELETE - Desativar profissional (soft delete — preserva histórico de agendamentos)
//
// NOTA (efeitos conhecidos, ainda sem tratamento — escopo de produto):
//  - não checa agendamentos futuros vinculados ao profissional antes de
//    desativar; um agendamento marcado com esse profissional continua no
//    banco apontando pra alguém inativo.
//  - profissional inativo sai do relatório de comissões
//    (GET /api/reports/commissions filtra isActive: true), mesmo tendo tido
//    atendimentos concluídos e pagos no período consultado.
//  Reativação é feita via PUT /api/users/[id] com { isActive: true }
//  (o schema já aceita), mas ainda não há UI pra isso.
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authUser = await getAuthUser(request);
    const { id } = await params;

    if (!authUser) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    if (!authUser.companyId) {
      return NextResponse.json({ error: "Usuário sem empresa" }, { status: 403 });
    }
    if (!["ADMIN", "OWNER"].includes(authUser.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }
    if (id === authUser.id) {
      return NextResponse.json({ error: "Você não pode remover a si mesmo." }, { status: 409 });
    }

    const writeError = await checkWriteAccess(authUser);
    if (writeError) return writeError;

    const existing = await prisma.user.findFirst({
      where: { id, companyId: authUser.companyId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Profissional não encontrado" }, { status: 404 });
    }

    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true, message: "Profissional desativado" });
  } catch (error) {
    console.error("Erro ao remover profissional:", error);
    return NextResponse.json({ error: "Erro inesperado." }, { status: 500 });
  }
}
