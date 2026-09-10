// utils/financialCalculations.ts
// Funções puras de cálculo do Financeiro da Clínica (extraídas de pages/Financial.tsx).
// Mantidas fora do componente para poderem ser testadas isoladamente — o comportamento
// deve ser idêntico ao que estava inline no componente.

import { Transaction } from '../types';

/**
 * Parcela futura (2ª em diante) de um parcelamento.
 * Essas linhas devem ser posicionadas no calendário pela `dueDate`, não pela `date`
 * (que é a data em que o parcelamento foi criado, sempre no mês da 1ª parcela).
 */
export function isFutureInstallment(t: Transaction): boolean {
  return !!(
    t.type === 'income' &&
    t.installments &&
    t.installments > 1 &&
    t.installmentIndex &&
    t.installmentIndex > 1
  );
}

/** Data efetiva usada para posicionar a transação no mês correto. */
export function effectiveDate(t: Transaction): string {
  return isFutureInstallment(t) && t.dueDate ? t.dueDate : t.date;
}

/** Filtra as transações que caem no mês/ano informados (0-11 para o mês). */
export function filterByMonth(
  transactions: Transaction[],
  month: number,
  year: number
): Transaction[] {
  return transactions.filter((t) => {
    const d = new Date(effectiveDate(t));
    return d.getMonth() === month && d.getFullYear() === year;
  });
}

/** Soma das receitas de um conjunto (normalmente já filtrado por mês). */
export function totalRevenue(transactions: Transaction[]): number {
  return transactions
    .filter((t) => t.type === 'income')
    .reduce((acc, t) => acc + t.amount, 0);
}

/** Soma das despesas de um conjunto (normalmente já filtrado por mês). */
export function totalCost(transactions: Transaction[]): number {
  return transactions
    .filter((t) => t.type === 'expense')
    .reduce((acc, t) => acc + t.amount, 0);
}

/**
 * Saldo acumulado (all-time): receitas menos despesas de TODAS as transações
 * visíveis, sem filtro de mês nem de status.
 */
export function allTimeBalance(transactions: Transaction[]): number {
  return transactions.reduce(
    (acc, t) => (t.type === 'income' ? acc + t.amount : acc - t.amount),
    0
  );
}

/**
 * Total "A Receber": soma de todas as parcelas de receita ainda `pending`
 * (com `installmentGroupId`), de qualquer mês.
 */
export function pendingInstallments(transactions: Transaction[]): number {
  return transactions
    .filter((t) => t.type === 'income' && t.status === 'pending' && t.installmentGroupId)
    .reduce((sum, t) => sum + Number(t.amount), 0);
}

export interface Trend {
  value: number;
  label: string;
}

/**
 * Variação percentual do valor atual vs. o mês anterior.
 * - `prev === 0 && current === 0` → sem trend (undefined)
 * - `prev === 0 && current > 0` → 100%
 * - demais casos → percentual arredondado (pode ser negativo)
 */
export function calcTrend(
  current: number,
  prev: number,
  label: string
): Trend | undefined {
  if (prev === 0 && current === 0) return undefined;
  if (prev === 0) return { value: 100, label };
  const pct = Math.round(((current - prev) / prev) * 100);
  return { value: pct, label };
}

export interface TransactionGroup {
  key: string;
  income?: Transaction;
  expense?: Transaction;
  standalone?: Transaction;
  date: string;
}

/**
 * Agrupa as transações do mês por `appointmentId` (receita + despesa do mesmo
 * atendimento na mesma linha). Casos especiais:
 * - Parcelas 2..N viram linhas `standalone` isoladas (`installment_<id>`),
 *   posicionadas pela `dueDate` — não somam custo de novo.
 * - Transações sem `appointmentId` (avulsas) também viram `standalone`.
 * Ordena por data decrescente.
 */
export function groupedTransactions(
  monthTransactions: Transaction[]
): TransactionGroup[] {
  const groups: Record<
    string,
    { income?: Transaction; expense?: Transaction; standalone?: Transaction }
  > = {};

  monthTransactions.forEach((t) => {
    if (t.appointmentId) {
      if (
        t.type === 'income' &&
        t.installments &&
        t.installments > 1 &&
        t.installmentIndex &&
        t.installmentIndex > 1
      ) {
        groups[`installment_${t.id}`] = { standalone: t };
        return;
      }
      if (!groups[t.appointmentId]) {
        groups[t.appointmentId] = {};
      }
      if (t.type === 'income') {
        groups[t.appointmentId].income = t;
      } else {
        groups[t.appointmentId].expense = t;
      }
    } else {
      groups[t.id] = { standalone: t };
    }
  });

  return Object.entries(groups)
    .map(([key, group]) => ({
      key,
      ...group,
      date:
        group.standalone?.dueDate ||
        group.standalone?.date ||
        group.income?.date ||
        group.expense?.date ||
        '',
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
