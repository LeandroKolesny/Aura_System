// utils/reportsCalc.ts
// Funções puras de cálculo da aba "Relatórios BI" / "Análise Geral"
// (extraídas de pages/Reports.tsx). Mantidas fora do componente para poderem
// ser testadas isoladamente — o comportamento deve ser IDÊNTICO ao que estava
// inline nos useMemo do componente.
//
// NOTA (duplicação conhecida): `professionalPerformance` recalcula comissão /
// salário fixo por profissional no cliente. Existe uma implementação equivalente
// e já testada no backend em `GET /api/reports/commissions`
// (aura-backend/src/app/api/reports/commissions/route.ts +
// aura-backend/src/__tests__/api/reports-commissions.test.ts). Esta tela NÃO
// consome esse endpoint hoje. Um refactor futuro deveria unificar as duas
// implementações (consumir o endpoint) para evitar divergência silenciosa.

import { Appointment, Transaction, Procedure, User } from '../types';
import { formatCurrency } from './formatUtils';

/**
 * Valores de `timeRange` aceitos pelo `<select>` de período em Reports.tsx.
 * Mantido aqui para o teste parametrizado garantir que todo range tem label
 * e multiplicador.
 */
export const TIME_RANGES = ['1w', '1m', '2m', '3m', '6m', '1y', '2y', '3y', '4y', '5y'] as const;
export type TimeRange = (typeof TIME_RANGES)[number];

/**
 * Data de início do período selecionado.
 *
 * BUGFIX: a versão antiga fazia `d.setMonth(d.getMonth() - N)` (ou
 * `setFullYear`) SEM fixar o dia antes. Em JS, `setMonth` "estoura" para o mês
 * seguinte quando o mês de destino tem menos dias que o dia atual — ex.: hoje
 * 31/03 + "1 Mês" virava 03/03 (fevereiro só tem 28 dias), começando o período
 * ~3 dias depois do esperado e excluindo silenciosamente transações /
 * atendimentos do início do intervalo.
 *
 * Correção: ao subtrair meses/anos, fixamos o dia no ÚLTIMO dia válido do mês
 * de destino (clamp). Assim 31/03 - 1 mês → 28/02 (e não 03/03 nem 01/02),
 * que é o resultado menos surpreendente e não desloca o início por um mês
 * inteiro. Para `1w` continuamos usando `setDate` (não há overflow de dias).
 *
 * `now` é injetável para testes determinísticos (default: agora).
 */
export function getStartDate(range: string, now: Date = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0); // zera a parte de hora para comparação estável

  const subtractMonths = (months: number): void => {
    // índice absoluto de mês (ano * 12 + mês) para lidar com virada de ano
    const absoluteMonth = d.getFullYear() * 12 + d.getMonth() - months;
    const targetYear = Math.floor(absoluteMonth / 12);
    const targetMonth = ((absoluteMonth % 12) + 12) % 12;
    // dia 0 do mês seguinte = último dia do mês de destino
    const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    d.setFullYear(targetYear, targetMonth, Math.min(d.getDate(), lastDayOfTargetMonth));
  };

  switch (range) {
    case '1w': d.setDate(d.getDate() - 7); break;
    case '1m': subtractMonths(1); break;
    case '2m': subtractMonths(2); break;
    case '3m': subtractMonths(3); break;
    case '6m': subtractMonths(6); break;
    case '1y': subtractMonths(12); break;
    case '2y': subtractMonths(24); break;
    case '3y': subtractMonths(36); break;
    case '4y': subtractMonths(48); break;
    case '5y': subtractMonths(60); break;
    default: subtractMonths(6);
  }
  return d;
}

/** Multiplicador de "meses" do período — usado para aproximar custo de salário fixo. */
export function getMonthMultiplier(range: string): number {
  switch (range) {
    case '1w': return 0.25;
    case '1m': return 1;
    case '2m': return 2;
    case '3m': return 3;
    case '6m': return 6;
    case '1y': return 12;
    case '2y': return 24;
    case '3y': return 36;
    case '4y': return 48;
    case '5y': return 60;
    default: return 1;
  }
}

/** Rótulo humano do período (exibido no header e nos cards). */
export function getTimeRangeLabel(range: string): string {
  switch (range) {
    case '1w': return 'Última Semana';
    case '1m': return 'Último Mês';
    case '2m': return 'Últimos 2 Meses';
    case '3m': return 'Últimos 3 Meses';
    case '6m': return 'Últimos 6 Meses';
    case '1y': return 'Último Ano';
    case '2y': return 'Últimos 2 Anos';
    case '3y': return 'Últimos 3 Anos';
    case '4y': return 'Últimos 4 Anos';
    case '5y': return 'Últimos 5 Anos';
    default: return 'Período';
  }
}

