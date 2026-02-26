// Aura System - Verificação de Permissões por Plano
// REGRA DE NEGÓCIO CRÍTICA - Executada no servidor
// FONTE DA VERDADE: Tabela SaasPlan no banco de dados

import prisma from "@/lib/prisma";

type Plan = "FREE" | "BASIC" | "STARTER" | "PROFESSIONAL" | "PREMIUM" | "ENTERPRISE";
type SubscriptionStatus = "ACTIVE" | "TRIAL" | "OVERDUE" | "CANCELED";

// Módulos do sistema
export type SystemModule =
  | "online_booking"
  | "financial"
  | "support"
  | "crm"
  | "ai_features"
  | "multi_user"
  | "reports"
  | "inventory"
  | "photos";

interface CompanyInfo {
  plan: Plan;
  subscriptionStatus: SubscriptionStatus;
  subscriptionExpiresAt: Date | null;
}

interface PlanData {
  name: string;
  modules: string[];
  maxPatients: number;
  maxProfessionals: number;
}

// Cache de planos (recarrega a cada 5 minutos)
let plansCache: Map<string, PlanData> = new Map();
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Carrega planos do banco de dados com cache
 */
async function loadPlansFromDB(): Promise<Map<string, PlanData>> {
  const now = Date.now();

  // Retorna cache se ainda válido
  if (plansCache.size > 0 && (now - cacheTimestamp) < CACHE_TTL) {
    return plansCache;
  }

  try {
    const plans = await prisma.saasPlan.findMany({
      where: { isActive: true },
      select: {
        name: true,
        modules: true,
        maxPatients: true,
        maxProfessionals: true,
      },
    });

    plansCache = new Map();
    for (const plan of plans) {
      plansCache.set(plan.name, {
        name: plan.name,
        modules: plan.modules,
        maxPatients: plan.maxPatients,
        maxProfessionals: plan.maxProfessionals,
      });
    }
    cacheTimestamp = now;

    return plansCache;
  } catch (error) {
    console.error("Erro ao carregar planos do banco:", error);
    // Se falhar, retorna cache antigo ou vazio
    return plansCache;
  }
}

/**
 * Obtém dados de um plano específico
 */
async function getPlanData(planName: string): Promise<PlanData | null> {
  const plans = await loadPlansFromDB();
  return plans.get(planName) || null;
}

/**
 * Verifica se a empresa tem acesso a um módulo específico
 */
export async function hasModuleAccess(company: CompanyInfo, module: SystemModule): Promise<boolean> {
  // Assinatura cancelada = sem acesso
  if (company.subscriptionStatus === "CANCELED") {
    return false;
  }

  // Verificar se expirou
  if (company.subscriptionExpiresAt && new Date(company.subscriptionExpiresAt) < new Date()) {
    return false;
  }

  const planData = await getPlanData(company.plan);
  if (!planData) {
    console.warn(`Plano não encontrado: ${company.plan}`);
    return false;
  }

  return planData.modules.includes(module);
}

/**
 * Verifica se a empresa está em modo somente leitura (plano expirado)
 */
export function isReadOnlyMode(company: CompanyInfo): boolean {
  // BASIC = plano expirado/bloqueado
  if (company.plan === "BASIC") {
    return true;
  }

  // Assinatura vencida
  if (company.subscriptionStatus === "OVERDUE") {
    return true;
  }

  // Trial expirado
  if (
    company.subscriptionStatus === "TRIAL" &&
    company.subscriptionExpiresAt &&
    new Date(company.subscriptionExpiresAt) < new Date()
  ) {
    return true;
  }

  return false;
}

/**
 * Verifica se atingiu limite de pacientes
 */
export async function canCreatePatient(company: CompanyInfo, currentCount: number): Promise<boolean> {
  if (isReadOnlyMode(company)) return false;

  const planData = await getPlanData(company.plan);
  if (!planData) return false;

  const limit = planData.maxPatients;
  if (limit === -1) return true; // Ilimitado
  return currentCount < limit;
}

/**
 * Verifica se atingiu limite de profissionais
 */
export async function canCreateProfessional(company: CompanyInfo, currentCount: number): Promise<boolean> {
  if (isReadOnlyMode(company)) return false;

  const planData = await getPlanData(company.plan);
  if (!planData) return false;

  const limit = planData.maxProfessionals;
  if (limit === -1) return true;
  return currentCount < limit;
}

/**
 * Retorna mensagem de erro apropriada para plano
 */
export async function getPlanErrorMessage(company: CompanyInfo, module?: SystemModule): Promise<string> {
  if (company.subscriptionStatus === "CANCELED") {
    return "Sua assinatura foi cancelada. Reative para continuar usando o sistema.";
  }

  if (isReadOnlyMode(company)) {
    return "Seu plano expirou. O sistema está em modo somente leitura.";
  }

  if (module) {
    const hasAccess = await hasModuleAccess(company, module);
    if (!hasAccess) {
      return `O módulo "${module}" não está disponível no seu plano atual. Faça upgrade para acessar.`;
    }
  }

  return "Acesso negado. Verifique seu plano.";
}

/**
 * Força recarga do cache de planos
 */
export function invalidatePlansCache(): void {
  cacheTimestamp = 0;
}
