// __tests__/utils/financialCalculations.test.ts
// Funções puras de cálculo do Financeiro da Clínica (utils/financialCalculations.ts).

import { describe, it, expect } from 'vitest';
import { Transaction } from '../../types';
import {
  isFutureInstallment,
  effectiveDate,
  filterByMonth,
  totalRevenue,
  totalCost,
  allTimeBalance,
  pendingInstallments,
  calcTrend,
  groupedTransactions,
} from '../../utils/financialCalculations';

function tx(over: Partial<Transaction> = {}): Transaction {
  return {
    id: over.id ?? 't1',
    companyId: 'c1',
    date: over.date ?? '2026-03-10T12:00:00.000Z',
    description: over.description ?? 'Lançamento',
    amount: over.amount ?? 100,
    type: over.type ?? 'income',
    category: over.category ?? 'Geral',
    status: over.status ?? 'paid',
    ...over,
  };
}

describe('isFutureInstallment / effectiveDate', () => {
  it('parcela 2..N de receita é futura e usa a dueDate como data efetiva', () => {
    const t = tx({
      type: 'income',
      installments: 3,
      installmentIndex: 2,
      installmentGroupId: 'g1',
      date: '2026-03-10T12:00:00.000Z',
      dueDate: '2026-04-10T12:00:00.000Z',
    });
    expect(isFutureInstallment(t)).toBe(true);
    expect(effectiveDate(t)).toBe('2026-04-10T12:00:00.000Z');
  });

  it('parcela 1 (ou transação normal) não é futura e usa a própria date', () => {
    const t1 = tx({ type: 'income', installments: 3, installmentIndex: 1, dueDate: '2026-04-10T12:00:00.000Z' });
    expect(isFutureInstallment(t1)).toBe(false);
    expect(effectiveDate(t1)).toBe(t1.date);

    const normal = tx({ type: 'income' });
    expect(isFutureInstallment(normal)).toBe(false);
  });

  it('despesa nunca é "future installment", mesmo com campos de parcela', () => {
    const t = tx({ type: 'expense', installments: 3, installmentIndex: 2, dueDate: '2026-05-01T12:00:00.000Z' });
    expect(isFutureInstallment(t)).toBe(false);
    expect(effectiveDate(t)).toBe(t.date);
  });
});

describe('filterByMonth', () => {
  it('inclui a parcela futura no mês da dueDate, não no mês da date', () => {
    const parcela2 = tx({
      id: 'p2', type: 'income', amount: 50, installments: 3, installmentIndex: 2,
      installmentGroupId: 'g1', date: '2026-03-10T12:00:00.000Z', dueDate: '2026-04-15T12:00:00.000Z',
    });
    const marco = filterByMonth([parcela2], 2, 2026); // março
    const abril = filterByMonth([parcela2], 3, 2026); // abril
    expect(marco).toHaveLength(0);
    expect(abril).toHaveLength(1);
  });

  it('filtra transações normais pelo mês/ano da date', () => {
    const list = [
      tx({ id: 'a', date: '2026-03-01T12:00:00.000Z' }),
      tx({ id: 'b', date: '2026-04-01T12:00:00.000Z' }),
      tx({ id: 'c', date: '2025-03-01T12:00:00.000Z' }),
    ];
    const res = filterByMonth(list, 2, 2026);
    expect(res.map((t) => t.id)).toEqual(['a']);
  });
});

describe('totalRevenue / totalCost com mix de status', () => {
  const mixed = [
    tx({ id: 'r1', type: 'income', amount: 200, status: 'paid' }),
    tx({ id: 'r2', type: 'income', amount: 100, status: 'pending' }),
    // "overdue" não existe no type do front (só paid|pending); representamos como pending
    tx({ id: 'r3', type: 'income', amount: 30, status: 'pending' }),
    tx({ id: 'e1', type: 'expense', amount: 80, status: 'paid' }),
    tx({ id: 'e2', type: 'expense', amount: 20, status: 'pending' }),
  ];

  it('totalRevenue soma TODAS as receitas do conjunto, independente do status', () => {
    expect(totalRevenue(mixed)).toBe(330);
  });

  it('totalCost soma TODAS as despesas do conjunto, independente do status', () => {
    expect(totalCost(mixed)).toBe(100);
  });
});

describe('allTimeBalance', () => {
  it('receitas menos despesas de todas as transações, sem filtro de mês/status', () => {
    const list = [
      tx({ id: 'a', type: 'income', amount: 500, status: 'paid', date: '2026-01-01T12:00:00.000Z' }),
      tx({ id: 'b', type: 'income', amount: 100, status: 'pending', date: '2026-09-01T12:00:00.000Z' }),
      tx({ id: 'c', type: 'expense', amount: 250, status: 'paid', date: '2025-12-01T12:00:00.000Z' }),
    ];
    expect(allTimeBalance(list)).toBe(350);
  });
});