/**
 * Janela do período anterior (para os cálculos de trend). Usa a mesma
 * `getStartDate` corrigida, então também se beneficia do bugfix acima.
 * `now` injetável para testes.
 */
export function getPreviousPeriodDates(
  range: string,
  now: Date = new Date()
): { prevStart: Date; prevEnd: Date } {
  const currentStart = getStartDate(range, now);
  const currentEnd = new Date(now);
  const periodMs = currentEnd.getTime() - currentStart.getTime();
  const prevEnd = new Date(currentStart.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - periodMs);
  return { prevStart, prevEnd };
}

/**
 * Variação percentual do valor atual vs. o período anterior.
 * - `previous === 0 && current > 0` → 100
 * - `previous === 0 && current === 0` → 0
 * - demais casos → percentual arredondado (pode ser negativo; aplica a fórmula
 *   crua também quando `previous` é negativo).
 */
export function calcTrend(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// Agregações da clínica selecionada. Todas recebem `startDate` já calculada
// (via getStartDate) para casar exatamente com o que o componente fazia inline.
// ─────────────────────────────────────────────────────────────────────────────

export interface LabelValue {
  label: string;
  value: number;
}

/** "Mais Vendidos": contagem de atendimentos completed/confirmed por serviço, top 5. */
export function topProceduresByClinic(
  appointments: Appointment[],
  companyId: string,
  startDate: Date
): LabelValue[] {
  if (!companyId) return [];

  const validAppts = appointments.filter(
    (a) =>
      a.companyId === companyId &&
      (a.status === 'completed' || a.status === 'confirmed') &&
      new Date(a.date) >= startDate
  );

  const counts: Record<string, number> = {};
  validAppts.forEach((a) => {
    if (a.service) {
      counts[a.service] = (counts[a.service] || 0) + 1;
    }
  });

  return Object.entries(counts)
    .map(([name, value]) => ({ label: name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
}

export interface SpenderRow {
  name: string;
  value: string;
  raw: number;
}

/**
 * "Clientes VIP": top 5 pacientes por soma de transações de receita vinculadas
 * a um `appointmentId`. A agregação é por `patientName` (não por id) — dois
 * pacientes com o mesmo nome seriam somados juntos; transação cujo
 * `appointmentId` não bate com nenhum agendamento é ignorada.
 */
export function topSpendersInClinic(
  transactions: Transaction[],
  appointments: Appointment[],
  companyId: string,
  startDate: Date
): SpenderRow[] {
  if (!companyId) return [];

  const clinicTransactions = transactions.filter(
    (t) =>
      t.companyId === companyId &&
      t.type === 'income' &&
      t.appointmentId &&
      new Date(t.date) >= startDate
  );

  const patientSpend: Record<string, number> = {};

  clinicTransactions.forEach((t) => {
    const appt = appointments.find((a) => a.id === t.appointmentId);
    if (appt && appt.patientName) {
      patientSpend[appt.patientName] = (patientSpend[appt.patientName] || 0) + t.amount;
    }
  });

  return Object.entries(patientSpend)
    .map(([name, total]) => ({ name, value: formatCurrency(total), raw: total }))
    .sort((a, b) => b.raw - a.raw)
    .slice(0, 5);
}

export interface ProcedureEfficiencyRow {
  name: string;
  volume: number;
  totalRevenue: number;
  ticket: number;
  status: string;
}

/**
 * "Matriz de Eficiência": por procedimento da clínica, volume e ticket médio
 * real de atendimentos `completed` no período, com classificação de negócio.
 *
 * Limiares (todos `>` / `<`, nunca `>=` / `<=`):
 * - `volume > 5 && ticket > 500` → "Estrela ⭐"
 * - senão `volume > 10`          → "Popular 🔥"
 * - senão `ticket > 1000`        → "Premium 💎"
 * - senão `volume < 3`           → "Baixo Rendimento ⚠️"
 * - senão                        → "Regular"
 */
export function procedureEfficiency(
  procedures: Procedure[],
  appointments: Appointment[],
  companyId: string,
  startDate: Date
): ProcedureEfficiencyRow[] {
  if (!companyId) return [];

  const clinicProcs = procedures.filter((p) => p.companyId === companyId);
  const clinicAppts = appointments.filter(
    (a) =>
      a.companyId === companyId &&
      a.status === 'completed' &&
      new Date(a.date) >= startDate
  );

  return clinicProcs
    .map((proc) => {
      const sales = clinicAppts.filter((a) => a.service === proc.name);
      const volume = sales.length;
      const totalRevenue = sales.reduce((acc, curr) => acc + curr.price, 0);

      const realTicket = volume > 0 ? totalRevenue / volume : 0;

      let status = 'Regular';
      if (volume > 5 && realTicket > 500) status = 'Estrela ⭐';
      else if (volume > 10) status = 'Popular 🔥';
      else if (realTicket > 1000) status = 'Premium 💎';
      else if (volume < 3) status = 'Baixo Rendimento ⚠️';

      return {
        name: proc.name,
        volume,
        totalRevenue,
        ticket: realTicket,
        status,
      };
    })
    .sort((a, b) => b.totalRevenue - a.totalRevenue);
}

export interface RetentionMetrics {
  single: number;
  returning: number;
  rate: string;
}

/**
 * KPI "Taxa de Retenção" da aba Análise Geral: % de pacientes com >1 atendimento
 * `completed` no período. (Fórmula diferente da retenção de `/api/retention`.)
 *
 * Sem `companyId` → `{ single: 0, returning: 0, rate: '0' }`.
 * Com `companyId` e nenhum atendimento → rate `'0.0'` (via `toFixed(1)`).
 */
export function retentionMetrics(
  appointments: Appointment[],
  companyId: string,
  startDate: Date
): RetentionMetrics {
  if (!companyId) return { single: 0, returning: 0, rate: '0' };

  const clinicAppts = appointments.filter(
    (a) =>
      a.companyId === companyId &&
      a.status === 'completed' &&
      new Date(a.date) >= startDate
  );

  const patientCounts: Record<string, number> = {};
  clinicAppts.forEach((a) => {
    if (a.patientId) {
      patientCounts[a.patientId] = (patientCounts[a.patientId] || 0) + 1;
    }
  });

  let returningCount = 0;
  let singleVisitCount = 0;

  Object.values(patientCounts).forEach((count) => {
    if (count > 1) returningCount++;
    else singleVisitCount++;
  });

  const total = returningCount + singleVisitCount;
  const rate = total > 0 ? (returningCount / total) * 100 : 0;

  return {
    returning: returningCount,
    single: singleVisitCount,
    rate: rate.toFixed(1),
  };
}

export interface AppointmentStats {
  completed: number;
  canceled: number;
  total: number;
  cancelRate: string;
}

/**
 * KPI "Atendimentos" + donut "Status de Agendamentos".
 * Sem `companyId` → `cancelRate: '0'`; com `companyId` e sem agendamentos →
 * `cancelRate: '0.0'` (via `toFixed(1)`).
 */
export function appointmentStats(
  appointments: Appointment[],
  companyId: string,
  startDate: Date
): AppointmentStats {
  if (!companyId) return { completed: 0, canceled: 0, total: 0, cancelRate: '0' };

  const clinicAppts = appointments.filter(
    (a) => a.companyId === companyId && new Date(a.date) >= startDate
  );

  const completed = clinicAppts.filter((a) => a.status === 'completed').length;
  const canceled = clinicAppts.filter((a) => a.status === 'canceled').length;
  const total = clinicAppts.length;
  const cancelRate = total > 0 ? (canceled / total) * 100 : 0;

  return { completed, canceled, total, cancelRate: cancelRate.toFixed(1) };
}

export interface ProfessionalPerformanceRow {
  name: string;
  revenue: number;
  completedCount: number;
  canceledCount: number;
  commissionCost: number;
  salaryCost: number;
  totalCost: number;
}

/**
 * "Performance da Equipe": por profissional da clínica, receita gerada
 * (atendimentos `completed` no período) e custo de pessoal.
 *
 * - `remunerationType` `comissao`/`misto` → comissão = receita * (rate/100);
 *   `commissionRate` ausente/0 → 0 (nunca NaN).
 * - `remunerationType` `fixo`/`misto` → salário = fixedSalary * monthsCount;
 *   `fixedSalary` ausente/0 → 0.
 * - `totalCost = salaryCost + commissionCost`; a margem (`revenue - totalCost`)
 *   é calculada na camada de view e pode ser negativa.
 *
 * Observação: filtra apenas por `professionalId` (não por `companyId` do
 * agendamento) — comportamento idêntico ao original; os profissionais já vêm
 * filtrados pela clínica.
 */
export function professionalPerformance(
  professionals: User[],
  appointments: Appointment[],
  companyId: string,
  startDate: Date,
  monthsCount: number
): ProfessionalPerformanceRow[] {
  if (!companyId) return [];

  const clinicPros = professionals.filter((p) => p.companyId === companyId);

  return clinicPros
    .map((pro) => {
      const proAppts = appointments.filter(
        (a) => a.professionalId === pro.id && new Date(a.date) >= startDate
      );

      const completedAppts = proAppts.filter((a) => a.status === 'completed');
      const canceledAppts = proAppts.filter((a) => a.status === 'canceled');

      const totalRevenue = completedAppts.reduce((acc, curr) => acc + curr.price, 0);

      let commissionCost = 0;
      if (pro.remunerationType === 'comissao' || pro.remunerationType === 'misto') {
        if (pro.commissionRate) {
          commissionCost = totalRevenue * (pro.commissionRate / 100);
        }
      }

      let salaryCost = 0;
      if (pro.remunerationType === 'fixo' || pro.remunerationType === 'misto') {
        if (pro.fixedSalary) {
          salaryCost = pro.fixedSalary * monthsCount;
        }
      }

      const totalCost = salaryCost + commissionCost;

      return {
        name: pro.name,
        revenue: totalRevenue,
        completedCount: completedAppts.length,
        canceledCount: canceledAppts.length,
        commissionCost,
        salaryCost,
        totalCost,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

/** Faturamento total (receitas) da clínica no período. */
export function totalRevenueInPeriod(
  transactions: Transaction[],
  companyId: string,
  startDate: Date
): number {
  if (!companyId) return 0;
  return transactions
    .filter(
      (t) =>
        t.companyId === companyId &&
        t.type === 'income' &&
        new Date(t.date) >= startDate
    )
    .reduce((acc, t) => acc + t.amount, 0);
}

/** Soma de receitas da clínica entre `start` e `end` (inclusive) — usado no trend. */
export function sumIncomeBetween(
  transactions: Transaction[],
  companyId: string,
  start: Date,
  end: Date
): number {
  return transactions
    .filter(
      (t) =>
        t.companyId === companyId &&
        t.type === 'income' &&
        new Date(t.date) >= start &&
        new Date(t.date) <= end
    )
    .reduce((acc, t) => acc + t.amount, 0);
}

/** Contagem de atendimentos `completed` da clínica entre `start` e `end`. */
export function countCompletedBetween(
  appointments: Appointment[],
  companyId: string,
  start: Date,
  end: Date
): number {
  return appointments.filter(
    (a) =>
      a.companyId === companyId &&
      a.status === 'completed' &&
      new Date(a.date) >= start &&
      new Date(a.date) <= end
  ).length;
}

export interface MonthlyRevenuePoint {
  label: string;
  value: number;
}

/**
 * "Evolução do Faturamento": série de receita agrupada por dia (`1w`/`1m`) ou
 * por mês (demais). A iteração mensal força `setDate(1)` para não pular meses
 * quando "hoje" é dia 29-31 (mesmo bug do `getStartDate`, já tratado aqui e no
 * loop). `now` injetável para testes.
 */
export function monthlyRevenueData(
  transactions: Transaction[],
  companyId: string,
  timeRange: string,
  now: Date = new Date()
): MonthlyRevenuePoint[] {
  if (!companyId) return [];

  const startDate = getStartDate(timeRange, now);
  const endDate = new Date(now);
  endDate.setHours(23, 59, 59, 999);

  let groupBy = 'month';
  if (['1w', '1m'].includes(timeRange)) {
    groupBy = 'day';
  }

  // Alinhar ao dia 1 para garantir iteração mensal limpa sem pular meses
  if (groupBy === 'month') {
    startDate.setDate(1);
  }

  const dataMap = new Map<string, { label: string; value: number }>();

  const getKey = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    if (groupBy === 'day') {
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return `${y}-${m}`;
  };

  const getLabel = (date: Date): string => {
    if (groupBy === 'day') {
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    }
    return date
      .toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
      .toUpperCase();
  };

  const loopDate = new Date(startDate);

  if (!isNaN(loopDate.getTime())) {
    while (loopDate <= endDate) {
      const key = getKey(loopDate);
      if (!dataMap.has(key)) {
        dataMap.set(key, { label: getLabel(loopDate), value: 0 });
      }

      if (groupBy === 'day') {
        loopDate.setDate(loopDate.getDate() + 1);
      } else {
        loopDate.setMonth(loopDate.getMonth() + 1);
        loopDate.setDate(1);
      }
    }
  }

  transactions.forEach((t) => {
    if (t.companyId !== companyId || t.type !== 'income') return;
    const tDate = new Date(t.date);
    const key = getKey(tDate);
    const entry = dataMap.get(key);
    if (entry) {
      entry.value += t.amount;
    }
  });

  return Array.from(dataMap.values());
}
