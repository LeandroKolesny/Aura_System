// __tests__/pages/PatientHistory.test.tsx
// Testes de componente da página "Meu Histórico" (pages/PatientHistory.tsx),
// usada tanto no portal do paciente (/historico) quanto no app de staff (/history)
// — mas SEMPRE renderizando dados de um único paciente (o usuário logado).
//
// BUG CONFIRMADO: currentPatientId era resolvido procurando o usuário logado
// dentro do array `patients` (patients.find(p => p.email === user.email)).
// Só que GET /api/patients retorna 403 para role PATIENT por design (LGPD —
// ver aura-backend/src/app/api/patients/route.ts), então loadPatients() nunca
// preenche esse array para um paciente logado — currentPatientId ficava
// SEMPRE null e a página mostrava "Nenhum histórico disponível" /
// "Você não tem agendamentos futuros" mesmo quando o paciente tinha
// agendamentos reais. O fix usa user.patientId (já resolvido pelo backend no
// login/sessão), igual a pages/Schedule.tsx.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen } from '@testing-library/react';
import { UserRole, type Appointment, type User } from '../../types';

const loadAppointments = vi.fn();
const loadPatients = vi.fn();
const showAlert = vi.fn();

const appState: {
  appointments: Appointment[];
  patients: unknown[];
  user: User | null;
  photos: unknown[];
} = {
  appointments: [],
  patients: [],
  user: null,
  photos: [],
};

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({
    appointments: appState.appointments,
    patients: appState.patients,
    user: appState.user,
    currentCompany: {},
    photos: appState.photos,
    signAppointmentConsent: vi.fn(),
    loadAppointments,
    loadPatients,
  }),
}));

vi.mock('../../context/DialogContext', () => ({
  useDialog: () => ({ showAlert }),
}));

vi.mock('../../components/Modals', () => ({
  SignatureModal: (() => null) as React.FC,
  SignatureHistoryModal: (() => null) as React.FC,
}));

import PatientHistory from '../../pages/PatientHistory';

function apptFor(patientId: string, over: Partial<Appointment> = {}): Appointment {
  return {
    id: `appt-${patientId}-${Math.random()}`,
    companyId: 'c1',
    patientId,
    patientName: 'Paciente',
    professionalId: 'prof-1',
    professionalName: 'Dra. Ana',
    procedureId: 'proc-1',
    service: 'Limpeza de Pele',
    date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // ontem -> "past"
    durationMinutes: 60,
    price: 150,
    status: 'completed',
    ...over,
  } as Appointment;
}

beforeEach(() => {
  vi.clearAllMocks();
  appState.appointments = [];
  appState.patients = [];
  appState.photos = [];
  appState.user = {
    id: 'u-patient',
    companyId: 'c1',
    name: 'Paciente Logado',
    email: 'paciente@email.com',
    role: UserRole.PATIENT,
    patientId: 'patient-001',
  };
});

describe('pages/PatientHistory — resolução de currentPatientId via user.patientId', () => {
  it('BUG: mostra o histórico do próprio paciente usando user.patientId mesmo com `patients` vazio (GET /api/patients bloqueia PATIENT com 403)', () => {
    appState.patients = []; // reflete o 403 real da API para role PATIENT
    appState.appointments = [apptFor('patient-001', { service: 'Limpeza de Pele' })];

    rtlRender(<PatientHistory />);

    expect(screen.getByText('Limpeza de Pele')).toBeInTheDocument();
    expect(screen.queryByText('Nenhum histórico disponível.')).not.toBeInTheDocument();
  });

  it('NÃO mostra o histórico de OUTRO paciente da mesma empresa', () => {
    appState.appointments = [
      apptFor('patient-001', { service: 'Meu Procedimento' }),
      apptFor('patient-OUTRO', { service: 'Procedimento de Outro Paciente' }),
    ];

    rtlRender(<PatientHistory />);

    expect(screen.getByText('Meu Procedimento')).toBeInTheDocument();
    expect(screen.queryByText('Procedimento de Outro Paciente')).not.toBeInTheDocument();
  });

  it('agendamento futuro do próprio paciente aparece em "Próximas Consultas"', () => {
    appState.appointments = [
      apptFor('patient-001', {
        service: 'Consulta Futura',
        status: 'scheduled',
        date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }),
    ];

    rtlRender(<PatientHistory />);

    expect(screen.getByText('Consulta Futura')).toBeInTheDocument();
    expect(screen.queryByText('Você não tem agendamentos futuros.')).not.toBeInTheDocument();
  });

  it('sem user.patientId (sessão restaurada sem o campo) não mostra agendamento de NINGUÉM — não cai para mostrar tudo', () => {
    appState.user = { ...(appState.user as User), patientId: undefined };
    appState.appointments = [apptFor('patient-001', { service: 'Não deveria aparecer' })];

    rtlRender(<PatientHistory />);

    expect(screen.queryByText('Não deveria aparecer')).not.toBeInTheDocument();
  });
});
