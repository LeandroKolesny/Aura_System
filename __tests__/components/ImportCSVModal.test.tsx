// __tests__/components/ImportCSVModal.test.tsx
// Testes do ImportCSVModal (components/ImportCSVModal.tsx) — fluxo de upload/importação.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('xlsx', () => ({
  utils: {
    aoa_to_sheet: vi.fn(() => ({})),
    book_new: vi.fn(() => ({})),
    book_append_sheet: vi.fn(),
  },
  writeFile: vi.fn(),
}));

import ImportCSVModal from '../../components/ImportCSVModal';

const baseProps = {
  title: 'Importar Lançamentos',
  templateFilename: 'template.xlsx',
  templateHeaders: ['descricao', 'valor', 'tipo'],
  templateSampleRows: [['Venda', '100', 'receita']],
};

function fileInput(): HTMLInputElement {
  return document.querySelector('input[type="file"]') as HTMLInputElement;
}

function makeFile(name: string) {
  return new File(['descricao,valor,tipo\nVenda,100,receita'], name, { type: 'text/csv' });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ImportCSVModal — seleção de arquivo', () => {
  it('rejeita extensão inválida e mostra mensagem de erro', () => {
    render(<ImportCSVModal {...baseProps} onImport={vi.fn()} onClose={vi.fn()} />);

    fireEvent.change(fileInput(), { target: { files: [makeFile('dados.pdf')] } });

    expect(screen.getByText('O arquivo deve ser CSV ou Excel (.csv, .xlsx)')).toBeInTheDocument();
    // o botão Importar continua desabilitado (nenhum arquivo válido selecionado)
    expect(screen.getByRole('button', { name: /Importar/i })).toBeDisabled();
  });

  it('aceita .csv e habilita o botão Importar', () => {
    render(<ImportCSVModal {...baseProps} onImport={vi.fn()} onClose={vi.fn()} />);

    fireEvent.change(fileInput(), { target: { files: [makeFile('dados.csv')] } });

    expect(screen.queryByText(/deve ser CSV ou Excel/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Importar/i })).toBeEnabled();
  });
});

describe('ImportCSVModal — importação', () => {
  it('mostra estado de loading enquanto onImport está pendente', async () => {
    let resolveImport!: (v: unknown) => void;
    const onImport = vi.fn(() => new Promise((r) => { resolveImport = r; }));
    render(<ImportCSVModal {...baseProps} onImport={onImport as never} onClose={vi.fn()} />);

    fireEvent.change(fileInput(), { target: { files: [makeFile('dados.csv')] } });
    fireEvent.click(screen.getByRole('button', { name: /Importar/i }));

    expect(await screen.findByText(/Importando\.\.\./i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Importando/i })).toBeDisabled();

    resolveImport({ imported: 1, updated: 0, errors: [] });
    await waitFor(() => expect(screen.queryByText(/Importando\.\.\./i)).not.toBeInTheDocument());
  });

  it('exibe os contadores imported/updated/errors vindos da resposta', async () => {
    const onImport = vi.fn().mockResolvedValue({
      success: true,
      imported: 3,
      updated: 2,
      errors: [{ row: 4, name: 'Linha ruim', reason: 'Valor inválido' }],
    });
    render(<ImportCSVModal {...baseProps} onImport={onImport} onClose={vi.fn()} />);

    fireEvent.change(fileInput(), { target: { files: [makeFile('dados.csv')] } });
    fireEvent.click(screen.getByRole('button', { name: /Importar/i }));

    expect(await screen.findByText('Importados')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    // contador de erros = 1 e a linha do erro aparece
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText(/Linha 4 — Linha ruim:/)).toBeInTheDocument();
  });

  it('lê a resposta mesmo quando vem embrulhada em { data } (padrão do fetchApi)', async () => {
    const onImport = vi.fn().mockResolvedValue({ data: { imported: 5, updated: 0, errors: [] } });
    render(<ImportCSVModal {...baseProps} onImport={onImport as never} onClose={vi.fn()} />);

    fireEvent.change(fileInput(), { target: { files: [makeFile('dados.csv')] } });
    fireEvent.click(screen.getByRole('button', { name: /Importar/i }));

    expect(await screen.findByText('Importados')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('mostra o erro retornado pelo backend (res.error) sem avançar para a tela de resultado', async () => {
    const onImport = vi.fn().mockResolvedValue({ error: 'Colunas obrigatórias ausentes' });
    render(<ImportCSVModal {...baseProps} onImport={onImport} onClose={vi.fn()} />);

    fireEvent.change(fileInput(), { target: { files: [makeFile('dados.csv')] } });
    fireEvent.click(screen.getByRole('button', { name: /Importar/i }));

    expect(await screen.findByText('Colunas obrigatórias ausentes')).toBeInTheDocument();
    expect(screen.queryByText('Importados')).not.toBeInTheDocument();
  });
});

describe('ImportCSVModal — onSuccess', () => {
  it('chama onSuccess quando houve importação (imported + updated > 0)', async () => {
    const onSuccess = vi.fn();
    const onImport = vi.fn().mockResolvedValue({ imported: 0, updated: 2, errors: [] });
    render(<ImportCSVModal {...baseProps} onImport={onImport} onClose={vi.fn()} onSuccess={onSuccess} />);

    fireEvent.change(fileInput(), { target: { files: [makeFile('dados.csv')] } });
    fireEvent.click(screen.getByRole('button', { name: /Importar/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });

  it('NÃO chama onSuccess quando nada foi importado (só erros)', async () => {
    const onSuccess = vi.fn();
    const onImport = vi.fn().mockResolvedValue({
      imported: 0,
      updated: 0,
      errors: [{ row: 2, name: 'x', reason: 'y' }],
    });
    render(<ImportCSVModal {...baseProps} onImport={onImport} onClose={vi.fn()} onSuccess={onSuccess} />);

    fireEvent.change(fileInput(), { target: { files: [makeFile('dados.csv')] } });
    fireEvent.click(screen.getByRole('button', { name: /Importar/i }));

    expect(await screen.findByText('Importados')).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
