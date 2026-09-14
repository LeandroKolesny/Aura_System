// __tests__/pages/Schedule.test.tsx
// Testes de componente da aba "Agenda" (pages/Schedule.tsx) — filtro por profissional
// e navegação de data refletindo nos agendamentos exibidos na grade do dia.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UserRole } from '../../types';

const render = (ui: React.ReactElement) =>
  rtlRender(ui, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });

vi.mock('../../components/Modals', () => ({
  NewAppointmentModal: (() => null) as React.FC,
  CheckoutModal: ((props: { appointment: { patientName: string } }) => (
    <div data-testid="checkout-modal">{props.appointment.patientName}</div>
  )) as React.FC,
  ReviewAppointmentModal: (() => <div data-testid="review-modal" />) as React.FC,
  PatientAppointmentViewModal: ((props: { appointment: { patientName: string } }) => (
    <div data-testid="patient-view-modal">{props.appointment.patientName}</div>
  )) as React.FC,
}));

vi.mock('../../services/api', () => ({
  calendarApi: { sync: vi.fn().mockResolvedValue({ success: true, data: { synced: 0 } }) },
}));

const loadAppointments = vi.fn();
const loadPatients = vi.fn();
const loadProcedures = vi.fn();
const loadUnavailabilityRules = vi.fn();
const markNotificationAsRead = vi.fn();

function todayAt(hour: number): string {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

const appState: { appointments: unknown[]; user: { id: string; role: UserRole; patientId?: string } } = {
  appointments: [],
  user: { id: 'u1', role: UserRole.ADMIN },
};

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({
    appointments: appState.appointments,
    professionals: [
      { id: 'prof-1', name: 'Dra. Ana' },
      { id: 'prof-2', name: 'Dr. Bob' },
    ],
    patients: [] as unknown[],
    currentCompany: {},
    user: appState.user,
    isReadOnly: false,
    unavailabilityRules: [] as unknown[],
    notifications: [] as unknown[],
    markNotificationAsRead,
    loadAppointments,
    loadPatients,
    loadProcedures,
    loadUnavailabilityRules,
    loadingStates: { appointments: false },
  }),
}));

import Schedule from '../../pages/Schedule';

beforeEach(() => {
  vi.clearAllMocks();
  appState.user = { id: 'u1', role: UserRole.ADMIN };
  appState.appointments = [
    { id: 'a1', companyId: 'c1', patientName: 'Alice', patientId: 'pa', professionalId: 'prof-1', professionalName: 'Dra. Ana', service: 'Limpeza', price: 100, date: todayAt(10), durationMinutes: 60, status: 'scheduled' },
    { id: 'a2', companyId: 'c1', patientName: 'Bruno', patientId: 'pb', professionalId: 'prof-2', professionalName: 'Dr. Bob', service: 'Peeling', price: 200, date: todayAt(11), durationMinutes: 60, status: 'scheduled' },
  ];
});

describe('pages/Schedule — filtro por profissional', () => {
  it('mostra todos os agendamentos do dia por padrão e filtra ao selecionar um profissional', () => {
    render(<Schedule />);

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bruno')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'prof-1' } });

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.queryByText('Bruno')).not.toBeInTheDocument();
  });
});

describe('pages/Schedule — navegação de data', () => {
  it('mudar a data esconde os agendamentos de hoje; "Hoje" traz de volta', () => {
    const { container } = render(<Schedule />);

    expect(screen.getByText('Alice')).toBeInTheDocument();

    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2027-03-15' } });

    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
    expect(screen.queryByText('Bruno')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Hoje'));

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bruno')).toBeInTheDocument();
  });
});

describe('pages/Schedule — recorte PATIENT', () => {
  beforeEach(() => {
    appState.user = { id: 'u-patient', role: UserRole.PATIENT, patientId: 'pa' };
  });

  it('mostra o PRÓPRIO agendamento com os dados reais', () => {
    render(<Schedule />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Limpeza')).toBeInTheDocument();
  });

  it('NÃO mostra nome/serviço do agendamento de OUTRO paciente — renderiza "Ocupado"', () => {
    render(<Schedule />);
    expect(screen.queryByText('Bruno')).not.toBeInTheDocument();
    expect(screen.queryByText('Peeling')).not.toBeInTheDocument();
    expect(screen.getByText('Ocupado')).toBeInTheDocument();
  });

  it('clicar no bloco "Ocupado" de outro paciente não abre nenhum modal (sem onClick)', () => {
    render(<Schedule />);
    fireEvent.click(screen.getByText('Ocupado'));
    expect(screen.queryByTestId('patient-view-modal')).not.toBeInTheDocument();
    expect(screen.queryByTestId('checkout-modal')).not.toBeInTheDocument();
  });

  it('clicar no PRÓPRIO agendamento abre o PatientAppointmentViewModal (nunca o CheckoutModal)', () => {
    render(<Schedule />);
    fireEvent.click(screen.getByText('Alice'));
    expect(screen.getByTestId('patient-view-modal')).toBeInTheDocument();
    expect(screen.queryByTestId('checkout-modal')).not.toBeInTheDocument();
  });

  it('não mostra o botão "Novo Agendamento" nem o seletor de profissional (área de staff)', () => {
    render(<Schedule />);
    expect(screen.queryByText('Novo Agendamento')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  // Documenta a dependência de user.patientId (ver bug corrigido em
  // GET /api/auth/me — aura-backend/src/app/api/auth/me/route.ts): sem esse
  // campo, a máscara de "Ocupado" de outros pacientes deixa de funcionar e
  // service/preço/hora reais de outros pacientes voltam a aparecer no card.
  it('CARACTERIZAÇÃO: sem user.patientId (ex.: sessão restaurada sem o campo), a máscara de outros pacientes falha', () => {
    appState.user = { id: 'u-patient', role: UserRole.PATIENT, patientId: undefined };
    render(<Schedule />);
    expect(screen.getByText('Peeling')).toBeInTheDocument();
    expect(screen.queryByText('Ocupado')).not.toBeInTheDocument();
  });

  // Pedido do usuário: "Consultar agenda" em Meus Planos (portal do cliente)
  // precisa abrir a Agenda já no dia da sessão vinculada ao plano, não em "hoje".
  it('abre já no dia vindo de location.state.targetDate (não em "hoje"), quando presente', () => {
    const targetDate = '2026-03-10T14:00:00.000Z';
    const expectedHeader = new Date(targetDate).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'long' });

    rtlRender(<Schedule />, {
      wrapper: ({ children }) => (
        <MemoryRouter initialEntries={[{ pathname: '/schedule', state: { targetDate } }]}>
          {children}
        </MemoryRouter>
      ),
    });

    expect(screen.getByText(new RegExp(expectedHeader, 'i'))).toBeInTheDocument();
  });

  it('sem targetDate no state, abre em "hoje" (comportamento pré-existente preservado)', () => {
    const expectedHeader = new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'long' });
    render(<Schedule />);
    expect(screen.getByText(new RegExp(expectedHeader, 'i'))).toBeInTheDocument();
  });
});
