// Aura System - API de Ajuste de Estoque
// LÓGICA CRÍTICA: Movimentação segura de estoque
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { stockAdjustmentSchema } from "@/lib/validations/inventory";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Erro de concorrência: entre a leitura inicial de currentStock (fora da
 * transação) e a escrita, outra operação já reduziu o estoque a ponto de este
 * ajuste deixá-lo negativo. Mapeado para HTTP 400 (mesma resposta da checagem
 * síncrona de "Estoque insuficiente").
 */
class ConcurrentStockError extends Error {
  constructor() {
    super("Estoque insuficiente");
    this.name = "ConcurrentStockError";
  }
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

    const currentStock = Number(item.currentStock);

    // Delta com sinal: IN soma, OUT/LOSS subtraem, ADJUSTMENT usa o sinal recebido.
    let delta: number;
    switch (type) {
      case "IN":
        delta = Math.abs(quantity);
        break;
      case "OUT":
      case "LOSS":
        delta = -Math.abs(quantity);
        break;
      case "ADJUSTMENT":
        delta = quantity;
        break;
      default:
        delta = 0;
    }

    // Valor projetado (a partir da leitura fora da transação) — usado só para
    // feedback rápido, o log de auditoria e a mensagem de retorno.
    const projectedStock = currentStock + delta;

    // Pré-checagem síncrona: bloqueia de imediato o que já é claramente inválido.
    if (projectedStock < 0) {
      return NextResponse.json(
        {
          error: "Estoque insuficiente",
          message: `Estoque atual: ${currentStock}. Não é possível remover ${Math.abs(quantity)}.`,
        },
        { status: 400 }
      );
    }

    // Ajuste dentro da transação usando increment/decrement ATÔMICO do Prisma —
    // nunca gravamos o valor absoluto calculado a partir de uma leitura fora da
    // transação (isso causava lost update em ajustes concorrentes).
    // Para o delta negativo, usamos um updateMany CONDICIONAL (where currentStock
    // >= |delta|): se uma operação concorrente já baixou o estoque, o updateMany
    // afeta 0 linhas e abortamos a transação — sem lost update e sem estoque
    // negativo.
    const result = await prisma.$transaction(async (tx) => {
      if (delta < 0) {
        const decrement = Math.abs(delta);
        const affected = await tx.inventoryItem.updateMany({
          where: { id, currentStock: { gte: decrement } },
          data: { currentStock: { decrement } },
        });
        if (affected.count === 0) {
          throw new ConcurrentStockError();
        }
      } else if (delta > 0) {
        await tx.inventoryItem.updateMany({
          where: { id },
          data: { currentStock: { increment: delta } },
        });
      }

      if (type === "IN") {
        await tx.inventoryItem.update({
          where: { id },
          data: { lastRestockDate: new Date() },
        });
      }

      // Re-leitura DENTRO da transação para devolver o estado consistente.
      const updatedItem = await tx.inventoryItem.findFirst({ where: { id } });

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

    // Para o log de auditoria, a notificação e a mensagem usamos o valor
    // projetado (currentStock + delta): o delta e o motivo são a fonte de verdade
    // do ajuste. `result.item` (re-lido na transação) vai só no corpo da resposta.
    const newStock = projectedStock;

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
    if (error instanceof ConcurrentStockError) {
      return NextResponse.json(
        {
          error: "Estoque insuficiente",
          message: "Outro ajuste concorrente alterou o estoque. Recarregue e tente novamente.",
        },
        { status: 400 }
      );
    }
    console.error("Erro ao ajustar estoque:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
