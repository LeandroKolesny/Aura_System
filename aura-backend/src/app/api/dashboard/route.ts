// Aura System - API de Dashboard
// Métricas e estatísticas consolidadas - OTIMIZADA
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

// Cache headers helper
function createCachedResponse(data: any, cacheSeconds: number = 30) {
  const response = NextResponse.json(data);
  // Cache por 30 segundos, stale-while-revalidate por 60 segundos
  response.headers.set(
    "Cache-Control",
    `private, s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 2}`
  );
  return response;
}

// GET - Obter métricas do dashboard (otimizado para performance)
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    if (!user.companyId) {
      return NextResponse.json({ error: "Usuário sem empresa" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "7"); // 7 ou 30 dias

    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Executar todas as queries em paralelo para máxima performance
    const [
      // KPIs principais
      periodTransactions,
      periodAppointments,
      completedAppointments,
      canceledAppointments,

      // Estoque baixo
      lowStockItems,

      // Top procedimentos
      topProceduresRaw,

      // Receita diária para gráfico
      dailyRevenue,
    ] = await Promise.all([
      // Transações do período (receita)
      prisma.transaction.aggregate({
        where: {
          companyId: user.companyId,
          type: "INCOME",
          status: "PAID",
          date: { gte: startDate },
        },
        _sum: { amount: true },
        _count: true,
      }),

      // Total de agendamentos no período
      prisma.appointment.count({
        where: { companyId: user.companyId, date: { gte: startDate } },
      }),

      // Agendamentos concluídos (pacientes atendidos únicos)
      prisma.appointment.findMany({
        where: {
          companyId: user.companyId,
          date: { gte: startDate },
          status: "COMPLETED"
        },
        select: { patientId: true },
        distinct: ["patientId"],
      }),

      // Agendamentos cancelados
      prisma.appointment.count({
        where: {
          companyId: user.companyId,
          date: { gte: startDate },
          status: "CANCELED"
        },
      }),

      // Itens com estoque baixo
      prisma.inventoryItem.findMany({
        where: { companyId: user.companyId, isActive: true },
        select: { id: true, name: true, currentStock: true, minStock: true, unit: true },
      }),

      // Top 5 procedimentos
      prisma.appointment.groupBy({
        by: ["procedureId"],
        where: {
          companyId: user.companyId,
          date: { gte: startDate },
          status: { not: "CANCELED" }
        },
        _count: { procedureId: true },
        orderBy: { _count: { procedureId: "desc" } },
        take: 5,
      }),

      // Receita diária para gráfico (agregação por dia)
      prisma.$queryRaw<{ date: Date; total: number }[]>`
        SELECT
          DATE("date") as date,
          COALESCE(SUM(amount), 0) as total
        FROM "transactions"
        WHERE "companyId" = ${user.companyId}
          AND "type" = 'INCOME'
          AND "status" = 'PAID'
          AND "date" >= ${startDate}
        GROUP BY DATE("date")
        ORDER BY date ASC
      `,
    ]);

    // Processar estoque baixo
    const lowStock = lowStockItems.filter(
      (item) => Number(item.currentStock) <= Number(item.minStock)
    );

    // Buscar nomes dos procedimentos
    const procedureIds = topProceduresRaw.map((p) => p.procedureId).filter(Boolean);
    const procedures = procedureIds.length > 0
      ? await prisma.procedure.findMany({
          where: { id: { in: procedureIds } },
          select: { id: true, name: true },
        })
      : [];

    const topProcedures = topProceduresRaw.map((p) => ({
      name: procedures.find((proc) => proc.id === p.procedureId)?.name || "Outro",
      count: p._count.procedureId,
    }));

    // Calcular KPIs
    const revenue = Number(periodTransactions._sum.amount || 0);
    const transactionCount = periodTransactions._count || 0;
    const seenPatients = completedAppointments.length;
    const cancelRate = periodAppointments > 0
      ? (canceledAppointments / periodAppointments) * 100
      : 0;
    const ticketMedio = transactionCount > 0 ? revenue / transactionCount : 0;

    // Formatar receita diária para o gráfico
    const revenueChart = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dateKey = d.toISOString().split('T')[0];

      const dayData = dailyRevenue.find(
        (r) => new Date(r.date).toISOString().split('T')[0] === dateKey
      );

      revenueChart.push({
        date: dateKey,
        name: days <= 7
          ? d.toLocaleDateString('pt-BR', { weekday: 'short' })
          : d.toLocaleDateString('pt-BR', { day: '2-digit' }),
        value: Number(dayData?.total || 0),
      });
    }

    const responseData = {
      kpis: {
        revenue,
        ticketMedio,
        seenPatients,
        cancelRate: Math.round(cancelRate * 10) / 10,
        appointmentsTotal: periodAppointments,
        appointmentsConfirmed: periodAppointments - canceledAppointments,
        appointmentsCanceled: canceledAppointments,
      },
      charts: {
        revenueChart,
        topProcedures,
      },
      alerts: {
        lowStock: lowStock.map(item => ({
          id: `inv_${item.id}`,
          title: `Estoque Baixo: ${item.name}`,
          message: `${item.currentStock} ${item.unit} restantes (mínimo: ${item.minStock})`,
          type: 'warning',
        })),
      },
      days,
      _meta: {
        queryTimeMs: Date.now() - startTime,
      },
    };

    // Retorna com cache headers (30 segundos)
    return createCachedResponse(responseData, 30);
  } catch (error) {
    console.error("Erro ao buscar métricas:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

