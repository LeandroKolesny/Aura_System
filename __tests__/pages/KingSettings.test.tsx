// __tests__/pages/KingSettings.test.tsx
// Testes da página pages/king/KingSettings.tsx (Planos & Preços, Notificações,
// Sistema/Manutenção e Aparência do painel King). Página grande (963 linhas,
// 4 abas) — testes organizados em describe blocks por seção.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Company, SaasPlan } from '../../types';

const showAlert = vi.fn();
const confirm = vi.fn();
vi.mock('../../context/DialogContext', () => ({
  useDialog: () => ({ showAlert, confirm }),
}));

const addPlan = vi.fn();
const updatePlan = vi.fn();
const removePlan = vi.fn();
const loadPlans = vi.fn();
const updateCompany = vi.fn();

interface AppState {
  saasPlans: SaasPlan[];
  companies: Company[];
}
const appState: AppState = { saasPlans: [], companies: [] };

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({
    saasPlans: appState.saasPlans,
    addPlan: (...a: unknown[]) => addPlan(...a),
    updatePlan: (...a: unknown[]) => updatePlan(...a),
    removePlan: (...a: unknown[]) => removePlan(...a),
    loadPlans: (...a: unknown[]) => loadPlans(...a),
    companies: appState.companies,
    updateCompany: (...a: unknown[]) => updateCompany(...a),
  }),
}));

const getMaintenanceMock = vi.fn();
const setMaintenanceMock = vi.fn();
vi.mock('../../services/api', () => ({
  systemApi: {
    getMaintenance: (...a: unknown[]) => getMaintenanceMock(...a),
    setMaintenance: (...a: unknown[]) => setMaintenanceMock(...a),
  },
}));

import KingSettings from '../../pages/king/KingSettings';

const render = () => rtlRender(<KingSettings />);

function plan(over: Partial<SaasPlan> = {}): SaasPlan {
  return {
    id: 'plan-1',
    name: 'STARTER',
    price: 97,
    maxProfessionals: 2,
    maxPatients: 100,
    modules: [],
    features: ['Recurso A'],
    active: true,
    stripePaymentLink: '',
    ...over,
  } as SaasPlan;
}

function company(over: Partial<Company> = {}): Company {
  return {
    id: 'c1',
    name: 'Clínica Bela Vida',
    slug: 'bela-vida',
    plan: 'starter',
    subscriptionStatus: 'active',
    subscriptionExpiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    ...over,
  } as Company;
}

beforeEach(() => {
  vi.clearAllMocks();
  appState.saasPlans = [plan()];
  appState.companies = [company()];
  addPlan.mockResolvedValue({ success: true });
  updatePlan.mockResolvedValue({ success: true });
  removePlan.mockResolvedValue({ success: true });
  updateCompany.mockResolvedValue({ success: true });
  confirm.mockResolvedValue(true);
  getMaintenanceMock.mockResolvedValue({ success: true, data: { maintenanceMode: false } });
  setMaintenanceMock.mockResolvedValue({ success: true, data: { maintenanceMode: true } });
});

describe('pages/king/KingSettings — navegação por abas', () => {
  it('carrega os planos ao montar e inicia na aba "Planos & Precos"', async () => {
    render();
    await waitFor(() => expect(loadPlans).toHaveBeenCalled());
    expect(screen.getByText('Gestao de Ativacoes')).toBeInTheDocument();
  });

  it('troca para a aba Notificacoes/Email', async () => {
    render();
    await waitFor(() => expect(getMaintenanceMock).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /Notificacoes\/Email/i }));
    expect(screen.getByText(/Configure quais notificacoes/i)).toBeInTheDocument();
  });

  it('troca para a aba Sistema', async () => {
    render();
    await waitFor(() => expect(getMaintenanceMock).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Sistema' }));
    expect(screen.getByText('Configuracoes de Trial')).toBeInTheDocument();
  });

  it('troca para a aba Aparencia', async () => {
    render();
    await waitFor(() => expect(getMaintenanceMock).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Aparencia' }));
    expect(screen.getByText('Logo do Sistema')).toBeInTheDocument();
  });
});

