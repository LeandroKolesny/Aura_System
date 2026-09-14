// __tests__/pages/patient-portal/PatientPlans.test.tsx
// Testes de pages/patient-portal/PatientPlans.tsx. Sem teste antes desta
// auditoria (docs/test-audit/cliente-planos-assinaturas.md).

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('../../../utils/subdomain', () => ({
  getPortalBasePath: () => '/clinica-aura',
  getClinicSlug: () => 'clinica-aura',
}));

vi.mock('../../../context/ClinicContext', () => ({
  useClinic: () => ({ clinic: { id: 'company-1', layoutConfig: {} } }),
}));

vi.mock('../../../services/api', () => ({
  getAuthToken: () => 'fake-token',
  API_BASE_URL: 'http://localhost:3001',
}));

import PatientPlans from '../../../pages/patient-portal/PatientPlans';

const MY_URL = 'http://localhost:3001/api/subscriptions/patients/my';
const COMPANY_URL = 'http://localhost:3001/api/public/company/clinica-aura';
const SELF_URL = 'http://localhost:3001/api/subscriptions/patients/self';

const PLAN_A: {
  id: string; name: string; price: number; description: string | null; imageUrl: string | null;
  items: { procedureId: string; procedureName: string; sessionsPerCycle: number }[];
} = {
  id: 'plan-a',
  name: 'Plano Facial',
  price: 150,
  description: 'desc',
  imageUrl: null,
  items: [{ procedureId: 'proc-1', procedureName: 'Limpeza de Pele', sessionsPerCycle: 4 }],
};

function jsonResponse(body: unknown, ok = true, status = 200) {
  return Promise.resolve({ ok, status, json: () => Promise.resolve(body) });
}

function mockFetchRouter(handlers: Record<string, () => Promise<unknown>>) {
  global.fetch = vi.fn((url: string) => {
    const handler = handlers[url];
    if (handler) return handler();
    return jsonResponse({ success: true, data: [] });
  }) as unknown as typeof fetch;
}

function renderPage() {
  return render(
    <MemoryRouter>
      <PatientPlans />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  navigateMock.mockReset();
});

