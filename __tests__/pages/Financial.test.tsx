// __tests__/pages/Financial.test.tsx
// Testes de componente da aba "Financeiro" (pages/Financial.tsx) — foco na
// visibilidade condicional de transações por role (visibleTransactions).

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UserRole, Transaction } from '../../types';

const render = (ui: React.ReactElement) =>
  rtlRender(ui, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });

const loadTransactions = vi.fn();
const loadAppointments = vi.fn();
const loadProcedures = vi.fn();
const markInstallmentPaid = vi.fn();
const deleteTransaction = vi.fn();
const updateCompany = vi.fn();

interface AppState {
  transactions: Transaction[];
  appointments: { id: string; patientId: string }[];
  user: { id: string; role: UserRole; companyId: string | null };
}

const appState: AppState = {
  transactions: [],
  appointments: [],
  user: { id: 'u-admin', role: UserRole.ADMIN, companyId: 'c1' },
};

// Referências ESTÁVEIS: o componente tem um useEffect com [currentCompany] que chama
// setState — se currentCompany (ou os arrays) mudasse de identidade a cada render,
// entraria em loop infinito de re-render.
const STABLE_COMPANY = { id: 'c1', paymentMethods: [] as string[] };
const STABLE_PROCEDURES: unknown[] = [];
const STABLE_LOADING = { transactions: false };
const STABLE_EMPTY: unknown[] = [];

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({
    transactions: appState.transactions,
    appointments: appState.appointments,
    user: appState.user,
    currentCompany: STABLE_COMPANY,
    updateCompany,
    isReadOnly: false,
    procedures: STABLE_PROCEDURES,
    loadingStates: STABLE_LOADING,
    loadTransactions,
    loadAppointments,
    loadProcedures,
    markInstallmentPaid,
    deleteTransaction,
    // usado só pelo SaaSFinancial (role OWNER) — não exercitado aqui
    companies: STABLE_EMPTY,
    saasPlans: STABLE_EMPTY,
  }),
}));

vi.mock('../../context/DialogContext', () => ({
  useDialog: () => ({ confirm: vi.fn(), showAlert: vi.fn() }),
}));

vi.mock('../../components/Modals', () => ({
  NewExpenseModal: (): null => null,
}));

vi.mock('../../components/ImportCSVModal', () => ({
  default: (): null => null,
}));

vi.mock('../../services/api', () => ({
  transactionsApi: { importCSV: vi.fn() },
}));

import Financial from '../../pages/Financial';

function tx(over: Partial<Transaction>): Transaction {
  return {
    id: 'x',
    companyId: 'c1',
    date: new Date().toISOString(), // mês corrente → cai no filtro de mês da tela
    description: 'Lançamento',
    amount: 100,
    type: 'income',
    category: 'Geral',
    status: 'paid',
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  appState.appointments = [
    { id: 'appt-mine', patientId: 'u-patient' },
    { id: 'appt-other', patientId: 'alguem-else' },
  ];
  appState.transactions = [
    tx({ id: 't-mine', description: 'Receita Mine', appointmentId: 'appt-mine', type: 'income' }),
    tx({ id: 't-other', description: 'Receita Other', appointmentId: 'appt-other', type: 'income' }),
    tx({ id: 't-exp', description: 'Despesa Avulsa', type: 'expense', amount: 50 }),
  ];
  appState.user = { id: 'u-admin', role: UserRole.ADMIN, companyId: 'c1' };
});

describe('pages/Financial — visibleTransactions por role', () => {
  it('ADMIN vê todas as transações (receitas de qualquer agendamento + despesas avulsas)', () => {
    render(<Financial />);
    expect(screen.getByText('Receita Mine')).toBeInTheDocument();
    expect(screen.getByText('Receita Other')).toBeInTheDocument();
    expect(screen.getByText('Despesa Avulsa')).toBeInTheDocument();
  });

  it('PATIENT só vê receitas ligadas aos próprios agendamentos', () => {
    appState.user = { id: 'u-patient', role: UserRole.PATIENT, companyId: 'c1' };
    render(<Financial />);
    expect(screen.getByText('Receita Mine')).toBeInTheDocument();
    expect(screen.queryByText('Receita Other')).not.toBeInTheDocument();
    expect(screen.queryByText('Despesa Avulsa')).not.toBeInTheDocument();
  });

  it('ESTHETICIAN também é restrito às receitas dos próprios agendamentos', () => {
    appState.user = { id: 'u-patient', role: UserRole.ESTHETICIAN, companyId: 'c1' };
    render(<Financial />);
    expect(screen.getByText('Receita Mine')).toBeInTheDocument();
    expect(screen.queryByText('Receita Other')).not.toBeInTheDocument();
    expect(screen.queryByText('Despesa Avulsa')).not.toBeInTheDocument();
  });

  it('dispara os loaders de dados ao montar', () => {
    render(<Financial />);
    expect(loadTransactions).toHaveBeenCalled();
    expect(loadAppointments).toHaveBeenCalled();
    expect(loadProcedures).toHaveBeenCalled();
  });

  it('esconde os botões de escrita (Importar / Lançar Despesa) para não-ADMIN', () => {
    appState.user = { id: 'u-patient', role: UserRole.PATIENT, companyId: 'c1' };
    render(<Financial />);
    expect(screen.queryByRole('button', { name: /Importar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Lançar Despesa/i })).not.toBeInTheDocument();
  });
});
