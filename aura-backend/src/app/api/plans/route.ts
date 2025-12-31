import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

// GET /api/plans - Listar todos os planos (publico)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("active") === "true";

    const plans = await prisma.saasPlan.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { price: "asc" },
    });

    // Converter Decimal para number para o frontend
    const formattedPlans = plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      price: Number(plan.price),
      features: plan.features,
      active: plan.isActive,
      stripePaymentLink: plan.stripeProductId || "",
    }));

    return NextResponse.json(formattedPlans);
  } catch (error) {
    console.error("Erro ao listar planos:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// POST /api/plans - Criar novo plano (OWNER only)
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
    }

    if (authResult.user.role !== "OWNER") {
      return NextResponse.json(
        { error: "Apenas o Owner pode criar planos" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, price, features, active, stripePaymentLink } = body;

    if (!name || price === undefined) {
      return NextResponse.json(
        { error: "Nome e preco sao obrigatorios" },
        { status: 400 }
      );
    }

    const plan = await prisma.saasPlan.create({
      data: {
        name,
        price: price,
        features: features || [],
        isActive: active !== false,
        stripeProductId: stripePaymentLink || null,
      },
    });

    return NextResponse.json({
      success: true,
      plan: {
        id: plan.id,
        name: plan.name,
        price: Number(plan.price),
        features: plan.features,
        active: plan.isActive,
        stripePaymentLink: plan.stripeProductId || "",
      },
    });
  } catch (error) {
    console.error("Erro ao criar plano:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
