// __tests__/pages/Inventory.test.tsx
// Testes de componente da aba "Estoque" (pages/Inventory.tsx)

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { InventoryItem } from '../../types';

const render = (ui: React.ReactElement) =>
  rtlRender(ui, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });

const removeInventoryItem = vi.fn();
const loadInventory = vi.fn();
const confirm = vi.fn();
const showAlert = vi.fn();

const appState: {
  inventory: InventoryItem[];
  isReadOnly: boolean;
} = {
  inventory: [],
  isReadOnly: false,
};

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({
    inventory: appState.inventory,
    removeInventoryItem,
    isReadOnly: appState.isReadOnly,
    loadInventory,
    loadingStates: { inventory: false },
  }),
}));

vi.mock('../../context/DialogContext', () => ({
  useDialog: () => ({ confirm, showAlert }),
}));

// O modal e o import não são o alvo destes testes
vi.mock('../../components/Modals', () => ({
  InventoryModal: () => <div data-testid="inventory-modal" />,
}));
vi.mock('../../components/ImportCSVModal', () => ({
  default: () => <div data-testid="import-modal" />,
}));
vi.mock('../../services/api', () => ({
  inventoryApi: { importCSV: vi.fn() },
}));

import Inventory from '../../pages/Inventory';

function item(over: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: 'i1',
    companyId: 'c1',
    name: 'Ácido Hialurônico',
    unit: 'ml',
    currentStock: 10,
    minStock: 5,
    costPerUnit: 2,
    ...over,
  };
}

function kpiValue(title: string): string {
  const card = screen.getByText(title).closest('div') as HTMLElement;
  return card.textContent ?? '';
}

beforeEach(() => {
  vi.clearAllMocks();
  appState.inventory = [];
  appState.isReadOnly = false;
  confirm.mockResolvedValue(true);
  removeInventoryItem.mockResolvedValue({ success: true });
});

describe('pages/Inventory', () => {
  it('renderiza a lista de itens do contexto', () => {
    appState.inventory = [
      item({ id: 'i1', name: 'Ácido Hialurônico' }),
      item({ id: 'i2', name: 'Luva Descartável' }),
    ];
    render(<Inventory />);
    expect(screen.getByText('Ácido Hialurônico')).toBeInTheDocument();
    expect(screen.getByText('Luva Descartável')).toBeInTheDocument();
  });

  it('a busca por nome filtra a tabela', () => {
    appState.inventory = [
      item({ id: 'i1', name: 'Ácido Hialurônico' }),
      item({ id: 'i2', name: 'Luva Descartável' }),
    ];
    render(<Inventory />);
    fireEvent.change(screen.getByPlaceholderText('Buscar insumo...'), { target: { value: 'luva' } });
    expect(screen.getByText('Luva Descartável')).toBeInTheDocument();
    expect(screen.queryByText('Ácido Hialurônico')).not.toBeInTheDocument();
  });

  it('o filtro "Estoque Baixo" mostra só itens com currentStock <= minStock', () => {
    appState.inventory = [
      item({ id: 'i1', name: 'Cheio', currentStock: 10, minStock: 5 }),
      item({ id: 'i2', name: 'Baixo', currentStock: 3, minStock: 5 }),
      item({ id: 'i3', name: 'NoLimite', currentStock: 5, minStock: 5 }),
    ];
    render(<Inventory />);
    expect(screen.getByText('Cheio')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Estoque Baixo/i }));
    expect(screen.queryByText('Cheio')).not.toBeInTheDocument();
    expect(screen.getByText('Baixo')).toBeInTheDocument();
    expect(screen.getByText('NoLimite')).toBeInTheDocument();
  });

  it('mostra o badge "Repor" em itens com currentStock <= minStock', () => {
    appState.inventory = [
      item({ id: 'i1', name: 'Cheio', currentStock: 10, minStock: 5 }),
      item({ id: 'i2', name: 'Baixo', currentStock: 3, minStock: 5 }),
      item({ id: 'i3', name: 'NoLimite', currentStock: 5, minStock: 5 }),
    ];
    render(<Inventory />);
    expect(screen.getAllByText('Repor')).toHaveLength(2);
  });

  it('calcula os 3 KPIs a partir do array de inventory', () => {
    appState.inventory = [
      item({ id: 'i1', currentStock: 10, minStock: 5, costPerUnit: 2 }), // valor 20, ok
      item({ id: 'i2', currentStock: 3, minStock: 5, costPerUnit: 4 }), // valor 12, baixo
      item({ id: 'i3', currentStock: 5, minStock: 5, costPerUnit: 10 }), // valor 50, baixo (<=)
    ];
    render(<Inventory />);
    expect(kpiValue('Total de Itens')).toContain('3');
    expect(kpiValue('Estoque Crítico')).toContain('2');
    expect(kpiValue('Valor em Estoque')).toContain('82,00');
  });

  it('exclusão: confirm() cancelado NÃO chama removeInventoryItem', async () => {
    confirm.mockResolvedValue(false);
    appState.inventory = [item({ id: 'i1', name: 'Ácido Hialurônico' })];
    render(<Inventory />);

    const delBtn = screen.getAllByRole('button').find((b) => b.querySelector('.lucide-trash-2'))!;
    fireEvent.click(delBtn);
    await Promise.resolve();
    await Promise.resolve();
    expect(removeInventoryItem).not.toHaveBeenCalled();
  });

  it('exclusão: erro da API chama showAlert com a mensagem do backend', async () => {
    confirm.mockResolvedValue(true);
    removeInventoryItem.mockResolvedValue({ success: false, error: 'Há movimentações vinculadas' });
    appState.inventory = [item({ id: 'i1', name: 'Ácido Hialurônico' })];
    render(<Inventory />);

    const delBtn = screen.getAllByRole('button').find((b) => b.querySelector('.lucide-trash-2'))!;
    fireEvent.click(delBtn);

    await waitFor(() =>
      expect(showAlert).toHaveBeenCalledWith('Há movimentações vinculadas', expect.objectContaining({ variant: 'danger' })),
    );
  });

  it('exclusão: sucesso chama removeInventoryItem com o id e não dispara showAlert', async () => {
    confirm.mockResolvedValue(true);
    removeInventoryItem.mockResolvedValue({ success: true });
    appState.inventory = [item({ id: 'i1', name: 'Ácido Hialurônico' })];
    const { rerender } = render(<Inventory />);

    const delBtn = screen.getAllByRole('button').find((b) => b.querySelector('.lucide-trash-2'))!;
    fireEvent.click(delBtn);

    await waitFor(() => expect(removeInventoryItem).toHaveBeenCalledWith('i1'));
    expect(showAlert).not.toHaveBeenCalled();

    // O contexto real removeria o item; simulamos o novo estado e re-renderizamos.
    appState.inventory = [];
    rerender(<Inventory />);
    expect(screen.queryByText('Ácido Hialurônico')).not.toBeInTheDocument();
  });

  it('CARACTERIZAÇÃO (bug de paginação): com 100 itens (limite do loadInventory) os KPIs batem só com o array recebido', () => {
    appState.inventory = Array.from({ length: 100 }, (_, idx) =>
      item({ id: `i${idx}`, name: `Item ${idx}`, currentStock: 1, minStock: 5, costPerUnit: 1 }),
    );
    render(<Inventory />);
    // Uma empresa com >100 itens veria estes números errados — nada indica truncamento.
    expect(kpiValue('Total de Itens')).toContain('100');
    expect(kpiValue('Estoque Crítico')).toContain('100');
    expect(kpiValue('Valor em Estoque')).toContain('100,00');
  });
});
