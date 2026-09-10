// __tests__/components/CheckoutModal.test.tsx
// Testes de componente do CheckoutModal (components/Modals.tsx) — fluxo de pagamento
// do atendimento a partir da Agenda.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Appointment } from '../../types';

const processPayment = vi.fn();
const changeAppointmentStatus = vi.fn();
const showAlert = vi.fn();

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({
    processPayment,
    changeAppointmentStatus,
    currentCompany: { paymentMethods: ['money', 'credit_card', 'pix'] },
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

import { CheckoutModal } from '../../components/Modals';

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
    status: 'confirmed',
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  processPayment.mockResolvedValue({ success: true });
});

describe('CheckoutModal — pagamento recusado pelo backend', () => {
  it('NÃO mostra "Pagamento Registrado!", comunica o erro via showAlert e libera o botão', async () => {
    processPayment.mockResolvedValue({ success: false, error: 'Agendamento já foi pago' });
    render(<CheckoutModal appointment={appointment()} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Finalizar e Receber/i }));

    await waitFor(() =>
      expect(showAlert).toHaveBeenCalledWith(
        'Agendamento já foi pago',
        expect.objectContaining({ variant: 'danger' })
      )
    );
    expect(screen.queryByText('Pagamento Registrado!')).not.toBeInTheDocument();
    // isProcessing volta a false → botão volta ao texto normal e habilitado
    const btn = await screen.findByRole('button', { name: /Finalizar e Receber/i });
    expect(btn).toBeEnabled();
  });
});

describe('CheckoutModal — caminho feliz', () => {
  it('avança para a tela de sucesso com o resumo (forma de pagamento)', async () => {
    render(<CheckoutModal appointment={appointment()} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Finalizar e Receber/i }));

    expect(await screen.findByText('Pagamento Registrado!')).toBeInTheDocument();
    expect(screen.getByText('Forma de pagamento')).toBeInTheDocument();
    expect(screen.getByText('Pix')).toBeInTheDocument();
    expect(showAlert).not.toHaveBeenCalled();
    expect(processPayment).toHaveBeenCalledWith(expect.objectContaining({ id: 'appt-1' }), 'pix', 1);
  });

  it('parcelamento em 3x reflete no resumo: "3x de R$ 100,00"', async () => {
    render(<CheckoutModal appointment={appointment({ price: 300 })} onClose={vi.fn()} />);

    // seleciona cartão de crédito → aparece a grade de parcelamento
    fireEvent.click(screen.getByRole('button', { name: /Cartão de Crédito/i }));

    // a grade mostra o valor por parcela para cada opção 1x..12x
    expect(screen.getByText('R$ 150,00')).toBeInTheDocument(); // 2x
    expect(screen.getByText('R$ 100,00')).toBeInTheDocument(); // 3x
    expect(screen.getByText('R$ 50,00')).toBeInTheDocument();  // 6x

    // seleciona 3x e finaliza
    const parcelaBtn = screen.getByText('R$ 100,00').closest('button') as HTMLButtonElement;
    fireEvent.click(parcelaBtn);
    expect(parcelaBtn.className).toContain('ring-2');

    fireEvent.click(screen.getByRole('button', { name: /Finalizar e Receber/i }));

    expect(await screen.findByText('Pagamento Registrado!')).toBeInTheDocument();
    expect(screen.getByText('3x de R$ 100,00')).toBeInTheDocument();
    expect(processPayment).toHaveBeenCalledWith(expect.objectContaining({ id: 'appt-1' }), 'credit_card', 3);
  });
});
