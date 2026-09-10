// __tests__/pages/Subscriptions.test.tsx
// Testes de componente da aba "Clube de Assinaturas" (pages/Subscriptions.tsx)

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { formatCurrency } from '../../utils/formatUtils';

const render = (ui: React.ReactElement) =>
  rtlRender(ui, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });

const { mockApi, mockShowAlert, mockConfirm, appState } = vi.hoisted(() => ({
  mockApi: {
    listPlans: vi.fn(),
    listSubscribers: vi.fn(),
    listPending: vi.fn(),
    cancel: vi.fn(),
    activate: vi.fn(),
    deactivatePlan: vi.fn(),
  },
  mockShowAlert: vi.fn(),
  mockConfirm: vi.fn(),
  appState: {
    patients: [] as { id: string; name: string }[],
    procedures: [] as { id: string; name: string; price: number }[],
  },
}));

vi.mock('../../services/api', () => ({ subscriptionsApi: mockApi }));
vi.mock('../../context/AppContext', () => ({
  useApp: () => ({
    patients: appState.patients,
    procedures: appState.procedures,
    loadPatients: vi.fn(),
    loadProcedures: vi.fn(),
  }),
}));
vi.mock('../../context/DialogContext', () => ({
  useDialog: () => ({ showAlert: mockShowAlert, confirm: mockConfirm }),
}));
vi.mock('../../components/SubscriptionPlanModal', () => ({ default: (): null => null }));

import Subscriptions from '../../pages/Subscriptions';
import type { SubscriptionPlan, PatientSubscription } from '../../services/api';

// ── fixtures ──────────────────────────────────────────────────────────────────

function planItem(procedureId: string, sessionsPerCycle = 1) {
  return { id: `item-${procedureId}`, procedureId, sessionsPerCycle, procedure: { id: procedureId, name: procedureId.toUpperCase(), price: 100 } };
}

function plan(over: Record<string, unknown> = {}): SubscriptionPlan {
  return {
    id: 'plan-1',
    name: 'Plano Ouro',
    price: 100,
    description: 'desc',
    imageUrl: null,
    isActive: true,
    companyId: 'c1',
    createdAt: '2026-01-01T00:00:00.000Z',
    items: [planItem('proc-a', 2)],
    _count: { subscribers: 0 },
    ...over,
  };
}

function sub(over: Record<string, unknown> = {}): PatientSubscription {
  return {
    id: 'sub-1',
    status: 'ACTIVE',
    startDate: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    nextBillingDate: '2026-02-01T00:00:00.000Z',
    sessionsUsedThisCycle: {},
    lastCycleReset: '2026-01-01T00:00:00.000Z',
    asaasSubscriptionId: null,
    patientId: 'pat-1',
    planId: 'plan-1',
    companyId: 'c1',
    patient: { id: 'pat-1', name: 'Maria Silva', phone: '11999990000', email: 'maria@x.com' },
    plan: plan(),
    ...over,
  };
}

const kpiValues = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('p.text-2xl.font-bold.text-slate-800')).map((e) => e.textContent);

beforeEach(() => {
  vi.clearAllMocks();
  appState.patients = [];
  appState.procedures = [];
  mockConfirm.mockResolvedValue(true);
  mockApi.listPlans.mockResolvedValue({ success: true, data: [] });
  mockApi.listSubscribers.mockResolvedValue({ success: true, data: [] });
  mockApi.listPending.mockResolvedValue({ success: true, data: [] });
  mockApi.cancel.mockResolvedValue({ success: true, data: {} });
  mockApi.activate.mockResolvedValue({ success: true, data: {} });
  mockApi.deactivatePlan.mockResolvedValue({ success: true, data: {} });
});

