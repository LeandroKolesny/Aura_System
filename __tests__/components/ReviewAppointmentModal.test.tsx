// __tests__/components/ReviewAppointmentModal.test.tsx
// Testes de componente do ReviewAppointmentModal (components/Modals.tsx) —
// aprovação/recusa de solicitação de agendamento pendente.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Appointment } from '../../types';

const changeAppointmentStatus = vi.fn();
const addNotification = vi.fn();
const showAlert = vi.fn();

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({
    changeAppointmentStatus,
    addNotification,
    currentCompany: { name: 'Clínica X' },
  }),
}));

vi.mock('../../context/DialogContext', () => ({
  useDialog: () => ({ showAlert, confirm: vi.fn() }),
}));

vi.mock('react-signature-canvas', () => ({ default: (() => null) as React.FC }));

vi.mock('../../services/api', () => ({
  appointmentsApi: {},
  subscriptionsApi: {},
}));

import { ReviewAppointmentModal } from '../../components/Modals';

function appointment(over: Partial<Appointment> = {}): Appointment {
  return {
    id: 'appt-1',
    companyId: 'c1',
    patientId: 'p1',
    patientName: 'Maria Silva',
    professionalId: 'prof-1',
    professionalName: 'Dra. Ana',
    service: 'Limpeza de Pele',
    price: 300,
    date: '2026-09-10T14:00:00.000Z',
    durationMinutes: 60,
    status: 'pending_approval',
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  changeAppointmentStatus.mockResolvedValue({ success: true });
  addNotification.mockResolvedValue({ success: true });
});

describe('ReviewAppointmentModal', () => {
  it('aprovar dispara changeAppointmentStatus(id, "SCHEDULED") e addNotification', async () => {
    const onClose = vi.fn();
    render(<ReviewAppointmentModal appointment={appointment()} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: /Aprovar Agendamento/i }));

    await waitFor(() => expect(changeAppointmentStatus).toHaveBeenCalledWith('appt-1', 'SCHEDULED'));
    expect(addNotification).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: 'c1', type: 'success' })
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(showAlert).not.toHaveBeenCalled();
  });

  it('recusar dispara changeAppointmentStatus(id, "CANCELED")', async () => {
    render(<ReviewAppointmentModal appointment={appointment()} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /^Cancelar$/i }));
    fireEvent.click(screen.getByRole('button', { name: /Sim, Cancelar/i }));

    await waitFor(() => expect(changeAppointmentStatus).toHaveBeenCalledWith('appt-1', 'CANCELED'));
    expect(addNotification).not.toHaveBeenCalled();
  });

  it('erro da API ao aprovar exibe showAlert (variant danger) e não fecha o modal', async () => {
    changeAppointmentStatus.mockResolvedValue({ success: false, error: 'Transição inválida' });
    const onClose = vi.fn();
    render(<ReviewAppointmentModal appointment={appointment()} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: /Aprovar Agendamento/i }));

    await waitFor(() =>
      expect(showAlert).toHaveBeenCalledWith('Transição inválida', expect.objectContaining({ variant: 'danger' }))
    );
    expect(addNotification).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
