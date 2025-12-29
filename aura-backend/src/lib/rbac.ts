// Aura System - Role-Based Access Control (RBAC)
// Controle de acesso centralizado baseado em roles

import { AuthUser } from "./auth";

// Definição de permissões por recurso
export type Resource =
  | "patients"
  | "appointments"
  | "procedures"
  | "transactions"
  | "inventory"
  | "professionals"
  | "settings"
  | "reports";

export type Action = "create" | "read" | "update" | "delete" | "manage";

// Matriz de permissões por role
const PERMISSIONS: Record<string, Record<Resource, Action[]>> = {
  OWNER: {
    patients: ["create", "read", "update", "delete", "manage"],
    appointments: ["create", "read", "update", "delete", "manage"],
    procedures: ["create", "read", "update", "delete", "manage"],
    transactions: ["create", "read", "update", "delete", "manage"],
    inventory: ["create", "read", "update", "delete", "manage"],
    professionals: ["create", "read", "update", "delete", "manage"],
    settings: ["create", "read", "update", "delete", "manage"],
    reports: ["read", "manage"],
  },
  ADMIN: {
    patients: ["create", "read", "update", "delete"],
    appointments: ["create", "read", "update", "delete"],
    procedures: ["create", "read", "update", "delete"],
    transactions: ["create", "read", "update", "delete"],
    inventory: ["create", "read", "update", "delete"],
    professionals: ["create", "read", "update", "delete"],
    settings: ["read", "update"],
    reports: ["read"],
  },
  RECEPTIONIST: {
    patients: ["create", "read", "update"],
    appointments: ["create", "read", "update"],
    procedures: ["read"],
    transactions: ["create", "read"],
    inventory: ["read"],
    professionals: ["read"],
    settings: ["read"],
    reports: [],
  },
  ESTHETICIAN: {
    patients: ["read", "update"],
    appointments: ["read", "update"],
    procedures: ["read"],
    transactions: [],
    inventory: ["read"],
    professionals: ["read"],
    settings: [],
    reports: [],
  },
  PATIENT: {
    patients: ["read"], // Apenas próprios dados
    appointments: ["read", "create"], // Apenas próprios agendamentos
    procedures: ["read"],
    transactions: ["read"], // Apenas próprias transações
    inventory: [],
    professionals: ["read"],
    settings: [],
    reports: [],
  },
};

/**
 * Verifica se o usuário tem permissão para executar uma ação em um recurso
 */
export function hasPermission(
  user: AuthUser,
  resource: Resource,
  action: Action
): boolean {
  const rolePermissions = PERMISSIONS[user.role];
  if (!rolePermissions) return false;

  const resourcePermissions = rolePermissions[resource];
  if (!resourcePermissions) return false;

  // "manage" implica todas as ações
  if (resourcePermissions.includes("manage")) return true;

  return resourcePermissions.includes(action);
}

/**
 * Verifica se o usuário pode acessar dados de uma empresa específica
 */
export function canAccessCompany(user: AuthUser, companyId: string): boolean {
  // OWNER pode acessar todas as empresas (para o SaaS admin)
  if (user.role === "OWNER") return true;
  
  // Outros roles só podem acessar sua própria empresa
  return user.companyId === companyId;
}

/**
 * Verifica se o usuário pode acessar dados de um paciente específico
 * Pacientes só podem acessar seus próprios dados
 */
export function canAccessPatientData(
  user: AuthUser,
  patientEmail: string
): boolean {
  if (user.role === "PATIENT") {
    return user.email === patientEmail;
  }
  return true; // Outros roles podem acessar qualquer paciente da empresa
}

/**
 * Retorna as permissões do usuário para um recurso
 */
export function getPermissions(user: AuthUser, resource: Resource): Action[] {
  const rolePermissions = PERMISSIONS[user.role];
  if (!rolePermissions) return [];
  return rolePermissions[resource] || [];
}

/**
 * Helper para verificar se é admin (OWNER ou ADMIN)
 */
export function isAdminRole(user: AuthUser): boolean {
  return ["OWNER", "ADMIN"].includes(user.role);
}

/**
 * Helper para verificar se pode gerenciar financeiro
 */
export function canManageFinancials(user: AuthUser): boolean {
  return hasPermission(user, "transactions", "manage") ||
         hasPermission(user, "transactions", "create");
}

/**
 * Helper para verificar se pode gerenciar estoque
 */
export function canManageInventory(user: AuthUser): boolean {
  return hasPermission(user, "inventory", "update") ||
         hasPermission(user, "inventory", "manage");
}

