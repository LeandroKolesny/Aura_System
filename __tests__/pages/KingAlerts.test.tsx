// __tests__/pages/KingAlerts.test.tsx
// Testes da página pages/king/KingAlerts.tsx (alertas/comunicados do sistema, King).

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react';
import type { SystemAlert, Company } from '../../types';

const showAlert = vi.fn();
vi.mock('../../context/DialogContext', () => ({
  useDialog: () => ({ showAlert, confirm: vi.fn() }),
}));

const addSystemAlert = vi.fn();
const toggleSystemAlertStatus = vi.fn();
const loadSystemAlerts = vi.fn();

interface AppState {
  systemAlerts: SystemAlert[];
  companies: Company[];
}
const appState: AppState = { systemAlerts: [], companies: [] };

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({
    systemAlerts: appState.systemAlerts,
    addSystemAlert: (...a: unknown[]) => addSystemAlert(...a),
    toggleSystemAlertStatus: (...a: unknown[]) => toggleSystemAlertStatus(...a),
    companies: appState.companies,
    loadSystemAlerts: (...a: unknown[]) => loadSystemAlerts(...a),
  }),
}));

import KingAlerts from '../../pages/king/KingAlerts';

const render = () => rtlRender(<KingAlerts />);

function alert(over: Partial<SystemAlert> = {}): SystemAlert {
  return {
    id: 'alert-1',
    title: 'Manutenção Programada',
    message: 'O sistema ficará indisponível às 22h.',
    type: 'info',
    target: 'all',
    status: 'active',
    createdAt: '2026-09-01T10:00:00.000Z',
    ...over,
  } as SystemAlert;
}

beforeEach(() => {
  vi.clearAllMocks();
  appState.systemAlerts = [];
  appState.companies = [];
  addSystemAlert.mockResolvedValue({ success: true, alert: alert() });
  toggleSystemAlertStatus.mockResolvedValue({ success: true });
});

describe('pages/king/KingAlerts', () => {
  it('carrega o histórico de alertas do backend ao montar', async () => {
    // REGRESSÃO: loadSystemAlerts() nunca era chamado nesta tela — o histórico
    // ficava sempre vazio após um reload, mesmo com alertas ativos no banco.
    render();
    await waitFor(() => expect(loadSystemAlerts).toHaveBeenCalled());
  });

  it('mostra estado vazio quando não há alertas', async () => {
    render();
    expect(screen.getByText('Nenhum alerta enviado')).toBeInTheDocument();
  });

  it('renderiza o histórico de alertas com título, mensagem e destinatário', async () => {
    appState.systemAlerts = [alert({ title: 'Aviso Importante', message: 'Leia com atenção' })];
    render();

    expect(screen.getByText('Aviso Importante')).toBeInTheDocument();
    expect(screen.getByText('Leia com atenção')).toBeInTheDocument();
    expect(screen.getByText('Todas as Clínicas')).toBeInTheDocument();
  });

  it('mostra o nome da clínica quando o alerta é direcionado (target = companyId)', async () => {
    appState.companies = [{ id: 'c1', name: 'Clínica Bela Vida' } as Company];
    appState.systemAlerts = [alert({ target: 'c1' })];
    render();

    expect(screen.getByText('Clínica Bela Vida')).toBeInTheDocument();
  });

  it('mostra os totais corretos nos cards de estatística (total, ativos, inativos, globais)', async () => {
    appState.systemAlerts = [
      alert({ id: 'a1', status: 'active', target: 'all' }),
      alert({ id: 'a2', status: 'inactive', target: 'c1' }),
    ];
    render();

    expect(screen.getByText('Total de Alertas')).toBeInTheDocument();
    expect(screen.getByText('Ativos')).toBeInTheDocument();
    expect(screen.getByText('Inativos')).toBeInTheDocument();
    expect(screen.getByText('Globais')).toBeInTheDocument();
  });

  it('cria um novo alerta com sucesso e fecha o formulário', async () => {
    render();
    fireEvent.click(screen.getByRole('button', { name: /Novo Alerta/i }));

    fireEvent.change(screen.getByPlaceholderText('Ex: Manutenção Programada'), {
      target: { value: 'Aviso de manutenção' },
    });
    fireEvent.change(screen.getByPlaceholderText('Escreva o comunicado que será exibido para as clínicas...'), {
      target: { value: 'Sistema fora do ar às 23h' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Enviar Alerta/i }));

    await waitFor(() =>
      expect(addSystemAlert).toHaveBeenCalledWith({
        title: 'Aviso de manutenção',
        message: 'Sistema fora do ar às 23h',
        type: 'info',
        target: 'all',
      })
    );
    await waitFor(() =>
      expect(screen.queryByText('Novo Alerta do Sistema')).not.toBeInTheDocument()
    );
  });

  it('erro ao criar alerta exibe a mensagem via showAlert e mantém o formulário aberto', async () => {
    addSystemAlert.mockResolvedValue({ success: false, error: 'Sem permissão' });
    render();
    fireEvent.click(screen.getByRole('button', { name: /Novo Alerta/i }));

    fireEvent.change(screen.getByPlaceholderText('Ex: Manutenção Programada'), {
      target: { value: 'Aviso' },
    });
    fireEvent.change(screen.getByPlaceholderText('Escreva o comunicado que será exibido para as clínicas...'), {
      target: { value: 'Mensagem' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Enviar Alerta/i }));

    await waitFor(() =>
      expect(showAlert).toHaveBeenCalledWith('Sem permissão', expect.objectContaining({ variant: 'danger' }))
    );
    expect(screen.getByText('Novo Alerta do Sistema')).toBeInTheDocument();
  });

  it('ativa/desativa um alerta ao clicar no botão de status', async () => {
    appState.systemAlerts = [alert({ id: 'a1', status: 'active' })];
    render();

    fireEvent.click(screen.getByTitle('Desativar alerta'));

    await waitFor(() => expect(toggleSystemAlertStatus).toHaveBeenCalledWith('a1'));
  });

  it('erro ao alternar status do alerta exibe a mensagem via showAlert', async () => {
    appState.systemAlerts = [alert({ id: 'a1', status: 'active' })];
    toggleSystemAlertStatus.mockResolvedValue({ success: false, error: 'Erro de sistema' });
    render();

    fireEvent.click(screen.getByTitle('Desativar alerta'));

    await waitFor(() =>
      expect(showAlert).toHaveBeenCalledWith('Erro de sistema', expect.objectContaining({ variant: 'danger' }))
    );
  });
});
