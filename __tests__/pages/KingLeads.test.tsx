// __tests__/pages/KingLeads.test.tsx
// Testes da página pages/king/KingLeads.tsx (pipeline comercial de leads do King).

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Lead } from '../../types';

const showAlert = vi.fn();
vi.mock('../../context/DialogContext', () => ({
  useDialog: () => ({ showAlert, confirm: vi.fn() }),
}));

const addLead = vi.fn();
const moveLead = vi.fn();
const loadLeads = vi.fn();

interface AppState {
  leads: Lead[];
}
const appState: AppState = { leads: [] };

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({
    leads: appState.leads,
    addLead: (...a: unknown[]) => addLead(...a),
    moveLead: (...a: unknown[]) => moveLead(...a),
    loadLeads: (...a: unknown[]) => loadLeads(...a),
    loadingStates: {},
  }),
}));

const companiesUpdateMock = vi.fn();
const markLeadsSeenMock = vi.fn();

vi.mock('../../services/api', () => ({
  companiesApi: { update: (...a: unknown[]) => companiesUpdateMock(...a) },
  kingApi: { markLeadsSeen: (...a: unknown[]) => markLeadsSeenMock(...a) },
}));

import KingLeads from '../../pages/king/KingLeads';

const render = () => rtlRender(<KingLeads />);

function lead(over: Partial<Lead> = {}): Lead {
  return {
    id: 'lead-1',
    clinicName: 'Clínica Bela Vida',
    contactName: 'Maria Silva',
    phone: '11999990000',
    email: 'maria@bela.com',
    status: 'new',
    value: 297,
    createdAt: '2026-09-01T00:00:00.000Z',
    ...over,
  } as Lead;
}

beforeEach(() => {
  vi.clearAllMocks();
  appState.leads = [];
  addLead.mockResolvedValue({ success: true, lead: lead() });
  moveLead.mockResolvedValue({ success: true });
  markLeadsSeenMock.mockResolvedValue({ success: true });
  companiesUpdateMock.mockResolvedValue({ success: true });
});

