import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

// GET - Estatísticas do Dashboard
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    if (!user.companyId) {
      return NextResponse.json({ error: "Usuário sem empresa" }, { status: 403 });
    }

    const companyId = user.companyId;
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    // Buscar estatísticas em paralelo usando modelos existentes
    const [
      totalLeads,
      leadsWon,
      totalPatients,
      newPatientsThisMonth,
      totalAppointments,
      appointmentsToday,
      appointmentsThisMonth,
      incomeThisMonth,
      expenseThisMonth,
      totalInventoryItems,
      recentActivities,
    ] = await Promise.all([
      // Leads
      prisma.lead.count({ where: { companyId } }).catch(() => 0),
      prisma.lead.count({ where: { companyId, status: "WON" } }).catch(() => 0),

      // Pacientes
      prisma.patient.count({ where: { companyId } }),
      prisma.patient.count({
        where: { companyId, createdAt: { gte: startOfMonth } }
      }),

      // Agendamentos
      prisma.appointment.count({ where: { companyId } }),
      prisma.appointment.count({
        where: { companyId, date: { gte: startOfDay } }
      }),
      prisma.appointment.count({
        where: { companyId, date: { gte: startOfMonth } }
      }),

      // Financeiro - Receitas
      prisma.transaction.aggregate({
        where: {
          companyId,
          type: "INCOME",
          date: { gte: startOfMonth },
        },
        _sum: { amount: true },
      }),

      // Financeiro - Despesas
      prisma.transaction.aggregate({
        where: {
          companyId,
          type: "EXPENSE",
          date: { gte: startOfMonth },
        },
        _sum: { amount: true },
      }),

      // Estoque
      prisma.inventoryItem.count({ where: { companyId } }),

      // Atividades recentes
      prisma.activity.findMany({
        where: { user: { companyId } },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          user: { select: { id: true, name: true, avatar: true } },
        },
      }).catch(() => []),
    ]);

    // Calcular taxa de conversão de leads
    const conversionRate = totalLeads > 0
      ? ((leadsWon / totalLeads) * 100).toFixed(1)
      : "0";

    // Calcular lucro
    const income = Number(incomeThisMonth._sum.amount) || 0;
    const expense = Number(expenseThisMonth._sum.amount) || 0;
    const profit = income - expense;

    return NextResponse.json({
      stats: {
        leads: {
          total: totalLeads,
          won: leadsWon,
          conversionRate: `${conversionRate}%`,
        },
        patients: {
          total: totalPatients,
          newThisMonth: newPatientsThisMonth,
        },
        appointments: {
          total: totalAppointments,
          today: appointmentsToday,
          thisMonth: appointmentsThisMonth,
        },
        financial: {
          income,
          expense,
          profit,
          profitMargin: income > 0
            ? `${((profit / income) * 100).toFixed(1)}%`
            : "0%",
        },
        inventory: {
          total: totalInventoryItems,
        },
      },
      recentActivities,
    });
  } catch (error) {
    console.error("Erro ao buscar estatísticas:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
