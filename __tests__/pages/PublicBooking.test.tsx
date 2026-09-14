// __tests__/pages/PublicBooking.test.tsx
// Testes da tela de agendamento público (pages/PublicBooking.tsx), usada tanto
// por visitante anônimo quanto por paciente já logado (isLoggedInPatient),
// tanto para procedimento avulso quanto para procedimento de plano de
// assinatura (bookingMode === 'plan').
//
// Cobre os bugs confirmados na auditoria (docs/test-audit/cliente-agendamento-publico.md):
//   - Bug B: botão da tela de sucesso desloga paciente já autenticado
//   - Bug C: subscriptionId nunca é enviado ao agendar por um paciente logado em modo plano
//   - Passo 3: slot cujo término ultrapassaria o fechamento não era desabilitado

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UserRole } from '../../types';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('../../utils/subdomain', () => ({
  getClinicSlug: () => 'clinica-aura',
  getPortalBasePath: () => '/clinica-aura',
}));

const logoutMock = vi.fn().mockResolvedValue(undefined);

interface MockUser {
  role: UserRole;
  companyId: string;
  name?: string;
  email?: string;
}

const appState: { user: MockUser | null } = { user: null };

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({ user: appState.user, logout: logoutMock }),
}));

const getCompanyBySlugMock = vi.fn();
const createMock = vi.fn();
const createPublicMock = vi.fn();
const bookSubscriptionPlanMock = vi.fn();

vi.mock('../../services/api', () => ({
  publicApi: { getCompanyBySlug: (...args: unknown[]) => getCompanyBySlugMock(...args) },
  appointmentsApi: {
    create: (...args: unknown[]) => createMock(...args),
    createPublic: (...args: unknown[]) => createPublicMock(...args),
  },
  publicBookingApi: {
    bookSubscriptionPlan: (...args: unknown[]) => bookSubscriptionPlanMock(...args),
  },
  getAuthToken: () => 'fake-token',
  API_BASE_URL: 'http://localhost:3001',
}));

import PublicBooking, { toLocalDateInputValue } from '../../pages/PublicBooking';

// ── fixtures ────────────────────────────────────────────────────────────────

const COMPANY_ID = 'company-1';

const BUSINESS_HOURS_ALL_OPEN_8_18 = {
  monday: { isOpen: true, start: '08:00', end: '18:00' },
  tuesday: { isOpen: true, start: '08:00', end: '18:00' },
  wednesday: { isOpen: true, start: '08:00', end: '18:00' },
  thursday: { isOpen: true, start: '08:00', end: '18:00' },
  friday: { isOpen: true, start: '08:00', end: '18:00' },
  saturday: { isOpen: true, start: '08:00', end: '18:00' },
  sunday: { isOpen: true, start: '08:00', end: '18:00' },
};

const PROCEDURE_SIMPLE = { id: 'proc-simple', companyId: COMPANY_ID, name: 'Limpeza de Pele', durationMinutes: 30, price: 100 };
const PROCEDURE_LONG = { id: 'proc-long', companyId: COMPANY_ID, name: 'Procedimento Longo', durationMinutes: 90, price: 200 };
const PROFESSIONAL = { id: 'prof-1', companyId: COMPANY_ID, name: 'Dra. Ana', role: UserRole.ESTHETICIAN };
const PLAN = {
  id: 'plan-1',
  name: 'Plano X',
  price: 100,
  items: [{ procedureId: PROCEDURE_LONG.id, sessionsPerCycle: 2, procedure: { id: PROCEDURE_LONG.id, name: PROCEDURE_LONG.name, price: 200 } }],
};
const ACTIVE_SUBSCRIPTION = {
  id: 'sub-1',
  status: 'ACTIVE',
  planId: PLAN.id,
  sessionsUsedThisCycle: { [PROCEDURE_LONG.id]: 0 },
  plan: { id: PLAN.id, name: PLAN.name, items: [{ procedureId: PROCEDURE_LONG.id, sessionsPerCycle: 2, procedure: { name: PROCEDURE_LONG.name } }] },
};

