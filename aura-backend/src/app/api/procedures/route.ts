// Aura System - API de Procedimentos
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { createProcedureSchema, listProceduresQuerySchema } from "@/lib/validations/procedure";

// GET - Listar procedimentos
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
    const queryValidation = listProceduresQuerySchema.safeParse({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
      search: searchParams.get("search"),
      isActive: searchParams.get("isActive"),
    });

    if (!queryValidation.success) {
      return NextResponse.json(
        { error: "Parâmetros inválidos", details: queryValidation.error.flatten() },
        { status: 400 }
      );
    }

    const { page, limit, search, isActive } = queryValidation.data;
    const skip = (page - 1) * limit;

    const where: any = { companyId: user.companyId };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    if (isActive !== "all") {
      where.isActive = isActive === "true";
    }

    const [procedures, total] = await Promise.all([
      prisma.procedure.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: "asc" },
        include: {
          supplies: {
            include: {
              inventoryItem: { select: { id: true, name: true, unit: true, costPerUnit: true } },
            },
          },
        },
      }),
      prisma.procedure.count({ where }),
    ]);

    return NextResponse.json({
      procedures,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Erro ao listar procedimentos:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// POST - Criar procedimento
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    if (!user.companyId) {
      return NextResponse.json({ error: "Usuário sem empresa" }, { status: 403 });
    }

    // Apenas ADMIN pode criar procedimentos
    if (!["OWNER", "ADMIN"].includes(user.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const body = await request.json();
    const validation = createProcedureSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { supplies, ...procedureData } = validation.data;

    // Verificar se os itens de estoque existem e calcular custo total
    let calculatedCost = 0;
    if (supplies && supplies.length > 0) {
      const inventoryIds = supplies.map((s) => s.inventoryItemId);
      const existingItems = await prisma.inventoryItem.findMany({
        where: { id: { in: inventoryIds }, companyId: user.companyId },
      });

      if (existingItems.length !== inventoryIds.length) {
        return NextResponse.json({ error: "Um ou mais itens de estoque não encontrados" }, { status: 400 });
      }

      // Calcular custo total dos insumos
      calculatedCost = supplies.reduce((total, supply) => {
        const item = existingItems.find((i) => i.id === supply.inventoryItemId);
        if (item) {
          return total + (Number(item.costPerUnit) * supply.quantityUsed);
        }
        return total;
      }, 0);
    }

    // Usar o custo calculado ou o enviado pelo frontend (o maior)
    const finalCost = Math.max(calculatedCost, procedureData.cost || 0);

    // Criar procedimento com insumos
    const procedure = await prisma.procedure.create({
      data: {
        ...procedureData,
        cost: finalCost,
        companyId: user.companyId,
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

    return NextResponse.json({ procedure }, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar procedimento:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