describe('pages/patient-portal/PatientPlans', () => {
  it('mostra o spinner de carregamento e depois o conteúdo', async () => {
    mockFetchRouter({
      [MY_URL]: () => jsonResponse({ success: true, data: [] }),
      [COMPANY_URL]: () => jsonResponse({ subscriptionPlans: [] }),
    });
    renderPage();
    expect(await screen.findByText('Você não possui planos ativos')).toBeInTheDocument();
  });

  it('sem nenhuma assinatura e sem planos disponíveis: mostra estado vazio', async () => {
    mockFetchRouter({
      [MY_URL]: () => jsonResponse({ success: true, data: [] }),
      [COMPANY_URL]: () => jsonResponse({ subscriptionPlans: [] }),
    });
    renderPage();
    expect(await screen.findByText('Você não possui planos ativos')).toBeInTheDocument();
    expect(screen.getByText('Assine um plano promocional para aproveitar sessões incluídas todo mês')).toBeInTheDocument();
  });

  it('assinatura PENDING: mostra "Aguardando 1º agendamento" e navega para o agendamento ao clicar em Agendar agora', async () => {
    mockFetchRouter({
      [MY_URL]: () => jsonResponse({
        success: true,
        data: [{
          id: 'sub-1', status: 'PENDING', startDate: '2026-01-01', nextBillingDate: '2026-02-01', lastCycleReset: '2026-01-01',
          plan: { id: 'plan-a', name: 'Plano Facial', price: 150 }, items: [],
        }],
      }),
      [COMPANY_URL]: () => jsonResponse({ subscriptionPlans: [] }),
    });
    renderPage();

    expect(await screen.findByText('Aguardando 1º agendamento')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Agendar agora' }));
    expect(navigateMock).toHaveBeenCalledWith('/clinica-aura/', {
      state: { pendingPlanId: 'plan-a', pendingPlanName: 'Plano Facial' },
    });
  });

  // Bug relatado: cliente já tinha agendado a 1ª sessão do plano (visível na
  // aba Agendamentos, status PENDING_APPROVAL aguardando o admin aprovar),
  // mas "Meus Planos" continuava dizendo "Agende sua primeira sessão" como
  // se nada tivesse sido agendado — a API agora informa hasPendingAppointment.
  it('assinatura PENDING com hasPendingAppointment: true → mostra "Pendente." em vez de "Aguardando 1º agendamento"', async () => {
    mockFetchRouter({
      [MY_URL]: () => jsonResponse({
        success: true,
        data: [{
          id: 'sub-1', status: 'PENDING', hasPendingAppointment: true,
          startDate: '2026-01-01', nextBillingDate: '2026-02-01', lastCycleReset: '2026-01-01',
          plan: { id: 'plan-a', name: 'Plano Facial', price: 150 }, items: [],
        }],
      }),
      [COMPANY_URL]: () => jsonResponse({ subscriptionPlans: [] }),
    });
    renderPage();

    expect(await screen.findByText('Pendente.')).toBeInTheDocument();
    expect(screen.queryByText('Aguardando 1º agendamento')).not.toBeInTheDocument();
    expect(screen.queryByText(/Agende sua primeira sessão/i)).not.toBeInTheDocument();
  });

  it('assinatura ACTIVE: mostra sessões restantes calculadas pelo backend (não recalcula no cliente)', async () => {
    mockFetchRouter({
      [MY_URL]: () => jsonResponse({
        success: true,
        data: [{
          id: 'sub-1', status: 'ACTIVE', startDate: '2026-01-01', nextBillingDate: '2026-02-01', lastCycleReset: '2026-01-01',
          plan: { id: 'plan-a', name: 'Plano Facial', price: 150 },
          items: [{ procedureId: 'proc-1', procedureName: 'Limpeza de Pele', sessionsPerCycle: 4, sessionsUsed: 1, sessionsRemaining: 3 }],
        }],
      }),
      [COMPANY_URL]: () => jsonResponse({ subscriptionPlans: [] }),
    });
    renderPage();

    expect(await screen.findByText('3 restantes')).toBeInTheDocument();
    expect(screen.getByText('/ 4')).toBeInTheDocument();
  });

  it('plano disponível (sem assinatura): contratar chama POST /self e navega ao agendamento em caso de sucesso', async () => {
    mockFetchRouter({
      [MY_URL]: () => jsonResponse({ success: true, data: [] }),
      [COMPANY_URL]: () => jsonResponse({ subscriptionPlans: [PLAN_A] }),
      [SELF_URL]: () => jsonResponse({ id: 'sub-new', status: 'PENDING', planId: 'plan-a' }, true, 201),
    });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Contratar Plano' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar Plano' }));

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/clinica-aura/', {
      state: { pendingPlanId: 'plan-a', pendingPlanName: 'Plano Facial' },
    }));
  });

  // ── Bug: mutação (contratar) falhando silenciosamente ──
  it('contratar falha (erro do backend): mostra o erro via diálogo (useDialog) e NÃO navega', async () => {
    mockFetchRouter({
      [MY_URL]: () => jsonResponse({ success: true, data: [] }),
      [COMPANY_URL]: () => jsonResponse({ subscriptionPlans: [PLAN_A] }),
      [SELF_URL]: () => jsonResponse({ error: 'Plano não encontrado' }, false, 404),
    });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Contratar Plano' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar Plano' }));

    expect(await screen.findByText('Plano não encontrado')).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('contratar falha por erro de rede (fetch rejeita): mostra diálogo de erro genérico', async () => {
    global.fetch = vi.fn((url: string) => {
      if (url === SELF_URL) return Promise.reject(new Error('network down'));
      if (url === MY_URL) return jsonResponse({ success: true, data: [] });
      if (url === COMPANY_URL) return jsonResponse({ subscriptionPlans: [PLAN_A] });
      return jsonResponse({ success: true, data: [] });
    }) as unknown as typeof fetch;
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Contratar Plano' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar Plano' }));

    expect(await screen.findByText(/Verifique sua conexão/i)).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  // ── Bug: falha ao carregar assinaturas próprias virava silenciosamente "sem planos" ──
  it('falha ao carregar /my (success: false): mostra banner de erro, não a mensagem de "sem planos"', async () => {
    mockFetchRouter({
      [MY_URL]: () => jsonResponse({ success: false, error: 'Não autenticado' }, false, 401),
      [COMPANY_URL]: () => jsonResponse({ subscriptionPlans: [] }),
    });
    renderPage();

    expect(await screen.findByText('Não foi possível carregar seus planos agora.')).toBeInTheDocument();
    expect(screen.queryByText('Você não possui planos ativos')).not.toBeInTheDocument();
  });

  it('falha de rede ao carregar /my: mostra banner de erro com botão de tentar novamente', async () => {
    global.fetch = vi.fn((url: string) => {
      if (url === MY_URL) return Promise.reject(new Error('network down'));
      return jsonResponse({ subscriptionPlans: [] });
    }) as unknown as typeof fetch;
    renderPage();

    expect(await screen.findByText('Não foi possível carregar seus planos agora.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  });

  it('ver histórico de uma assinatura ativa abre o drawer com o subscriptionId correto', async () => {
    mockFetchRouter({
      [MY_URL]: () => jsonResponse({
        success: true,
        data: [{
          id: 'sub-1', status: 'ACTIVE', startDate: '2026-01-01', nextBillingDate: '2026-02-01', lastCycleReset: '2026-01-01',
          plan: { id: 'plan-a', name: 'Plano Facial', price: 150 },
          items: [{ procedureId: 'proc-1', procedureName: 'Limpeza de Pele', sessionsPerCycle: 4, sessionsUsed: 1, sessionsRemaining: 3 }],
        }],
      }),
      [COMPANY_URL]: () => jsonResponse({ subscriptionPlans: [] }),
      'http://localhost:3001/api/subscriptions/patients/sub-1/history': () => jsonResponse({ success: true, data: [] }),
    });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Ver histórico' }));
    expect(await screen.findByText('Histórico de sessões')).toBeInTheDocument();
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/subscriptions/patients/sub-1/history',
      expect.anything()
    ));
  });
});
