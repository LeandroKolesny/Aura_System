// __tests__/pages/Dashboard.test.tsx
// Testes de componente da aba "Dashboard" (pages/Dashboard.tsx -> ClinicDashboard)
// + testes da função pura de tendência de receita (utils/dashboardCalc.ts).

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UserRole } from '../../types';
import type { Appointment, SystemAlert } from '../../types';
import type { DashboardData, PatientSubscription, SubscriptionPlan } from '../../services/api';
import { formatCurrency } from '../../utils/formatUtils';
import { calcRevenueTrend } from '../../utils/dashboardCalc';

const render = (ui: React.ReactElement) =>
  rtlRender(ui, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });

// ── mocks de módulos ──────────────────────────────────────────────────────────
const getStats = vi.fn();
const listPending = vi.fn();
const activatePlan = vi.fn();
const cancelPlan = vi.fn();
const changeAppointmentStatus = vi.fn();
const addNotification = vi.fn();
const loadAppointments = vi.fn();
const showAlert = vi.fn();

interface TestCtx {
  appointments: Appointment[];
  user: { role: UserRole; companyId: string } | null;
  systemAlerts: SystemAlert[];
  currentCompany: { name: string } | null;
  dismissedAlertIds: string[];
}

const appState: TestCtx = {
  appointments: [],
  user: { role: UserRole.ADMIN, companyId: 'c1' },
  systemAlerts: [],
  currentCompany: { name: 'Clínica Bella' },
  dismissedAlertIds: [],
};

vi.mock('../../services/api', () => ({
  dashboardApi: { getStats: (...a: unknown[]) => getStats(...a) },
  subscriptionsApi: {
    listPending: (...a: unknown[]) => listPending(...a),
    activate: (...a: unknown[]) => activatePlan(...a),
    cancel: (...a: unknown[]) => cancelPlan(...a),
  },
}));

vi.mock('../../context/AppContext', () => ({
  // `dismissedAlertIds` é estado real para que o teste de "descartar alerta"
  // observe a remoção imediata (client-side, sem API).
  useApp: () => {
    const [dismissedAlertIds, setDismissed] = React.useState<string[]>(appState.dismissedAlertIds);
    return {
      appointments: appState.appointments,
      user: appState.user,
      systemAlerts: appState.systemAlerts,
      currentCompany: appState.currentCompany,
      dismissedAlertIds,
      dismissAlert: (id: string) =>
        setDismissed((prev) => (prev.includes(id) ? prev : [...prev, id])),
      addNotification,
      loadAppointments,
      changeAppointmentStatus,
    };
  },
}));

vi.mock('../../context/DialogContext', () => ({
  useDialog: () => ({ showAlert, confirm: async () => true }),
}));

vi.mock('../../components/Modals', () => ({ AlertDetailsModal: (): null => null }));

import Dashboard from '../../pages/Dashboard';

// ── fixtures ──────────────────────────────────────────────────────────────────

const okStats = (data: DashboardData) => ({ success: true, data });

// Intl.NumberFormat (pt-BR) usa NARROW NO-BREAK SPACE (U+202F); o normalizador do
// Testing Library colapsa esse caractere para espaço comum no DOM, mas não na
// string de consulta — então normalizamos os dois lados.
const brl = (n: number) => formatCurrency(n).replace(/\s/g, ' ');

function dash(
  kpisOver: Partial<DashboardData['kpis']> = {},
  chartsOver: Partial<DashboardData['charts']> = {},
  alertsOver: Partial<DashboardData['alerts']> = {}
): DashboardData {
  return {
    kpis: {
      revenue: 5000,
      ticketMedio: 250,
      seenPatients: 42,
      cancelRate: 12.5,
      appointmentsTotal: 100,
      appointmentsConfirmed: 80,
      appointmentsCompleted: 60,
      appointmentsCanceled: 20,
      ...kpisOver,
    },
    charts: {
      revenueChart: [
        { date: '2026-09-01', name: 'seg', value: 100 },
        { date: '2026-09-02', name: 'ter', value: 150 },
      ],
      topProcedures: [{ name: 'Limpeza de Pele', count: 8 }],
      ...chartsOver,
    },
    alerts: { lowStock: [], ...alertsOver },
    days: 7,
  };
}

