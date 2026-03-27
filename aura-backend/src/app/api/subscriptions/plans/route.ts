// Aura System - Clube de Assinaturas: CRUD de Planos
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { checkWriteAccess } from "@/lib/apiGuards";

// GET - Lista todos os planos da clínica
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    if (!user.companyId) return NextResponse.json({ error: "Usuário sem empresa" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

    const plans = await prisma.subscriptionPlan.findMany({
      where: {
        companyId: user.companyId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        items: {
          include: {
            procedure: {
              select: { id: true, name: true, price: true, durationMinutes: true },
            },
          },
        },
        _count: { select: { subscribers: { where: { status: "ACTIVE" } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: plans });
  } catch (error) {
    console.error("Erro ao listar planos de assinatura:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

// POST - Cria novo plano
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const writeBlock = await checkWriteAccess(user);
    if (writeBlock) return writeBlock;

    const body = await request.json() as {
      name: string;
      price: number;
      description?: string;
      items: { procedureId: string; sessionsPerCycle: number }[];
    };

    const { name, price, description, items } = body;

    if (!name || price == null || !items || items.length === 0) {
      return NextResponse.json(
        { error: "name, price e items são obrigatórios" },
        { status: 400 }
      );
    }

    const plan = await prisma.subscriptionPlan.create({
      data: {
        name,
        price,
        description: description ?? null,
        companyId: user.companyId!,
        items: {
          create: items.map((item) => ({
            procedureId: item.procedureId,
            sessionsPerCycle: item.sessionsPerCycle,
          })),
        },
      },
      include: {
        items: {
          include: {
            procedure: { select: { id: true, name: true, price: true } },
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: plan }, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar plano de assinatura:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
