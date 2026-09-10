// __tests__/components/Modals.NewExpenseModal.test.tsx
// Testes do NewExpenseModal (components/Modals.tsx) — lançamento manual de despesa/receita.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Transaction } from '../../types';

const addTransaction = vi.fn();
const updateTransaction = vi.fn();

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({ addTransaction, updateTransaction }),
}));

vi.mock('../../context/DialogContext', () => ({
  useDialog: () => ({ showAlert: vi.fn(), confirm: vi.fn() }),
}));

vi.mock('react-signature-canvas', () => ({ default: (() => null) as React.FC }));

vi.mock('../../services/api', () => ({
  appointmentsApi: {},
  subscriptionsApi: {},
}));

import { NewExpenseModal } from '../../components/Modals';

const descInput = () => screen.getByPlaceholderText('Ex: Conta de Luz...');
const amountInput = () => screen.getByRole('spinbutton');
const categoryInput = () => screen.getByPlaceholderText('Ex: Aluguel, Insumos...');
// Dispara o submit direto no <form>, contornando a constraint validation nativa
// do jsdom (que impede o submit quando um campo `required` está vazio) — o objetivo
// aqui é exercitar a validação JS do handleSubmit.
const submitForm = () =>
  fireEvent.submit(descInput().closest('form') as HTMLFormElement);

beforeEach(() => {
  vi.clearAllMocks();
  addTransaction.mockResolvedValue({ success: true });
  updateTransaction.mockResolvedValue({ success: true });
});

describe('NewExpenseModal — validação client-side', () => {
  it('bloqueia submit com descrição vazia e mostra "Preencha a descrição e o valor."', () => {
    render(<NewExpenseModal onClose={vi.fn()} />);
    fireEvent.change(amountInput(), { target: { value: '100' } });
    submitForm();

    expect(screen.getByText('Preencha a descrição e o valor.')).toBeInTheDocument();
    expect(addTransaction).not.toHaveBeenCalled();
  });

  it('bloqueia submit com valor <= 0 e mostra "O valor deve ser positivo."', () => {
    render(<NewExpenseModal onClose={vi.fn()} />);
    fireEvent.change(descInput(), { target: { value: 'Aluguel' } });
    fireEvent.change(amountInput(), { target: { value: '0' } });
    submitForm();

    expect(screen.getByText('O valor deve ser positivo.')).toBeInTheDocument();
    expect(addTransaction).not.toHaveBeenCalled();
  });
});

describe('NewExpenseModal — submit válido (criação)', () => {
  it('chama addTransaction com o payload esperado e categoria default "Despesas" para despesa', async () => {
    const onClose = vi.fn();
    render(<NewExpenseModal onClose={onClose} />);

    fireEvent.change(descInput(), { target: { value: '  Conta de Luz  ' } });
    fireEvent.change(amountInput(), { target: { value: '150.5' } });
    fireEvent.click(screen.getByRole('button', { name: /Registrar Despesa/i }));

    await waitFor(() => expect(addTransaction).toHaveBeenCalledTimes(1));
    const expectedDate = new Date(new Date().toISOString().split('T')[0]).toISOString();
    expect(addTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Conta de Luz',
        amount: 150.5,
        type: 'expense',
        category: 'Despesas',
        status: 'paid',
        date: expectedDate,
      })
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('para receita, a categoria default é "Receitas"', async () => {
    render(<NewExpenseModal onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /^Receita$/i })); // troca o tipo
    fireEvent.change(descInput(), { target: { value: 'Venda avulsa' } });
    fireEvent.change(amountInput(), { target: { value: '80' } });
    fireEvent.click(screen.getByRole('button', { name: /Registrar Receita/i }));

    await waitFor(() => expect(addTransaction).toHaveBeenCalledTimes(1));
    expect(addTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'income', category: 'Receitas', amount: 80 })
    );
  });

  it('categoria informada pelo usuário sobrescreve a default', async () => {
    render(<NewExpenseModal onClose={vi.fn()} />);
    fireEvent.change(descInput(), { target: { value: 'Produto X' } });
    fireEvent.change(amountInput(), { target: { value: '40' } });
    fireEvent.change(categoryInput(), { target: { value: 'Insumos' } });
    fireEvent.click(screen.getByRole('button', { name: /Registrar Despesa/i }));

    await waitFor(() => expect(addTransaction).toHaveBeenCalledTimes(1));
    expect(addTransaction).toHaveBeenCalledWith(expect.objectContaining({ category: 'Insumos' }));
  });
});

describe('NewExpenseModal — edição', () => {
  const initial: Transaction = {
    id: 'tx-9',
    companyId: 'c1',
    date: '2026-02-01T12:00:00.000Z',
    description: 'Material antigo',
    amount: 120,
    type: 'expense',
    category: 'Insumos',
    status: 'pending',
  };

  it('chama updateTransaction com o id e os campos alterados', async () => {
    const onClose = vi.fn();
    render(<NewExpenseModal initialData={initial} onClose={onClose} />);

    fireEvent.change(descInput(), { target: { value: 'Material novo' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar Alterações/i }));

    await waitFor(() => expect(updateTransaction).toHaveBeenCalledTimes(1));
    expect(updateTransaction).toHaveBeenCalledWith(
      'tx-9',
      expect.objectContaining({
        description: 'Material novo',
        amount: 120,
        type: 'expense',
        status: 'pending',
      })
    );
    expect(addTransaction).not.toHaveBeenCalled();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('exibe o erro retornado pelo backend e não fecha o modal', async () => {
    updateTransaction.mockResolvedValue({ success: false, error: 'Vinculada a um agendamento' });
    const onClose = vi.fn();
    render(<NewExpenseModal initialData={initial} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: /Salvar Alterações/i }));

    expect(await screen.findByText('Vinculada a um agendamento')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
