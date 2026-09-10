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
  CheckoutModal: (() => null) as React.FC,
  ReviewAppointmentModal: (() => null) as React.FC,
  PatientAppointmentViewModal: (() => null) as React.FC,
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

const appState: { appointments: unknown[] } = { appointments: [] };

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({
    appointments: appState.appointments,
    professionals: [
      { id: 'prof-1', name: 'Dra. Ana' },
      { id: 'prof-2', name: 'Dr. Bob' },
    ],
    patients: [] as unknown[],
    currentCompany: {},
    user: { id: 'u1', role: UserRole.ADMIN },
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
