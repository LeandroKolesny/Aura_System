// __tests__/pages/Support.test.tsx
// Testes de componente da aba "Suporte" (pages/Support.tsx)

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const render = (ui: React.ReactElement) => rtlRender(ui, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
import { UserRole } from '../../types';

const loadTickets = vi.fn();
const createTicket = vi.fn();
const replyTicket = vi.fn();
const closeTicket = vi.fn();
const checkModuleAccess = vi.fn(() => true);

const appState: {
  tickets: unknown[];
  user: { id: string; role: UserRole; companyId: string | null };
} = {
  tickets: [],
  user: { id: 'u1', role: UserRole.ADMIN, companyId: 'c1' },
};

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({
    tickets: appState.tickets,
    user: appState.user,
    loadTickets,
    createTicket,
    replyTicket,
    closeTicket,
    checkModuleAccess,
  }),
}));

vi.mock('../../context/DialogContext', () => ({
  useDialog: () => ({ showAlert: vi.fn(), confirm: vi.fn() }),
}));

import Support from '../../pages/Support';

function ticket(over: Record<string, unknown> = {}) {
  return {
    id: 't1',
    companyId: 'c1',
    companyName: 'Clínica X',
    subject: 'Problema com faturamento',
    status: 'open',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-02T00:00:00.000Z',
    messages: [
      { id: 'm1', senderId: 'u1', senderName: 'Admin', isAdmin: false, content: 'Olá, tenho um problema', timestamp: '2026-09-01T00:00:00.000Z' },
    ],
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  appState.tickets = [];
  appState.user = { id: 'u1', role: UserRole.ADMIN, companyId: 'c1' };
  checkModuleAccess.mockReturnValue(true);
});

describe('pages/Support', () => {
  it('dispara loadTickets ao montar (carregamento do histórico do backend)', () => {
    render(<Support />);
    expect(loadTickets).toHaveBeenCalledTimes(1);
  });

  it('renderiza a lista de tickets vinda do estado do contexto', () => {
    appState.tickets = [
      ticket({ id: 't1', subject: 'Assunto A' }),
      ticket({ id: 't2', subject: 'Assunto B', status: 'closed' }),
    ];
    render(<Support />);
    expect(screen.getByText('Assunto A')).toBeInTheDocument();
    expect(screen.getByText('Assunto B')).toBeInTheDocument();
    expect(screen.queryByText('Nenhum ticket encontrado.')).not.toBeInTheDocument();
  });

  it('mostra o estado vazio quando não há tickets', () => {
    appState.tickets = [];
    render(<Support />);
    expect(screen.getByText('Nenhum ticket encontrado.')).toBeInTheDocument();
  });

  it('mostra o botão "Novo Chamado" para ADMIN', () => {
    render(<Support />);
    expect(screen.getByRole('button', { name: /Novo Chamado/i })).toBeInTheDocument();
  });

  it('esconde o botão "Novo Chamado" e muda o texto do cabeçalho para OWNER', () => {
    appState.user = { id: 'u2', role: UserRole.OWNER, companyId: null };
    render(<Support />);
    expect(screen.queryByRole('button', { name: /Novo Chamado/i })).not.toBeInTheDocument();
    expect(screen.getByText('Gerencie os chamados das clínicas.')).toBeInTheDocument();
  });

  it('em um ticket encerrado, não mostra o campo de resposta nem o botão "Encerrar", e exibe o aviso', async () => {
    const { rerender } = render(<Support />);
    appState.tickets = [ticket({ id: 't1', status: 'closed' })];
    rerender(<Support />);
    // seleciona o ticket
    (await screen.findByText('Problema com faturamento')).click();
    rerender(<Support />);

    expect(screen.getByText('Este chamado foi encerrado.')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Digite sua resposta...')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Encerrar/i })).not.toBeInTheDocument();
  });

  it('em um ticket aberto, mostra o campo de resposta e o botão "Encerrar"', async () => {
    const { rerender } = render(<Support />);
    appState.tickets = [ticket({ id: 't1', status: 'open' })];
    rerender(<Support />);
    (await screen.findByText('Problema com faturamento')).click();
    rerender(<Support />);

    expect(screen.getByPlaceholderText('Digite sua resposta...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Encerrar/i })).toBeInTheDocument();
  });

  it('bloqueia a aba inteira com UpgradeOverlay quando o plano não tem o módulo support', () => {
    checkModuleAccess.mockReturnValue(false);
    render(<Support />);
    expect(screen.getByText(/Ative a versão Starter/i)).toBeInTheDocument();
  });
});
