// __tests__/utils/reportsCalc.test.ts
// Funções puras de cálculo da aba "Relatórios BI" (utils/reportsCalc.ts),
// extraídas de pages/Reports.tsx. Foco especial no bugfix de overflow de mês
// em getStartDate (dias 29-31 cruzando fevereiro).

import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Appointment, Transaction, Procedure, User } from '../../types';
import {
  TIME_RANGES,
  getStartDate,
  getMonthMultiplier,
  getTimeRangeLabel,
  getPreviousPeriodDates,
  calcTrend,
  topProceduresByClinic,
  topSpendersInClinic,
  procedureEfficiency,
  retentionMetrics,
  appointmentStats,
  professionalPerformance,
  totalRevenueInPeriod,
  monthlyRevenueData,
} from '../../utils/reportsCalc';

// ─── factories ──────────────────────────────────────────────────────────────

function appt(over: Partial<Appointment> = {}): Appointment {
  return {
    id: over.id ?? 'a1',
    companyId: over.companyId ?? 'c1',
    patientId: over.patientId ?? 'p1',
    patientName: over.patientName ?? 'Paciente',
    professionalId: over.professionalId ?? 'pro1',
    professionalName: over.professionalName ?? 'Profissional',
    service: over.service ?? 'Limpeza de Pele',
    price: over.price ?? 100,
    date: over.date ?? '2026-05-10T12:00:00.000Z',
    durationMinutes: over.durationMinutes ?? 60,
    status: over.status ?? 'completed',
    ...over,
  };
}

function tx(over: Partial<Transaction> = {}): Transaction {
  return {
    id: over.id ?? 't1',
    companyId: over.companyId ?? 'c1',
    date: over.date ?? '2026-05-10T12:00:00.000Z',
    description: over.description ?? 'Receita',
    amount: over.amount ?? 100,
    type: over.type ?? 'income',
    category: over.category ?? 'Serviços',
    status: over.status ?? 'paid',
    ...over,
  };
}

function proc(over: Partial<Procedure> = {}): Procedure {
  return {
    id: over.id ?? 'proc1',
    companyId: over.companyId ?? 'c1',
    name: over.name ?? 'Botox',
    price: over.price ?? 100,
    cost: over.cost ?? 10,
    durationMinutes: over.durationMinutes ?? 30,
    ...over,
  };
}

function pro(over: Partial<User> = {}): User {
  return {
    id: over.id ?? 'pro1',
    companyId: over.companyId ?? 'c1',
    name: over.name ?? 'Dra. Ana',
    email: over.email ?? 'ana@x.com',
    role: over.role ?? ('ESTHETICIAN' as User['role']),
    ...over,
  };
}

const FAR_PAST = new Date(2000, 0, 1);

afterEach(() => {
  vi.useRealTimers();
});

// ─── getStartDate: bugfix de overflow de mês ────────────────────────────────

describe('getStartDate — overflow de mês nos dias 29-31', () => {
  const ymd = (d: Date) => [d.getFullYear(), d.getMonth() + 1, d.getDate()];

  it('31/03 + "1m" → 28/02 (e NÃO 03/03 / 04/03 como no bug antigo)', () => {
    const d = getStartDate('1m', new Date(2026, 2, 31));
    expect(ymd(d)).toEqual([2026, 2, 28]);
    // prova explícita de que não estourou para março
    expect(d.getMonth()).not.toBe(2);
  });

  it('29/03 e 30/03 + "1m" também caem em 28/02 (clamp no último dia do mês)', () => {
    expect(ymd(getStartDate('1m', new Date(2026, 2, 29)))).toEqual([2026, 2, 28]);
    expect(ymd(getStartDate('1m', new Date(2026, 2, 30)))).toEqual([2026, 2, 28]);
  });

  it('31/03 + "2m" → 31/01 (janeiro tem 31 dias, sem clamp)', () => {
    expect(ymd(getStartDate('2m', new Date(2026, 2, 31)))).toEqual([2026, 1, 31]);
  });

  it('31/03 + "3m" → 31/12 do ano anterior (vira o ano)', () => {
    expect(ymd(getStartDate('3m', new Date(2026, 2, 31)))).toEqual([2025, 12, 31]);
  });

  it('31/03 + "6m" → 30/09 do ano anterior (setembro tem 30 dias, clamp)', () => {
    expect(ymd(getStartDate('6m', new Date(2026, 2, 31)))).toEqual([2025, 9, 30]);
  });

  it('31/03/2026 + "1y" → 31/03/2025', () => {
    expect(ymd(getStartDate('1y', new Date(2026, 2, 31)))).toEqual([2025, 3, 31]);
  });

  it('29/02/2024 (bissexto) + "1m" → 29/02/2024? não: 29/03 - 1m → 29/02 (Fev bissexto tem 29)', () => {
    expect(ymd(getStartDate('1m', new Date(2024, 2, 29)))).toEqual([2024, 2, 29]);
  });

  it('"1w" usa subtração de dias simples, sem overflow (05/03 → 26/02)', () => {
    expect(ymd(getStartDate('1w', new Date(2026, 2, 5)))).toEqual([2026, 2, 26]);
  });

  it('zera a parte de hora do resultado', () => {
    const d = getStartDate('3m', new Date(2026, 2, 15, 18, 45, 30));
    expect([d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()]).toEqual([0, 0, 0, 0]);
  });

  it('sem argumento usa "agora" (fake timers) — 31/03 + "1m" → fevereiro', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-31T12:00:00'));
    const d = getStartDate('1m');
    expect(d.getMonth()).toBe(1); // fevereiro
    expect(d.getDate()).toBe(28);
  });

  it('range desconhecido cai no default de 6 meses', () => {
    expect(ymd(getStartDate('xx', new Date(2026, 5, 15)))).toEqual([2025, 12, 15]);
  });
});

