// Aura System - API de Item de Estoque Individual
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { updateInventoryItemSchema } from "@/lib/validations/inventory";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PUT - Atualizar item de estoque
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAuthUser(request);
    const { id } = await params;

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    if (!user.companyId) {
      return NextResponse.json({ error: "Usuário sem empresa" }, { status: 403 });
    }
    if (!["OWNER", "ADMIN"].includes(user.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const existing = await prisma.inventoryItem.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Item de estoque não encontrado" }, { status: 404 });
    }

    const body = await request.json();
    const validation = updateInventoryItemSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const item = await prisma.inventoryItem.update({
      where: { id },
      data: validation.data,
    });

    return NextResponse.json({ item });
  } catch (error) {
    console.error("Erro ao atualizar item de estoque:", error);
    return NextResponse.json({ error: "Erro inesperado." }, { status: 500 });
  }
}

// DELETE - Desativar item de estoque (soft delete)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAuthUser(request);
    const { id } = await params;

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    if (!user.companyId) {
      return NextResponse.json({ error: "Usuário sem empresa" }, { status: 403 });
    }
    if (!["OWNER", "ADMIN"].includes(user.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const existing = await prisma.inventoryItem.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Item de estoque não encontrado" }, { status: 404 });
    }

    await prisma.inventoryItem.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true, message: "Item de estoque desativado" });
  } catch (error) {
    console.error("Erro ao remover item de estoque:", error);
    return NextResponse.json({ error: "Erro inesperado." }, { status: 500 });
  }
}
