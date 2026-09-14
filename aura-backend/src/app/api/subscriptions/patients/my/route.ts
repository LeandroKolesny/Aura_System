import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

// GET /api/subscriptions/patients/my
// Returns the authenticated patient's active subscriptions with session usage
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    if (!user.companyId) return NextResponse.json({ success: true, data: [] });

    // Patient and User are separate records linked by email+companyId
    const patient = await prisma.patient.findFirst({
      where: { email: user.email, companyId: user.companyId },
      select: { id: true },
    });
    if (!patient) return NextResponse.json({ success: true, data: [] });

    const subscriptions = await prisma.patientSubscription.findMany({
      where: {
        patientId: patient.id,
        companyId: user.companyId,
        status: { in: ["PENDING", "ACTIVE", "PAUSED"] },
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

    // Uma assinatura PENDING pode já ter uma sessão agendada aguardando
    // aprovação do admin (o agendamento nasce PENDING_APPROVAL e só vira
    // SCHEDULED — ativando a assinatura — quando o admin aprova). Sem isso, a
    // tela "Meus Planos" não tinha como distinguir "ainda não agendou" de
    // "já agendou, aguardando a clínica aprovar", mostrando sempre "Agende
    // sua primeira sessão" mesmo com um agendamento já pendente.
    const pendingSubscriptionIds = subscriptions
      .filter((sub) => sub.status === "PENDING")
      .map((sub) => sub.id);
    const subscriptionIdsWithPendingAppointment = new Set<string>();
    if (pendingSubscriptionIds.length > 0) {
      const pendingAppointments = await prisma.appointment.findMany({
        where: {
          subscriptionId: { in: pendingSubscriptionIds },
          status: "PENDING_APPROVAL",
        },
        select: { subscriptionId: true },
      });
      for (const appt of pendingAppointments) {
        if (appt.subscriptionId) subscriptionIdsWithPendingAppointment.add(appt.subscriptionId);
      }
    }

    // Assinatura ACTIVE: para o botão "Consultar agenda" (leva o paciente
    // direto pro dia/horário da sessão), buscamos o agendamento vinculado a
    // ela — o próximo futuro se houver, senão o mais recente já realizado.
    const activeSubscriptionIds = subscriptions
      .filter((sub) => sub.status === "ACTIVE")
      .map((sub) => sub.id);
    const nextAppointmentBySubscription = new Map<string, { id: string; date: Date }>();
    if (activeSubscriptionIds.length > 0) {
      const linkedAppointments = await prisma.appointment.findMany({
        where: {
          subscriptionId: { in: activeSubscriptionIds },
          status: { in: ["SCHEDULED", "CONFIRMED"] },
        },
        select: { id: true, date: true, subscriptionId: true },
        orderBy: { date: "asc" },
      });
      // Lista já vem ordenada por data ASC: assim que acharmos o primeiro
      // agendamento futuro de uma assinatura, ele é o futuro mais próximo —
      // ignoramos o resto. Se nenhum for futuro, vamos sobrescrevendo até
      // sobrar o último visto (o passado mais recente).
      const now = new Date();
      for (const appt of linkedAppointments) {
        if (!appt.subscriptionId) continue;
        const current = nextAppointmentBySubscription.get(appt.subscriptionId);
        if (current && current.date >= now) continue;
        nextAppointmentBySubscription.set(appt.subscriptionId, appt);
      }
    }

    const result = subscriptions.map((sub) => {
      const used = (sub.sessionsUsedThisCycle ?? {}) as Record<string, number>;
      const linkedAppointment = nextAppointmentBySubscription.get(sub.id);
      return {
        id: sub.id,
        status: sub.status,
        hasPendingAppointment: subscriptionIdsWithPendingAppointment.has(sub.id),
        nextAppointment: linkedAppointment
          ? { id: linkedAppointment.id, date: linkedAppointment.date }
          : null,
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
