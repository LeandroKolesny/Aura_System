// Query Builders Reutilizáveis
// Permitem queries com ou sem filtro de companyId (para OWNER ver tudo)

import prisma from "@/lib/prisma";
import { Prisma, type PatientStatus, type AppointmentStatus, type TransactionType, type SubscriptionStatus } from "@prisma/client";

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

  const where: Prisma.PatientWhereInput = {};

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
    where.status = status as PatientStatus;
  }

  const [patients, total] = await Promise.all([
    prisma.patient.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      // Seleção explícita: a visão global do King (Owner) NÃO deve trafegar
      // dados sensíveis/LGPD (cpf, anamnese, assinatura de consentimento) —
      // só o necessário para a listagem agregada de pacientes por clínica.
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        birthDate: true,
        lastVisit: true,
        createdAt: true,
        companyId: true,
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

  const where: Prisma.AppointmentWhereInput = {};

  if (companyId) {
    where.companyId = companyId;
  }

  if (startDate || endDate) {
    where.date = {
      ...(startDate ? { gte: new Date(startDate) } : {}),
      ...(endDate ? { lte: new Date(endDate) } : {}),
    };
  }
  if (status && status !== "all") where.status = status as AppointmentStatus;

  const [appointments, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { date: "desc" },
      // Seleção explícita: a visão global do King (Owner) não deve trafegar
      // dados sensíveis (assinatura de consentimento/notas clínicas) — só o
      // necessário para a listagem agregada de agendamentos por clínica.
      select: {
        id: true,
        date: true,
        durationMinutes: true,
        price: true,
        status: true,
        notes: true,
        createdAt: true,
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

  const where: Prisma.TransactionWhereInput = {};

  if (companyId) {
    where.companyId = companyId;
  }

  if (startDate || endDate) {
    where.date = {
      ...(startDate ? { gte: new Date(startDate) } : {}),
      ...(endDate ? { lte: new Date(endDate) } : {}),
    };
  }
  if (type && type !== "all") where.type = type as TransactionType;

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

  const where: Prisma.CompanyWhereInput = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { slug: { contains: search, mode: "insensitive" } },
    ];
  }

  if (status && status !== "all") {
    where.subscriptionStatus = status as SubscriptionStatus;
  }

  const [companies, total] = await Promise.all([
    prisma.company.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      // Seleção explícita: a listagem global do King não precisa (e não deve)
      // trafegar dados internos de billing (IDs do Asaas) nem configurações
      // internas de negócio (horários, booking online, layout público).
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        // BUG CORRIGIDO: faltava aqui — sem esse campo, `KingRevenue.tsx`
        // (MRR em Risco / lista de Inadimplentes) sempre recebe `lastPlan:
        // undefined`, caindo no fallback `c.lastPlan || c.plan`, que usa
        // `c.plan` (já BASIC/preço 0 após o cron de expiração ter rebaixado
        // a empresa) em vez do plano efetivamente perdido. Resultado: "MRR em
        // Risco" sempre mostrava R$ 0,00 e a lista de inadimplentes sempre
        // rotulava "Era: BASIC" independente do plano real anterior.
        lastPlan: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
        createdAt: true,
        isActive: true,
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
