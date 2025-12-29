// Aura System - API de Estoque
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { createInventoryItemSchema, listInventoryQuerySchema } from "@/lib/validations/inventory";

// GET - Listar itens de estoque
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
    const queryValidation = listInventoryQuerySchema.safeParse({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
      search: searchParams.get("search"),
      lowStock: searchParams.get("lowStock"),
      isActive: searchParams.get("isActive"),
    });

    if (!queryValidation.success) {
      return NextResponse.json(
        { error: "Parâmetros inválidos", details: queryValidation.error.flatten() },
        { status: 400 }
      );
    }

    const { page, limit, search, lowStock, isActive } = queryValidation.data;
    const skip = (page - 1) * limit;

    const where: any = { companyId: user.companyId };

    if (search) {
      where.name = { contains: search, mode: "insensitive" };
    }

    if (isActive !== "all") {
      where.isActive = isActive === "true";
    }

    let items = await prisma.inventoryItem.findMany({
      where,
      skip,
      take: limit,
      orderBy: { name: "asc" },
      include: {
        stockMovements: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    // Filtrar por estoque baixo (feito em memória pois Prisma não suporta comparação entre campos)
    if (lowStock === "true") {
      items = items.filter((item) => Number(item.currentStock) <= Number(item.minStock));
    }

    const total = await prisma.inventoryItem.count({ where });

    // Calcular estatísticas
    const allItems = await prisma.inventoryItem.findMany({
      where: { companyId: user.companyId, isActive: true },
    });

    const lowStockCount = allItems.filter((item) => Number(item.currentStock) <= Number(item.minStock)).length;
    const totalValue = allItems.reduce(
      (acc, item) => acc + Number(item.currentStock) * Number(item.costPerUnit),
      0
    );

    return NextResponse.json({
      items,
      summary: {
        totalItems: allItems.length,
        lowStockCount,
        totalValue,
      },
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Erro ao listar estoque:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// POST - Criar item de estoque
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    if (!user.companyId) {
      return NextResponse.json({ error: "Usuário sem empresa" }, { status: 403 });
    }

    // Apenas ADMIN pode gerenciar estoque
    if (!["OWNER", "ADMIN"].includes(user.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const body = await request.json();
    const validation = createInventoryItemSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const item = await prisma.inventoryItem.create({
      data: {
        ...validation.data,
        companyId: user.companyId,
        lastRestockDate: validation.data.currentStock > 0 ? new Date() : null,
      },
    });

    // Registrar movimento inicial se houver estoque
    if (validation.data.currentStock > 0) {
      await prisma.stockMovement.create({
        data: {
          inventoryItemId: item.id,
          quantity: validation.data.currentStock,
          type: "IN",
          reason: "Estoque inicial",
        },
      });
    }

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar item de estoque:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