describe('pendingInstallments', () => {
  it('soma apenas parcelas de receita pending COM installmentGroupId (qualquer mês)', () => {
    const list = [
      tx({ id: 'p1', type: 'income', amount: 33.33, status: 'paid', installmentGroupId: 'g1', installments: 3, installmentIndex: 1, dueDate: '2026-03-10T12:00:00.000Z' }),
      tx({ id: 'p2', type: 'income', amount: 33.33, status: 'pending', installmentGroupId: 'g1', installments: 3, installmentIndex: 2, dueDate: '2026-04-10T12:00:00.000Z' }),
      tx({ id: 'p3', type: 'income', amount: 33.34, status: 'pending', installmentGroupId: 'g1', installments: 3, installmentIndex: 3, dueDate: '2026-05-10T12:00:00.000Z' }),
      // pending mas SEM grupo → não conta (não é parcela)
      tx({ id: 'x', type: 'income', amount: 999, status: 'pending' }),
      // despesa pending → não conta
      tx({ id: 'e', type: 'expense', amount: 40, status: 'pending', installmentGroupId: 'g2', installments: 2, installmentIndex: 2 }),
    ];
    expect(pendingInstallments(list)).toBeCloseTo(66.67, 10);
  });
});

describe('calcTrend', () => {
  it('prev=0 & current=0 → sem trend (undefined)', () => {
    expect(calcTrend(0, 0, 'vs Fevereiro')).toBeUndefined();
  });

  it('prev=0 & current>0 → 100%', () => {
    expect(calcTrend(500, 0, 'vs Fevereiro')).toEqual({ value: 100, label: 'vs Fevereiro' });
  });

  it('percentual arredondado quando prev>0', () => {
    expect(calcTrend(150, 100, 'vs Fevereiro')).toEqual({ value: 50, label: 'vs Fevereiro' });
    expect(calcTrend(80, 100, 'vs Fevereiro')).toEqual({ value: -20, label: 'vs Fevereiro' });
  });

  it('prev negativo: aplica a fórmula (current - prev) / prev sem tratamento especial', () => {
    // (50 - (-100)) / -100 = -1.5 → -150%
    expect(calcTrend(50, -100, 'vs Fevereiro')).toEqual({ value: -150, label: 'vs Fevereiro' });
  });
});

describe('groupedTransactions', () => {
  it('agrupa receita + despesa do mesmo appointmentId numa única linha', () => {
    const income = tx({ id: 'i', type: 'income', amount: 300, appointmentId: 'appt1', date: '2026-03-10T12:00:00.000Z' });
    const expense = tx({ id: 'e', type: 'expense', amount: 90, appointmentId: 'appt1', date: '2026-03-10T12:00:00.000Z' });
    const groups = groupedTransactions([income, expense]);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('appt1');
    expect(groups[0].income?.id).toBe('i');
    expect(groups[0].expense?.id).toBe('e');
  });

  it('parcela 2..N vira linha standalone (installment_<id>) posicionada pela dueDate, sem duplicar custo', () => {
    const parcela1 = tx({ id: 'i1', type: 'income', amount: 100, appointmentId: 'appt1', installments: 3, installmentIndex: 1, installmentGroupId: 'g1', date: '2026-03-10T12:00:00.000Z' });
    const custo = tx({ id: 'c1', type: 'expense', amount: 60, appointmentId: 'appt1', date: '2026-03-10T12:00:00.000Z' });
    const parcela2 = tx({ id: 'i2', type: 'income', amount: 100, appointmentId: 'appt1', installments: 3, installmentIndex: 2, installmentGroupId: 'g1', date: '2026-03-10T12:00:00.000Z', dueDate: '2026-04-10T12:00:00.000Z' });

    const groups = groupedTransactions([parcela1, custo, parcela2]);
    // uma linha para o atendimento (parcela 1 + custo) e uma linha standalone para a parcela 2
    expect(groups).toHaveLength(2);

    const standalone = groups.find((g) => g.key === 'installment_i2');
    expect(standalone).toBeDefined();
    expect(standalone?.standalone?.id).toBe('i2');
    // a linha standalone é datada pela dueDate (mês seguinte)
    expect(standalone?.date).toBe('2026-04-10T12:00:00.000Z');
    // não há despesa associada à parcela 2 → custo não é duplicado
    expect(standalone?.expense).toBeUndefined();

    const atendimento = groups.find((g) => g.key === 'appt1');
    expect(atendimento?.income?.id).toBe('i1');
    expect(atendimento?.expense?.id).toBe('c1');
  });

  it('transação avulsa (sem appointmentId) vira standalone com key = id', () => {
    const avulsa = tx({ id: 'av1', type: 'expense', amount: 200, date: '2026-03-05T12:00:00.000Z' });
    const groups = groupedTransactions([avulsa]);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('av1');
    expect(groups[0].standalone?.id).toBe('av1');
  });

  it('ordena as linhas por data decrescente', () => {
    const a = tx({ id: 'a', date: '2026-03-01T12:00:00.000Z' });
    const b = tx({ id: 'b', date: '2026-03-20T12:00:00.000Z' });
    const c = tx({ id: 'c', date: '2026-03-10T12:00:00.000Z' });
    const groups = groupedTransactions([a, b, c]);
    expect(groups.map((g) => g.key)).toEqual(['b', 'c', 'a']);
  });
});
