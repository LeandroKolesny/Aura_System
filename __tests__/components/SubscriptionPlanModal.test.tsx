// __tests__/components/SubscriptionPlanModal.test.tsx
// Testes de componente do modal de criar/editar plano de assinatura
// (components/SubscriptionPlanModal.tsx)

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const { mockApi, mockShowAlert } = vi.hoisted(() => ({
  mockApi: { createPlan: vi.fn(), updatePlan: vi.fn() },
  mockShowAlert: vi.fn(),
}));

vi.mock('../../services/api', () => ({ subscriptionsApi: mockApi }));
vi.mock('../../context/DialogContext', () => ({
  useDialog: () => ({ showAlert: mockShowAlert }),
}));

import SubscriptionPlanModal from '../../components/SubscriptionPlanModal';
import type { SubscriptionPlan } from '../../services/api';

const PROCEDURES = [
  { id: 'proc-a', name: 'Limpeza de Pele', price: 120 },
  { id: 'proc-b', name: 'Peeling', price: 200 },
];

function renderModal(plan: SubscriptionPlan | null = null) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(
    <SubscriptionPlanModal plan={plan} procedures={PROCEDURES} onClose={onClose} onSaved={onSaved} />
  );
  return { onClose, onSaved };
}

const nameInput = () => screen.getByPlaceholderText('Ex: Plano Mensal de Limpeza de Pele');
const priceInput = () => screen.getByPlaceholderText('0,00');
// price e "sessões por ciclo" são ambos <input type="number"> (spinbutton);
// o campo de sessões é o último.
const sessionsInputs = () => screen.getAllByRole('spinbutton');
const lastSessionsInput = () => sessionsInputs()[sessionsInputs().length - 1];
const saveButton = () => screen.getByRole('button', { name: /Criar plano|Salvar alterações/ });

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.createPlan.mockResolvedValue({ success: true, data: {} });
  mockApi.updatePlan.mockResolvedValue({ success: true, data: {} });
});

describe('components/SubscriptionPlanModal — validações client-side', () => {
  it('bloqueia salvar com nome vazio', async () => {
    renderModal();
    fireEvent.click(saveButton());
    expect(await screen.findByText('Nome do plano é obrigatório')).toBeInTheDocument();
    expect(mockApi.createPlan).not.toHaveBeenCalled();
  });

  it('bloqueia salvar com preço <= 0', async () => {
    renderModal();
    fireEvent.change(nameInput(), { target: { value: 'Plano X' } });
    fireEvent.change(priceInput(), { target: { value: '0' } });
    fireEvent.click(saveButton());
    expect(await screen.findByText('Preço deve ser maior que zero')).toBeInTheDocument();
    expect(mockApi.createPlan).not.toHaveBeenCalled();
  });

  it('bloqueia salvar com item sem procedimento selecionado', async () => {
    renderModal();
    fireEvent.change(nameInput(), { target: { value: 'Plano X' } });
    fireEvent.change(priceInput(), { target: { value: '99.9' } });
    fireEvent.click(saveButton());
    expect(await screen.findByText('Selecione o procedimento para todos os itens')).toBeInTheDocument();
    expect(mockApi.createPlan).not.toHaveBeenCalled();
  });

  it('bloqueia salvar com sessões por ciclo menor que 1', async () => {
    renderModal();
    fireEvent.change(nameInput(), { target: { value: 'Plano X' } });
    fireEvent.change(priceInput(), { target: { value: '99.9' } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'proc-a' } });
    fireEvent.change(lastSessionsInput(), { target: { value: "-1" } });
    fireEvent.click(saveButton());
    expect(await screen.findByText('Sessões por ciclo deve ser no mínimo 1')).toBeInTheDocument();
    expect(mockApi.createPlan).not.toHaveBeenCalled();
  });

  it('bloqueia salvar com procedimento duplicado entre itens', async () => {
    // modal em edição com dois itens apontando para o mesmo procedimento
    renderModal({
      id: 'plan-1',
      name: 'Plano Dup',
      price: 150,
      description: null,
      imageUrl: null,
      isActive: true,
      companyId: 'c1',
      createdAt: '2026-01-01T00:00:00.000Z',
      items: [
        { id: 'i1', procedureId: 'proc-a', sessionsPerCycle: 1, procedure: { id: 'proc-a', name: 'Limpeza de Pele', price: 120 } },
        { id: 'i2', procedureId: 'proc-a', sessionsPerCycle: 2, procedure: { id: 'proc-a', name: 'Limpeza de Pele', price: 120 } },
      ],
    });
    fireEvent.click(saveButton());
    expect(
      await screen.findByText('Cada procedimento pode aparecer apenas uma vez no plano')
    ).toBeInTheDocument();
    expect(mockApi.updatePlan).not.toHaveBeenCalled();
  });

  it('passa em todas as validações e chama createPlan com o payload montado', async () => {
    renderModal();
    fireEvent.change(nameInput(), { target: { value: '  Plano Válido  ' } });
    fireEvent.change(priceInput(), { target: { value: '149.90' } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'proc-b' } });
    fireEvent.change(lastSessionsInput(), { target: { value: "3" } });
    fireEvent.click(saveButton());

    await waitFor(() => expect(mockApi.createPlan).toHaveBeenCalledTimes(1));
    expect(mockApi.createPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Plano Válido',
        price: 149.9,
        items: [{ procedureId: 'proc-b', sessionsPerCycle: 3 }],
      })
    );
  });
});

describe('components/SubscriptionPlanModal — edição', () => {
  it('pré-preenche os campos a partir do plan recebido', () => {
    renderModal({
      id: 'plan-1',
      name: 'Plano Premium',
      price: 299.9,
      description: 'Tudo incluso',
      imageUrl: null,
      isActive: true,
      companyId: 'c1',
      createdAt: '2026-01-01T00:00:00.000Z',
      items: [
        { id: 'i1', procedureId: 'proc-b', sessionsPerCycle: 4, procedure: { id: 'proc-b', name: 'Peeling', price: 200 } },
      ],
    });

    expect(screen.getByText('Editar Plano')).toBeInTheDocument();
    expect(nameInput()).toHaveValue('Plano Premium');
    expect(priceInput()).toHaveValue(299.9);
    expect(screen.getByDisplayValue('Tudo incluso')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveValue('proc-b');
    expect(lastSessionsInput()).toHaveValue(4);
    expect(screen.getByRole('button', { name: /Salvar alterações/ })).toBeInTheDocument();
  });
});
