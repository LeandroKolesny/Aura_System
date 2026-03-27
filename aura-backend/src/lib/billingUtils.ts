// aura-backend/src/lib/billingUtils.ts
// Utilitários de billing: resolução de plano para webhook Asaas

const VALID_PLANS = new Set(['STARTER', 'PROFESSIONAL', 'PREMIUM'])

const VALUE_TO_PLAN: Record<number, string> = {
  97: 'STARTER',
  197: 'PROFESSIONAL',
  397: 'PREMIUM',
}

/**
 * Resolve o plano a partir dos dados de um pagamento Asaas.
 *
 * Prioridade:
 * 1. externalReference (planId salvo no checkout como enum, ex: "STARTER")
 * 2. Mapeamento por valor do pagamento (fallback para retrocompatibilidade)
 * 3. "STARTER" como default final
 */
export function resolvePlanFromPayment(payment: {
  externalReference?: string | null
  value: number
}): string {
  if (payment.externalReference && VALID_PLANS.has(payment.externalReference)) {
    return payment.externalReference
  }
  return VALUE_TO_PLAN[payment.value] ?? 'STARTER'
}
