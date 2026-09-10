// __tests__/pages/Professionals.test.tsx
// Testes de componente da aba "Profissionais" (pages/Professionals.tsx)

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UserRole } from '../../types';

const render = (ui: React.ReactElement) =>
  rtlRender(ui, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });

const removeProfessional = vi.fn();

const appState: {
  professionals: unknown[];
  isReadOnly: boolean;
  user: { id: string; role: UserRole; companyId: string | null };
} = {
  professionals: [],
  isReadOnly: false,
  user: { id: 'u1', role: UserRole.ADMIN, companyId: 'c1' },
};

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({
    professionals: appState.professionals,
    removeProfessional,
    user: appState.user,
    companies: [] as unknown[],
    isReadOnly: appState.isReadOnly,
    currentCompany: { id: 'c1', name: 'Clínica X' },
  }),
}));

vi.mock('../../context/DialogContext', () => ({
  useDialog: () => ({ confirm: vi.fn().mockResolvedValue(true), showAlert: vi.fn() }),
}));

import Professionals from '../../pages/Professionals';

function prof(over: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    companyId: 'c1',
    name: 'Bruna Lima',
    email: 'bruna@clinica.com',
    title: 'Esteticista',
    role: UserRole.ESTHETICIAN,
    contractType: 'PJ',
    remunerationType: 'comissao',
    commissionRate: 30,
    fixedSalary: 0,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  appState.professionals = [];
  appState.isReadOnly = false;
  appState.user = { id: 'u1', role: UserRole.ADMIN, companyId: 'c1' };
});

describe('pages/Professionals', () => {
  it('renderiza nome, cargo e badge de contrato de cada profissional', () => {
    appState.professionals = [prof({ id: 'p1', name: 'Bruna Lima', title: 'Esteticista', contractType: 'PJ' })];
    render(<Professionals />);
    expect(screen.getByText('Bruna Lima')).toBeInTheDocument();
    expect(screen.getByText('Esteticista')).toBeInTheDocument();
    expect(screen.getByText('PJ')).toBeInTheDocument();
  });

  it('coluna de comissão: mostra "%" para remuneração por comissão e "Salário Fixo" para remuneração fixa', () => {
    appState.professionals = [
      prof({ id: 'p1', name: 'Comissionada', remunerationType: 'comissao', commissionRate: 25 }),
      prof({ id: 'p2', name: 'Fixa', remunerationType: 'fixo', commissionRate: 0 }),
    ];
    render(<Professionals />);
    // '25%' aparece na linha da tabela e também no KPI 'Comissão Média' — basta existir
    expect(screen.getAllByText('25%').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Salário Fixo')).toBeInTheDocument();
  });

  it('a busca filtra a lista por nome/email/cargo', () => {
    appState.professionals = [
      prof({ id: 'p1', name: 'Bruna Lima', email: 'bruna@x.com' }),
      prof({ id: 'p2', name: 'Carlos Souza', email: 'carlos@x.com' }),
    ];
    render(<Professionals />);
    expect(screen.getByText('Carlos Souza')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Buscar por nome/i), { target: { value: 'bruna' } });
    expect(screen.getByText('Bruna Lima')).toBeInTheDocument();
    expect(screen.queryByText('Carlos Souza')).not.toBeInTheDocument();
  });

  it('mostra o estado vazio quando não há profissionais', () => {
    appState.professionals = [];
    render(<Professionals />);
    expect(screen.getByText('Nenhum profissional encontrado.')).toBeInTheDocument();
  });

  it('com isReadOnly, o botão "Adicionar Profissional" e as ações de editar/remover ficam desabilitados', () => {
    appState.isReadOnly = true;
    appState.professionals = [prof({ id: 'p1', name: 'Bruna Lima' })];
    render(<Professionals />);

    expect(screen.getByRole('button', { name: /Adicionar Profissional/i })).toBeDisabled();
    expect(screen.getByTitle('Editar')).toBeDisabled();
    expect(screen.getByTitle('Remover')).toBeDisabled();
  });

  it('clicar em remover (com confirmação) chama removeProfessional', async () => {
    removeProfessional.mockResolvedValue({ success: true });
    appState.professionals = [prof({ id: 'p1', name: 'Bruna Lima' })];
    render(<Professionals />);

    fireEvent.click(screen.getByTitle('Remover'));
    // aguarda o confirm() resolver e a chamada acontecer
    await Promise.resolve();
    await Promise.resolve();
    expect(removeProfessional).toHaveBeenCalledWith('p1');
  });
});