function buildCompanyResponse(overrides: { procedures?: unknown[]; subscriptionPlans?: unknown[] } = {}) {
  return {
    success: true,
    data: {
      company: {
        id: COMPANY_ID,
        slug: 'clinica-aura',
        name: 'Clínica Aura',
        address: '',
        logo: '',
        layoutConfig: null as unknown,
        businessHours: BUSINESS_HOURS_ALL_OPEN_8_18,
        onlineBookingConfig: { slotInterval: 30, minAdvanceTime: 0, maxBookingPeriod: 400, cancellationNotice: 0 },
      },
      procedures: overrides.procedures ?? [PROCEDURE_SIMPLE],
      professionals: [PROFESSIONAL],
      appointments: [] as unknown[],
      unavailabilityRules: [] as unknown[],
      subscriptionPlans: overrides.subscriptionPlans ?? [],
    },
  };
}

// Próxima segunda-feira a partir de "hoje" (determinístico, sem depender do
// fuso de quem roda o teste — mesmo padrão usado nos testes de backend).
function nextMondayISODateString(): string {
  const d = new Date();
  d.setDate(d.getDate() + (((8 - d.getDay()) % 7) || 7));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function render() {
  return rtlRender(<PublicBooking clinicSlug="clinica-aura" />, {
    wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
  });
}

async function waitForStep1() {
  await waitFor(() => expect(screen.getByText('Escolha o tratamento')).toBeInTheDocument());
}

/** Avança do step1 (escolhe procedimento/plano pelo texto) até o step3 (grade de horários) com Dra. Ana selecionada. */
async function advanceToStep3(clickText: string) {
  fireEvent.click(screen.getByText(clickText));
  await waitFor(() => expect(screen.getByText('Qual especialista?')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Dra. Ana'));
  await waitFor(() => expect(screen.getByText('Escolha o melhor horário')).toBeInTheDocument());
}

function setDateToNextMonday(container: HTMLElement) {
  const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
  fireEvent.change(dateInput, { target: { value: nextMondayISODateString() } });
}

async function pickSlotAndConfirm(time: string) {
  fireEvent.click(screen.getByText(time));
  fireEvent.click(screen.getByText('Confirmar Horário Selecionado'));
  await waitFor(() =>
    expect(screen.getByText(/Dados Pessoais|Confirmar Agendamento/)).toBeInTheDocument()
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  appState.user = null;
  logoutMock.mockResolvedValue(undefined);
  getCompanyBySlugMock.mockResolvedValue(buildCompanyResponse());
  global.fetch = vi.fn().mockResolvedValue({
    json: async () => ({ success: true, data: [] as unknown[] }),
  } as unknown as Response);
});

describe('pages/PublicBooking', () => {
  describe('Bug B: botão da tela de sucesso não pode deslogar paciente já autenticado', () => {
    it('paciente logado: após sucesso, o botão leva de volta ao portal SEM deslogar', async () => {
      appState.user = { role: UserRole.PATIENT, companyId: COMPANY_ID, name: 'Maria Paciente', email: 'maria@example.com' };
      global.fetch = vi.fn().mockResolvedValue({
        json: async () => ({ success: true, data: [] as unknown[] }),
      } as unknown as Response);
      createMock.mockResolvedValue({ success: true, data: { appointment: { id: 'appt-1' } } });

      const { container } = render();
      await waitForStep1();

      await advanceToStep3(PROCEDURE_SIMPLE.name);
      setDateToNextMonday(container);
      await pickSlotAndConfirm('08:00');

      fireEvent.change(screen.getByPlaceholderText('(11) 99999-9999'), { target: { value: '11999998888' } });
      fireEvent.click(screen.getByText('Solicitar Agendamento'));

      await waitFor(() => expect(screen.getByText('Solicitação Enviada!')).toBeInTheDocument());

      fireEvent.click(screen.getByRole('button'));

      expect(logoutMock).not.toHaveBeenCalled();
      expect(navigateMock).toHaveBeenCalledWith('/clinica-aura/minha-conta');
    });

    it('visitante novo (não logado): após sucesso, o botão desloga e vai para /login (comportamento preservado)', async () => {
      appState.user = null;
      createPublicMock.mockResolvedValue({ success: true, data: { appointment: { id: 'appt-1' } } });

      const { container } = render();
      await waitForStep1();

      await advanceToStep3(PROCEDURE_SIMPLE.name);
      setDateToNextMonday(container);
      await pickSlotAndConfirm('08:00');

      fireEvent.change(screen.getByPlaceholderText('Ex: Maria Oliveira'), { target: { value: 'Maria Nova' } });
      fireEvent.change(screen.getByPlaceholderText('(11) 99999-9999'), { target: { value: '11999998888' } });
      fireEvent.change(screen.getByPlaceholderText('seu@email.com'), { target: { value: 'nova@example.com' } });
      const passwordInputs = screen.getAllByPlaceholderText('••••••••');
      fireEvent.change(passwordInputs[0], { target: { value: 'senha1234' } });
      fireEvent.change(passwordInputs[1], { target: { value: 'senha1234' } });
      fireEvent.click(screen.getByText('Solicitar Agendamento'));

      await waitFor(() => expect(screen.getByText('Solicitação Enviada!')).toBeInTheDocument());

      fireEvent.click(screen.getByRole('button'));

      expect(logoutMock).toHaveBeenCalledTimes(1);
      expect(navigateMock).toHaveBeenCalledWith('/login');
    });
  });

  describe('Bug C: subscriptionId deve ser enviado ao agendar plano como paciente logado', () => {
    it('envia subscriptionId da assinatura ATIVA correspondente ao plano selecionado', async () => {
      appState.user = { role: UserRole.PATIENT, companyId: COMPANY_ID, name: 'Maria Paciente', email: 'maria@example.com' };
      getCompanyBySlugMock.mockResolvedValue(
        buildCompanyResponse({ procedures: [PROCEDURE_LONG], subscriptionPlans: [PLAN] })
      );
      global.fetch = vi.fn().mockResolvedValue({
        json: async () => ({ success: true, data: [ACTIVE_SUBSCRIPTION] }),
      } as unknown as Response);
      createMock.mockResolvedValue({ success: true, data: { appointment: { id: 'appt-1' } } });

      const { container } = render();
      await waitForStep1();
      await waitFor(() => expect(global.fetch).toHaveBeenCalled());

      // Seleciona o plano (não o procedimento avulso) — assinatura já ativa,
      // então pula direto para a escolha de especialista.
      await advanceToStep3(PLAN.name);
      setDateToNextMonday(container);
      await pickSlotAndConfirm('08:00');

      fireEvent.change(screen.getByPlaceholderText('(11) 99999-9999'), { target: { value: '11999998888' } });
      fireEvent.click(screen.getByText('Solicitar Agendamento'));

      await waitFor(() => expect(createMock).toHaveBeenCalled());
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({ subscriptionId: ACTIVE_SUBSCRIPTION.id, price: 0 })
      );
    });
  });

  describe('Passo 3: slot cujo término ultrapassaria o fechamento não pode ser oferecido', () => {
    it('procedimento de 90min às 17:30 (clínica fecha 18:00) aparece desabilitado/indisponível', async () => {
      getCompanyBySlugMock.mockResolvedValue(buildCompanyResponse({ procedures: [PROCEDURE_LONG] }));

      const { container } = render();
      await waitForStep1();
      await advanceToStep3(PROCEDURE_LONG.name);
      setDateToNextMonday(container);

      const slot1730 = screen.getByText('17:30').closest('button') as HTMLButtonElement;
      expect(slot1730).toBeDisabled();
      expect(screen.getByText('08:00').closest('button')).not.toBeDisabled();
    });
  });

  // Bug achado ao investigar uma falha intermitente nos testes acima: o
  // <input type="date"> oculto (usado só pra abrir o seletor nativo) exibia
  // amanhã em vez de hoje sempre que rodado à noite no Brasil (depois de
  // ~21h), porque construía o valor com toISOString() (UTC) em vez da data
  // local. Isso também mascarava mudança de data nos testes acima sempre que
  // rodados nesse horário — corrigido junto.
  describe('toLocalDateInputValue — valor do seletor nativo de data usa a data LOCAL, não UTC', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('à noite no Brasil (UTC-3), depois da meia-noite em UTC, ainda mostra o dia local — não amanhã', () => {
      // 21h de sábado em São Paulo (UTC-3) == 00h de domingo em UTC.
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-09-12T21:00:00-03:00'));
      expect(toLocalDateInputValue(new Date())).toBe('2026-09-12');
    });

    it('de manhã, sem a travessia de meia-noite em UTC, também acerta (não regride o caso simples)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-09-12T09:00:00-03:00'));
      expect(toLocalDateInputValue(new Date())).toBe('2026-09-12');
    });

    it('preenche mês e dia com zero à esquerda (formato YYYY-MM-DD)', () => {
      expect(toLocalDateInputValue(new Date(2026, 0, 5))).toBe('2026-01-05'); // 5 de janeiro
    });
  });
});