// ─── getMonthMultiplier / getTimeRangeLabel ─────────────────────────────────

describe('getMonthMultiplier / getTimeRangeLabel — cobertura de todo o <select>', () => {
  it.each(TIME_RANGES)('range "%s" tem multiplicador > 0 e label != "Período"', (range) => {
    const mult = getMonthMultiplier(range);
    expect(mult).toBeGreaterThan(0);
    expect(Number.isFinite(mult)).toBe(true);
    expect(getTimeRangeLabel(range)).not.toBe('Período');
  });

  it('range desconhecido: multiplicador 1 e label "Período"', () => {
    expect(getMonthMultiplier('zzz')).toBe(1);
    expect(getTimeRangeLabel('zzz')).toBe('Período');
  });
});

// ─── calcTrend ─────────────────────────────────────────────────────────────

describe('calcTrend', () => {
  it('prev=0 & current=0 → 0 (sem trend)', () => {
    expect(calcTrend(0, 0)).toBe(0);
  });
  it('prev=0 & current>0 → 100', () => {
    expect(calcTrend(500, 0)).toBe(100);
  });
  it('prev=0 & current<0 → 0 (current > 0 é falso)', () => {
    expect(calcTrend(-10, 0)).toBe(0);
  });
  it('prev>0: percentual arredondado (pode ser negativo)', () => {
    expect(calcTrend(150, 100)).toBe(50);
    expect(calcTrend(80, 100)).toBe(-20);
  });
  it('prev negativo: aplica a fórmula crua', () => {
    // (50 - (-100)) / -100 * 100 = -150
    expect(calcTrend(50, -100)).toBe(-150);
  });
});

// ─── getPreviousPeriodDates ────────────────────────────────────────────────

describe('getPreviousPeriodDates', () => {
  it('a janela anterior termina 1ms antes do início da janela atual', () => {
    const now = new Date(2026, 2, 31, 10, 0, 0);
    const currentStart = getStartDate('1m', now);
    const { prevStart, prevEnd } = getPreviousPeriodDates('1m', now);
    expect(prevEnd.getTime()).toBe(currentStart.getTime() - 1);
    expect(prevStart.getTime()).toBeLessThan(prevEnd.getTime());
  });
});

// ─── professionalPerformance ───────────────────────────────────────────────

