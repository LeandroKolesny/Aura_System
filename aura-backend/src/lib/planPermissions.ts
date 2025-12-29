// Aura System - Verificação de Permissões por Plano
// REGRA DE NEGÓCIO CRÍTICA - Executada no servidor

type Plan = "FREE" | "BASIC" | "PROFESSIONAL" | "PREMIUM" | "ENTERPRISE";
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

// Permissões por plano (espelho do frontend, mas AUTORIDADE está aqui)
export const PLAN_PERMISSIONS: Record<Plan, SystemModule[]> = {
  // FREE: Trial de 15 dias - acesso total
  FREE: [
    "online_booking",
    "financial",
    "support",
    "crm",
    "ai_features",
    "multi_user",
    "reports",
    "inventory",
    "photos",
  ],
  // BASIC: Plano expirado - apenas leitura (verificado separadamente)
  BASIC: [
    "online_booking",
    "financial",
    "support",
    "crm",
    "ai_features",
    "multi_user",
    "reports",
    "inventory",
    "photos",
  ],
  // PROFESSIONAL: Starter
  PROFESSIONAL: ["online_booking", "financial", "support", "inventory"],
  // PREMIUM: Pro
  PREMIUM: [
    "online_booking",
    "financial",
    "support",
    "crm",
    "ai_features",
    "inventory",
    "photos",
  ],
  // ENTERPRISE: Clinic - tudo liberado
  ENTERPRISE: [
    "online_booking",
    "financial",
    "support",
    "crm",
    "ai_features",
    "multi_user",
    "reports",
    "inventory",
    "photos",
  ],
};

// Limites por plano
export const PLAN_LIMITS: Record<Plan, { patients: number; professionals: number }> = {
  FREE: { patients: 50, professionals: 1 },
  BASIC: { patients: 0, professionals: 0 }, // Bloqueado
  PROFESSIONAL: { patients: 200, professionals: 1 },
  PREMIUM: { patients: -1, professionals: 3 }, // -1 = ilimitado
  ENTERPRISE: { patients: -1, professionals: -1 },
};

interface CompanyInfo {
  plan: Plan;
  subscriptionStatus: SubscriptionStatus;
  subscriptionExpiresAt: Date | null;
}

/**
 * Verifica se a empresa tem acesso a um módulo específico
 */
export function hasModuleAccess(company: CompanyInfo, module: SystemModule): boolean {
  // Assinatura cancelada ou vencida = sem acesso
  if (company.subscriptionStatus === "CANCELED") {
    return false;
  }

  // Verificar se expirou
  if (company.subscriptionExpiresAt && new Date(company.subscriptionExpiresAt) < new Date()) {
    return false;
  }

  const allowedModules = PLAN_PERMISSIONS[company.plan] || [];
  return allowedModules.includes(module);
}

/**
 * Verifica se a empresa está em modo somente leitura (plano expirado)
 */
export function isReadOnlyMode(company: CompanyInfo): boolean {
  // BASIC = plano expirado
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
export function canCreatePatient(company: CompanyInfo, currentCount: number): boolean {
  if (isReadOnlyMode(company)) return false;

  const limit = PLAN_LIMITS[company.plan]?.patients ?? 0;
  if (limit === -1) return true; // Ilimitado
  return currentCount < limit;
}

/**
 * Verifica se atingiu limite de profissionais
 */
export function canCreateProfessional(company: CompanyInfo, currentCount: number): boolean {
  if (isReadOnlyMode(company)) return false;

  const limit = PLAN_LIMITS[company.plan]?.professionals ?? 0;
  if (limit === -1) return true;
  return currentCount < limit;
}

/**
 * Retorna mensagem de erro apropriada para plano
 */
export function getPlanErrorMessage(company: CompanyInfo, module?: SystemModule): string {
  if (company.subscriptionStatus === "CANCELED") {
    return "Sua assinatura foi cancelada. Reative para continuar usando o sistema.";
  }

  if (isReadOnlyMode(company)) {
    return "Seu plano expirou. O sistema está em modo somente leitura.";
  }

  if (module && !hasModuleAccess(company, module)) {
    return `O módulo "${module}" não está disponível no seu plano atual. Faça upgrade para acessar.`;
  }

  return "Acesso negado. Verifique seu plano.";
}

