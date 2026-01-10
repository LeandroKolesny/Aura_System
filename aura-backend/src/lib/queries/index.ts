// Query Builders Reutilizáveis
// Permitem queries com ou sem filtro de companyId (para OWNER ver tudo)

import prisma from "@/lib/prisma";

interface QueryOptions {
  companyId?: string; // Se undefined, retorna de todas as empresas
  page?: number;
  limit?: number;
  search?: string;
}

// ============ PATIENTS ============
export async function queryPatients(options: QueryOptions & { status?: string }) {
  const { companyId, page = 1, limit = 100, search, status } = options;
  const skip = (page - 1) * limit;

  const where: any = {};

  // Filtro opcional por empresa
  if (companyId) {
    where.companyId = companyId;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { phone: { contains: search } },
    ];
  }

  if (status && status !== "all") {
    where.status = status;
  }

  const [patients, total] = await Promise.all([
    prisma.patient.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        company: { select: { id: true, name: true, slug: true } },
      },
    }),
    prisma.patient.count({ where }),
  ]);

  return { patients, total, page, limit };
}

// ============ APPOINTMENTS ============
export async function queryAppointments(options: QueryOptions & {
  startDate?: string;
  endDate?: string;
  status?: string;
}) {
  const { companyId, page = 1, limit = 100, startDate, endDate, status } = options;
  const skip = (page - 1) * limit;

  const where: any = {};

  if (companyId) {
    where.companyId = companyId;
  }

  if (startDate) where.date = { ...where.date, gte: new Date(startDate) };
  if (endDate) where.date = { ...where.date, lte: new Date(endDate) };
  if (status && status !== "all") where.status = status;

  const [appointments, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { date: "desc" },
      include: {
        patient: { select: { id: true, name: true } },
        professional: { select: { id: true, name: true } },
        procedure: { select: { id: true, name: true } },
        company: { select: { id: true, name: true, slug: true } },
      },
    }),
    prisma.appointment.count({ where }),
  ]);

  return { appointments, total, page, limit };
}

// ============ TRANSACTIONS ============
export async function queryTransactions(options: QueryOptions & {
  startDate?: string;
  endDate?: string;
  type?: string;
}) {
  const { companyId, page = 1, limit = 100, startDate, endDate, type } = options;
  const skip = (page - 1) * limit;

  const where: any = {};

  if (companyId) {
    where.companyId = companyId;
  }

  if (startDate) where.date = { ...where.date, gte: new Date(startDate) };
  if (endDate) where.date = { ...where.date, lte: new Date(endDate) };
  if (type && type !== "all") where.type = type;

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      skip,
      take: limit,
      orderBy: { date: "desc" },
      include: {
        company: { select: { id: true, name: true, slug: true } },
      },
    }),
    prisma.transaction.count({ where }),
  ]);

  return { transactions, total, page, limit };
}

// ============ COMPANIES ============
export async function queryCompanies(options: QueryOptions & { status?: string }) {
  const { page = 1, limit = 100, search, status } = options;
  const skip = (page - 1) * limit;

  const where: any = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { slug: { contains: search, mode: "insensitive" } },
    ];
  }

  if (status && status !== "all") {
    where.subscriptionStatus = status;
  }

  const [companies, total] = await Promise.all([
    prisma.company.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            patients: true,
            appointments: true,
            users: true,
          },
        },
        users: {
          where: {
            role: { in: ["ADMIN", "OWNER"] },
          },
          select: {
            role: true,
            email: true,
            phone: true,
            name: true,
          },
          take: 1, // Pegar apenas o primeiro admin/owner
        },
      },
    }),
    prisma.company.count({ where }),
  ]);

  // Adicionar flag hasOwner e contato do admin para cada empresa
  const companiesWithFlags = companies.map(c => {
    const adminUser = c.users?.[0];
    return {
      ...c,
      hasOwner: c.users?.some(u => u.role === "OWNER") || false,
      // Dados de contato do admin (para o OWNER entrar em contato)
      adminContact: adminUser ? {
        name: adminUser.name,
        email: adminUser.email,
        phone: adminUser.phone,
      } : null,
      users: undefined, // Remover lista de users
    };
  });

  return { companies: companiesWithFlags, total, page, limit };
}

// ============ DASHBOARD STATS (Global) ============
export async function queryGlobalStats() {
  console.log("🔍 [queryGlobalStats] Iniciando queries...");

  try {
    // Testar conexão primeiro
    await prisma.$connect();
    console.log("✅ [queryGlobalStats] Conectado ao banco");

    const [
      totalCompanies,
      activeCompanies,
      totalPatients,
      totalAppointments,
      todayAppointments,
      monthlyRevenue,
      companies,
    ] = await Promise.all([
      prisma.company.count(),
      prisma.company.count({ where: { subscriptionStatus: "ACTIVE" } }),
      prisma.patient.count(),
      prisma.appointment.count(),
      prisma.appointment.count({
        where: {
          date: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lt: new Date(new Date().setHours(23, 59, 59, 999)),
          },
        },
      }),
      prisma.transaction.aggregate({
        where: {
          type: "INCOME",
          status: "PAID",
          date: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
        _sum: { amount: true },
      }),
      prisma.company.findMany({
        select: {
          id: true,
          name: true,
          plan: true,
          subscriptionStatus: true,
          subscriptionExpiresAt: true,
          users: {
            select: {
              role: true,
            },
          },
        },
      }),
    ]);

    console.log("📊 [queryGlobalStats] Counts:", {
      totalCompanies,
      activeCompanies,
      totalPatients,
      totalAppointments,
      todayAppointments,
      monthlyRevenueRaw: monthlyRevenue._sum.amount,
      companiesFound: companies.length,
    });

    // Calcular MRR baseado nos planos (corrigido para schema Prisma)
    // EXCLUIR empresas que têm usuário OWNER (conta do dono do sistema)
    const PLAN_PRICES: Record<string, number> = {
      FREE: 0,
      BASIC: 97,
      PROFESSIONAL: 197,
      PREMIUM: 297,
      ENTERPRISE: 497,
    };

    const mrr = companies.reduce((acc, c) => {
      // Excluir empresas com usuário OWNER do MRR (não pagam)
      const hasOwnerUser = c.users?.some(u => u.role === "OWNER");
      if (hasOwnerUser) {
        console.log(`  ⏭️ Empresa: ${c.name} - EXCLUÍDA do MRR (OWNER)`);
        return acc;
      }

      const planKey = c.plan?.toUpperCase() || "FREE";
      const planPrice = PLAN_PRICES[planKey] || 0;
      console.log(`  📍 Empresa: ${c.name}, Plano: ${planKey}, Preço: ${planPrice}, Status: ${c.subscriptionStatus}`);
      return acc + (c.subscriptionStatus === "ACTIVE" ? planPrice : 0);
    }, 0);

    const result = {
      totalCompanies,
      activeCompanies,
      totalPatients,
      totalAppointments,
      todayAppointments,
      monthlyRevenue: Number(monthlyRevenue._sum.amount) || 0,
      mrr,
      companiesByPlan: companies.reduce((acc, c) => {
        const plan = c.plan?.toUpperCase() || "FREE";
        acc[plan] = (acc[plan] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    console.log("✅ [queryGlobalStats] Resultado final:", result);
    return result;
  } catch (error) {
    console.error("❌ [queryGlobalStats] Erro:", error);
    throw error;
  }
}
