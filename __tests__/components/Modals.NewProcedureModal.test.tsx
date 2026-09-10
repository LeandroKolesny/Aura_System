// __tests__/components/Modals.NewProcedureModal.test.tsx
// Testes de componente do NewProcedureModal (components/Modals.tsx)

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { InventoryItem, Procedure } from '../../types';

const addProcedure = vi.fn();
const updateProcedure = vi.fn();
const showAlert = vi.fn();

const INVENTORY: InventoryItem[] = [
  { id: 'inv1', companyId: 'c1', name: 'Toxina Botulínica', unit: 'un', currentStock: 100, minStock: 10, costPerUnit: 5 },
];

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({ addProcedure, updateProcedure, inventory: INVENTORY }),
}));

vi.mock('../../context/DialogContext', () => ({
  useDialog: () => ({ showAlert }),
}));

import { NewProcedureModal } from '../../components/Modals';

// --- helpers -------------------------------------------------------------

function fieldInput(labelText: string): HTMLInputElement {
  const wrapper = screen.getByText(labelText).closest('div') as HTMLElement;
  return wrapper.querySelector('input') as HTMLInputElement;
}

function form(): HTMLFormElement {
  return document.querySelector('form') as HTMLFormElement;
}

function addSupplyButton(): HTMLButtonElement {
  return screen.getAllByRole('button').find((b) => b.querySelector('.lucide-plus')) as HTMLButtonElement;
}

function fillRequired({ name = 'Preenchimento Labial', price = '500', duration = '60' } = {}) {
  fireEvent.change(fieldInput('Nome do Procedimento'), { target: { value: name } });
  fireEvent.change(fieldInput('Preço de Venda (R$)'), { target: { value: price } });
  fireEvent.change(fieldInput('Duração Padrão (min)'), { target: { value: duration } });
}

// stub de Image + canvas p/ o fluxo de compressão de imagem
class MockImage {
  onload: () => void = () => {};
  width = 100;
  height = 100;
  set src(_v: string) {
    queueMicrotask(() => this.onload());
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  addProcedure.mockResolvedValue({ success: true });
  updateProcedure.mockResolvedValue({ success: true });
  vi.stubGlobal('Image', MockImage as unknown as typeof Image);
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage: vi.fn() })) as never;
  HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/jpeg;base64,MOCKCOMPRESSED');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('NewProcedureModal — validação de preço/duração', () => {
  it('aceita price = 0 (procedimento cortesia) — não mostra "Preço inválido."', async () => {
    render(<NewProcedureModal onClose={vi.fn()} />);
    fillRequired({ price: '0', duration: '30' });
    fireEvent.submit(form());

    await waitFor(() => expect(addProcedure).toHaveBeenCalled());
    expect(addProcedure.mock.calls[0][0].price).toBe(0);
    expect(screen.queryByText('Preço inválido.')).not.toBeInTheDocument();
  });

  it('bloqueia price < 0 com "Preço inválido." e não chama addProcedure', async () => {
    render(<NewProcedureModal onClose={vi.fn()} />);
    fillRequired({ price: '-5', duration: '30' });
    fireEvent.submit(form());

    expect(await screen.findByText('Preço inválido.')).toBeInTheDocument();
    expect(addProcedure).not.toHaveBeenCalled();
  });

  it('bloqueia duration <= 0 com "Duração inválida." e não chama addProcedure', async () => {
    render(<NewProcedureModal onClose={vi.fn()} />);
    fillRequired({ price: '100', duration: '0' });
    fireEvent.submit(form());

    expect(await screen.findByText('Duração inválida.')).toBeInTheDocument();
    expect(addProcedure).not.toHaveBeenCalled();
  });
});

describe('NewProcedureModal — custo dos insumos', () => {
  it('totalCost exibido = insumo de estoque (qty × costPerUnit) + insumo manual', async () => {
    render(<NewProcedureModal onClose={vi.fn()} />);

    // insumo de estoque: inv1 (costPerUnit 5) × 2 = 10
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'inv1' } });
    fireEvent.change(fieldInput('Quantidade'), { target: { value: '2' } });
    fireEvent.click(addSupplyButton());

    // insumo manual: 3
    fireEvent.change(fieldInput('Nome do Insumo'), { target: { value: 'Gaze estéril' } });
    fireEvent.change(fieldInput('Custo (R$)'), { target: { value: '3' } });
    fireEvent.click(addSupplyButton());

    // footer "Custo Total" => 13
    expect(screen.getByText(/13,00/)).toBeInTheDocument();
  });

  it('ao salvar: custo enviado NÃO inclui insumo manual e dispara showAlert de aviso (Opção B)', async () => {
    render(<NewProcedureModal onClose={vi.fn()} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'inv1' } });
    fireEvent.change(fieldInput('Quantidade'), { target: { value: '2' } });
    fireEvent.click(addSupplyButton());

    fireEvent.change(fieldInput('Nome do Insumo'), { target: { value: 'Gaze estéril' } });
    fireEvent.change(fieldInput('Custo (R$)'), { target: { value: '3' } });
    fireEvent.click(addSupplyButton());

    fillRequired();
    fireEvent.submit(form());

    await waitFor(() => expect(addProcedure).toHaveBeenCalled());
    const payload = addProcedure.mock.calls[0][0];
    expect(payload.cost).toBe(10); // só o insumo de estoque
    expect(payload.supplies).toHaveLength(1);
    expect(payload.supplies[0].inventoryItemId).toBe('inv1');
    expect(showAlert).toHaveBeenCalledWith(
      expect.stringContaining('Insumos manuais'),
      expect.objectContaining({ variant: 'warning' }),
    );
  });

  it('EDIÇÃO: insumo manual adicionado no modal não entra no cost/supplies enviados', async () => {
    const initial: Procedure = {
      id: 'p1',
      companyId: 'c1',
      name: 'Limpeza de Pele',
      price: 200,
      cost: 10,
      durationMinutes: 60,
      supplies: [{ id: 's1', inventoryItemId: 'inv1', name: 'Toxina Botulínica', quantityUsed: 2, cost: 10 }],
    };
    render(<NewProcedureModal onClose={vi.fn()} initialData={initial} />);

    fireEvent.change(fieldInput('Nome do Insumo'), { target: { value: 'Álcool 70' } });
    fireEvent.change(fieldInput('Custo (R$)'), { target: { value: '4' } });
    fireEvent.click(addSupplyButton());

    fireEvent.submit(form());

    await waitFor(() => expect(updateProcedure).toHaveBeenCalled());
    const [id, payload] = updateProcedure.mock.calls[0];
    expect(id).toBe('p1');
    expect(payload.cost).toBe(10); // manual "Álcool 70" (4) ignorado
    expect(payload.supplies).toHaveLength(1);
    expect(showAlert).toHaveBeenCalledWith(
      expect.stringContaining('Insumos manuais'),
      expect.objectContaining({ variant: 'warning' }),
    );
  });
});