describe('pages/king/KingLeads', () => {
  it('carrega os leads e marca como vistos ao montar', async () => {
    render();
    await waitFor(() => expect(loadLeads).toHaveBeenCalled());
    expect(markLeadsSeenMock).toHaveBeenCalled();
  });

  it('renderiza as colunas do funil com a contagem correta de leads', async () => {
    appState.leads = [
      lead({ id: 'l1', status: 'new' }),
      lead({ id: 'l2', status: 'contacted', clinicName: 'Clínica B' }),
    ];
    render();

    expect(screen.getByText('Novos Contatos')).toBeInTheDocument();
    expect(screen.getByText('Clínica Bela Vida')).toBeInTheDocument();
    expect(screen.getByText('Clínica B')).toBeInTheDocument();
  });

  it('mostra os totais de leads e valor potencial nos cards de estatística', async () => {
    appState.leads = [
      lead({ id: 'l1', status: 'new', value: 100 }),
      lead({ id: 'l2', status: 'won', value: 200 }),
    ];
    render();

    expect(screen.getByText('Total de Leads')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Leads Ganhos')).toBeInTheDocument();
  });

  it('cria um novo lead com sucesso e fecha o modal', async () => {
    render();
    fireEvent.click(screen.getByRole('button', { name: /Novo Lead/i }));

    fireEvent.change(screen.getByPlaceholderText('Ex: Clínica Beleza Natural'), {
      target: { value: 'Clínica Nova' },
    });
    fireEvent.change(screen.getByPlaceholderText('Ex: Maria Silva'), {
      target: { value: 'João' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar Lead' }));

    await waitFor(() => expect(addLead).toHaveBeenCalled());
    expect(showAlert).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByText('Adicionar Novo Lead')).not.toBeInTheDocument()
    );
  });

  it('erro ao criar lead exibe a mensagem via showAlert e mantém o modal aberto', async () => {
    addLead.mockResolvedValue({ success: false, error: 'Usuário sem empresa' });
    render();
    fireEvent.click(screen.getByRole('button', { name: /Novo Lead/i }));

    fireEvent.change(screen.getByPlaceholderText('Ex: Clínica Beleza Natural'), {
      target: { value: 'Clínica Nova' },
    });
    fireEvent.change(screen.getByPlaceholderText('Ex: Maria Silva'), {
      target: { value: 'João' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar Lead' }));

    await waitFor(() => expect(showAlert).toHaveBeenCalledWith('Usuário sem empresa', expect.objectContaining({ variant: 'danger' })));
    expect(screen.getByText('Adicionar Novo Lead')).toBeInTheDocument();
  });

  it('avançar um lead sem etapa especial (new → contacted) chama moveLead direto', async () => {
    appState.leads = [lead({ id: 'l1', status: 'new' })];
    render();

    fireEvent.click(screen.getByRole('button', { name: /Avançar/i }));

    await waitFor(() =>
      expect(moveLead).toHaveBeenCalledWith('l1', 'contacted')
    );
  });

  it('erro ao mover lead exibe a mensagem de erro via showAlert', async () => {
    appState.leads = [lead({ id: 'l1', status: 'new' })];
    moveLead.mockResolvedValue({ success: false, error: 'Falha ao mover lead' });
    render();

    fireEvent.click(screen.getByRole('button', { name: /Avançar/i }));

    await waitFor(() =>
      expect(showAlert).toHaveBeenCalledWith('Falha ao mover lead', expect.objectContaining({ variant: 'danger' }))
    );
  });

  it('confirmar demo faz uma única chamada a moveLead com status + demoAt/demoNotes', async () => {
    appState.leads = [lead({ id: 'l1', status: 'contacted' })];
    render();

    // abre o menu de ações e escolhe mover pra negociação (não há atalho direto pra demo
    // fora do menu; simulamos o avanço até a coluna "demo" pelo botão de avançar).
    // A coluna "contacted" avança para "demo" via handleMove -> openModalForStatus.
    fireEvent.click(screen.getByRole('button', { name: /Avançar/i }));

    // Como o próximo status após "contacted" é "demo", o modal de demo deve abrir
    await screen.findByRole('button', { name: 'Confirmar Demo' });

    fireEvent.change(screen.getByPlaceholderText('Pontos a abordar, necessidades do cliente...'), {
      target: { value: 'Focar no módulo financeiro' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Demo' }));

    await waitFor(() =>
      expect(moveLead).toHaveBeenCalledWith('l1', 'demo', {
        demoAt: undefined,
        demoNotes: 'Focar no módulo financeiro',
      })
    );
    // Uma única chamada — sem chamada extra e redundante ao backend.
    expect(moveLead).toHaveBeenCalledTimes(1);
  });

  it('erro ao confirmar demo exibe a mensagem via showAlert e mantém o modal aberto', async () => {
    appState.leads = [lead({ id: 'l1', status: 'contacted' })];
    moveLead.mockResolvedValue({ success: false, error: 'Erro ao salvar' });
    render();

    fireEvent.click(screen.getByRole('button', { name: /Avançar/i }));
    await screen.findByRole('button', { name: 'Confirmar Demo' });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Demo' }));

    await waitFor(() =>
      expect(showAlert).toHaveBeenCalledWith('Erro ao salvar', expect.objectContaining({ variant: 'danger' }))
    );
    expect(screen.getByRole('button', { name: 'Confirmar Demo' })).toBeInTheDocument();
  });

  it('registrar perda cancela a assinatura da empresa e move o lead com motivo/comentário numa única chamada', async () => {
    appState.leads = [lead({ id: 'l1', status: 'negotiation', companyId: 'company-1' })];
    render();

    fireEvent.click(screen.getByRole('button', { name: /Perdido/i }));
    await screen.findByRole('heading', { name: 'Registrar Perda' });

    fireEvent.change(screen.getByPlaceholderText('Detalhes adicionais...'), {
      target: { value: 'Foi para o concorrente' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar Perda' }));

    await waitFor(() =>
      expect(companiesUpdateMock).toHaveBeenCalledWith('company-1', {
        plan: 'BASIC',
        subscriptionStatus: 'CANCELED',
      })
    );
    expect(moveLead).toHaveBeenCalledWith('l1', 'lost', {
      lostReason: 'Preço muito alto',
      lostComment: 'Foi para o concorrente',
    });
    expect(moveLead).toHaveBeenCalledTimes(1);
  });

  it('converter lead (ganho) ativa a assinatura com o plano selecionado e move o lead', async () => {
    appState.leads = [lead({ id: 'l1', status: 'negotiation', companyId: 'company-1' })];
    render();

    fireEvent.click(screen.getByRole('button', { name: /Fechado/i }));
    await screen.findByText('Converter Lead');

    fireEvent.click(screen.getByRole('button', { name: /Confirmar Conversão/i }));

    await waitFor(() =>
      expect(companiesUpdateMock).toHaveBeenCalledWith('company-1', {
        plan: 'PROFESSIONAL',
        subscriptionStatus: 'ACTIVE',
      })
    );
    expect(moveLead).toHaveBeenCalledWith('l1', 'won');
  });

  it('exibe estado vazio "Nenhum lead" em colunas sem leads', async () => {
    render();
    expect(screen.getAllByText('Nenhum lead').length).toBeGreaterThan(0);
  });
});
