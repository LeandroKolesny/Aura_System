// __tests__/utils/availabilityUtils.test.ts
// Testes das funções puras de disponibilidade da Agenda
// (utils/availabilityUtils.ts): isWithinBusinessHours e getUnavailabilityRule.

import { describe, it, expect } from 'vitest';
import { isWithinBusinessHours, getUnavailabilityRule } from '../../utils/availabilityUtils';
import { BusinessHours, DaySchedule, UnavailabilityRule } from '../../types';

const DAY_KEYS: (keyof BusinessHours)[] = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
];

/** Constrói um BusinessHours com o mesmo horário em todos os 7 dias. */
const everyDay = (schedule: DaySchedule): BusinessHours =>
  DAY_KEYS.reduce((acc, key) => ({ ...acc, [key]: schedule }), {} as BusinessHours);

describe('isWithinBusinessHours', () => {
  it('retorna true quando não há configuração de horário (default aberto)', () => {
    expect(isWithinBusinessHours(new Date(2026, 8, 14, 10, 0), undefined)).toBe(true);
  });

  it('retorna false quando o dia está fechado (isOpen=false)', () => {
    const hours = everyDay({ isOpen: false, start: '08:00', end: '18:00' });
    expect(isWithinBusinessHours(new Date(2026, 8, 14, 10, 0), hours)).toBe(false);
  });

  it('retorna false para horário antes da abertura', () => {
    const hours = everyDay({ isOpen: true, start: '08:00', end: '18:00' });
    expect(isWithinBusinessHours(new Date(2026, 8, 14, 7, 59), hours)).toBe(false);
  });

  it('retorna false para horário depois do fechamento', () => {
    const hours = everyDay({ isOpen: true, start: '08:00', end: '18:00' });
    expect(isWithinBusinessHours(new Date(2026, 8, 14, 18, 30), hours)).toBe(false);
  });

  it('retorna true exatamente no horário de abertura (limite inclusivo)', () => {
    const hours = everyDay({ isOpen: true, start: '08:00', end: '18:00' });
    expect(isWithinBusinessHours(new Date(2026, 8, 14, 8, 0), hours)).toBe(true);
  });

  it('retorna false exatamente no horário de fechamento (limite exclusivo)', () => {
    const hours = everyDay({ isOpen: true, start: '08:00', end: '18:00' });
    expect(isWithinBusinessHours(new Date(2026, 8, 14, 18, 0), hours)).toBe(false);
  });

  it('retorna false 1 minuto depois do fechamento', () => {
    const hours = everyDay({ isOpen: true, start: '08:00', end: '18:00' });
    expect(isWithinBusinessHours(new Date(2026, 8, 14, 18, 1), hours)).toBe(false);
  });

  it('trata fechamento "00:00" como meia-noite (endTotal=0 vira 1440)', () => {
    const hours = everyDay({ isOpen: true, start: '08:00', end: '00:00' });
    expect(isWithinBusinessHours(new Date(2026, 8, 14, 23, 59), hours)).toBe(true);
    expect(isWithinBusinessHours(new Date(2026, 8, 14, 7, 0), hours)).toBe(false);
  });
});

describe('getUnavailabilityRule', () => {
  const LOCAL_DAY = '2026-09-14';

  const rule = (over: Partial<UnavailabilityRule> = {}): UnavailabilityRule => ({
    id: 'rule-1',
    companyId: 'c1',
    description: 'Férias',
    startTime: '08:00',
    endTime: '18:00',
    dates: [LOCAL_DAY],
    professionalIds: ['prof-1'],
    ...over,
  });

  it('aplica regra que afeta todos os profissionais (professionalIds inclui "all")', () => {
    const rules = [rule({ professionalIds: ['all'] })];
    const found = getUnavailabilityRule(new Date(2026, 8, 14, 10, 0), rules, 'prof-999');
    expect(found).toBeDefined();
  });

  it('aplica regra específica de um profissional apenas para aquele profissional', () => {
    const rules = [rule({ professionalIds: ['prof-1'] })];
    expect(getUnavailabilityRule(new Date(2026, 8, 14, 10, 0), rules, 'prof-1')).toBeDefined();
    expect(getUnavailabilityRule(new Date(2026, 8, 14, 10, 0), rules, 'prof-2')).toBeUndefined();
  });

  it('quando o filtro é "all", casa com qualquer regra ativa naquele horário', () => {
    const rules = [rule({ professionalIds: ['prof-1'] })];
    expect(getUnavailabilityRule(new Date(2026, 8, 14, 10, 0), rules, 'all')).toBeDefined();
  });

  it('não aplica regra fora da data configurada', () => {
    const rules = [rule({ dates: ['2026-09-20'] })];
    expect(getUnavailabilityRule(new Date(2026, 8, 14, 10, 0), rules, 'prof-1')).toBeUndefined();
  });

  it('não aplica regra fora da janela de horário', () => {
    const rules = [rule({ startTime: '08:00', endTime: '12:00' })];
    expect(getUnavailabilityRule(new Date(2026, 8, 14, 13, 0), rules, 'prof-1')).toBeUndefined();
  });

  it('usa a data local (wall-clock), não a data UTC — não vaza para o dia adjacente', () => {
    // Independente do fuso do runner, um horário local do dia 14 (seja 00:15 ou 23:30)
    // deve casar com a regra do dia 14. Uma implementação ingênua com toISOString()
    // "vazaria" para o dia 13 (fusos positivos) ou 15 (fusos negativos) e falharia.
    const rules = [rule({ startTime: '00:00', endTime: '23:59' })];
    const lateNight = new Date(2026, 8, 14, 23, 30, 0);
    const earlyMorning = new Date(2026, 8, 14, 0, 15, 0);
    expect(getUnavailabilityRule(lateNight, rules, 'prof-1')).toBeDefined();
    expect(getUnavailabilityRule(earlyMorning, rules, 'prof-1')).toBeDefined();
  });
});