describe('NewProcedureModal — insumo pendente (showPendingConfirm)', () => {
  it('preencher insumo de estoque sem clicar em "+" abre o aviso; "incluir e salvar" soma o custo', async () => {
    render(<NewProcedureModal onClose={vi.fn()} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'inv1' } });
    fireEvent.change(fieldInput('Quantidade'), { target: { value: '2' } });
    fillRequired();
    fireEvent.submit(form());

    expect(await screen.findByText(/Deseja salvar o insumo no procedimento/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Sim, incluir e salvar/i }));

    await waitFor(() => expect(addProcedure).toHaveBeenCalled());
    const payload = addProcedure.mock.calls[0][0];
    expect(payload.cost).toBe(10);
    expect(payload.supplies).toHaveLength(1);
  });

  it('"salvar sem ele" ignora o insumo pendente — cost final 0', async () => {
    render(<NewProcedureModal onClose={vi.fn()} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'inv1' } });
    fireEvent.change(fieldInput('Quantidade'), { target: { value: '2' } });
    fillRequired();
    fireEvent.submit(form());

    expect(await screen.findByText(/Deseja salvar o insumo no procedimento/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Não, salvar sem ele/i }));

    await waitFor(() => expect(addProcedure).toHaveBeenCalled());
    const payload = addProcedure.mock.calls[0][0];
    expect(payload.cost).toBe(0);
    expect(payload.supplies).toHaveLength(0);
  });
});

describe('NewProcedureModal — manutenção / retoque', () => {
  it('marcar o checkbox revela o campo de dias com default 120; desmarcar não envia maintenanceIntervalDays', async () => {
    render(<NewProcedureModal onClose={vi.fn()} />);

    expect(screen.queryByText('Dias para retorno ideal')).not.toBeInTheDocument();

    const checkbox = screen.getByLabelText(/Requer Manutenção/i);
    fireEvent.click(checkbox);
    expect(screen.getByText('Dias para retorno ideal')).toBeInTheDocument();
    expect(fieldInput('Dias para retorno ideal').value).toBe('120');

    fireEvent.click(checkbox); // desmarca
    expect(screen.queryByText('Dias para retorno ideal')).not.toBeInTheDocument();

    fillRequired();
    fireEvent.submit(form());

    await waitFor(() => expect(addProcedure).toHaveBeenCalled());
    const payload = addProcedure.mock.calls[0][0];
    expect(payload.maintenanceRequired).toBe(false);
    expect(payload.maintenanceIntervalDays).toBeUndefined();
  });

  it('com o checkbox marcado, envia maintenanceIntervalDays = 120', async () => {
    render(<NewProcedureModal onClose={vi.fn()} />);
    fireEvent.click(screen.getByLabelText(/Requer Manutenção/i));
    fillRequired();
    fireEvent.submit(form());

    await waitFor(() => expect(addProcedure).toHaveBeenCalled());
    const payload = addProcedure.mock.calls[0][0];
    expect(payload.maintenanceRequired).toBe(true);
    expect(payload.maintenanceIntervalDays).toBe(120);
  });
});

describe('NewProcedureModal — upload de imagem', () => {
  it('arquivo > 2MB dispara showAlert e não define imagem', () => {
    render(<NewProcedureModal onClose={vi.fn()} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    const big = new File(['x'], 'grande.png', { type: 'image/png' });
    Object.defineProperty(big, 'size', { value: 3 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [big] } });

    expect(showAlert).toHaveBeenCalledWith(
      'Imagem muito grande. Máximo 2MB.',
      expect.objectContaining({ variant: 'warning' }),
    );
    expect(screen.queryByAltText('Preview')).not.toBeInTheDocument();
  });

  it('arquivo válido gera preview (imagem comprimida) e permite remover', async () => {
    render(<NewProcedureModal onClose={vi.fn()} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    const ok = new File(['x'], 'foto.png', { type: 'image/png' });
    Object.defineProperty(ok, 'size', { value: 1024 });
    fireEvent.change(input, { target: { files: [ok] } });

    const preview = await screen.findByAltText('Preview');
    expect(preview).toHaveAttribute('src', 'data:image/jpeg;base64,MOCKCOMPRESSED');

    fireEvent.click(screen.getByRole('button', { name: /Remover/i }));
    expect(screen.queryByAltText('Preview')).not.toBeInTheDocument();
    expect(screen.getByText(/Clique para enviar/i)).toBeInTheDocument();
  });
});
