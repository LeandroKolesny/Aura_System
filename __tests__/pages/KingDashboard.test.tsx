// __tests__/pages/KingDashboard.test.tsx
// Testes da página pages/king/KingDashboard.tsx (métricas globais do painel King).

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { formatCurrency } from '../../utils/formatUtils';
import type { Lead } from '../../types';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});

const dashboardMock = vi.fn();

vi.mock('../../services/api', () => ({
  kingApi: { dashboard: (...a: unknown[]) => dashboardMock(...a) },
}));

interface AppState {
  leads: Lead[];
  newLeadsCount: number;
}

const appState: AppState = { leads: [], newLeadsCount: 0 };

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({
    leads: appState.leads,
    newLeadsCount: appState.newLeadsCount,
  }),
}));

import KingDashboard from '../../pages/king/KingDashboard';

const render = () =>
  rtlRender(<KingDashboard />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });

const brl = (n: number) => formatCurrency(n).replace(/\s/g, ' ');

interface Stats {
  totalCompanies: number;
  activeCompanies: number;
  totalPatients: number;
  totalAppointments: number;
  todayAppointments: number;
  monthlyRevenue: number;
  mrr: number;
  companiesByPlan: Record<string, number>;
}

function stats(over: Partial<Stats> = {}): Stats {
  return {
    totalCompanies: 10,
    activeCompanies: 8,
    totalPatients: 1200,
    totalAppointments: 500,
    todayAppointments: 12,
    monthlyRevenue: 45000,
    mrr: 9800,
    companiesByPlan: { FREE: 2, PROFESSIONAL: 5, PREMIUM: 3 },
    ...over,
  };
}

const okResponse = (data: Stats) => ({
  success: true,
  data: { success: true, data },
});

function lead(over: Partial<Lead> = {}): Lead {
  return {
    id: 'lead-1',
    clinicName: 'Clínica Teste',
    contactName: 'Fulano',
    phone: '11999999999',
    email: 'fulano@teste.com',
    status: 'new',
    value: 197,
    createdAt: '2026-09-01T00:00:00.000Z',
    seenByOwner: false,
    ...over,
  } as Lead;
}

beforeEach(() => {
  vi.clearAllMocks();
  appState.leads = [];
  appState.newLeadsCount = 0;
  dashboardMock.mockResolvedValue(okResponse(stats()));
});

describe('pages/king/KingDashboard', () => {
  it('mostra o spinner de carregamento antes da resposta da API', async () => {
    let resolveDashboard: (v: unknown) => void = () => {};
    dashboardMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDashboard = resolve;
        })
    );

    const { container } = render();
    expect(container.querySelector('.animate-spin')).toBeTruthy();
    expect(screen.queryByText('King Dashboard')).not.toBeInTheDocument();

    resolveDashboard(okResponse(stats()));
    await screen.findByText('King Dashboard');
  });

  it('renderiza os 4 KPIs principais com os valores retornados pela API', async () => {
    dashboardMock.mockResolvedValue(
      okResponse(
        stats({
          mrr: 12400,
          activeCompanies: 30,
          totalCompanies: 42,
          totalPatients: 1500,
          todayAppointments: 47,
          totalAppointments: 8200,
        })
      )
    );

    render();
    await screen.findByText('King Dashboard');

    expect(screen.getByText(brl(12400))).toBeInTheDocument();
    expect(screen.getByText('30/42')).toBeInTheDocument();
    expect(screen.getByText('71% ativas')).toBeInTheDocument();
    expect(screen.getByText('1.500')).toBeInTheDocument();
    expect(screen.getByText('47')).toBeInTheDocument();
    expect(screen.getByText('8.200 total')).toBeInTheDocument();
  });

  it('0 empresas cadastradas: mostra "0% ativas" em vez de NaN%', async () => {
    dashboardMock.mockResolvedValue(okResponse(stats({ totalCompanies: 0, activeCompanies: 0 })));

    render();
    await screen.findByText('King Dashboard');

    expect(screen.getByText('0% ativas')).toBeInTheDocument();
  });

  it('renderiza a distribuição por plano', async () => {
    dashboardMock.mockResolvedValue(
      okResponse(stats({ companiesByPlan: { FREE: 2, PREMIUM: 3 } }))
    );

    render();
    await screen.findByText('Distribuição por Plano');

    expect(screen.getByText('FREE')).toBeInTheDocument();
    expect(screen.getByText('PREMIUM')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('sem empresas cadastradas mostra a mensagem de estado vazio da distribuição por plano', async () => {
    dashboardMock.mockResolvedValue(okResponse(stats({ companiesByPlan: {} })));

    render();
    await screen.findByText('Distribuição por Plano');

    expect(screen.getByText('Nenhuma empresa cadastrada')).toBeInTheDocument();
  });

  it('erro de rede (exceção) exibe "Erro de conexão" e permite tentar novamente', async () => {
    dashboardMock.mockRejectedValueOnce(new Error('network down'));

    render();
    await screen.findByText('Erro de conexão');

    dashboardMock.mockResolvedValueOnce(okResponse(stats()));
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    await screen.findByText('King Dashboard');
    expect(dashboardMock).toHaveBeenCalledTimes(2);
  });

  it('resposta HTTP de erro (ex.: 403 do backend) exibe a mensagem de erro devolvida pela API', async () => {
    dashboardMock.mockResolvedValue({ success: false, error: 'Acesso restrito ao Owner' });

    render();

    await waitFor(() => expect(screen.getByText('Acesso restrito ao Owner')).toBeInTheDocument());
    expect(screen.queryByText('King Dashboard')).not.toBeInTheDocument();
  });

  it('resposta HTTP 200 mas com success:false no corpo exibe o erro do corpo da API', async () => {
    dashboardMock.mockResolvedValue({
      success: true,
      data: { success: false, error: 'Erro interno' },
    });

    render();

    await waitFor(() => expect(screen.getByText('Erro interno')).toBeInTheDocument());
  });

  it('sem novos leads não exibe o widget "novos leads aguardando"', async () => {
    appState.newLeadsCount = 0;
    render();
    await screen.findByText('King Dashboard');

    expect(screen.queryByText(/aguardando/)).not.toBeInTheDocument();
  });

  it('com novos leads exibe o widget e navega para /king/leads ao clicar em "Ver CRM"', async () => {
    appState.newLeadsCount = 2;
    appState.leads = [
      lead({ id: 'l1', clinicName: 'Clínica A', seenByOwner: false }),
      lead({ id: 'l2', clinicName: 'Clínica B', seenByOwner: false }),
    ];

    render();
    await screen.findByText('King Dashboard');

    expect(screen.getByText('2 novos leads aguardando')).toBeInTheDocument();
    expect(screen.getByText('Clínica A, Clínica B')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ver CRM' }));
    expect(navigateMock).toHaveBeenCalledWith('/king/leads');
  });

  it('botão "Atualizar" recarrega as estatísticas', async () => {
    render();
    await screen.findByText('King Dashboard');
    expect(dashboardMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Atualizar/i }));

    await waitFor(() => expect(dashboardMock).toHaveBeenCalledTimes(2));
  });
});
