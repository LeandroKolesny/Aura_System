// Aura System - API de Ajuste de Estoque
// LÓGICA CRÍTICA: Movimentação segura de estoque
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { stockAdjustmentSchema } from "@/lib/validations/inventory";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST - Ajustar estoque
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAuthUser(request);
    const { id } = await params;

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    if (!user.companyId) {
      return NextResponse.json({ error: "Usuário sem empresa" }, { status: 403 });
    }

    // Apenas ADMIN pode ajustar estoque
    if (!["OWNER", "ADMIN"].includes(user.role)) {
      return NextResponse.json({ error: "Sem permissão para ajustar estoque" }, { status: 403 });
    }

    // Verificar se item existe
    const item = await prisma.inventoryItem.findFirst({
      where: { id, companyId: user.companyId },
    });

    if (!item) {
      return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
    }

    const body = await request.json();
    const validation = stockAdjustmentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { quantity, type, reason } = validation.data;

    // Calcular novo estoque
    let newStock: number;
    const currentStock = Number(item.currentStock);

    switch (type) {
      case "IN":
        // Entrada sempre adiciona
        newStock = currentStock + Math.abs(quantity);
        break;
      case "OUT":
      case "LOSS":
        // Saída e perda sempre subtraem
        newStock = currentStock - Math.abs(quantity);
        break;
      case "ADJUSTMENT":
        // Ajuste pode ser positivo ou negativo
        newStock = currentStock + quantity;
        break;
      default:
        newStock = currentStock;
    }

    // Validar que estoque não ficará negativo
    if (newStock < 0) {
      return NextResponse.json(
        { 
          error: "Estoque insuficiente", 
          message: `Estoque atual: ${currentStock}. Não é possível remover ${Math.abs(quantity)}.`
        },
        { status: 400 }
      );
    }

    // Executar ajuste em transação
    const result = await prisma.$transaction(async (tx) => {
      // Atualizar estoque
      const updatedItem = await tx.inventoryItem.update({
        where: { id },
        data: {
          currentStock: newStock,
          lastRestockDate: type === "IN" ? new Date() : item.lastRestockDate,
        },
      });

      // Registrar movimento
      const movement = await tx.stockMovement.create({
        data: {
          inventoryItemId: id,
          quantity: Math.abs(quantity),
          type,
          reason,
        },
      });

      return { item: updatedItem, movement };
    });

    // Log de atividade
    await prisma.activity.create({
      data: {
        type: "STOCK_ADJUSTED",
        title: `Estoque ajustado: ${item.name}`,
        userId: user.id,
        metadata: {
          itemId: id,
          type,
          quantity,
          previousStock: currentStock,
          newStock,
          reason,
        },
      },
    });

    // Verificar se estoque ficou baixo e criar alerta
    if (newStock <= Number(item.minStock)) {
      await prisma.appNotification.create({
        data: {
          companyId: user.companyId,
          message: `⚠️ Estoque baixo: ${item.name} (${newStock} ${item.unit})`,
          type: "WARNING",
        },
      });
    }

    return NextResponse.json({
      success: true,
      item: result.item,
      movement: result.movement,
      message: `Estoque atualizado: ${currentStock} → ${newStock} ${item.unit}`,
    });
  } catch (error) {
    console.error("Erro ao ajustar estoque:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