describe('professionalPerformance', () => {
  it('remunerationType "comissao": comissão = receita * rate/100; sem salário', () => {
    const pros = [pro({ id: 'x', remunerationType: 'comissao', commissionRate: 30 })];
    const appts = [
      appt({ id: 'a', professionalId: 'x', price: 100, status: 'completed' }),
      appt({ id: 'b', professionalId: 'x', price: 200, status: 'completed' }),
    ];
    const [row] = professionalPerformance(pros, appts, 'c1', FAR_PAST, 6);
    expect(row.revenue).toBe(300);
    expect(row.commissionCost).toBe(90);
    expect(row.salaryCost).toBe(0);
    expect(row.totalCost).toBe(90);
    expect(row.completedCount).toBe(2);
  });

  it('remunerationType "fixo": salário = fixedSalary * monthsCount; independe da receita', () => {
    const pros = [pro({ id: 'x', remunerationType: 'fixo', fixedSalary: 1000 })];
    const [row] = professionalPerformance(pros, [], 'c1', FAR_PAST, 6);
    expect(row.revenue).toBe(0);
    expect(row.salaryCost).toBe(6000);
    expect(row.commissionCost).toBe(0);
    expect(row.totalCost).toBe(6000);
  });

  it('remunerationType "misto": soma salário fixo + comissão', () => {
    const pros = [pro({ id: 'x', remunerationType: 'misto', fixedSalary: 500, commissionRate: 10 })];
    const appts = [appt({ id: 'a', professionalId: 'x', price: 1000, status: 'completed' })];
    const [row] = professionalPerformance(pros, appts, 'c1', FAR_PAST, 2);
    expect(row.salaryCost).toBe(1000); // 500 * 2
    expect(row.commissionCost).toBe(100); // 1000 * 0.1
    expect(row.totalCost).toBe(1100);
  });

  it('sem commissionRate / sem fixedSalary → custos 0 (nunca NaN)', () => {
    const pros = [
      pro({ id: 'c', name: 'So Comissao', remunerationType: 'comissao' }), // commissionRate undefined
      pro({ id: 'f', name: 'So Fixo', remunerationType: 'fixo' }), // fixedSalary undefined
    ];
    const appts = [appt({ id: 'a', professionalId: 'c', price: 300, status: 'completed' })];
    const rows = professionalPerformance(pros, appts, 'c1', FAR_PAST, 3);
    const c = rows.find((r) => r.name === 'So Comissao')!;
    const f = rows.find((r) => r.name === 'So Fixo')!;
    expect(c.commissionCost).toBe(0);
    expect(Number.isNaN(c.commissionCost)).toBe(false);
    expect(f.salaryCost).toBe(0);
    expect(Number.isNaN(f.salaryCost)).toBe(false);
  });

  it('profissional sem atendimentos no período → zeros (mas salário fixo ainda conta)', () => {
    const pros = [pro({ id: 'x', remunerationType: 'misto', fixedSalary: 100, commissionRate: 50 })];
    const appts = [appt({ id: 'old', professionalId: 'x', price: 999, status: 'completed', date: '2019-01-01T00:00:00.000Z' })];
    const [row] = professionalPerformance(pros, appts, 'c1', new Date(2026, 0, 1), 1);
    expect(row.revenue).toBe(0);
    expect(row.completedCount).toBe(0);
    expect(row.commissionCost).toBe(0);
    expect(row.salaryCost).toBe(100);
  });

  it('margem (revenue - totalCost) pode ser negativa', () => {
    const pros = [pro({ id: 'x', remunerationType: 'fixo', fixedSalary: 1000 })];
    const appts = [appt({ id: 'a', professionalId: 'x', price: 100, status: 'completed' })];
    const [row] = professionalPerformance(pros, appts, 'c1', FAR_PAST, 1);
    expect(row.revenue - row.totalCost).toBe(-900);
  });

  it('conta cancelados separadamente e ordena por receita desc', () => {
    const pros = [
      pro({ id: 'lo', name: 'Baixa', remunerationType: 'comissao', commissionRate: 0 }),
      pro({ id: 'hi', name: 'Alta', remunerationType: 'comissao', commissionRate: 0 }),
    ];
    const appts = [
      appt({ id: '1', professionalId: 'hi', price: 500, status: 'completed' }),
      appt({ id: '2', professionalId: 'lo', price: 50, status: 'completed' }),
      appt({ id: '3', professionalId: 'lo', price: 50, status: 'canceled' }),
    ];
    const rows = professionalPerformance(pros, appts, 'c1', FAR_PAST, 1);
    expect(rows.map((r) => r.name)).toEqual(['Alta', 'Baixa']);
    expect(rows[1].canceledCount).toBe(1);
  });

  it('filtra profissionais pela clínica; sem companyId → []', () => {
    const pros = [pro({ id: 'x', companyId: 'c1' }), pro({ id: 'y', companyId: 'c2' })];
    expect(professionalPerformance(pros, [], 'c1', FAR_PAST, 1)).toHaveLength(1);
    expect(professionalPerformance(pros, [], '', FAR_PAST, 1)).toEqual([]);
  });
});

// ─── procedureEfficiency: limiares de classificação ─────────────────────────

