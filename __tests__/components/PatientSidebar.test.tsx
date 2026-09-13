// __tests__/components/PatientSidebar.test.tsx
// Testes da sidebar do Portal do Paciente (components/patient-portal/PatientSidebar.tsx).

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const navigateMock = vi.fn();
const logoutMock = vi.fn().mockResolvedValue(undefined);

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('../../utils/subdomain', () => ({
  getPortalBasePath: () => '/clinica-aura',
}));

vi.mock('../../context/ClinicContext', () => ({
  useClinic: () => ({
    clinic: { name: 'Clínica Aura', logo: null as string | null, layoutConfig: {} },
  }),
}));

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({
    user: { name: 'Maria Paciente', email: 'maria@example.com' },
    logout: logoutMock,
  }),
}));

import PatientSidebar from '../../components/patient-portal/PatientSidebar';

const render = (props: React.ComponentProps<typeof PatientSidebar> = {}) =>
  rtlRender(<PatientSidebar {...props} />, {
    wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
  });

beforeEach(() => {
  vi.clearAllMocks();
  logoutMock.mockResolvedValue(undefined);
});

describe('components/patient-portal/PatientSidebar', () => {
  it('renderiza os 5 itens de navegação com os paths corretos (com basePath)', () => {
    render();

    expect(screen.getByRole('link', { name: /Minha Conta/i })).toHaveAttribute(
      'href',
      '/clinica-aura/minha-conta'
    );
    expect(screen.getByRole('link', { name: /Meus Planos/i })).toHaveAttribute(
      'href',
      '/clinica-aura/meus-planos'
    );
    expect(screen.getByRole('link', { name: /Agendamentos/i })).toHaveAttribute(
      'href',
      '/clinica-aura/agendamentos'
    );
    expect(screen.getByRole('link', { name: /Procedimentos/i })).toHaveAttribute(
      'href',
      '/clinica-aura/procedimentos'
    );
    expect(screen.getByRole('link', { name: /Histórico/i })).toHaveAttribute(
      'href',
      '/clinica-aura/historico'
    );
  });

  it('exibe nome e e-mail do usuário logado no rodapé', () => {
    render();
    expect(screen.getByText('Maria Paciente')).toBeInTheDocument();
    expect(screen.getByText('maria@example.com')).toBeInTheDocument();
  });

  it('clicar em "Sair" chama logout() e navega para o login do portal', async () => {
    render();

    fireEvent.click(screen.getByRole('button', { name: /Sair/i }));

    expect(logoutMock).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    expect(navigateMock).toHaveBeenCalledWith('/clinica-aura/login');
  });

  it('sem overlay quando isMobileOpen=false', () => {
    const { container } = render({ isMobileOpen: false, onMobileClose: vi.fn() });
    expect(container.querySelector('.bg-black\\/50')).toBeNull();
  });

  it('overlay aparece quando isMobileOpen=true e clicar nele chama onMobileClose', () => {
    const onMobileClose = vi.fn();
    const { container } = render({ isMobileOpen: true, onMobileClose });

    const overlay = container.querySelector('.bg-black\\/50');
    expect(overlay).not.toBeNull();
    fireEvent.click(overlay as Element);
    expect(onMobileClose).toHaveBeenCalledTimes(1);
  });

  it('botão fechar (X) do mobile chama onMobileClose', () => {
    const onMobileClose = vi.fn();
    render({ isMobileOpen: true, onMobileClose });

    // O botão de fechar é o primeiro botão sem nome acessível (ícone X, sem aria-label) —
    // localizamos pelo container para não depender de aria-label ausente no componente.
    const closeButtons = screen.getAllByRole('button');
    // O primeiro botão renderizado na árvore é o "fechar" (aparece antes do "Sair")
    fireEvent.click(closeButtons[0]);
    expect(onMobileClose).toHaveBeenCalledTimes(1);
  });
});
