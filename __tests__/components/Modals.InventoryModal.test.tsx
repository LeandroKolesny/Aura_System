// __tests__/components/Modals.InventoryModal.test.tsx
// Testes de componente do InventoryModal (components/Modals.tsx)

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { InventoryItem } from '../../types';

const addInventoryItem = vi.fn();
const updateInventoryItem = vi.fn();
const adjustInventoryStock = vi.fn();
const showAlert = vi.fn();

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({ addInventoryItem, updateInventoryItem, adjustInventoryStock }),
}));

vi.mock('../../context/DialogContext', () => ({
  useDialog: () => ({ showAlert }),
}));

import { InventoryModal } from '../../components/Modals';

const EXISTING: InventoryItem = {
  id: 'i1',
  companyId: 'c1',
  name: 'Ácido Hialurônico',
  unit: 'ml',
  currentStock: 10,
  minStock: 5,
  costPerUnit: 2,
};

function fieldInput(labelText: string): HTMLInputElement {
  const wrapper = screen.getByText(labelText).closest('div') as HTMLElement;
  return wrapper.querySelector('input') as HTMLInputElement;
}

function submit() {
  fireEvent.submit(screen.getByRole('button', { name: /Salvar Item/i }).closest('form') as HTMLFormElement);
}

beforeEach(() => {
  vi.clearAllMocks();
  addInventoryItem.mockResolvedValue({ success: true });
  updateInventoryItem.mockResolvedValue({ success: true });
  adjustInventoryStock.mockResolvedValue({ success: true });
});

describe('InventoryModal', () => {
  it('EDIÇÃO: alterar "Estoque Atual" chama a rota de AJUSTE auditado com o delta — e o PUT vai SEM currentStock', async () => {
    render(<InventoryModal onClose={vi.fn()} initialData={EXISTING} />);

    fireEvent.change(fieldInput('Estoque Atual'), { target: { value: '7' } });
    submit();

    await waitFor(() => expect(updateInventoryItem).toHaveBeenCalled());

    const [id, putPayload] = updateInventoryItem.mock.calls[0];
    expect(id).toBe('i1');
    expect(putPayload).not.toHaveProperty('currentStock');
    expect(putPayload).toMatchObject({ name: 'Ácido Hialurônico', unit: 'ml', minStock: 5, costPerUnit: 2 });

    expect(adjustInventoryStock).toHaveBeenCalledWith('i1', {
      type: 'ADJUSTMENT',
      quantity: -3,
      reason: 'Ajuste manual pela ficha do item',
    });
  });

  it('EDIÇÃO: se "Estoque Atual" não mudou, só o PUT roda (nenhum ajuste auditado)', async () => {
    render(<InventoryModal onClose={vi.fn()} initialData={EXISTING} />);

    fireEvent.change(fieldInput('Custo Unitário (R$)'), { target: { value: '9' } });
    submit();

    await waitFor(() => expect(updateInventoryItem).toHaveBeenCalled());
    expect(updateInventoryItem.mock.calls[0][1]).toMatchObject({ costPerUnit: 9 });
    expect(adjustInventoryStock).not.toHaveBeenCalled();
  });

  it('EDIÇÃO: erro no ajuste auditado dispara showAlert e não fecha o modal', async () => {
    const onClose = vi.fn();
    adjustInventoryStock.mockResolvedValue({ success: false, error: 'Estoque insuficiente' });
    render(<InventoryModal onClose={onClose} initialData={EXISTING} />);

    fireEvent.change(fieldInput('Estoque Atual'), { target: { value: '999' } });
    submit();

    await waitFor(() =>
      expect(showAlert).toHaveBeenCalledWith('Estoque insuficiente', expect.objectContaining({ variant: 'danger' })),
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it('CRIAÇÃO: converte os campos de texto para número (Number(x) || 0) antes de chamar addInventoryItem', async () => {
    render(<InventoryModal onClose={vi.fn()} />);

    fireEvent.change(fieldInput('Nome do Insumo / Produto'), { target: { value: 'Sérum Vitamina C' } });
    fireEvent.change(fieldInput('Custo Unitário (R$)'), { target: { value: '12.5' } });
    fireEvent.change(fieldInput('Estoque Atual'), { target: { value: '30' } });
    fireEvent.change(fieldInput('Alerta de Estoque Mínimo'), { target: { value: '4' } });
    submit();

    await waitFor(() => expect(addInventoryItem).toHaveBeenCalled());
    expect(addInventoryItem.mock.calls[0][0]).toEqual({
      name: 'Sérum Vitamina C',
      unit: 'un',
      currentStock: 30,
      minStock: 4,
      costPerUnit: 12.5,
    });
    expect(updateInventoryItem).not.toHaveBeenCalled();
  });

  it('CRIAÇÃO: campos numéricos vazios viram 0', async () => {
    render(<InventoryModal onClose={vi.fn()} />);
    fireEvent.change(fieldInput('Nome do Insumo / Produto'), { target: { value: 'Item Sem Números' } });
    submit();

    await waitFor(() => expect(addInventoryItem).toHaveBeenCalled());
    expect(addInventoryItem.mock.calls[0][0]).toMatchObject({ currentStock: 0, minStock: 0, costPerUnit: 0 });
  });

  it('CRIAÇÃO: erro da API dispara showAlert com a mensagem do backend', async () => {
    addInventoryItem.mockResolvedValue({ success: false, error: 'Dados inválidos' });
    render(<InventoryModal onClose={vi.fn()} />);

    fireEvent.change(fieldInput('Nome do Insumo / Produto'), { target: { value: 'X' } });
    submit();

    await waitFor(() =>
      expect(showAlert).toHaveBeenCalledWith('Dados inválidos', expect.objectContaining({ variant: 'danger' })),
    );
  });
});