describe('pages/king/KingSettings — Gestão de Ativações', () => {
  it('mostra "Nenhuma empresa cadastrada" quando não há empresas', () => {
    appState.companies = [];
    render();
    expect(screen.getByText('Nenhuma empresa cadastrada')).toBeInTheDocument();
  });

  it('lista as empresas com o nome do plano correspondente (mesmo com plan em minúsculo e id do SaasPlan diferente)', () => {
    // Regressão coberta: a busca comparava `saasPlans.find(p => p.id ===
    // company.plan)` — nunca batia (id é um cuid, company.plan é o nome do
    // enum em minúsculo). Deve casar por nome, normalizando caixa.
    render();
    expect(screen.getByText('Clínica Bela Vida')).toBeInTheDocument();
    expect(screen.getAllByText('STARTER').length).toBeGreaterThan(0);
  });

  it('abre o modal "Adicionar Tempo" e envia subscriptionStatus em maiúsculo (ACTIVE)', async () => {
    render();
    fireEvent.click(screen.getByRole('button', { name: /Adicionar Tempo/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar 30 dias' }));

    await waitFor(() => expect(updateCompany).toHaveBeenCalled());
    const [companyId, data] = updateCompany.mock.calls[0];
    expect(companyId).toBe('c1');
    // BUG CORRIGIDO: era 'active' (minúsculo) — o enum Prisma só aceita
    // ACTIVE/TRIAL/OVERDUE/CANCELED (maiúsculo).
    expect(data.subscriptionStatus).toBe('ACTIVE');
    expect(typeof data.subscriptionExpiresAt).toBe('string');
  });

  it('erro ao adicionar tempo exibe showAlert e mantém o modal', async () => {
    updateCompany.mockResolvedValue({ success: false, error: 'Empresa não encontrada' });
    render();
    fireEvent.click(screen.getByRole('button', { name: /Adicionar Tempo/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar 30 dias' }));

    await waitFor(() =>
      expect(showAlert).toHaveBeenCalledWith('Empresa não encontrada', expect.objectContaining({ variant: 'danger' }))
    );
  });

  it('abre o modal "Alterar Plano" e envia o NOME do plano (não o id do SaasPlan)', async () => {
    appState.saasPlans = [plan({ id: 'cuid-xyz', name: 'PROFESSIONAL', price: 297 })];
    render();

    fireEvent.click(screen.getByRole('button', { name: /starter|free/i }));
    fireEvent.click(screen.getByRole('button', { name: /PROFESSIONAL/i }));

    await waitFor(() =>
      // BUG CORRIGIDO: enviava `plan.id` ("cuid-xyz") em vez de `plan.name`
      // ("PROFESSIONAL") — Company.plan é o enum Prisma, não uma FK para
      // SaasPlan.
      expect(updateCompany).toHaveBeenCalledWith('c1', { plan: 'PROFESSIONAL' })
    );
  });

  it('marca o plano atual da empresa com o badge "Atual" no modal de troca (case-insensitive)', async () => {
    appState.companies = [company({ plan: 'starter' })];
    appState.saasPlans = [plan({ id: 'p1', name: 'STARTER' }), plan({ id: 'p2', name: 'PREMIUM' })];
    render();
    await waitFor(() => expect(getMaintenanceMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /STARTER/i }));
    expect(screen.getByText('Atual')).toBeInTheDocument();
  });

  it('erro ao alterar plano exibe showAlert', async () => {
    updateCompany.mockResolvedValue({ success: false, error: 'Plano inválido' });
    appState.saasPlans = [plan({ id: 'p1', name: 'PREMIUM' })];
    render();

    fireEvent.click(screen.getByRole('button', { name: /starter|free/i }));
    fireEvent.click(screen.getByRole('button', { name: /PREMIUM/i }));

    await waitFor(() =>
      expect(showAlert).toHaveBeenCalledWith('Plano inválido', expect.objectContaining({ variant: 'danger' }))
    );
  });
});

describe('pages/king/KingSettings — Configuração de Planos (CRUD)', () => {
  it('cria um novo plano com sucesso', async () => {
    render();
    fireEvent.click(screen.getByRole('button', { name: /Novo Plano/i }));

    fireEvent.change(screen.getByPlaceholderText('Ex: Enterprise'), { target: { value: 'Gold' } });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '199' } });
    const featureInput = screen.getByPlaceholderText('Novo recurso');
    fireEvent.change(featureInput, { target: { value: 'Suporte 24h' } });
    fireEvent.keyDown(featureInput, { key: 'Enter' });

    await waitFor(() => expect(screen.getByText('Suporte 24h')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(addPlan).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Gold', price: 199, features: ['Suporte 24h'] })
    ));
  });

  it('erro ao criar plano exibe a mensagem no modal', async () => {
    addPlan.mockResolvedValue({ success: false, error: 'Nome já existe' });
    render();
    fireEvent.click(screen.getByRole('button', { name: /Novo Plano/i }));
    fireEvent.change(screen.getByPlaceholderText('Ex: Enterprise'), { target: { value: 'Gold' } });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '199' } });
    fireEvent.change(screen.getByPlaceholderText('Novo recurso'), { target: { value: 'X' } });
    fireEvent.keyDown(screen.getByPlaceholderText('Novo recurso'), { key: 'Enter' });

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(screen.getByText('Nome já existe')).toBeInTheDocument());
  });

  it('exclui um plano após confirmação', async () => {
    render();
    const deleteButtons = screen.getAllByRole('button').filter(b => b.className.includes('hover:text-red-500'));
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => expect(confirm).toHaveBeenCalled());
    await waitFor(() => expect(removePlan).toHaveBeenCalledWith('plan-1'));
  });

  it('erro ao excluir plano exibe showAlert', async () => {
    removePlan.mockResolvedValue({ success: false, error: 'Plano em uso' });
    render();
    const deleteButtons = screen.getAllByRole('button').filter(b => b.className.includes('hover:text-red-500'));
    fireEvent.click(deleteButtons[0]);

    await waitFor(() =>
      expect(showAlert).toHaveBeenCalledWith(expect.stringContaining('Plano em uso'), expect.objectContaining({ variant: 'danger' }))
    );
  });

  it('alterna a visibilidade do plano (ativo/inativo)', async () => {
    render();
    const toggleButtons = screen.getAllByTitle('Visivel na landing');
    fireEvent.click(toggleButtons[0]);

    await waitFor(() => expect(updatePlan).toHaveBeenCalledWith('plan-1', { active: false }));
  });

  it('erro ao alternar visibilidade exibe showAlert', async () => {
    updatePlan.mockResolvedValue({ success: false, error: 'Erro ao salvar' });
    render();
    const toggleButtons = screen.getAllByTitle('Visivel na landing');
    fireEvent.click(toggleButtons[0]);

    await waitFor(() =>
      expect(showAlert).toHaveBeenCalledWith(expect.stringContaining('Erro ao salvar'), expect.objectContaining({ variant: 'danger' }))
    );
  });
});

