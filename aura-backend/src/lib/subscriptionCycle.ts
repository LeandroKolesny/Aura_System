// Aura System - Clube de Assinaturas: renovação de ciclo
//
// Lógica compartilhada de "resetar sessões do ciclo" usada tanto pelo webhook do
// Asaas (SUBSCRIPTION_PAYMENT_RECEIVED) quanto pelo cron diário
// (/api/cron/reset-subscription-cycles) que cobre assinaturas inscritas
// manualmente pela clínica (sem asaasSubscriptionId). Não duplicar esta regra.

interface PlanItemLike {
  procedureId: string;
}

export interface CycleResetData {
  sessionsUsedThisCycle: Record<string, number>;
  lastCycleReset: Date;
  nextBillingDate: Date;
}

/**
 * Monta o `data` de update que renova o ciclo de uma PatientSubscription:
 *  - zera `sessionsUsedThisCycle` para TODOS os procedimentos do plano ATUAL
 *    (recalculado a partir dos items recebidos — reflete edições no plano);
 *  - marca `lastCycleReset` no instante `now`;
 *  - avança `nextBillingDate` em 1 mês a partir de `now`.
 */
export function buildCycleResetData(
  planItems: PlanItemLike[],
  now: Date = new Date(),
): CycleResetData {
  const sessionsUsedThisCycle: Record<string, number> = {};
  for (const item of planItems) {
    sessionsUsedThisCycle[item.procedureId] = 0;
  }

  const nextBillingDate = new Date(now);
  nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

  return {
    sessionsUsedThisCycle,
    lastCycleReset: new Date(now),
    nextBillingDate,
  };
}
