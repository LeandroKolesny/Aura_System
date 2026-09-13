import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

// Sem validação Zod, um corpo malformado (price como string, negativo, nome
// vazio) chegava direto no Prisma e só falharia lá (ou pior, seria aceito
// silenciosamente quando o tipo "batia" por coerção implícita do JS).
const createPlanSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório"),
  displayName: z.string().trim().min(1).max(100).optional(),
  price: z.number().min(0, "Preço não pode ser negativo"),
  maxProfessionals: z.number().int().optional(),
  maxPatients: z.number().int().optional(),
  modules: z.array(z.string()).optional(),
  features: z.array(z.string()).optional(),
  active: z.boolean().optional(),
  stripePaymentLink: z.string().trim().max(500).optional(),
});

// GET /api/plans - Listar todos os planos (publico)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("active") === "true";

    const plans = await prisma.saasPlan.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { price: "asc" },
    });

    // Converter Decimal para number e incluir novos campos
    const formattedPlans = plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      displayName: plan.displayName || plan.name,
      price: Number(plan.price),
      maxProfessionals: plan.maxProfessionals,
      maxPatients: plan.maxPatients,
      modules: plan.modules,
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

    const rawBody = await request.json();
    const validation = createPlanSchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { name, displayName, price, maxProfessionals, maxPatients, modules, features, active, stripePaymentLink } = validation.data;

    const plan = await prisma.saasPlan.create({
      data: {
        name,
        displayName: displayName || name,
        price: price,
        maxProfessionals: maxProfessionals ?? 1,
        maxPatients: maxPatients ?? 50,
        modules: modules || [],
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
        displayName: plan.displayName,
        price: Number(plan.price),
        maxProfessionals: plan.maxProfessionals,
        maxPatients: plan.maxPatients,
        modules: plan.modules,
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
