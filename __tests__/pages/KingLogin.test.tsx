// __tests__/pages/KingLogin.test.tsx
// Testes da tela de login do Painel King (pages/KingLogin.tsx).

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UserRole } from '../../types';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});

const loginMock = vi.fn();
const logoutMock = vi.fn().mockResolvedValue(undefined);

interface MockUser {
  role: UserRole;
  companyId: string | null;
  name?: string;
  email?: string;
}

const appState: { user: MockUser | null } = {
  user: null,
};

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({
    login: loginMock,
    user: appState.user,
    logout: logoutMock,
  }),
}));

import KingLogin from '../../pages/KingLogin';

const render = () =>
  rtlRender(<KingLogin />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });

const fillAndSubmit = async (email = 'king@aura.system', password = 'admin') => {
  fireEvent.change(screen.getByPlaceholderText('seu@email.com'), { target: { value: email } });
  fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: password } });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Entrar no Painel/i }));
    await Promise.resolve();
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  logoutMock.mockResolvedValue(undefined);
  appState.user = null;
});

describe('pages/KingLogin', () => {
  it('credenciais inválidas (login retorna false) exibe mensagem de erro genérica', async () => {
    loginMock.mockResolvedValue(false);
    render();

    await fillAndSubmit();

    await waitFor(() =>
      expect(screen.getByText('Acesso negado. Verifique suas credenciais.')).toBeInTheDocument()
    );
    expect(navigateMock).not.toHaveBeenCalled();
    expect(logoutMock).not.toHaveBeenCalled();
  });

  it('exceção lançada por login() exibe mensagem de erro genérica', async () => {
    loginMock.mockRejectedValue(new Error('network down'));
    render();

    await fillAndSubmit();

    await waitFor(() =>
      expect(screen.getByText('Erro ao tentar logar. Tente novamente.')).toBeInTheDocument()
    );
  });

  it('login bem-sucedido como OWNER navega para /king/dashboard', async () => {
    loginMock.mockResolvedValue(true);
    const { rerender } = render();

    await fillAndSubmit();

    // Simula o AppContext atualizando `user` após login bem-sucedido.
    appState.user = { role: UserRole.OWNER, companyId: null, name: 'King', email: 'king@aura.system' };
    rerender(<KingLogin />);

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/king/dashboard'));
    expect(logoutMock).not.toHaveBeenCalled();
  });

  it('sessão já restaurada como OWNER ao montar a tela redireciona automaticamente', async () => {
    appState.user = { role: UserRole.OWNER, companyId: null };
    render();

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/king/dashboard'));
    expect(logoutMock).not.toHaveBeenCalled();
  });

  it('BUG CORRIGIDO: login bem-sucedido com credenciais válidas de um papel diferente de OWNER ' +
    'exibe erro claro e desloga, em vez de navegar silenciosamente para o painel King', async () => {
    loginMock.mockResolvedValue(true);
    const { rerender } = render();

    await fillAndSubmit('admin@clinica.com', 'senha123');

    // Simula o AppContext autenticando um ADMIN válido (credenciais corretas,
    // papel errado para este login exclusivo do King).
    appState.user = { role: UserRole.ADMIN, companyId: 'company-1' };
    rerender(<KingLogin />);

    await waitFor(() =>
      expect(screen.getByText('Acesso restrito ao proprietário da plataforma.')).toBeInTheDocument()
    );
    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).not.toHaveBeenCalledWith('/king/dashboard');
  });

  it('sessão já existente de um papel diferente de OWNER ao ABRIR a tela (sem tentativa de login ' +
    'nesta página) não desloga nem mostra erro — apenas exibe o formulário normalmente', () => {
    appState.user = { role: UserRole.RECEPTIONIST, companyId: 'company-1' };
    render();

    expect(logoutMock).not.toHaveBeenCalled();
    expect(screen.queryByText('Acesso restrito ao proprietário da plataforma.')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('seu@email.com')).toBeInTheDocument();
  });

  it('botão "Preencher Credenciais (Dev)" preenche email e senha de demonstração', () => {
    render();

    fireEvent.click(screen.getByText('Preencher Credenciais (Dev)'));

    expect(screen.getByPlaceholderText('seu@email.com')).toHaveValue('king@aura.system');
    expect(screen.getByPlaceholderText('••••••••')).toHaveValue('admin');
  });

  it('desabilita o botão e mostra "Entrando..." enquanto isLoading', async () => {
    let resolveLogin: (v: boolean) => void = () => {};
    loginMock.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          resolveLogin = resolve;
        })
    );
    render();

    fireEvent.change(screen.getByPlaceholderText('seu@email.com'), { target: { value: 'a@a.com' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'senha' } });
    fireEvent.click(screen.getByRole('button', { name: /Entrar no Painel/i }));

    await waitFor(() => expect(screen.getByText('Entrando...')).toBeInTheDocument());

    await act(async () => {
      resolveLogin(false);
      await Promise.resolve();
    });
  });
});