describe('pages/Subscriptions', () => {
  it('calcula os KPIs: planos ativos, assinantes ACTIVE, MRR só de ACTIVE e pendentes', async () => {
    mockApi.listPlans.mockResolvedValue({
      success: true,
      data: [plan({ id: 'p1', isActive: true }), plan({ id: 'p2', isActive: false })],
    });
    mockApi.listSubscribers.mockResolvedValue({
      success: true,
      data: [
        sub({ id: 's1', status: 'ACTIVE', plan: plan({ price: 100 }) }),
        sub({ id: 's2', status: 'CANCELED', plan: plan({ price: 999 }) }),
      ],
    });
    mockApi.listPending.mockResolvedValue({ success: true, data: [sub({ id: 's3', status: 'PENDING' })] });

    const { container } = render(<Subscriptions />);
    await screen.findByText('Clube de Assinaturas');

    await waitFor(() => {
      const [planosAtivos, assinantesAtivos, mrr, pendentes] = kpiValues(container);
      expect(planosAtivos).toBe('1'); // p2 está inativo
      expect(assinantesAtivos).toBe('1'); // s2 está CANCELED
      expect(mrr).toBe(formatCurrency(100)); // não soma o assinante CANCELED (999)
      expect(pendentes).toBe('1');
    });
  });

  it('barra de progresso de sessões: pinta vermelho e limita em 100% quando usadas >= limite', async () => {
    mockApi.listSubscribers.mockResolvedValue({
      success: true,
      data: [
        sub({
          id: 's1',
          status: 'ACTIVE',
          sessionsUsedThisCycle: { 'proc-a': 5, 'proc-b': 3 }, // 8
          plan: plan({ items: [planItem('proc-a', 2), planItem('proc-b', 2)] }), // cap 4
        }),
      ],
    });

    const { container } = render(<Subscriptions />);
    await screen.findByText('Clube de Assinaturas');
    fireEvent.click(screen.getByRole('button', { name: /Assinantes/ }));

    const bar = await waitFor(() => {
      const el = container.querySelector('.bg-rose-400') as HTMLElement | null;
      if (!el) throw new Error('barra vermelha ainda não renderizou');
      return el;
    });
    expect(bar.style.width).toBe('100%'); // Math.min(100, 8/4*100)
    expect(screen.getByText('8/4')).toBeInTheDocument();
  });

  it('barra de progresso de sessões: pinta verde e usa proporção correta quando abaixo do limite', async () => {
    mockApi.listSubscribers.mockResolvedValue({
      success: true,
      data: [
        sub({
          id: 's1',
          status: 'ACTIVE',
          sessionsUsedThisCycle: { 'proc-a': 1 }, // 1
          plan: plan({ items: [planItem('proc-a', 2), planItem('proc-b', 2)] }), // cap 4
        }),
      ],
    });

    const { container } = render(<Subscriptions />);
    await screen.findByText('Clube de Assinaturas');
    fireEvent.click(screen.getByRole('button', { name: /Assinantes/ }));

    const bar = await waitFor(() => {
      const el = container.querySelector('.bg-emerald-400') as HTMLElement | null;
      if (!el) throw new Error('barra verde ainda não renderizou');
      return el;
    });
    expect(bar.style.width).toBe('25%');
    expect(screen.getByText('1/4')).toBeInTheDocument();
  });

  it('exibe showAlert com o erro do backend quando cancel() falha', async () => {
    mockApi.listSubscribers.mockResolvedValue({
      success: true,
      data: [sub({ id: 's1', status: 'ACTIVE' })],
    });
    mockApi.cancel.mockResolvedValue({ success: false, error: 'Falha ao cancelar assinatura' });

    render(<Subscriptions />);
    await screen.findByText('Clube de Assinaturas');
    fireEvent.click(screen.getByRole('button', { name: /Assinantes/ }));

    fireEvent.click(await screen.findByRole('button', { name: /Cancelar/ }));

    await waitFor(() =>
      expect(mockShowAlert).toHaveBeenCalledWith(
        'Falha ao cancelar assinatura',
        expect.objectContaining({ variant: 'danger' })
      )
    );
  });

  it('exibe showAlert com o erro do backend quando deactivatePlan() falha', async () => {
    mockApi.listPlans.mockResolvedValue({ success: true, data: [plan({ id: 'p1', isActive: true })] });
    mockApi.deactivatePlan.mockResolvedValue({ success: false, error: 'Falha ao desativar plano' });

    render(<Subscriptions />);
    await screen.findByText('Clube de Assinaturas');

    fireEvent.click(await screen.findByTitle('Desativar'));

    await waitFor(() =>
      expect(mockShowAlert).toHaveBeenCalledWith(
        'Falha ao desativar plano',
        expect.objectContaining({ variant: 'danger' })
      )
    );
  });

  it('exibe showAlert com o erro do backend quando activate() (aba Pendentes) falha', async () => {
    mockApi.listPending.mockResolvedValue({ success: true, data: [sub({ id: 's3', status: 'PENDING' })] });
    mockApi.activate.mockResolvedValue({ success: false, error: 'Cobrança inicial falhou' });

    render(<Subscriptions />);
    await screen.findByText('Clube de Assinaturas');
    fireEvent.click(screen.getByRole('button', { name: /Pendentes/ }));

    fireEvent.click(await screen.findByRole('button', { name: /Ativar Plano/ }));

    await waitFor(() =>
      expect(mockShowAlert).toHaveBeenCalledWith(
        'Cobrança inicial falhou',
        expect.objectContaining({ variant: 'danger' })
      )
    );
  });

  it('renderiza o estado vazio de cada aba', async () => {
    render(<Subscriptions />);
    await screen.findByText('Clube de Assinaturas');

    // aba Planos (default)
    expect(screen.getByText('Nenhum plano criado')).toBeInTheDocument();

    // aba Assinantes
    fireEvent.click(screen.getByRole('button', { name: /Assinantes/ }));
    expect(await screen.findByText('Nenhuma assinante')).toBeInTheDocument();

    // aba Pendentes
    fireEvent.click(screen.getByRole('button', { name: /Pendentes/ }));
    expect(await screen.findByText('Nenhum plano pendente')).toBeInTheDocument();
  });
});
