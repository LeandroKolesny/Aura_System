// Aura System - API de Procedimento Individual (GET, PUT, DELETE)
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { updateProcedureSchema } from "@/lib/validations/procedure";

// GET - Buscar procedimento por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    if (!user.companyId) return NextResponse.json({ error: "Usuário sem empresa" }, { status: 403 });

    const { id } = await params;

    const procedure = await prisma.procedure.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        supplies: {
          include: {
            inventoryItem: { select: { id: true, name: true, unit: true, costPerUnit: true } },
          },
        },
      },
    });

    if (!procedure) {
      return NextResponse.json({ error: "Procedimento não encontrado" }, { status: 404 });
    }

    return NextResponse.json({ procedure });
  } catch (error) {
    console.error("Erro ao buscar procedimento:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// PUT - Atualizar procedimento
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    if (!user.companyId) return NextResponse.json({ error: "Usuário sem empresa" }, { status: 403 });
    if (!["OWNER", "ADMIN"].includes(user.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const validation = updateProcedureSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    // Verificar se procedimento existe
    const existing = await prisma.procedure.findFirst({
      where: { id, companyId: user.companyId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Procedimento não encontrado" }, { status: 404 });
    }

    const { supplies, ...procedureData } = validation.data;

    // Calcular custo total dos insumos se supplies foram enviados
    let calculatedCost = 0;
    if (supplies && supplies.length > 0) {
      const inventoryIds = supplies.map((s) => s.inventoryItemId);
      const existingItems = await prisma.inventoryItem.findMany({
        where: { id: { in: inventoryIds }, companyId: user.companyId },
      });

      calculatedCost = supplies.reduce((total, supply) => {
        const item = existingItems.find((i) => i.id === supply.inventoryItemId);
        if (item) {
          return total + (Number(item.costPerUnit) * supply.quantityUsed);
        }
        return total;
      }, 0);
    }

    // Usar o custo calculado ou o enviado pelo frontend (o maior)
    const finalCost = supplies !== undefined
      ? Math.max(calculatedCost, procedureData.cost || 0)
      : procedureData.cost;

    // Atualizar procedimento
    // Primeiro, remover supplies antigos se novos foram enviados
    if (supplies !== undefined) {
      await prisma.procedureSupply.deleteMany({ where: { procedureId: id } });
    }

    const procedure = await prisma.procedure.update({
      where: { id },
      data: {
        ...procedureData,
        ...(finalCost !== undefined && { cost: finalCost }),
        supplies: supplies && supplies.length > 0 ? {
          create: supplies.map((s) => ({
            inventoryItemId: s.inventoryItemId,
            quantityUsed: s.quantityUsed,
          })),
        } : undefined,
      },
      include: {
        supplies: {
          include: {
            inventoryItem: { select: { id: true, name: true, unit: true, costPerUnit: true } },
          },
        },
      },
    });

    return NextResponse.json({ procedure });
  } catch (error) {
    console.error("Erro ao atualizar procedimento:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// DELETE - Remover procedimento
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    if (!user.companyId) return NextResponse.json({ error: "Usuário sem empresa" }, { status: 403 });
    if (!["OWNER", "ADMIN"].includes(user.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const { id } = await params;

    const existing = await prisma.procedure.findFirst({
      where: { id, companyId: user.companyId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Procedimento não encontrado" }, { status: 404 });
    }

    await prisma.procedure.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Procedimento removido" });
  } catch (error) {
    console.error("Erro ao remover procedimento:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

