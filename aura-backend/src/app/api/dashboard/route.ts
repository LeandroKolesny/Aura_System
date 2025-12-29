// Aura System - API de Dashboard
// Métricas e estatísticas consolidadas
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

// GET - Obter métricas do dashboard
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
    const period = searchParams.get("period") || "month"; // day, week, month, year

    // Calcular datas do período
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case "day":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "week":
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default: // month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Executar todas as queries em paralelo
    const [
      appointmentsToday,
      appointmentsTotal,
      patientsTotal,
      newPatientsMonth,
      revenueData,
      expenseData,
      lowStockItems,
      recentActivities,
      appointmentsByStatus,
      topProcedures,
    ] = await Promise.all([
      // Agendamentos de hoje
      prisma.appointment.count({
        where: {
          companyId: user.companyId,
          date: {
            gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
            lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
          },
          status: { in: ["SCHEDULED", "CONFIRMED"] },
        },
      }),

      // Total de agendamentos no período
      prisma.appointment.count({
        where: { companyId: user.companyId, date: { gte: startDate } },
      }),

      // Total de pacientes
      prisma.patient.count({ where: { companyId: user.companyId } }),

      // Novos pacientes no mês
      prisma.patient.count({
        where: {
          companyId: user.companyId,
          createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) },
        },
      }),

      // Receita do período
      prisma.transaction.aggregate({
        where: {
          companyId: user.companyId,
          type: "INCOME",
          status: "PAID",
          date: { gte: startDate },
        },
        _sum: { amount: true },
      }),

      // Despesas do período
      prisma.transaction.aggregate({
        where: {
          companyId: user.companyId,
          type: "EXPENSE",
          status: "PAID",
          date: { gte: startDate },
        },
        _sum: { amount: true },
      }),

      // Itens com estoque baixo
      prisma.inventoryItem.findMany({
        where: { companyId: user.companyId, isActive: true },
        select: { id: true, name: true, currentStock: true, minStock: true, unit: true },
      }),

      // Atividades recentes
      prisma.activity.findMany({
        where: { user: { companyId: user.companyId } },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { user: { select: { name: true } } },
      }),

      // Agendamentos por status
      prisma.appointment.groupBy({
        by: ["status"],
        where: { companyId: user.companyId, date: { gte: startDate } },
        _count: true,
      }),

      // Top procedimentos
      prisma.appointment.groupBy({
        by: ["procedureId"],
        where: { companyId: user.companyId, date: { gte: startDate }, status: "COMPLETED" },
        _count: true,
        orderBy: { _count: { procedureId: "desc" } },
        take: 5,
      }),
    ]);

    // Filtrar itens com estoque baixo
    const lowStock = lowStockItems.filter(
      (item) => Number(item.currentStock) <= Number(item.minStock)
    );

    // Buscar nomes dos procedimentos top
    const procedureIds = topProcedures.map((p) => p.procedureId);
    const procedures = await prisma.procedure.findMany({
      where: { id: { in: procedureIds } },
      select: { id: true, name: true },
    });

    const topProceduresWithNames = topProcedures.map((p) => ({
      ...p,
      name: procedures.find((proc) => proc.id === p.procedureId)?.name || "Desconhecido",
    }));

    const revenue = Number(revenueData._sum.amount || 0);
    const expenses = Number(expenseData._sum.amount || 0);

    return NextResponse.json({
      metrics: {
        appointmentsToday,
        appointmentsTotal,
        patientsTotal,
        newPatientsMonth,
        revenue,
        expenses,
        profit: revenue - expenses,
        lowStockCount: lowStock.length,
      },
      charts: {
        appointmentsByStatus,
        topProcedures: topProceduresWithNames,
      },
      alerts: {
        lowStock,
      },
      recentActivities,
      period,
    });
  } catch (error) {
    console.error("Erro ao buscar métricas:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