function appt(over: Partial<Appointment> = {}): Appointment {
  return {
    id: 'a1',
    companyId: 'c1',
    patientId: 'p1',
    patientName: 'Maria Silva',
    professionalId: 'pro1',
    professionalName: 'Dra. Ana',
    service: 'Botox',
    price: 500,
    date: '2026-09-20T14:00:00.000Z',
    durationMinutes: 60,
    status: 'pending_approval',
    ...over,
  };
}

function sysAlert(over: Partial<SystemAlert> = {}): SystemAlert {
  return {
    id: 'al1',
    title: 'Aviso do sistema',
    message: 'mensagem',
    type: 'info',
    target: 'all',
    status: 'active',
    createdAt: '2026-09-01T00:00:00.000Z',
    ...over,
  };
}

function planFixture(): SubscriptionPlan {
  return {
    id: 'plan-1',
    name: 'Plano Ouro',
    price: 200,
    description: null,
    imageUrl: null,
    isActive: true,
    companyId: 'c1',
    createdAt: '2026-01-01T00:00:00.000Z',
    items: [],
    _count: { subscribers: 0 },
  };
}

function planSub(over: Partial<PatientSubscription> = {}): PatientSubscription {
  return {
    id: 'sub-1',
    status: 'PENDING',
    startDate: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    nextBillingDate: '2026-10-01T00:00:00.000Z',
    sessionsUsedThisCycle: {},
    lastCycleReset: '2026-09-01T00:00:00.000Z',
    asaasSubscriptionId: null,
    patientId: 'pat-1',
    planId: 'plan-1',
    companyId: 'c1',
    patient: { id: 'pat-1', name: 'João Souza', phone: '11999990000', email: 'joao@x.com' },
    plan: planFixture(),
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  appState.appointments = [];
  appState.user = { role: UserRole.ADMIN, companyId: 'c1' };
  appState.systemAlerts = [];
  appState.currentCompany = { name: 'Clínica Bella' };
  appState.dismissedAlertIds = [];
  getStats.mockResolvedValue(okStats(dash()));
  listPending.mockResolvedValue({ success: true, data: [] });
  activatePlan.mockResolvedValue({ success: true, data: {} });
  cancelPlan.mockResolvedValue({ success: true, data: {} });
  changeAppointmentStatus.mockResolvedValue({ success: true });
  loadAppointments.mockResolvedValue(undefined);
});

// ── função pura: calcRevenueTrend ─────────────────────────────────────────────

describe('utils/dashboardCalc.calcRevenueTrend', () => {
  it('retorna null com menos de 2 pontos', () => {
    expect(calcRevenueTrend(undefined)).toBeNull();
    expect(calcRevenueTrend(null)).toBeNull();
    expect(calcRevenueTrend([])).toBeNull();
    expect(calcRevenueTrend([{ value: 10 }])).toBeNull();
  });

  it('calcula a variação percentual arredondada entre 1ª e 2ª metade', () => {
    expect(calcRevenueTrend([{ value: 100 }, { value: 150 }])).toBe(50);
    expect(calcRevenueTrend([{ value: 200 }, { value: 100 }])).toBe(-50);
  });

  it('primeira metade === 0: retorna 100 se a segunda for > 0, senão 0', () => {
    expect(calcRevenueTrend([{ value: 0 }, { value: 50 }])).toBe(100);
    expect(calcRevenueTrend([{ value: 0 }, { value: 0 }])).toBe(0);
  });

  it('usa Math.floor(n/2) como ponto de corte quando o nº de pontos é ímpar', () => {
    // 3 pontos -> half=1 -> first=[10]=10, second=[20,30]=50 -> round((50-10)/10*100)=400
    expect(calcRevenueTrend([{ value: 10 }, { value: 20 }, { value: 30 }])).toBe(400);
  });
});

