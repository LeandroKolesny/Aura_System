// __tests__/pages/KingLayout.test.tsx
// Testes do layout/guard do Painel King (pages/king/KingLayout.tsx).

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { UserRole } from '../../types';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});

const logoutMock = vi.fn().mockResolvedValue(undefined);
const loadLeadsMock = vi.fn().mockResolvedValue(undefined);

interface MockUser {
  role: UserRole;
  companyId: string | null;
  name?: string;
  email?: string;
}

const appState: {
  user: MockUser | null;
  isInitializing: boolean;
  newLeadsCount: number;
} = {
  user: null,
  isInitializing: false,
  newLeadsCount: 0,
};

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({
    user: appState.user,
    logout: logoutMock,
    newLeadsCount: appState.newLeadsCount,
    isInitializing: appState.isInitializing,
    loadLeads: loadLeadsMock,
  }),
}));

import KingLayout from '../../pages/king/KingLayout';

// Reproduz o recorte relevante das rotas de App.tsx: `/king` sozinho (tela de
// login) e `/king` aninhado sob o layout, mais `/dashboard` (destino de quem
// não é OWNER) — permite observar para onde o guard efetivamente navega.
const renderAt = (path: string) =>
  rtlRender(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/king" element={<div>KING_LOGIN_MARK</div>} />
        <Route path="/king" element={<KingLayout />}>
          <Route path="dashboard" element={<div>DASHBOARD_CONTENT</div>} />
        </Route>
        <Route path="/dashboard" element={<div>ADMIN_DASHBOARD_MARK</div>} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  logoutMock.mockResolvedValue(undefined);
  loadLeadsMock.mockResolvedValue(undefined);
  appState.user = null;
  appState.isInitializing = false;
  appState.newLeadsCount = 0;
});

describe('pages/king/KingLayout', () => {
  it('enquanto isInitializing=true mostra "Verificando acesso..." e não decide nada ainda', () => {
    appState.isInitializing = true;
    appState.user = null;
    renderAt('/king/dashboard');

    expect(screen.getByText('Verificando acesso...')).toBeInTheDocument();
    expect(screen.queryByText('DASHBOARD_CONTENT')).not.toBeInTheDocument();
    expect(screen.queryByText('KING_LOGIN_MARK')).not.toBeInTheDocument();
  });

  it('sem usuário autenticado redireciona para /king (tela de login do King)', () => {
    appState.user = null;
    renderAt('/king/dashboard');

    expect(screen.getByText('KING_LOGIN_MARK')).toBeInTheDocument();
  });

  it('usuário autenticado mas que NÃO é OWNER redireciona para /dashboard (nunca fica preso aqui)', () => {
    appState.user = { role: UserRole.ADMIN, companyId: 'company-1' };
    renderAt('/king/dashboard');

    expect(screen.getByText('ADMIN_DASHBOARD_MARK')).toBeInTheDocument();
    expect(screen.queryByText('DASHBOARD_CONTENT')).not.toBeInTheDocument();
  });

  it('usuário OWNER renderiza o layout completo (menu + conteúdo da rota filha)', () => {
    appState.user = { role: UserRole.OWNER, companyId: null, name: 'King', email: 'king@aura.system' };
    renderAt('/king/dashboard');

    // O conteúdo do menu/usuário é duplicado (sidebar desktop fixa + drawer
    // mobile), então usamos getAllByText — o importante é que ele exista.
    expect(screen.getByText('DASHBOARD_CONTENT')).toBeInTheDocument();
    expect(screen.getAllByText('Aura King').length).toBeGreaterThan(0);
    expect(screen.getAllByText('King').length).toBeGreaterThan(0);
    expect(screen.getAllByText('king@aura.system').length).toBeGreaterThan(0);
    for (const label of ['Dashboard', 'Empresas', 'Pacientes', 'Agendamentos', 'CRM', 'Alertas', 'Receita', 'Configurações']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it('BUG CORRIGIDO: carrega os leads (loadLeads) ao montar para um OWNER, para que o badge do CRM ' +
    'e o widget do Dashboard não dependam de o usuário já ter aberto a aba CRM antes', () => {
    appState.user = { role: UserRole.OWNER, companyId: null };
    renderAt('/king/dashboard');

    expect(loadLeadsMock).toHaveBeenCalledTimes(1);
  });

  it('não chama loadLeads quando o usuário não é OWNER', () => {
    appState.user = { role: UserRole.ADMIN, companyId: 'company-1' };
    renderAt('/king/dashboard');

    expect(loadLeadsMock).not.toHaveBeenCalled();
  });

  it('mostra badge numérico no item "CRM" quando há novos leads, em vez do chevron', () => {
    appState.user = { role: UserRole.OWNER, companyId: null };
    appState.newLeadsCount = 5;
    renderAt('/king/dashboard');

    // A sidebar é renderizada duas vezes (desktop fixa + drawer mobile) —
    // basta que o badge apareça em pelo menos uma das duas.
    const crmLinks = screen.getAllByText('CRM').map((el) => el.closest('a') as HTMLElement);
    expect(crmLinks.some((link) => within(link).queryByText('5') !== null)).toBe(true);
  });

  it('sem novos leads não mostra badge no item "CRM"', () => {
    appState.user = { role: UserRole.OWNER, companyId: null };
    appState.newLeadsCount = 0;
    renderAt('/king/dashboard');

    const crmLinks = screen.getAllByText('CRM').map((el) => el.closest('a') as HTMLElement);
    for (const link of crmLinks) {
      expect(within(link).queryByText('0')).not.toBeInTheDocument();
    }
  });

  it('logout: clicar em "Sair" chama logout() e depois navega para /king', async () => {
    appState.user = { role: UserRole.OWNER, companyId: null, name: 'King', email: 'king@aura.system' };
    renderAt('/king/dashboard');

    fireEvent.click(screen.getAllByRole('button', { name: /Sair/i })[0]);

    await waitFor(() => expect(logoutMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/king'));
  });
});
