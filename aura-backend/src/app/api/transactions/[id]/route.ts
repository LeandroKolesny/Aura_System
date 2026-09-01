import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { z } from "zod";

const updateTransactionSchema = z.object({
  description: z.string().min(1).max(255).optional(),
  amount: z.number().positive().optional(),
  date: z.string().optional(),
  category: z.string().max(100).optional(),
  status: z.enum(["PAID", "PENDING", "OVERDUE"]).optional(),
  type: z.enum(["INCOME", "EXPENSE"]).optional(),
  paymentMethod: z.string().max(50).optional(),
});

async function getOwnedTransaction(id: string, companyId: string) {
  return prisma.transaction.findFirst({
    where: { id, companyId },
  });
}

// PUT - Editar transação
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    if (!user.companyId) return NextResponse.json({ error: "Usuário sem empresa" }, { status: 403 });
    if (!["OWNER", "ADMIN"].includes(user.role))
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

    const { id } = await params;
    const existing = await getOwnedTransaction(id, user.companyId);
    if (!existing) return NextResponse.json({ error: "Transação não encontrada" }, { status: 404 });

    if (existing.appointmentId)
      return NextResponse.json(
        { error: "Transações vinculadas a agendamentos não podem ser editadas manualmente." },
        { status: 409 }
      );

    const body = await request.json();
    const validation = updateTransactionSchema.safeParse(body);
    if (!validation.success)
      return NextResponse.json({ error: "Dados inválidos", details: validation.error.flatten() }, { status: 400 });

    const { date, ...rest } = validation.data;
    const updated = await prisma.transaction.update({
      where: { id },
      data: {
        ...rest,
        ...(date ? { date: new Date(`${date}T12:00:00.000Z`) } : {}),
      },
    });

    return NextResponse.json({ transaction: updated });
  } catch (error) {
    console.error("Erro ao editar transação:", error);
    return NextResponse.json({ error: "Erro inesperado." }, { status: 500 });
  }
}

// DELETE - Excluir transação
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    if (!user.companyId) return NextResponse.json({ error: "Usuário sem empresa" }, { status: 403 });
    if (!["OWNER", "ADMIN"].includes(user.role))
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

    const { id } = await params;
    const existing = await getOwnedTransaction(id, user.companyId);
    if (!existing) return NextResponse.json({ error: "Transação não encontrada" }, { status: 404 });

    if (existing.appointmentId)
      return NextResponse.json(
        { error: "Transações vinculadas a agendamentos não podem ser excluídas manualmente." },
        { status: 409 }
      );

    await prisma.transaction.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao excluir transação:", error);
    return NextResponse.json({ error: "Erro inesperado." }, { status: 500 });
  }
}