describe('procedureEfficiency — classificação por limiar (>/< , nunca >=/<=)', () => {
  const run = (name: string, priceEach: number, count: number) => {
    const procedures = [proc({ id: 'p', name })];
    const appts = Array.from({ length: count }, (_, i) =>
      appt({ id: `a${i}`, service: name, price: priceEach, status: 'completed' })
    );
    return procedureEfficiency(procedures, appts, 'c1', FAR_PAST)[0];
  };

  it('Estrela ⭐: volume > 5 E ticket > 500', () => {
    expect(run('X', 600, 6).status).toBe('Estrela ⭐');
  });

  it('borda volume === 5 (ticket 600) → NÃO é Estrela (é Regular)', () => {
    expect(run('X', 600, 5).status).toBe('Regular');
  });

  it('borda ticket === 500 (volume 6) → NÃO é Estrela (é Regular)', () => {
    expect(run('X', 500, 6).status).toBe('Regular');
  });

  it('Popular 🔥: volume > 10 com ticket baixo', () => {
    expect(run('X', 100, 11).status).toBe('Popular 🔥');
  });

  it('borda volume === 10 (ticket baixo) → NÃO é Popular (é Regular)', () => {
    expect(run('X', 100, 10).status).toBe('Regular');
  });

  it('Premium 💎: ticket > 1000 com volume baixo (vence "Baixo Rendimento")', () => {
    expect(run('X', 1200, 2).status).toBe('Premium 💎');
  });

  it('borda ticket === 1000 (volume 2) → NÃO é Premium → cai em Baixo Rendimento ⚠️', () => {
    expect(run('X', 1000, 2).status).toBe('Baixo Rendimento ⚠️');
  });

  it('Baixo Rendimento ⚠️: volume < 3 e ticket baixo', () => {
    expect(run('X', 100, 2).status).toBe('Baixo Rendimento ⚠️');
  });

  it('borda volume === 3 → NÃO é Baixo Rendimento (é Regular)', () => {
    expect(run('X', 100, 3).status).toBe('Regular');
  });

  it('Regular: volume médio, ticket médio', () => {
    expect(run('X', 200, 4).status).toBe('Regular');
  });

  it('procedimento sem vendas → volume 0, ticket 0, "Baixo Rendimento ⚠️"', () => {
    const r = procedureEfficiency([proc({ name: 'Z' })], [], 'c1', FAR_PAST)[0];
    expect(r.volume).toBe(0);
    expect(r.ticket).toBe(0);
    expect(r.status).toBe('Baixo Rendimento ⚠️');
  });

  it('ordena por faturamento desc; sem companyId → []', () => {
    const procedures = [proc({ id: 'a', name: 'A' }), proc({ id: 'b', name: 'B' })];
    const appts = [
      appt({ id: '1', service: 'A', price: 100, status: 'completed' }),
      appt({ id: '2', service: 'B', price: 900, status: 'completed' }),
    ];
    const rows = procedureEfficiency(procedures, appts, 'c1', FAR_PAST);
    expect(rows.map((r) => r.name)).toEqual(['B', 'A']);
    expect(procedureEfficiency(procedures, appts, '', FAR_PAST)).toEqual([]);
  });
});

// ─── retentionMetrics ──────────────────────────────────────────────────────

