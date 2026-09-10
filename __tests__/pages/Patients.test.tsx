// __tests__/pages/Patients.test.tsx
// Testes de componente da aba "Pacientes" (pages/Patients.tsx)

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UserRole, type Patient, type User } from '../../types';

const render = (ui: React.ReactElement) =>
  rtlRender(ui, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });

const removePatient = vi.fn();
const loadPatients = vi.fn();
const confirm = vi.fn();
const showAlert = vi.fn();
const navigate = vi.fn();

const st: {
  patients: Patient[];
  companies: unknown[];
  user: User | null;
  isReadOnly: boolean;
  loadingPatients: boolean;
} = {
  patients: [],
  companies: [],
  user: null,
  isReadOnly: false,
  loadingPatients: false,
};

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({
    patients: st.patients,
    companies: st.companies,
    user: st.user,
    removePatient,
    isReadOnly: st.isReadOnly,
    loadPatients,
    loadingStates: { patients: st.loadingPatients },
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
  NewPatientModal: () => <div data-testid="new-patient-modal" />,
}));
vi.mock('../../components/ImportCSVModal', () => ({
  default: () => <div data-testid="import-modal" />,
}));
vi.mock('../../components/LoadingSkeleton', () => ({
  PatientsSkeleton: () => <div data-testid="skeleton" />,
}));

import Patients from '../../pages/Patients';

function patient(over: Partial<Patient> = {}): Patient {
  return {
    id: 'p1', companyId: 'c1', name: 'Maria Silva', phone: '11999990000',
    email: 'maria@example.com', status: 'active', ...over,
  };
}

function kpiCard(title: string): HTMLElement {
  return screen.getByText(title).closest('div.relative') as HTMLElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  st.patients = [];
  st.companies = [];
  st.user = { id: 'u1', role: UserRole.ADMIN, companyId: 'c1' } as User;
  st.isReadOnly = false;
  st.loadingPatients = false;
  confirm.mockResolvedValue(true);
  removePatient.mockResolvedValue({ success: true });
});

describe('Patients — listagem e busca', () => {
  it('renderiza a lista a partir de useApp().patients', () => {
    st.patients = [
      patient({ id: 'p1', name: 'Maria Silva', email: 'maria@example.com' }),
      patient({ id: 'p2', name: 'João Souza', email: 'joao@example.com' }),
    ];
    render(<Patients />);
    expect(screen.getByText('Maria Silva')).toBeInTheDocument();
    expect(screen.getByText('João Souza')).toBeInTheDocument();
  });

  it('filtra client-side por nome', () => {
    st.patients = [
      patient({ id: 'p1', name: 'Maria Silva', email: 'maria@example.com' }),
      patient({ id: 'p2', name: 'João Souza', email: 'joao@example.com' }),
    ];
    render(<Patients />);
    fireEvent.change(screen.getByPlaceholderText(/Buscar por nome ou email/i), { target: { value: 'joão' } });
    expect(screen.queryByText('Maria Silva')).not.toBeInTheDocument();
    expect(screen.getByText('João Souza')).toBeInTheDocument();
  });

  it('filtra client-side por email', () => {
    st.patients = [
      patient({ id: 'p1', name: 'Maria Silva', email: 'maria@example.com' }),
      patient({ id: 'p2', name: 'João Souza', email: 'joao@example.com' }),
    ];
    render(<Patients />);
    fireEvent.change(screen.getByPlaceholderText(/Buscar por nome ou email/i), { target: { value: 'joao@example' } });
    expect(screen.getByText('João Souza')).toBeInTheDocument();
    expect(screen.queryByText('Maria Silva')).not.toBeInTheDocument();
  });

  it('não exibe a linha "Nasc:" para paciente sem birthDate', () => {
    st.patients = [
      patient({ id: 'p1', name: 'Com Data', birthDate: '1990-02-01' }),
      patient({ id: 'p2', name: 'Sem Data', birthDate: undefined }),
    ];
    render(<Patients />);
    expect(screen.getAllByText(/^Nasc:/)).toHaveLength(1);
  });
});

describe('Patients — KPIs', () => {
  it('calcula total, ativos e com visita registrada', () => {
    st.patients = [
      patient({ id: 'p1', status: 'active', lastVisit: '2026-01-01' }),
      patient({ id: 'p2', status: 'active' }),
      patient({ id: 'p3', status: 'inactive', lastVisit: '2026-02-01' }),
    ];
    render(<Patients />);
    expect(within(kpiCard('Total de Pacientes')).getByText('3')).toBeInTheDocument();
    expect(within(kpiCard('Pacientes Ativos')).getByText('2')).toBeInTheDocument();
    expect(within(kpiCard('Com Visita Registrada')).getByText('2')).toBeInTheDocument();
  });
});

describe('Patients — exclusão', () => {
  it('confirma com o texto honesto de soft delete (marcado como inativo, reversível)', async () => {
    st.patients = [patient({ id: 'p1', name: 'Maria Silva' })];
    render(<Patients />);
    fireEvent.click(screen.getAllByTitle('Excluir')[0]);

    await waitFor(() => expect(confirm).toHaveBeenCalled());
    const [message] = confirm.mock.calls[0];
    expect(message).toMatch(/marcado como inativo/i);
    expect(message).not.toMatch(/não pode ser desfeita/i);
    expect(removePatient).toHaveBeenCalledWith('p1');
  });

  it('exibe showAlert quando removePatient retorna { success: false }', async () => {
    removePatient.mockResolvedValue({ success: false, error: 'Paciente possui agendamentos vinculados' });
    st.patients = [patient({ id: 'p1', name: 'Maria Silva' })];
    render(<Patients />);
    fireEvent.click(screen.getAllByTitle('Excluir')[0]);

    await waitFor(() => expect(showAlert).toHaveBeenCalled());
    expect(showAlert.mock.calls[0][0]).toMatch(/agendamentos vinculados/i);
  });

  it('não chama removePatient se o usuário cancela a confirmação', async () => {
    confirm.mockResolvedValue(false);
    st.patients = [patient({ id: 'p1', name: 'Maria Silva' })];
    render(<Patients />);
    fireEvent.click(screen.getAllByTitle('Excluir')[0]);

    await waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(removePatient).not.toHaveBeenCalled();
  });
});
