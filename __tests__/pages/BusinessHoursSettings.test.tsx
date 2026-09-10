// __tests__/pages/BusinessHoursSettings.test.tsx
// Testes da página "Horários de Atendimento" (pages/BusinessHoursSettings.tsx).

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UserRole } from '../../types';

const render = (ui: React.ReactElement) =>
  rtlRender(ui, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });

const DAY = { isOpen: true, start: '08:00', end: '18:00' };
const FULL_HOURS = {
  monday: DAY, tuesday: DAY, wednesday: DAY, thursday: DAY, friday: DAY,
  saturday: { isOpen: true, start: '09:00', end: '13:00' },
  sunday: { isOpen: false, start: '00:00', end: '00:00' },
};

type RuleResult = { success: boolean; error?: string };

const updateCompany = vi.fn<(id: string, data: unknown) => Promise<RuleResult>>();
const addUnavailabilityRule = vi.fn<(rule: unknown) => Promise<RuleResult>>();
const removeUnavailabilityRule = vi.fn<(id: string) => Promise<RuleResult>>();

const appState: {
  professionals: unknown[];
  unavailabilityRules: unknown[];
} = { professionals: [], unavailabilityRules: [] };

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({
    currentCompany: { id: 'c1', name: 'Clínica X', businessHours: FULL_HOURS },
    updateCompany,
    professionals: appState.professionals,
    addUnavailabilityRule,
    removeUnavailabilityRule,
    unavailabilityRules: appState.unavailabilityRules,
    setHasUnsavedChanges: vi.fn(),
    triggerSave: false,
    setTriggerSave: vi.fn(),
    pendingNavigationPath: null as string | null,
    setPendingNavigationPath: vi.fn(),
  }),
}));

import BusinessHoursSettings from '../../pages/BusinessHoursSettings';

function prof(over: Record<string, unknown> = {}) {
  return { id: 'p1', name: 'Bruna Lima', role: UserRole.ESTHETICIAN, ...over };
}

/** Os 2 últimos input[type=time] da página são Início/Término do bloqueio (os
 *  14 primeiros são do BusinessHoursEditor: 7 dias x 2). */
function unavTimeInputs(container: HTMLElement) {
  const times = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="time"]'));
  return { start: times[times.length - 2], end: times[times.length - 1] };
}

beforeEach(() => {
  vi.clearAllMocks();
  appState.professionals = [prof()];
  appState.unavailabilityRules = [];
  updateCompany.mockResolvedValue({ success: true });
  addUnavailabilityRule.mockResolvedValue({ success: true });
  removeUnavailabilityRule.mockResolvedValue({ success: true });
});

describe('pages/BusinessHoursSettings — salvar horário de funcionamento', () => {
  it('salvar chama updateCompany com { businessHours } e mostra toast de sucesso', async () => {
    render(<BusinessHoursSettings />);
    fireEvent.click(screen.getByRole('button', { name: /Salvar Horários/i }));

    expect(await screen.findByText(/Horários de atendimento atualizados/i)).toBeInTheDocument();
    expect(updateCompany).toHaveBeenCalledWith('c1', { businessHours: FULL_HOURS });
  });

  it('falha de updateCompany ({ success: false }) mostra o toast de erro com a mensagem retornada', async () => {
    updateCompany.mockResolvedValue({ success: false, error: 'Horário inválido no servidor' });
    render(<BusinessHoursSettings />);
    fireEvent.click(screen.getByRole('button', { name: /Salvar Horários/i }));

    expect(await screen.findByText('Horário inválido no servidor')).toBeInTheDocument();
  });
});