describe('retentionMetrics', () => {
  it('sem companyId → { single:0, returning:0, rate:"0" }', () => {
    expect(retentionMetrics([], '', FAR_PAST)).toEqual({ single: 0, returning: 0, rate: '0' });
  });

  it('companyId mas nenhum atendimento → rate "0.0" (toFixed(1), não "0")', () => {
    expect(retentionMetrics([], 'c1', FAR_PAST)).toEqual({ returning: 0, single: 0, rate: '0.0' });
  });

  it('todos com 1 visita → rate "0.0"', () => {
    const appts = [
      appt({ id: '1', patientId: 'p1', status: 'completed' }),
      appt({ id: '2', patientId: 'p2', status: 'completed' }),
      appt({ id: '3', patientId: 'p3', status: 'completed' }),
    ];
    expect(retentionMetrics(appts, 'c1', FAR_PAST)).toEqual({ returning: 0, single: 3, rate: '0.0' });
  });

  it('todos recorrentes → rate "100.0"', () => {
    const appts = [
      appt({ id: '1', patientId: 'p1', status: 'completed' }),
      appt({ id: '2', patientId: 'p1', status: 'completed' }),
      appt({ id: '3', patientId: 'p2', status: 'completed' }),
      appt({ id: '4', patientId: 'p2', status: 'completed' }),
    ];
    expect(retentionMetrics(appts, 'c1', FAR_PAST)).toEqual({ returning: 2, single: 0, rate: '100.0' });
  });

  it('caso misto → toFixed(1) (1 recorrente de 3 → "33.3")', () => {
    const appts = [
      appt({ id: '1', patientId: 'p1', status: 'completed' }),
      appt({ id: '2', patientId: 'p1', status: 'completed' }),
      appt({ id: '3', patientId: 'p2', status: 'completed' }),
      appt({ id: '4', patientId: 'p3', status: 'completed' }),
    ];
    expect(retentionMetrics(appts, 'c1', FAR_PAST).rate).toBe('33.3');
  });

  it('ignora não-completed, fora do período e sem patientId', () => {
    const appts = [
      appt({ id: '1', patientId: 'p1', status: 'completed' }),
      appt({ id: '2', patientId: 'p1', status: 'canceled' }),
      appt({ id: '3', patientId: 'p1', status: 'completed', date: '2019-01-01T00:00:00.000Z' }),
      appt({ id: '4', patientId: '', status: 'completed' }),
    ];
    expect(retentionMetrics(appts, 'c1', new Date(2026, 0, 1))).toEqual({ returning: 0, single: 1, rate: '0.0' });
  });
});

// ─── appointmentStats ──────────────────────────────────────────────────────

describe('appointmentStats', () => {
  it('sem companyId → cancelRate "0"', () => {
    expect(appointmentStats([], '', FAR_PAST)).toEqual({ completed: 0, canceled: 0, total: 0, cancelRate: '0' });
  });

  it('companyId mas sem agendamentos → cancelRate "0.0"', () => {
    expect(appointmentStats([], 'c1', FAR_PAST)).toEqual({ completed: 0, canceled: 0, total: 0, cancelRate: '0.0' });
  });

  it('mix de status: cancelRate = canceled / total (toFixed(1))', () => {
    const appts = [
      appt({ id: '1', status: 'completed' }),
      appt({ id: '2', status: 'completed' }),
      appt({ id: '3', status: 'canceled' }),
      appt({ id: '4', status: 'scheduled' }),
    ];
    expect(appointmentStats(appts, 'c1', FAR_PAST)).toEqual({ completed: 2, canceled: 1, total: 4, cancelRate: '25.0' });
  });

  it('cancelRate não-inteiro → "33.3"', () => {
    const appts = [
      appt({ id: '1', status: 'completed' }),
      appt({ id: '2', status: 'completed' }),
      appt({ id: '3', status: 'canceled' }),
    ];
    expect(appointmentStats(appts, 'c1', FAR_PAST).cancelRate).toBe('33.3');
  });

  it('filtra por companyId e data', () => {
    const appts = [
      appt({ id: '1', companyId: 'c1', status: 'completed' }),
      appt({ id: '2', companyId: 'c2', status: 'completed' }),
      appt({ id: '3', companyId: 'c1', status: 'completed', date: '2019-01-01T00:00:00.000Z' }),
    ];
    expect(appointmentStats(appts, 'c1', new Date(2026, 0, 1)).total).toBe(1);
  });
});

// ─── topProceduresByClinic ─────────────────────────────────────────────────

describe('topProceduresByClinic', () => {
  it('conta completed + confirmed por serviço, top 5, ordenado desc', () => {
    const appts = [
      appt({ id: '1', service: 'A', status: 'completed' }),
      appt({ id: '2', service: 'A', status: 'confirmed' }),
      appt({ id: '3', service: 'B', status: 'completed' }),
      appt({ id: '4', service: 'C', status: 'scheduled' }), // ignorado
    ];
    const res = topProceduresByClinic(appts, 'c1', FAR_PAST);
    expect(res).toEqual([
      { label: 'A', value: 2 },
      { label: 'B', value: 1 },
    ]);
  });

  it('sem companyId → []', () => {
    expect(topProceduresByClinic([appt()], '', FAR_PAST)).toEqual([]);
  });
});

// ─── topSpendersInClinic ───────────────────────────────────────────────────

