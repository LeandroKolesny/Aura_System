// __tests__/apps/PatientPortalApp.test.tsx
// Testes do roteador/guardas do Portal do Paciente (apps/PatientPortalApp.tsx).

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { UserRole } from '../../types';
import type { Appointment } from '../../types';

vi.mock('../../utils/subdomain', () => ({
  getPortalBasePath: () => '/clinica-aura',
}));

interface MockUser {
  role: UserRole;
  companyId: string;
  name?: string;
  patientId?: string;
}

const appState: { user: MockUser | null; isInitializing: boolean; appointments: Appointment[] } = {
  user: null,
  isInitializing: false,
  appointments: [],
};

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({
    user: appState.user,
    isInitializing: appState.isInitializing,
    appointments: appState.appointments,
  }),
}));

const clinicState: { clinic: { id: string; name?: string; layoutConfig?: Record<string, string> } | null } = {
  clinic: { id: 'company-1', name: 'Clínica Aura' },
};

vi.mock('../../context/ClinicContext', () => ({
  useClinic: () => ({ clinic: clinicState.clinic }),
}));

vi.mock('../../components/patient-portal/PatientSidebar', () => ({
  default: (): React.ReactElement => <div data-testid="sidebar" />,
}));

import { PatientPortalLayout, PatientDashboard } from '../../apps/PatientPortalApp';

beforeEach(() => {
  vi.clearAllMocks();
  appState.user = null;
  appState.isInitializing = false;
  appState.appointments = [];
  clinicState.clinic = { id: 'company-1', name: 'Clínica Aura' };
});

const renderLayout = () =>
  rtlRender(
    <MemoryRouter initialEntries={['/protegida']}>
      <Routes>
        <Route path="/clinica-aura/login" element={<div>TELA DE LOGIN</div>} />
        <Route path="/clinica-aura/" element={<div>TELA PUBLICA</div>} />
        <Route element={<PatientPortalLayout />}>
          <Route path="/protegida" element={<div>CONTEUDO PROTEGIDO</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );

describe('apps/PatientPortalApp — PatientPortalLayout (guarda de acesso)', () => {
  it('sem usuário logado, redireciona para o login do portal', () => {
    appState.user = null;
    renderLayout();
    expect(screen.getByText('TELA DE LOGIN')).toBeInTheDocument();
  });

  it('usuário logado mas não é PATIENT, redireciona para a página pública', () => {
    appState.user = { role: UserRole.ADMIN, companyId: 'company-1' };
    renderLayout();
    expect(screen.getByText('TELA PUBLICA')).toBeInTheDocument();
  });

  it('paciente da MESMA clínica acessa o conteúdo protegido normalmente', () => {
    appState.user = { role: UserRole.PATIENT, companyId: 'company-1' };
    renderLayout();
    expect(screen.getByText('CONTEUDO PROTEGIDO')).toBeInTheDocument();
  });

  it('BUG: paciente de OUTRA clínica não deve acessar o portal — deve ser redirecionado ao login', () => {
    appState.user = { role: UserRole.PATIENT, companyId: 'company-DE-OUTRA-CLINICA' };
    clinicState.clinic = { id: 'company-1', name: 'Clínica Aura' };
    renderLayout();

    expect(screen.queryByText('CONTEUDO PROTEGIDO')).not.toBeInTheDocument();
    expect(screen.getByText('TELA DE LOGIN')).toBeInTheDocument();
  });

  it('enquanto isInitializing=true, não decide redirecionamento (mostra carregando)', () => {
    appState.user = null;
    appState.isInitializing = true;
    renderLayout();

    expect(screen.queryByText('TELA DE LOGIN')).not.toBeInTheDocument();
    expect(screen.queryByText('CONTEUDO PROTEGIDO')).not.toBeInTheDocument();
  });
});

describe('apps/PatientPortalApp — PatientDashboard', () => {
  const renderDashboard = () =>
    rtlRender(
      <MemoryRouter>
        <PatientDashboard />
      </MemoryRouter>
    );

  it('BUG: exibe o próximo agendamento real quando existe um futuro não cancelado', () => {
    appState.user = { role: UserRole.PATIENT, companyId: 'company-1', patientId: 'patient-1', name: 'Maria' };
    const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    appState.appointments = [
      {
        id: 'a1',
        companyId: 'company-1',
        patientId: 'patient-1',
        patientName: 'Maria',
        professionalId: 'p1',
        professionalName: 'Dra. Ana',
        service: 'Limpeza de pele',
        price: 150,
        date: future,
        durationMinutes: 60,
        status: 'scheduled',
      },
    ];

    renderDashboard();

    expect(screen.queryByText('Você não tem agendamentos próximos')).not.toBeInTheDocument();
    expect(screen.getByText(/Limpeza de pele/)).toBeInTheDocument();
  });

  it('mostra "sem agendamentos" quando não há nenhum agendamento futuro não cancelado', () => {
    appState.user = { role: UserRole.PATIENT, companyId: 'company-1', patientId: 'patient-1', name: 'Maria' };
    const past = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    appState.appointments = [
      {
        id: 'a2',
        companyId: 'company-1',
        patientId: 'patient-1',
        patientName: 'Maria',
        professionalId: 'p1',
        professionalName: 'Dra. Ana',
        service: 'Procedimento passado',
        price: 150,
        date: past,
        durationMinutes: 60,
        status: 'completed',
      },
    ];

    renderDashboard();

    expect(screen.getByText('Você não tem agendamentos próximos')).toBeInTheDocument();
  });

  it('ignora agendamentos futuros cancelados ao calcular o próximo agendamento', () => {
    appState.user = { role: UserRole.PATIENT, companyId: 'company-1', patientId: 'patient-1', name: 'Maria' };
    const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    appState.appointments = [
      {
        id: 'a3',
        companyId: 'company-1',
        patientId: 'patient-1',
        patientName: 'Maria',
        professionalId: 'p1',
        professionalName: 'Dra. Ana',
        service: 'Cancelado no futuro',
        price: 150,
        date: future,
        durationMinutes: 60,
        status: 'canceled',
      },
    ];

    renderDashboard();

    expect(screen.getByText('Você não tem agendamentos próximos')).toBeInTheDocument();
  });
});
