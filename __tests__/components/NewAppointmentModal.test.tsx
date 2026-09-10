// __tests__/components/NewAppointmentModal.test.tsx
// Testes de componente do NewAppointmentModal (components/Modals.tsx) — criação de
// agendamento a partir da Agenda (fluxo staff).

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { UserRole } from '../../types';

const addAppointment = vi.fn();
const checkGoogleConflicts = vi.fn();
const listPlans = vi.fn();
const listForPatient = vi.fn();
const requestSelf = vi.fn();

const appState = {
  patients: [{ id: 'p1', name: 'Maria Silva' }] as unknown[],
  procedures: [{ id: 'proc-1', name: 'Limpeza', price: 150, durationMinutes: 60 }] as unknown[],
  professionals: [{ id: 'prof-1', name: 'Dra. Ana', role: UserRole.ESTHETICIAN, title: 'Esteticista' }] as unknown[],
  user: { id: 'u1', name: 'Admin', email: 'admin@x.com', role: UserRole.ADMIN },
};

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({
    addAppointment,
    patients: appState.patients,
    procedures: appState.procedures,
    professionals: appState.professionals,
    user: appState.user,
  }),
}));

vi.mock('../../context/DialogContext', () => ({
  useDialog: () => ({ showAlert: vi.fn(), confirm: vi.fn() }),
}));

vi.mock('react-signature-canvas', () => ({ default: (() => null) as React.FC }));

vi.mock('../../services/api', () => ({
  appointmentsApi: {
    checkGoogleConflicts: (...a: unknown[]) => checkGoogleConflicts(...a),
  },
  subscriptionsApi: {
    listPlans: (...a: unknown[]) => listPlans(...a),
    listForPatient: (...a: unknown[]) => listForPatient(...a),
    requestSelf: (...a: unknown[]) => requestSelf(...a),
  },
}));

import { NewAppointmentModal } from '../../components/Modals';

const FIXED_DATE = new Date(2026, 8, 14, 10, 0, 0);

beforeEach(() => {
  vi.clearAllMocks();
  checkGoogleConflicts.mockResolvedValue({ success: true, data: { hasConflict: false } });
  listPlans.mockResolvedValue({ success: true, data: [] });
  listForPatient.mockResolvedValue({ success: true, data: [] });
  addAppointment.mockResolvedValue({ success: true });
});

function procedureSelect(): HTMLSelectElement {
  const combos = screen.getAllByRole('combobox');
  return combos.find((c) => within(c).queryByText('Selecione da lista...')) as HTMLSelectElement;
}

describe('NewAppointmentModal — conflito com Google Calendar', () => {
  it('banner de conflito aparece e bloqueia o botão de submit', async () => {
    checkGoogleConflicts.mockResolvedValue({
      success: true,
      data: { hasConflict: true, event: { title: 'Consulta médica', start: '10:00', end: '11:00' } },
    });

    render(
      <NewAppointmentModal
        onClose={vi.fn()}
        preSelectedDate={FIXED_DATE}
        preSelectedProfessionalId="prof-1"
        preSelectedProcedureId="proc-1"
      />
    );

    expect(await screen.findByText(/Horário indisponível no Google Agenda/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Agendar$/i })).toBeDisabled();
  });
});

describe('NewAppointmentModal — seleção de plano (Promoção)', () => {
  it('selecionar "Promoção X" via handleProcedureChange zera o preço', async () => {
    listPlans.mockResolvedValue({
      success: true,
      data: [{ id: 'plan-1', name: 'Verão', price: 500, items: [{ procedureId: 'proc-1', sessionsPerCycle: 4 }] }],
    });

    render(<NewAppointmentModal onClose={vi.fn()} preSelectedDate={FIXED_DATE} preSelectedProfessionalId="prof-1" />);

    // aguarda os planos carregarem na lista
    await screen.findByRole('option', { name: 'Promoção Verão' });

    fireEvent.change(procedureSelect(), { target: { value: 'plan-plan-1' } });

    expect((screen.getByPlaceholderText('0.00') as HTMLInputElement).value).toBe('0');
  });
});

describe('NewAppointmentModal — conflito de horário retornado pelo backend', () => {
  it('result.conflict exibe a mensagem "horário já está ocupado"', async () => {
    addAppointment.mockResolvedValue({ success: false, conflict: true });

    render(
      <NewAppointmentModal
        onClose={vi.fn()}
        preSelectedDate={FIXED_DATE}
        preSelectedProfessionalId="prof-1"
        preSelectedProcedureId="proc-1"
      />
    );

    // seleciona o paciente
    const patientCombo = screen
      .getAllByRole('combobox')
      .find((c) => within(c).queryByText('Selecione...')) as HTMLSelectElement;
    fireEvent.change(patientCombo, { target: { value: 'p1' } });

    const submit = screen.getByRole('button', { name: /^Agendar$/i });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    expect(await screen.findByText(/Este horário já está ocupado/i)).toBeInTheDocument();
    expect(addAppointment).toHaveBeenCalled();
  });
});
