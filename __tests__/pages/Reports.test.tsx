// __tests__/pages/Reports.test.tsx
// Aba "Relatórios BI" (pages/Reports.tsx) — gate de plano, travamento do
// seletor de clínica por papel e estados vazios das tabelas.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UserRole } from '../../types';

const render = (ui: React.ReactElement) =>
  rtlRender(ui, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });

// ---- estado mutável do contexto ----
const checkModuleAccess = vi.fn(() => true);
const loadFns = {
  loadPatients: vi.fn(),
  loadAppointments: vi.fn(),
  loadTransactions: vi.fn(),
  loadProcedures: vi.fn(),
  loadProfessionals: vi.fn(),
};

type St = {
  companies: { id: string; name: string }[];
  saasPlans: unknown[];
  patients: unknown[];
  appointments: unknown[];
  transactions: unknown[];
  procedures: unknown[];
  professionals: unknown[];
  currentCompany: { id: string; name: string } | null;
  loadingStates: Record<string, boolean>;
  user: { id: string; role: UserRole; companyId: string };
};

const st: St = {
  companies: [{ id: 'c1', name: 'Clínica Alpha' }],
  saasPlans: [],
  patients: [],
  appointments: [],
  transactions: [],
  procedures: [],
  professionals: [],
  currentCompany: { id: 'c1', name: 'Clínica Alpha' },
  loadingStates: {
    patients: false, appointments: false, transactions: false, procedures: false, professionals: false,
  },
  user: { id: 'u1', role: UserRole.ADMIN, companyId: 'c1' },
};

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({
    companies: st.companies,
    saasPlans: st.saasPlans,
    patients: st.patients,
    appointments: st.appointments,
    transactions: st.transactions,
    procedures: st.procedures,
    professionals: st.professionals,
    currentCompany: st.currentCompany,
    loadingStates: st.loadingStates,
    user: st.user,
    checkModuleAccess,
    ...loadFns,
  }),
}));

vi.mock('../../components/charts', () => ({
  RevenueAreaChart: (): null => null,
  MetricDonutChart: (): null => null,
  HorizontalBarChart: (): null => null,
  KPICard: ({ title, value }: { title: string; value: React.ReactNode }) => (
    <div data-testid="kpi">{title}: {value}</div>
  ),
  MiniSparkline: (): null => null,
}));

vi.mock('../../components/LoadingSkeleton', () => ({
  ReportsSkeleton: () => <div>skeleton</div>,
}));

vi.mock('../../components/RetentionTab', () => ({ default: (): null => null }));

import Reports from '../../pages/Reports';

beforeEach(() => {
  vi.clearAllMocks();
  checkModuleAccess.mockReturnValue(true);
  st.companies = [{ id: 'c1', name: 'Clínica Alpha' }];
  st.saasPlans = [];
  st.patients = [];
  st.appointments = [];
  st.transactions = [];
  st.procedures = [];
  st.professionals = [];
  st.currentCompany = { id: 'c1', name: 'Clínica Alpha' };
  st.loadingStates = {
    patients: false, appointments: false, transactions: false, procedures: false, professionals: false,
  };
  st.user = { id: 'u1', role: UserRole.ADMIN, companyId: 'c1' };
});

describe('pages/Reports — gate de plano (checkModuleAccess)', () => {
  it('sem acesso ao módulo "reports" → conteúdo envolvido pelo UpgradeOverlay', () => {
    checkModuleAccess.mockReturnValue(false);
    render(<Reports />);
    expect(checkModuleAccess).toHaveBeenCalledWith('reports');
    expect(screen.getByText('Recurso Premium')).toBeInTheDocument();
    expect(screen.getByText(/Ative a vers[aã]o Pro ou superior/i)).toBeInTheDocument();
  });

  it('com acesso → conteúdo normal, sem overlay de upgrade', () => {
    render(<Reports />);
    expect(screen.getByText('Relatórios de Inteligência')).toBeInTheDocument();
    expect(screen.queryByText('Recurso Premium')).not.toBeInTheDocument();
  });
});

describe('pages/Reports — estados vazios das tabelas', () => {
  it('sem dados no período, as 3 tabelas mostram o estado neutro', () => {
    render(<Reports />);
    expect(screen.getByText('Nenhum cliente VIP no período selecionado')).toBeInTheDocument();
    expect(screen.getByText('Nenhum atendimento no período selecionado')).toBeInTheDocument();
    expect(screen.getByText('Nenhum dado para analisar no período selecionado')).toBeInTheDocument();
  });
});

describe('pages/Reports — seletor de clínica por papel', () => {
  it('não-OWNER: seletor de clínica fica oculto (só o seletor de período existe)', () => {
    render(<Reports />);
    const combos = screen.getAllByRole('combobox');
    expect(combos).toHaveLength(1);
    // o único combobox é o de período
    expect(screen.getByRole('option', { name: '6 Meses' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Clínica Alpha' })).not.toBeInTheDocument();
  });

  it('OWNER: seletor de clínica aparece com as clínicas cadastradas', () => {
    st.user = { id: 'u9', role: UserRole.OWNER, companyId: 'c1' };
    st.companies = [{ id: 'c1', name: 'Clínica Alpha' }, { id: 'c2', name: 'Clínica Beta' }];
    render(<Reports />);
    expect(screen.getAllByRole('combobox')).toHaveLength(2);
    expect(screen.getByRole('option', { name: 'Clínica Alpha' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Clínica Beta' })).toBeInTheDocument();
  });
});
