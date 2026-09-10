// __tests__/components/ProfessionalModal.test.tsx
// Testes de componente do ProfessionalModal (components/Modals.tsx)

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UserRole } from '../../types';

const addProfessional = vi.fn();
const updateProfessional = vi.fn();
const resetUserPassword = vi.fn();
const showAlert = vi.fn();

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({
    addProfessional,
    updateProfessional,
    resetUserPassword,
    currentCompany: { id: 'c1', name: 'Clínica X', businessHours: null as unknown },
  }),
}));

vi.mock('../../context/DialogContext', () => ({
  useDialog: () => ({ showAlert }),
}));

import { ProfessionalModal } from '../../components/Modals';

const EXISTING = {
  id: 'p1',
  name: 'Bruna Lima',
  email: 'bruna@x.com',
  role: UserRole.ESTHETICIAN,
  title: 'Esteticista',
  phone: '',
  contractType: 'pj' as const,
  remunerationType: 'comissao' as const,
  commissionRate: 30,
  fixedSalary: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  addProfessional.mockResolvedValue({ success: true });
  updateProfessional.mockResolvedValue({ success: true });
});

describe('ProfessionalModal', () => {
  it('na CRIAÇÃO, o campo de senha aparece e é obrigatório; submeter sem senha mostra alerta e não chama addProfessional', async () => {
    render(<ProfessionalModal onClose={vi.fn()} />);
    expect(screen.getByPlaceholderText('Mínimo 6 caracteres')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Nome Completo'), { target: { value: 'Nova Prof' } });
    fireEvent.change(screen.getByLabelText('E-mail (Login)'), { target: { value: 'nova@x.com' } });
    fireEvent.submit(screen.getByRole('button', { name: /Salvar Profissional/i }).closest('form')!);

    await waitFor(() => expect(showAlert).toHaveBeenCalledWith(
      'Senha é obrigatória para novos usuários',
      expect.objectContaining({ variant: 'warning' }),
    ));
    expect(addProfessional).not.toHaveBeenCalled();
  });

  it('na EDIÇÃO, não há campo de senha — aparece o botão "Redefinir Senha"', () => {
    render(<ProfessionalModal onClose={vi.fn()} initialData={EXISTING as never} />);
    expect(screen.queryByPlaceholderText('Mínimo 6 caracteres')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Redefinir Senha/i })).toBeInTheDocument();
  });

  it('o campo "Comissão (%)" aparece só para remuneração por comissão/misto; "Salário Fixo" só para fixo/misto', () => {
    render(<ProfessionalModal onClose={vi.fn()} initialData={EXISTING as never} />);
    const modelo = screen.getByLabelText('Modelo de Pagamento');

    // inicial = comissao → mostra Comissão, esconde Salário Fixo
    expect(screen.getByLabelText('Comissão (%)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Salário Fixo Mensal')).not.toBeInTheDocument();

    fireEvent.change(modelo, { target: { value: 'fixo' } });
    expect(screen.queryByLabelText('Comissão (%)')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Salário Fixo Mensal')).toBeInTheDocument();

    fireEvent.change(modelo, { target: { value: 'misto' } });
    expect(screen.getByLabelText('Comissão (%)')).toBeInTheDocument();
    expect(screen.getByLabelText('Salário Fixo Mensal')).toBeInTheDocument();
  });

  it('o input de comissão tem min=0 e max=100 (defesa em profundidade)', () => {
    render(<ProfessionalModal onClose={vi.fn()} initialData={EXISTING as never} />);
    const input = screen.getByLabelText('Comissão (%)');
    expect(input).toHaveAttribute('min', '0');
    expect(input).toHaveAttribute('max', '100');
  });

  it('handleResetPassword: sucesso mostra a senha gerada na tela', async () => {
    resetUserPassword.mockResolvedValueOnce({ success: true });
    render(<ProfessionalModal onClose={vi.fn()} initialData={EXISTING as never} />);

    fireEvent.click(screen.getByRole('button', { name: /Redefinir Senha/i }));
    await waitFor(() => expect(screen.getByText('Nova senha gerada:')).toBeInTheDocument());
    expect(resetUserPassword).toHaveBeenCalledWith('p1', expect.any(String));
  });

  it('handleResetPassword: erro da API chama showAlert', async () => {
    resetUserPassword.mockResolvedValueOnce({ success: false, error: 'Senha muito curta' });
    render(<ProfessionalModal onClose={vi.fn()} initialData={EXISTING as never} />);

    fireEvent.click(screen.getByRole('button', { name: /Redefinir Senha/i }));
    await waitFor(() => expect(showAlert).toHaveBeenCalledWith(
      expect.stringContaining('Senha muito curta'),
      expect.objectContaining({ variant: 'danger' }),
    ));
  });

  it('submeter uma EDIÇÃO nunca envia o campo password para updateProfessional', async () => {
    render(<ProfessionalModal onClose={vi.fn()} initialData={EXISTING as never} />);
    fireEvent.change(screen.getByLabelText('Nome Completo'), { target: { value: 'Bruna Lima Editada' } });
    fireEvent.submit(screen.getByRole('button', { name: /Salvar Profissional/i }).closest('form')!);

    await waitFor(() => expect(updateProfessional).toHaveBeenCalled());
    const [, payload] = updateProfessional.mock.calls[0];
    expect(payload).not.toHaveProperty('password');
    expect(payload.name).toBe('Bruna Lima Editada');
  });
});
