// Aura System - API de Transações Financeiras
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import {
  createTransactionSchema,
  listTransactionsQuerySchema,
} from "@/lib/validations/transaction";

// GET - Listar transações
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    if (!user.companyId) {
      return NextResponse.json({ error: "Usuário sem empresa" }, { status: 403 });
    }

    // Apenas ADMIN e OWNER podem ver todas as transações
    if (!["OWNER", "ADMIN"].includes(user.role)) {
      return NextResponse.json({ error: "Sem permissão para acessar financeiro" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const queryValidation = listTransactionsQuerySchema.safeParse({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
      startDate: searchParams.get("startDate"),
      endDate: searchParams.get("endDate"),
      type: searchParams.get("type"),
      status: searchParams.get("status"),
      category: searchParams.get("category"),
      patientId: searchParams.get("patientId"),
    });

    if (!queryValidation.success) {
      return NextResponse.json(
        { error: "Parâmetros inválidos", details: queryValidation.error.flatten() },
        { status: 400 }
      );
    }

    const { page, limit, startDate, endDate, type, status, category, patientId } = queryValidation.data;
    const skip = (page - 1) * limit;

    // Construir filtros
    const where: any = { companyId: user.companyId };

    if (startDate) where.date = { ...where.date, gte: new Date(startDate) };
    if (endDate) where.date = { ...where.date, lte: new Date(endDate) };
    if (type && type !== "all") where.type = type;
    if (status && status !== "all") where.status = status;
    if (category) where.category = category;
    if (patientId) where.patientId = patientId;

    const [transactions, total, totals] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: "desc" },
        include: {
          patient: { select: { id: true, name: true } },
          appointment: {
            select: {
              id: true,
              date: true,
              procedure: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                  cost: true,
                }
              }
            }
          },
          professional: { select: { id: true, name: true } },
        },
      }),
      prisma.transaction.count({ where }),
      // Calcular totais
      prisma.transaction.groupBy({
        by: ["type"],
        where: { ...where, status: "PAID" },
        _sum: { amount: true },
      }),
    ]);

    // Processar totais
    const income = totals.find((t) => t.type === "INCOME")?._sum.amount || 0;
    const expense = totals.find((t) => t.type === "EXPENSE")?._sum.amount || 0;

    return NextResponse.json({
      transactions,
      summary: {
        income: Number(income),
        expense: Number(expense),
        balance: Number(income) - Number(expense),
      },
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Erro ao listar transações:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// POST - Criar transação (despesa manual)
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    if (!user.companyId) {
      return NextResponse.json({ error: "Usuário sem empresa" }, { status: 403 });
    }

    // Apenas ADMIN pode criar transações manuais
    if (!["OWNER", "ADMIN"].includes(user.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const body = await request.json();
    const validation = createTransactionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const transaction = await prisma.transaction.create({
      data: {
        ...validation.data,
        date: new Date(validation.data.date),
        companyId: user.companyId,
      },
    });

    // Log de atividade
    await prisma.activity.create({
      data: {
        type: validation.data.type === "EXPENSE" ? "EXPENSE_CREATED" : "PAYMENT_RECEIVED",
        title: `${validation.data.type === "EXPENSE" ? "Despesa" : "Receita"}: ${validation.data.description}`,
        userId: user.id,
        metadata: { transactionId: transaction.id, amount: validation.data.amount },
      },
    });

    return NextResponse.json({ transaction }, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar transação:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

