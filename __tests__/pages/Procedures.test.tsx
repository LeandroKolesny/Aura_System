// __tests__/pages/Procedures.test.tsx
// Testes de componente da aba "Procedimentos" (pages/Procedures.tsx)

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UserRole, type Procedure, type User } from '../../types';

const render = (ui: React.ReactElement) =>
  rtlRender(ui, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });

const removeProcedure = vi.fn();
const loadProcedures = vi.fn();
const loadInventory = vi.fn();
const confirm = vi.fn();
const showAlert = vi.fn();
const navigate = vi.fn();

const appState: {
  procedures: Procedure[];
  user: User | null;
  isReadOnly: boolean;
  loadingProcedures: boolean;
} = {
  procedures: [],
  user: null,
  isReadOnly: false,
  loadingProcedures: false,
};

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({
    procedures: appState.procedures,
    user: appState.user,
    removeProcedure,
    isReadOnly: appState.isReadOnly,
    loadProcedures,
    loadInventory,
    loadingStates: { procedures: appState.loadingProcedures },
  }),
}));

vi.mock('../../context/DialogContext', () => ({
  useDialog: () => ({ confirm, showAlert }),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigate };
});

vi.mock('../../components/Modals', () => ({
  NewProcedureModal: () => <div data-testid="procedure-modal" />,
}));
vi.mock('../../components/ImportCSVModal', () => ({
  default: () => <div data-testid="import-modal" />,
}));
vi.mock('../../components/LoadingSkeleton', () => ({
  ProceduresSkeleton: () => <div data-testid="skeleton" />,
}));
vi.mock('../../services/api', () => ({
  proceduresApi: { importCSV: vi.fn() },
}));
vi.mock('../../utils/subdomain', () => ({
  getPortalBasePath: () => '',
  isPatientPortal: () => false,
}));

import Procedures from '../../pages/Procedures';

function proc(over: Partial<Procedure> = {}): Procedure {
  return {
    id: 'p1',
    companyId: 'c1',
    name: 'Botox',
    description: 'Toxina botulínica',
    price: 200,
    cost: 50,
    durationMinutes: 60,
    ...over,
  };
}

function userWith(role: UserRole): User {
  return { id: 'u1', name: 'User', email: 'u@x.com', role, companyId: 'c1', isActive: true };
}

function deleteButton(): HTMLButtonElement | undefined {
  return screen.queryAllByRole('button').find((b) => b.querySelector('.lucide-trash-2')) as
    | HTMLButtonElement
    | undefined;
}

beforeEach(() => {
  vi.clearAllMocks();
  appState.procedures = [];
  appState.user = userWith(UserRole.ADMIN);
  appState.isReadOnly = false;
  appState.loadingProcedures = false;
  confirm.mockResolvedValue(true);
  removeProcedure.mockResolvedValue({ success: true });
});

describe('pages/Procedures — margem / divisão por zero', () => {
  it('card com price = 0 NÃO renderiza "NaN%" (mostra "—")', () => {
    appState.procedures = [proc({ price: 0, cost: 0 })];
    render(<Procedures />);
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('card com price > 0 mostra a margem percentual normalmente', () => {
    appState.procedures = [proc({ price: 200, cost: 50 })];
    render(<Procedures />);
    expect(screen.getByText('75%')).toBeInTheDocument();
  });
});

describe('pages/Procedures — permissões por role', () => {
  it('PATIENT: não vê custo/margem e o clique no card navega para o agendamento', () => {
    appState.user = userWith(UserRole.PATIENT);
    appState.procedures = [proc()];
    render(<Procedures />);

    expect(screen.queryByText('Custo Insumos')).not.toBeInTheDocument();
    expect(screen.queryByText('Margem de Lucro')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Botox'));
    expect(navigate).toHaveBeenCalledWith(
      '/schedule',
      expect.objectContaining({ state: expect.objectContaining({ procedureId: 'p1', procedureName: 'Botox' }) }),
    );
  });

  it.each([UserRole.RECEPTIONIST, UserRole.ESTHETICIAN])(
    '%s: não vê botões de CRUD nem financeiro',
    (role) => {
      appState.user = userWith(role);
      appState.procedures = [proc()];
      render(<Procedures />);

      expect(screen.queryByRole('button', { name: /Novo Procedimento/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Importar Planilha/i })).not.toBeInTheDocument();
      expect(deleteButton()).toBeUndefined();
      expect(screen.queryByText('Margem de Lucro')).not.toBeInTheDocument();
    },
  );
});

describe('pages/Procedures — exclusão', () => {
  it('confirm() cancelado NÃO chama removeProcedure', async () => {
    confirm.mockResolvedValue(false);
    appState.procedures = [proc()];
    render(<Procedures />);

    fireEvent.click(deleteButton()!);
    await Promise.resolve();
    await Promise.resolve();
    expect(removeProcedure).not.toHaveBeenCalled();
  });

  it('erro da API (agendamentos vinculados) dispara showAlert com a mensagem do backend', async () => {
    removeProcedure.mockResolvedValue({ success: false, error: 'este procedimento possui 2 agendamento(s) vinculado(s).' });
    appState.procedures = [proc()];
    render(<Procedures />);

    fireEvent.click(deleteButton()!);
    await waitFor(() =>
      expect(showAlert).toHaveBeenCalledWith(
        'este procedimento possui 2 agendamento(s) vinculado(s).',
        expect.objectContaining({ variant: 'danger' }),
      ),
    );
  });

  it('sucesso chama removeProcedure com o id e não dispara showAlert', async () => {
    appState.procedures = [proc({ id: 'p9' })];
    render(<Procedures />);

    fireEvent.click(deleteButton()!);
    await waitFor(() => expect(removeProcedure).toHaveBeenCalledWith('p9'));
    expect(showAlert).not.toHaveBeenCalled();
  });
});

describe('pages/Procedures — estados de lista', () => {
  it('estado vazio mostra "Nenhum procedimento cadastrado."', () => {
    appState.procedures = [];
    render(<Procedures />);
    expect(screen.getByText('Nenhum procedimento cadastrado.')).toBeInTheDocument();
  });

  it('loading + lista vazia renderiza o skeleton', () => {
    appState.procedures = [];
    appState.loadingProcedures = true;
    render(<Procedures />);
    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });
});
