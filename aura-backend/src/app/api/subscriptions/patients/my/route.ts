import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

// GET /api/subscriptions/patients/my
// Returns the authenticated patient's active subscriptions with session usage
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const subscriptions = await prisma.patientSubscription.findMany({
      where: {
        patientId: user.id,
        status: { in: ["ACTIVE", "PAUSED"] },
      },
      include: {
        plan: {
          include: {
            items: {
              include: {
                procedure: { select: { id: true, name: true, durationMinutes: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const result = subscriptions.map((sub) => {
      const used = (sub.sessionsUsedThisCycle ?? {}) as Record<string, number>;
      return {
        id: sub.id,
        status: sub.status,
        startDate: sub.startDate,
        nextBillingDate: sub.nextBillingDate,
        lastCycleReset: sub.lastCycleReset,
        plan: {
          id: sub.plan.id,
          name: sub.plan.name,
          price: Number(sub.plan.price),
          description: sub.plan.description,
          imageUrl: sub.plan.imageUrl,
        },
        items: sub.plan.items.map((item) => ({
          procedureId: item.procedureId,
          procedureName: item.procedure.name,
          sessionsPerCycle: item.sessionsPerCycle,
          sessionsUsed: used[item.procedureId] ?? 0,
          sessionsRemaining: Math.max(0, item.sessionsPerCycle - (used[item.procedureId] ?? 0)),
        })),
      };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Erro ao buscar assinaturas do paciente:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
