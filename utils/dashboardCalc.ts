// utils/dashboardCalc.ts
// Cálculos puros do Dashboard (extraídos de pages/Dashboard.tsx para ficarem testáveis
// de forma isolada, sem render). Nenhuma mudança de comportamento em relação à versão
// que vivia inline no componente.

/**
 * Tendência de receita: compara a soma da primeira metade do histórico com a soma
 * da segunda metade do array `revenueChart` (variação percentual arredondada).
 *
 * Regras (mantidas idênticas ao código original):
 * - menos de 2 pontos            -> `null` (o card omite a tag de tendência)
 * - primeira metade === 0 e
 *     segunda metade > 0          -> `100`
 *     segunda metade === 0        -> `0`
 * - caso geral                   -> `round((segunda - primeira) / primeira * 100)`
 */
export function calcRevenueTrend(
  revenueChart: ReadonlyArray<{ value: number }> | null | undefined
): number | null {
  if (!revenueChart || revenueChart.length < 2) return null;

  const half = Math.floor(revenueChart.length / 2);
  const firstHalf = revenueChart.slice(0, half).reduce((s, d) => s + d.value, 0);
  const secondHalf = revenueChart.slice(half).reduce((s, d) => s + d.value, 0);

  if (firstHalf === 0) return secondHalf > 0 ? 100 : 0;
  return Math.round(((secondHalf - firstHalf) / firstHalf) * 100);
}