describe('pages/king/KingSettings — Sistema / Modo Manutenção', () => {
  it('carrega o status de manutenção ao montar', async () => {
    getMaintenanceMock.mockResolvedValue({ success: true, data: { maintenanceMode: true } });
    render();
    fireEvent.click(screen.getByRole('button', { name: 'Sistema' }));

    await waitFor(() => expect(screen.getByText(/em modo manutencao/i)).toBeInTheDocument());
  });

  it('ativa o modo manutenção com sucesso', async () => {
    render();
    fireEvent.click(screen.getByRole('button', { name: 'Sistema' }));
    await waitFor(() => expect(getMaintenanceMock).toHaveBeenCalled());

    // O checkbox de Modo Manutenção é o último renderizado na aba Sistema
    // (depois do de "Suspender automaticamente").
    const maintenanceCheckbox = screen.getAllByRole('checkbox').slice(-1)[0];
    fireEvent.click(maintenanceCheckbox);

    await waitFor(() => expect(setMaintenanceMock).toHaveBeenCalledWith(true));
    await waitFor(() => expect(showAlert).toHaveBeenCalledWith(expect.stringContaining('ATIVADO'), expect.objectContaining({ variant: 'warning' })));
  });

  it('erro ao alterar modo manutenção exibe mensagem inline', async () => {
    setMaintenanceMock.mockResolvedValue({ success: false, error: 'Falha ao conectar' });
    render();
    fireEvent.click(screen.getByRole('button', { name: 'Sistema' }));
    await waitFor(() => expect(getMaintenanceMock).toHaveBeenCalled());

    const maintenanceCheckbox = screen.getAllByRole('checkbox').slice(-1)[0];
    fireEvent.click(maintenanceCheckbox);

    await waitFor(() => expect(screen.getByText('Falha ao conectar')).toBeInTheDocument());
  });
});
