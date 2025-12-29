// Aura System - Sistema de Auditoria
// Registra todas as ações críticas do sistema

import prisma from "@/lib/prisma";

// Tipos de atividade existentes no schema
type ActivityType =
  | "PATIENT_CREATED"
  | "PATIENT_UPDATED"
  | "CONSENT_SIGNED"
  | "APPOINTMENT_CREATED"
  | "APPOINTMENT_CONFIRMED"
  | "APPOINTMENT_COMPLETED"
  | "APPOINTMENT_CANCELED"
  | "PAYMENT_RECEIVED"
  | "EXPENSE_CREATED"
  | "STOCK_ADJUSTED"
  | "STOCK_LOW_ALERT"
  | "USER_LOGIN"
  | "USER_LOGOUT"
  | "SETTINGS_CHANGED";

interface AuditLogParams {
  type: ActivityType;
  title: string;
  description?: string;
  userId: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Registra uma atividade no log de auditoria
 * Função assíncrona que não bloqueia a resposta
 */
export async function logActivity(params: AuditLogParams): Promise<void> {
  try {
    await prisma.activity.create({
      data: {
        type: params.type,
        title: params.title,
        description: params.description,
        userId: params.userId,
        metadata: params.metadata || {},
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
  } catch (error) {
    // Log de erro não deve quebrar a operação principal
    console.error("[AUDIT] Falha ao registrar atividade:", error);
  }
}

/**
 * Extrai informações do request para auditoria
 */
export function getRequestInfo(request: Request): {
  ipAddress: string;
  userAgent: string;
} {
  const forwarded = request.headers.get("x-forwarded-for");
  const ipAddress = forwarded
    ? forwarded.split(",")[0].trim()
    : request.headers.get("x-real-ip") || "unknown";

  const userAgent = request.headers.get("user-agent") || "unknown";

  return { ipAddress, userAgent };
}

/**
 * Log de login bem-sucedido
 */
export async function logLogin(
  userId: string,
  email: string,
  request: Request
): Promise<void> {
  const { ipAddress, userAgent } = getRequestInfo(request);
  await logActivity({
    type: "USER_LOGIN",
    title: `Login realizado: ${email}`,
    userId,
    ipAddress,
    userAgent,
    metadata: { email },
  });
}

/**
 * Log de falha de login (para detecção de ataques)
 * Nota: Não temos userId, então registramos de outra forma
 */
export async function logLoginFailure(
  email: string,
  reason: string,
  request: Request
): Promise<void> {
  const { ipAddress, userAgent } = getRequestInfo(request);
  console.warn(`[SECURITY] Login falhou - Email: ${email}, IP: ${ipAddress}, Razão: ${reason}`);
  // Em produção, enviar para serviço de monitoramento (Sentry, etc.)
}

/**
 * Log de ação financeira
 */
export async function logFinancialAction(
  userId: string,
  action: "PAYMENT_RECEIVED" | "EXPENSE_CREATED",
  amount: number,
  description: string,
  metadata?: Record<string, any>
): Promise<void> {
  await logActivity({
    type: action,
    title: `${action === "PAYMENT_RECEIVED" ? "Pagamento" : "Despesa"}: R$ ${amount.toFixed(2)}`,
    description,
    userId,
    metadata: { amount, ...metadata },
  });
}

/**
 * Log de alteração de configurações
 */
export async function logSettingsChange(
  userId: string,
  setting: string,
  oldValue: any,
  newValue: any
): Promise<void> {
  await logActivity({
    type: "SETTINGS_CHANGED",
    title: `Configuração alterada: ${setting}`,
    userId,
    metadata: { setting, oldValue, newValue },
  });
}