describe('topSpendersInClinic', () => {
  it('transação com appointmentId órfão é ignorada (não quebra)', () => {
    const appts = [appt({ id: 'a1', patientName: 'Maria' })];
    const txs = [
      tx({ id: 't1', appointmentId: 'a1', amount: 100 }),
      tx({ id: 't2', appointmentId: 'inexistente', amount: 999 }),
    ];
    const res = topSpendersInClinic(txs, appts, 'c1', FAR_PAST);
    expect(res).toHaveLength(1);
    expect(res[0].name).toBe('Maria');
    expect(res[0].raw).toBe(100);
  });

  it('agrega por patientName — dois pacientes com o MESMO nome somam juntos (comportamento documentado)', () => {
    const appts = [
      appt({ id: 'a1', patientId: 'p1', patientName: 'Maria' }),
      appt({ id: 'a2', patientId: 'p2', patientName: 'Maria' }),
    ];
    const txs = [
      tx({ id: 't1', appointmentId: 'a1', amount: 100 }),
      tx({ id: 't2', appointmentId: 'a2', amount: 50 }),
    ];
    const res = topSpendersInClinic(txs, appts, 'c1', FAR_PAST);
    expect(res).toHaveLength(1);
    expect(res[0].raw).toBe(150);
  });

  it('ignora despesas, transações sem appointmentId, e respeita o filtro de data; ordena desc e fatia top 5', () => {
    const appts = Array.from({ length: 7 }, (_, i) => appt({ id: `a${i}`, patientName: `P${i}` }));
    const txs = [
      ...appts.map((a, i) => tx({ id: `t${i}`, appointmentId: a.id, amount: (i + 1) * 10 })),
      tx({ id: 'exp', appointmentId: 'a0', amount: 9999, type: 'expense' }),
      tx({ id: 'noappt', amount: 9999 }),
      tx({ id: 'old', appointmentId: 'a1', amount: 9999, date: '2019-01-01T00:00:00.000Z' }),
    ];
    const res = topSpendersInClinic(txs, appts, 'c1', new Date(2026, 0, 1));
    expect(res).toHaveLength(5);
    expect(res[0].raw).toBe(70); // P6
    expect(res.map((r) => r.raw)).toEqual([70, 60, 50, 40, 30]);
    expect(typeof res[0].value).toBe('string');
  });

  it('sem companyId → []', () => {
    expect(topSpendersInClinic([tx()], [appt()], '', FAR_PAST)).toEqual([]);
  });
});

// ─── totalRevenueInPeriod ──────────────────────────────────────────────────

describe('totalRevenueInPeriod', () => {
  it('soma receitas da clínica no período; ignora despesa, outra clínica e fora de data', () => {
    const txs = [
      tx({ id: '1', amount: 100 }),
      tx({ id: '2', amount: 50, type: 'expense' }),
      tx({ id: '3', amount: 200, companyId: 'c2' }),
      tx({ id: '4', amount: 999, date: '2019-01-01T00:00:00.000Z' }),
    ];
    expect(totalRevenueInPeriod(txs, 'c1', new Date(2026, 0, 1))).toBe(100);
  });
  it('sem companyId → 0', () => {
    expect(totalRevenueInPeriod([tx()], '', FAR_PAST)).toBe(0);
  });
});

// ─── monthlyRevenueData ────────────────────────────────────────────────────

describe('monthlyRevenueData', () => {
  it('agrupamento mensal: "hoje" 31/03 e range "3m" → 4 meses consecutivos SEM pular fevereiro', () => {
    const now = new Date(2026, 2, 31);
    const txs = [
      tx({ id: 'dez', amount: 10, date: '2025-12-15T12:00:00.000Z' }),
      tx({ id: 'fev', amount: 20, date: '2026-02-15T12:00:00.000Z' }),
      tx({ id: 'mar', amount: 30, date: '2026-03-15T12:00:00.000Z' }),
    ];
    const res = monthlyRevenueData(txs, 'c1', '3m', now);
    // dez/2025, jan/2026, fev/2026, mar/2026
    expect(res).toHaveLength(4);
    const total = res.reduce((s, p) => s + p.value, 0);
    expect(total).toBe(60); // nenhuma transação caiu num bucket inexistente
    // fevereiro NÃO foi pulado: existe um bucket com valor 20
    expect(res.some((p) => p.value === 20)).toBe(true);
  });

  it('agrupamento diário: "hoje" 31/03 e range "1m" → 28/02..31/03 (32 dias) sem gap', () => {
    const now = new Date(2026, 2, 31);
    const res = monthlyRevenueData([], 'c1', '1m', now);
    expect(res).toHaveLength(32); // 28/02 + 31 dias de março
  });

  it('sem companyId → []', () => {
    expect(monthlyRevenueData([tx()], '', '3m', new Date(2026, 2, 31))).toEqual([]);
  });
});
