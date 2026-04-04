// Aura System - Clube de Assinaturas: Assinantes
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { checkWriteAccess } from "@/lib/apiGuards";

// GET - Lista assinantes da clínica
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    if (!user.companyId) return NextResponse.json({ error: "Usuário sem empresa" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? undefined;
    const patientId = searchParams.get("patientId") ?? undefined;

    const subscriptions = await prisma.patientSubscription.findMany({
      where: {
        companyId: user.companyId,
        ...(status ? { status: status as "ACTIVE" | "PAUSED" | "CANCELED" | "OVERDUE" | "PENDING" } : {}),
        ...(patientId ? { patientId } : {}),
      },
      include: {
        patient: { select: { id: true, name: true, phone: true, email: true } },
        plan: {
          include: {
            items: {
              include: {
                procedure: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(subscriptions);
  } catch (error) {
    console.error("Erro ao listar assinantes:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

// POST - Inscreve paciente em um plano
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const writeBlock = await checkWriteAccess(user);
    if (writeBlock) return writeBlock;

    const body = await request.json() as {
      patientId: string;
      planId: string;
      nextBillingDate: string;
      asaasSubscriptionId?: string;
      asaasCustomerId?: string;
    };

    const { patientId, planId, nextBillingDate, asaasSubscriptionId, asaasCustomerId } = body;

    if (!patientId || !planId || !nextBillingDate) {
      return NextResponse.json(
        { error: "patientId, planId e nextBillingDate são obrigatórios" },
        { status: 400 }
      );
    }

    // Garante que patient e plan pertencem à mesma empresa
    const [patient, plan] = await Promise.all([
      prisma.patient.findFirst({ where: { id: patientId, companyId: user.companyId! } }),
      prisma.subscriptionPlan.findFirst({ where: { id: planId, companyId: user.companyId!, isActive: true }, include: { items: true } }),
    ]);

    if (!patient) return NextResponse.json({ error: "Paciente não encontrado" }, { status: 404 });
    if (!plan) return NextResponse.json({ error: "Plano não encontrado ou inativo" }, { status: 404 });

    // Inicializa sessões usadas zeradas para cada procedimento do plano
    const sessionsUsedThisCycle: Record<string, number> = {};
    plan.items.forEach((item) => {
      sessionsUsedThisCycle[item.procedureId] = 0;
    });

    // Transação atômica para evitar race condition (duas inscrições simultâneas)
    const subscription = await prisma.$transaction(async (tx) => {
      const existing = await tx.patientSubscription.findFirst({
        where: { patientId, companyId: user.companyId!, status: "ACTIVE" },
      });
      if (existing) {
        throw new Error("ALREADY_ACTIVE");
      }

      return tx.patientSubscription.create({
        data: {
          patientId,
          planId,
          companyId: user.companyId!,
          nextBillingDate: new Date(nextBillingDate),
          sessionsUsedThisCycle,
          asaasSubscriptionId: asaasSubscriptionId ?? null,
          asaasCustomerId: asaasCustomerId ?? null,
        },
        include: {
          patient: { select: { id: true, name: true, phone: true } },
          plan: { select: { id: true, name: true, price: true } },
        },
      });
    }).catch((err: Error) => {
      if (err.message === "ALREADY_ACTIVE") return null;
      throw err;
    });

    if (!subscription) {
      return NextResponse.json({ error: "Paciente já possui uma assinatura ativa" }, { status: 409 });
    }

    return NextResponse.json({ success: true, data: subscription }, { status: 201 });
  } catch (error) {
    console.error("Erro ao inscrever paciente:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