describe('pages/BusinessHoursSettings — regras de indisponibilidade', () => {
  it('bloqueia o envio sem horário de início/término', async () => {
    render(<BusinessHoursSettings />);
    fireEvent.click(screen.getByRole('button', { name: /Adicionar Regra/i }));

    expect(await screen.findByText(/Preencha o horário de início e término/i)).toBeInTheDocument();
    expect(addUnavailabilityRule).not.toHaveBeenCalled();
  });

  it('bloqueia o envio sem data selecionada', async () => {
    const { container } = render(<BusinessHoursSettings />);
    const { start, end } = unavTimeInputs(container);
    fireEvent.change(start, { target: { value: '12:00' } });
    fireEvent.change(end, { target: { value: '13:00' } });
    fireEvent.click(screen.getByRole('button', { name: /Adicionar Regra/i }));

    expect(await screen.findByText(/Selecione pelo menos uma data/i)).toBeInTheDocument();
    expect(addUnavailabilityRule).not.toHaveBeenCalled();
  });

  it('bloqueia o envio sem profissional/"Toda a Equipe"', async () => {
    const { container } = render(<BusinessHoursSettings />);
    const { start, end } = unavTimeInputs(container);
    fireEvent.change(start, { target: { value: '12:00' } });
    fireEvent.change(end, { target: { value: '13:00' } });
    fireEvent.change(container.querySelector('input[type="date"]')!, { target: { value: '2026-03-01' } });
    fireEvent.click(screen.getByRole('button', { name: /Adicionar Regra/i }));
    fireEvent.click(screen.getByRole('button', { name: /Adicionar Regra/i }));

    expect(await screen.findByText(/Selecione 'Toda a Equipe' ou funcionários específicos/i)).toBeInTheDocument();
    expect(addUnavailabilityRule).not.toHaveBeenCalled();
  });

  it('auto-adiciona a data digitada no input quando o usuário esquece de clicar em "+"', async () => {
    const { container } = render(<BusinessHoursSettings />);
    const { start, end } = unavTimeInputs(container);
    fireEvent.change(start, { target: { value: '12:00' } });
    fireEvent.change(end, { target: { value: '13:00' } });
    // digita a data mas NÃO clica no "+"
    fireEvent.change(container.querySelector('input[type="date"]')!, { target: { value: '2026-03-01' } });
    // seleciona um profissional (o select auto-adiciona no onChange)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'all' } });

    fireEvent.click(screen.getByRole('button', { name: /Adicionar Regra/i }));

    expect(addUnavailabilityRule).toHaveBeenCalledTimes(1);
    expect(addUnavailabilityRule).toHaveBeenCalledWith(
      expect.objectContaining({
        startTime: '12:00',
        endTime: '13:00',
        dates: ['2026-03-01'],
        professionalIds: ['all'],
      })
    );
  });

  it('falha de addUnavailabilityRule mostra toast de erro (não falha em silêncio)', async () => {
    addUnavailabilityRule.mockResolvedValue({ success: false, error: 'Existem 2 agendamentos ativos neste período.' });
    const { container } = render(<BusinessHoursSettings />);
    const { start, end } = unavTimeInputs(container);
    fireEvent.change(start, { target: { value: '12:00' } });
    fireEvent.change(end, { target: { value: '13:00' } });
    fireEvent.change(container.querySelector('input[type="date"]')!, { target: { value: '2026-03-01' } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'all' } });
    fireEvent.click(screen.getByRole('button', { name: /Adicionar Regra/i }));

    expect(await screen.findByText('Existem 2 agendamentos ativos neste período.')).toBeInTheDocument();
  });

  it('falha de removeUnavailabilityRule mostra toast de erro', async () => {
    appState.unavailabilityRules = [
      { id: 'r1', description: 'Feriado', startTime: '08:00', endTime: '18:00', dates: ['2026-03-01'], professionalIds: ['all'] },
    ];
    removeUnavailabilityRule.mockResolvedValue({ success: false, error: 'Não foi possível remover.' });
    render(<BusinessHoursSettings />);

    const ruleRow = screen.getByText('Feriado').closest('div')!.parentElement!.parentElement as HTMLElement;
    fireEvent.click(within(ruleRow).getByRole('button'));

    expect(await screen.findByText('Não foi possível remover.')).toBeInTheDocument();
  });
});
