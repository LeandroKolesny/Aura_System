// POST /api/subscriptions/patients/self
// Authenticated PATIENT creates a PENDING subscription for themselves
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    if (user.role !== "PATIENT") return NextResponse.json({ error: "Apenas pacientes podem contratar planos" }, { status: 403 });
    if (!user.companyId) return NextResponse.json({ error: "Usuário sem empresa" }, { status: 403 });

    const body = await request.json() as { planId: string };
    const { planId } = body;
    if (!planId) return NextResponse.json({ error: "planId é obrigatório" }, { status: 400 });

    // Validate plan belongs to same company and is active
    const plan = await prisma.subscriptionPlan.findFirst({
      where: { id: planId, companyId: user.companyId, isActive: true },
      include: { items: true },
    });
    if (!plan) return NextResponse.json({ error: "Plano não encontrado" }, { status: 404 });

    // Find patient record linked to this portal user (same email + companyId)
    const patient = await prisma.patient.findFirst({
      where: { email: user.email, companyId: user.companyId },
    });
    if (!patient) return NextResponse.json({ error: "Registro de paciente não encontrado" }, { status: 404 });

    // Check for existing non-canceled subscription for this plan
    const existing = await prisma.patientSubscription.findFirst({
      where: {
        patientId: patient.id,
        planId,
        companyId: user.companyId,
        status: { in: ["PENDING", "ACTIVE", "PAUSED"] },
      },
    });
    if (existing) {
      // Retorna o existente com 200 — paciente pode agendar mesmo com plano já ativo/pendente
      return NextResponse.json(
        { id: existing.id, status: existing.status, planId: existing.planId },
        { status: 200 }
      );
    }

    // Initialize sessions counter zeroed for each procedure
    const sessionsUsedThisCycle: Record<string, number> = {};
    plan.items.forEach((item) => { sessionsUsedThisCycle[item.procedureId] = 0; });

    const subscription = await prisma.patientSubscription.create({
      data: {
        patientId: patient.id,
        planId,
        companyId: user.companyId,
        status: "PENDING",
        startDate: new Date(),
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        sessionsUsedThisCycle,
        lastCycleReset: new Date(),
      },
      select: { id: true, status: true, planId: true },
    });

    return NextResponse.json({ id: subscription.id, status: subscription.status, planId: subscription.planId }, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar assinatura:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