// ── render do ClinicDashboard ─────────────────────────────────────────────────

describe('pages/Dashboard (ClinicDashboard)', () => {
  it('exibe a tag de tendência no card "Faturamento" calculada a partir de revenueChart', async () => {
    getStats.mockResolvedValue(
      okStats(
        dash(
          {},
          {
            revenueChart: [
              { date: 'd1', name: 'seg', value: 100 },
              { date: 'd2', name: 'ter', value: 150 },
            ],
          }
        )
      )
    );

    render(<Dashboard />);
    const card = ((await screen.findByText('Faturamento')).closest('div.bg-white')) as HTMLElement;
    expect(within(card).getByText('+50%')).toBeInTheDocument();
  });

  it('omite a tag de tendência quando revenueChart tem menos de 2 pontos', async () => {
    getStats.mockResolvedValue(okStats(dash({}, { revenueChart: [] })));

    render(<Dashboard />);
    const card = ((await screen.findByText('Faturamento')).closest('div.bg-white')) as HTMLElement;
    expect(within(card).queryByText(/%$/)).toBeNull();
  });

  it('renderiza os 4 StatCards, a faixa de 5 mini-KPIs e os 2 gráficos SVG', async () => {
    getStats.mockResolvedValue(
      okStats(
        dash({
          revenue: 5000,
          ticketMedio: 250,
          seenPatients: 42,
          cancelRate: 12.5,
          appointmentsTotal: 100,
          appointmentsConfirmed: 80,
          appointmentsCompleted: 60,
          appointmentsCanceled: 20,
        })
      )
    );

    const { container } = render(<Dashboard />);
    await screen.findByText('Faturamento');

    // StatCards
    expect(screen.getByText(brl(5000))).toBeInTheDocument();
    expect(screen.getByText(brl(250))).toBeInTheDocument();
    expect(screen.getByText('Ticket Médio')).toBeInTheDocument();
    expect(screen.getByText('Pacientes Atendidos')).toBeInTheDocument();
    expect(screen.getByText('Taxa de Cancelamento')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    // 12.5% aparece no StatCard e no mini-KPI "Taxa de Falta"
    expect(screen.getAllByText('12.5%').length).toBeGreaterThanOrEqual(2);

    // faixa de 5 mini-KPIs
    for (const label of ['Total', 'Confirmadas', 'Realizadas', 'Canceladas', 'Taxa de Falta']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('80')).toBeInTheDocument();
    expect(screen.getByText('60')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();

    // 2 SVGs de gráfico: receita (viewBox "0 0 800 ...") e procedimentos ("0 0 400 ...")
    expect(container.querySelector('svg[viewBox^="0 0 800"]')).toBeTruthy();
    expect(container.querySelector('svg[viewBox^="0 0 400"]')).toBeTruthy();
    expect(container.querySelector('#revenueGradient')).toBeTruthy();
  });

  it('toggle 7D/30D: chama dashboardApi.getStats com os dias corretos e destaca o botão ativo', async () => {
    render(<Dashboard />);
    await screen.findByText('Faturamento');

    await waitFor(() => expect(getStats).toHaveBeenCalledWith(7));
    expect(screen.getByRole('button', { name: '7D' }).className).toContain('bg-primary-500');
    expect(screen.getByRole('button', { name: '30D' }).className).not.toContain('bg-primary-500');

    fireEvent.click(screen.getByRole('button', { name: '30D' }));

    await waitFor(() => expect(getStats).toHaveBeenCalledWith(30));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '30D' }).className).toContain('bg-primary-500')
    );
    expect(screen.getByRole('button', { name: '7D' }).className).not.toContain('bg-primary-500');
  });

  it('mostra o DashboardSkeleton enquanto carrega e o remove após os dados chegarem', async () => {
    let resolveStats: (v: unknown) => void = () => {};
    getStats.mockImplementation(
      () =>
        new Promise((r) => {
          resolveStats = r;
        })
    );

    const { container } = render(<Dashboard />);
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
    expect(screen.queryByText('Faturamento')).not.toBeInTheDocument();

    resolveStats(okStats(dash()));

    await screen.findByText('Faturamento');
    expect(container.querySelector('.animate-pulse')).toBeNull();
  });

  // ── Banner "Novas Solicitações" (recusar agendamento) ──────────────────────

  it('recusar solicitação: em falha da API exibe showAlert(danger) e mantém o item na lista', async () => {
    appState.appointments = [appt({ id: 'a1', patientName: 'Maria Silva', status: 'pending_approval' })];
    changeAppointmentStatus.mockResolvedValue({ success: false, error: 'Transição inválida' });

    render(<Dashboard />);
    await screen.findByText('Novas Solicitações');

    fireEvent.click(screen.getByRole('button', { name: 'Recusar' }));

    await waitFor(() =>
      expect(showAlert).toHaveBeenCalledWith(
        'Transição inválida',
        expect.objectContaining({ variant: 'danger' })
      )
    );
    expect(changeAppointmentStatus).toHaveBeenCalledWith('a1', 'CANCELED');
    expect(screen.getByText('Maria Silva')).toBeInTheDocument();
  });

  it('recusar solicitação: em sucesso NÃO exibe alerta de erro', async () => {
    appState.appointments = [appt({ id: 'a1', status: 'pending_approval' })];
    changeAppointmentStatus.mockResolvedValue({ success: true });

    render(<Dashboard />);
    await screen.findByText('Novas Solicitações');

    fireEvent.click(screen.getByRole('button', { name: 'Recusar' }));

    await waitFor(() => expect(changeAppointmentStatus).toHaveBeenCalledWith('a1', 'CANCELED'));
    expect(showAlert).not.toHaveBeenCalled();
  });

  // ── Banner "Novos Planos para Aprovação" (recusar plano pendente) ──────────

  it('recusar plano pendente: se a API retorna erro, o plano PERMANECE e showAlert é exibido', async () => {
    listPending.mockResolvedValue({ success: true, data: [planSub({ id: 'sub-1' })] });
    cancelPlan.mockResolvedValue({ success: false, error: 'Falha ao cancelar' });

    render(<Dashboard />);
    await screen.findByText('Novos Planos para Aprovação');

    fireEvent.click(screen.getByRole('button', { name: 'Recusar' }));

    await waitFor(() =>
      expect(showAlert).toHaveBeenCalledWith(
        'Falha ao cancelar',
        expect.objectContaining({ variant: 'danger' })
      )
    );
    expect(screen.getByText('João Souza')).toBeInTheDocument();
    expect(screen.getByText('Novos Planos para Aprovação')).toBeInTheDocument();
  });

  it('recusar plano pendente: se a chamada rejeita (throw), o plano PERMANECE e há feedback', async () => {
    listPending.mockResolvedValue({ success: true, data: [planSub({ id: 'sub-1' })] });
    cancelPlan.mockRejectedValue(new Error('network'));

    render(<Dashboard />);
    await screen.findByText('Novos Planos para Aprovação');

    fireEvent.click(screen.getByRole('button', { name: 'Recusar' }));

    await waitFor(() =>
      expect(showAlert).toHaveBeenCalledWith(
        'Erro ao recusar o plano.',
        expect.objectContaining({ variant: 'danger' })
      )
    );
    expect(screen.getByText('João Souza')).toBeInTheDocument();
  });

  it('recusar plano pendente: em sucesso remove o item da lista sem alerta', async () => {
    listPending.mockResolvedValue({ success: true, data: [planSub({ id: 'sub-1' })] });
    cancelPlan.mockResolvedValue({ success: true, data: {} });

    render(<Dashboard />);
    await screen.findByText('Novos Planos para Aprovação');

    fireEvent.click(screen.getByRole('button', { name: 'Recusar' }));

    await waitFor(() =>
      expect(screen.queryByText('Novos Planos para Aprovação')).not.toBeInTheDocument()
    );
    expect(showAlert).not.toHaveBeenCalled();
  });

  it('ativar plano pendente: em falha da API exibe showAlert(danger) e mantém o item', async () => {
    listPending.mockResolvedValue({ success: true, data: [planSub({ id: 'sub-1' })] });
    activatePlan.mockResolvedValue({ success: false, error: 'Cobrança inicial falhou' });

    render(<Dashboard />);
    await screen.findByText('Novos Planos para Aprovação');

    fireEvent.click(screen.getByRole('button', { name: 'Ativar' }));

    await waitFor(() =>
      expect(showAlert).toHaveBeenCalledWith(
        'Cobrança inicial falhou',
        expect.objectContaining({ variant: 'danger' })
      )
    );
    expect(screen.getByText('João Souza')).toBeInTheDocument();
  });

  // ── Alertas do sistema ────────────────────────────────────────────────────

  it('activeAlerts: combina lowStock da API + systemAlerts aplicáveis, exclui descartados e limita a 3', async () => {
    getStats.mockResolvedValue(
      okStats(
        dash(
          {},
          {},
          {
            lowStock: [
              { id: 'inv_1', title: 'Estoque Baixo: Botox', message: 'x', type: 'warning' },
              { id: 'inv_2', title: 'Estoque Baixo: Ácido', message: 'x', type: 'warning' },
            ],
          }
        )
      )
    );
    appState.systemAlerts = [
      sysAlert({ id: 'ok_company', title: 'Alerta da empresa', target: 'c1', status: 'active' }),
      sysAlert({ id: 'ok_all', title: 'Alerta global', target: 'all', status: 'active' }),
      sysAlert({ id: 'ok_all_2', title: 'Alerta global 2', target: 'all', status: 'active' }),
      sysAlert({ id: 'other_co', title: 'Alerta de outra empresa', target: 'c2', status: 'active' }),
      sysAlert({ id: 'inactive', title: 'Alerta inativo', target: 'all', status: 'inactive' }),
    ];
    appState.dismissedAlertIds = ['inv_2'];

    render(<Dashboard />);
    await screen.findByText('Faturamento');

    // aplicáveis e dentro do limite de 3: inv_1, ok_company, ok_all
    expect(screen.getByText('Estoque Baixo: Botox')).toBeInTheDocument();
    expect(screen.getByText('Alerta da empresa')).toBeInTheDocument();
    expect(screen.getByText('Alerta global')).toBeInTheDocument();
    // descartado
    expect(screen.queryByText('Estoque Baixo: Ácido')).not.toBeInTheDocument();
    // filtrados (empresa diferente / inativo)
    expect(screen.queryByText('Alerta de outra empresa')).not.toBeInTheDocument();
    expect(screen.queryByText('Alerta inativo')).not.toBeInTheDocument();
    // além do limite de 3 exibidos
    expect(screen.queryByText('Alerta global 2')).not.toBeInTheDocument();

    expect(screen.getAllByText('Ler mais')).toHaveLength(3);
  });

  it('descartar alerta (X): remove da lista imediatamente, sem chamada de API', async () => {
    // dismissAlert é apenas estado em memória no AppContext — NÃO persiste em F5
    // nem no servidor. Este teste trava o comportamento client-side atual.
    getStats.mockResolvedValue(
      okStats(
        dash(
          {},
          {},
          { lowStock: [{ id: 'inv_1', title: 'Estoque Baixo: Botox', message: 'x', type: 'warning' }] }
        )
      )
    );

    render(<Dashboard />);
    const card = ((await screen.findByText('Estoque Baixo: Botox')).closest(
      'div.cursor-pointer'
    )) as HTMLElement;

    fireEvent.click(within(card).getByRole('button'));

    await waitFor(() =>
      expect(screen.queryByText('Estoque Baixo: Botox')).not.toBeInTheDocument()
    );
    // nenhuma nova chamada de rede foi disparada pelo dismiss
    expect(getStats).toHaveBeenCalledTimes(1);
  });
});
