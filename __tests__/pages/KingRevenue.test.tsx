// __tests__/pages/KingRevenue.test.tsx
// Testes da página pages/king/KingRevenue.tsx (métricas de receita/assinaturas do King).

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, waitFor, fireEvent } from '@testing-library/react';

const companiesMock = vi.fn();
const plansListMock = vi.fn();

vi.mock('../../services/api', () => ({
  kingApi: { companies: (...a: unknown[]) => companiesMock(...a) },
  plansApi: { list: (...a: unknown[]) => plansListMock(...a) },
}));

import KingRevenue from '../../pages/king/KingRevenue';

const render = () => rtlRender(<KingRevenue />);

interface CompanyFixture {
  id: string;
  name: string;
  slug: string;
  plan: string;
  lastPlan?: string;
  subscriptionStatus: string;
  subscriptionExpiresAt: string | null;
  createdAt: string;
  hasOwner?: boolean;
  adminContact?: { name: string; email: string; phone: string | null } | null;
  _count: { patients: number; appointments: number; users: number };
}

function company(over: Partial<CompanyFixture> = {}): CompanyFixture {
  return {
    id: 'c1',
    name: 'Clínica Bela Vida',
    slug: 'bela-vida',
    plan: 'PROFESSIONAL',
    subscriptionStatus: 'ACTIVE',
    subscriptionExpiresAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    hasOwner: false,
    adminContact: null,
    _count: { patients: 10, appointments: 20, users: 3 },
    ...over,
  };
}

const PLAN_PROFESSIONAL = { id: 'p1', name: 'PROFESSIONAL', price: 297, maxProfessionals: 5, maxPatients: 500, modules: [] as string[], features: [] as string[], active: true };
const PLAN_STARTER = { id: 'p2', name: 'STARTER', price: 97, maxProfessionals: 2, maxPatients: 100, modules: [] as string[], features: [] as string[], active: true };

const okCompanies = (companies: CompanyFixture[]) => ({
  success: true,
  data: { success: true, data: { companies, total: companies.length, page: 1, limit: 200 } },
});
const okPlans = (plans: unknown[]) => ({ success: true, data: plans });

beforeEach(() => {
  vi.clearAllMocks();
  companiesMock.mockResolvedValue(okCompanies([company()]));
  plansListMock.mockResolvedValue(okPlans([PLAN_PROFESSIONAL, PLAN_STARTER]));
});

describe('pages/king/KingRevenue', () => {
  it('mostra o spinner de carregamento antes da resposta da API', async () => {
    let resolve: (v: unknown) => void = () => {};
    companiesMock.mockImplementation(() => new Promise((r) => { resolve = r; }));
    const { container } = render();
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    resolve(okCompanies([]));
    await waitFor(() => expect(container.querySelector('.animate-spin')).not.toBeInTheDocument());
  });

  it('calcula o MRR atual somando apenas empresas ACTIVE que não são do OWNER', async () => {
    companiesMock.mockResolvedValue(okCompanies([
      company({ id: 'c1', plan: 'PROFESSIONAL', subscriptionStatus: 'ACTIVE' }),
      company({ id: 'c2', plan: 'STARTER', subscriptionStatus: 'ACTIVE' }),
      company({ id: 'c3', plan: 'PROFESSIONAL', subscriptionStatus: 'ACTIVE', hasOwner: true }),
    ]));
    render();

    // MRR = 297 (c1) + 97 (c2); a empresa do OWNER (c3) é excluída.
    await waitFor(() => expect(screen.getByText('R$ 394,00')).toBeInTheDocument());
    expect(screen.getByText('2 assinaturas ativas')).toBeInTheDocument();
  });

  it('MRR em Risco usa o lastPlan da empresa inadimplente, não o plan atual (BASIC)', async () => {
    // Regressão coberta: sem `lastPlan` selecionado no backend, o fallback
    // `c.lastPlan || c.plan` sempre caía em `c.plan` (BASIC, preço 0) e essa
    // métrica ficava sempre zerada. Aqui simulamos o retorno JÁ CORRIGIDO da
    // API (com lastPlan populado) para travar o cálculo do frontend.
    companiesMock.mockResolvedValue(okCompanies([
      company({ id: 'c1', plan: 'BASIC', lastPlan: 'PROFESSIONAL', subscriptionStatus: 'OVERDUE' }),
    ]));
    render();

    await waitFor(() => expect(screen.getByText('MRR em Risco')).toBeInTheDocument());
    expect(screen.getByText('R$ 297,00')).toBeInTheDocument();
    expect(screen.getByText('1 inadimplentes')).toBeInTheDocument();
  });

  it('lista de Inadimplentes rotula "Era: <plano anterior>" usando lastPlan', async () => {
    companiesMock.mockResolvedValue(okCompanies([
      company({ id: 'c1', name: 'Clínica Devedora', plan: 'BASIC', lastPlan: 'STARTER', subscriptionStatus: 'OVERDUE' }),
    ]));
    render();

    await waitFor(() => expect(screen.getByText('Clínica Devedora')).toBeInTheDocument());
    expect(screen.getByText('Era: STARTER')).toBeInTheDocument();
    expect(screen.getByText('-R$ 97,00/mês')).toBeInTheDocument();
  });

  it('exibe mensagem de erro quando a API de empresas falha (bug corrigido: falha não era comunicada)', async () => {
    companiesMock.mockResolvedValue({ success: false, error: 'Falha ao carregar empresas' });
    render();

    await waitFor(() => expect(screen.getByText('Falha ao carregar empresas')).toBeInTheDocument());
  });

  it('exibe mensagem de erro quando a API de empresas retorna corpo malformado (success:false)', async () => {
    companiesMock.mockResolvedValue({ success: true, data: { success: false } });
    render();

    await waitFor(() => expect(screen.getByText(/Erro/i)).toBeInTheDocument());
  });

  it('recarrega os dados ao clicar em "Atualizar"', async () => {
    render();
    await waitFor(() => expect(companiesMock).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: /Atualizar/i }));

    await waitFor(() => expect(companiesMock).toHaveBeenCalledTimes(2));
    expect(plansListMock).toHaveBeenCalledTimes(2);
  });

  it('exibe estado vazio de vencimentos quando nenhuma empresa vence nos próximos 30 dias', async () => {
    render();
    await waitFor(() => expect(screen.getByText('Nenhum vencimento nos próximos 30 dias')).toBeInTheDocument());
  });

  it('lista próximos vencimentos (30 dias) para empresas ACTIVE/TRIAL', async () => {
    const soon = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    companiesMock.mockResolvedValue(okCompanies([
      company({ id: 'c1', name: 'Clínica a Vencer', subscriptionStatus: 'ACTIVE', subscriptionExpiresAt: soon }),
    ]));
    render();

    await waitFor(() => expect(screen.getByText('Clínica a Vencer')).toBeInTheDocument());
  });
});
