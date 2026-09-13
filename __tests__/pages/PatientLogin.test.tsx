// __tests__/pages/PatientLogin.test.tsx
// Testes da tela de login do Portal do Paciente (pages/patient-portal/PatientLogin.tsx).

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

vi.mock('../../utils/subdomain', () => ({
  getPortalBasePath: () => '/clinica-aura',
}));

const loginMock = vi.fn();
const logoutMock = vi.fn().mockResolvedValue(undefined);

interface MockUser {
  role: UserRole;
  companyId: string;
  name?: string;
}

const appState: { user: MockUser | null; isInitializing: boolean } = {
  user: null,
  isInitializing: false,
};

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({
    login: loginMock,
    user: appState.user,
    logout: logoutMock,
    isInitializing: appState.isInitializing,
  }),
}));

const clinicState: { clinic: { id: string; name?: string } | null } = {
  clinic: { id: 'company-1', name: 'Clínica Aura' },
};

vi.mock('../../context/ClinicContext', () => ({
  useClinic: () => ({ clinic: clinicState.clinic }),
}));

import PatientLogin from '../../pages/patient-portal/PatientLogin';

const render = () =>
  rtlRender(<PatientLogin />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });

const fillAndSubmit = async (email = 'maria@example.com', password = 'senha123') => {
  fireEvent.change(screen.getByPlaceholderText('seu@email.com'), { target: { value: email } });
  fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: password } });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Entrar/i }));
    await Promise.resolve();
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  logoutMock.mockResolvedValue(undefined);
  appState.user = null;
  appState.isInitializing = false;
  clinicState.clinic = { id: 'company-1', name: 'Clínica Aura' };
});

describe('pages/patient-portal/PatientLogin', () => {
  it('credenciais inválidas (login retorna false) exibe mensagem de erro genérica', async () => {
    loginMock.mockResolvedValue(false);
    render();

    await fillAndSubmit();

    await waitFor(() => expect(screen.getByText('E-mail ou senha incorretos.')).toBeInTheDocument());
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('exceção lançada por login() exibe mensagem de erro genérica', async () => {
    loginMock.mockRejectedValue(new Error('network down'));
    render();

    await fillAndSubmit();

    await waitFor(() =>
      expect(screen.getByText('Erro ao fazer login. Tente novamente.')).toBeInTheDocument()
    );
  });

  it('login bem-sucedido com companyId da mesma clínica navega para minha-conta', async () => {
    loginMock.mockResolvedValue(true);
    const { rerender } = render();

    await fillAndSubmit();

    // Simula o AppContext atualizando `user` após login bem-sucedido e força
    // o componente a re-ler o contexto mockado (o mock não é reativo por si só).
    appState.user = { role: UserRole.PATIENT, companyId: 'company-1' };
    rerender(<PatientLogin />);

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith('/clinica-aura/minha-conta')
    );
    expect(logoutMock).not.toHaveBeenCalled();
  });

  it('BUG: usuário logado com companyId de OUTRA clínica não deve navegar para minha-conta, deve deslogar e mostrar erro', async () => {
    // Paciente já autenticado (ex.: sessão restaurada via cookie) mas de uma empresa diferente
    // da clínica cujo portal está sendo acessado (clinicState.clinic.id === 'company-1').
    appState.user = { role: UserRole.PATIENT, companyId: 'company-OUTRA' };
    render();

    await waitFor(() => expect(logoutMock).toHaveBeenCalledTimes(1));
    expect(navigateMock).not.toHaveBeenCalledWith('/clinica-aura/minha-conta');
    expect(
      screen.getByText(/conta pertence a outra clínica|conta não pertence a esta clínica/i)
    ).toBeInTheDocument();
  });

  it('enquanto isInitializing=true não renderiza o formulário (evita flash de login)', () => {
    appState.isInitializing = true;
    render();

    expect(screen.queryByPlaceholderText('seu@email.com')).not.toBeInTheDocument();
  });
});
