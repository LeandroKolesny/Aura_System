// __tests__/components/patient-portal/PlanHistoryDrawer.test.tsx
// Testes do drawer de histórico de sessões do plano
// (components/patient-portal/PlanHistoryDrawer.tsx). Sem teste antes desta
// auditoria (docs/test-audit/cliente-planos-assinaturas.md).
//
// Cobre a verificação do Passo 2 da auditoria: um agendamento vinculado a uma
// assinatura (subscriptionId preenchido, ver Bug C do agente anterior em
// PublicBooking.tsx) nasce PENDING_APPROVAL — confirma que ele aparece
// normalmente no drawer, com o rótulo/cor certos, e não é filtrado.
// Também corrige um bug de falha silenciosa: fetchHistory tinha
// try {} finally {} sem catch — uma falha de rede virava uma rejeição de
// Promise não tratada e o drawer mostrava o estado vazio ("Nenhuma sessão
// realizada ainda"), indistinguível de um paciente que realmente não tem
// nenhuma sessão.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { PlanHistoryDrawer } from '../../../components/patient-portal/PlanHistoryDrawer';

vi.mock('../../../services/api', () => ({
  getAuthToken: () => 'fake-token',
  API_BASE_URL: 'http://localhost:3001',
}));

function renderDrawer() {
  const onClose = vi.fn();
  render(
    <PlanHistoryDrawer
      subscriptionId="sub-1"
      planName="Plano Facial"
      primaryColor="#8b5cf6"
      cardBg="#fff"
      cardText="#1e293b"
      borderColor="#eee"
      isDark={false}
      onClose={onClose}
    />
  );
  return { onClose };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('components/patient-portal/PlanHistoryDrawer', () => {
  it('busca o histórico da assinatura correta com o token de autenticação', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true, data: [] }),
    }) as unknown as typeof fetch;

    renderDrawer();

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/subscriptions/patients/sub-1/history',
      { headers: { Authorization: 'Bearer fake-token' } }
    ));
  });

  it('estado vazio: mostra mensagem de nenhuma sessão quando data = []', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true, data: [] }),
    }) as unknown as typeof fetch;

    renderDrawer();
    expect(await screen.findByText('Nenhuma sessão realizada ainda.')).toBeInTheDocument();
  });

  it('renderiza um agendamento PENDING_APPROVAL (nascido de um agendamento de paciente vinculado ao plano) com o rótulo Pendente', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        success: true,
        data: [{
          id: 'apt-1', date: '2026-03-10T00:00:00.000Z', status: 'PENDING_APPROVAL',
          procedureName: 'Limpeza de Pele', professionalName: 'Dra. Ana', photos: [],
        }],
      }),
    }) as unknown as typeof fetch;

    renderDrawer();

    expect(await screen.findByText('Pendente')).toBeInTheDocument();
    expect(screen.getByText('Limpeza de Pele')).toBeInTheDocument();
    expect(screen.getByText('Dra. Ana')).toBeInTheDocument();
  });

  it('renderiza status desconhecido usando o próprio valor como rótulo (fallback)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        success: true,
        data: [{ id: 'apt-1', date: '2026-03-10T00:00:00.000Z', status: 'ALGO_NOVO', procedureName: 'X', professionalName: 'Y', photos: [] }],
      }),
    }) as unknown as typeof fetch;

    renderDrawer();
    expect(await screen.findByText('ALGO_NOVO')).toBeInTheDocument();
  });

  it('renderiza fotos de antes/depois quando presentes', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        success: true,
        data: [{
          id: 'apt-1', date: '2026-03-10T00:00:00.000Z', status: 'COMPLETED',
          procedureName: 'Limpeza de Pele', professionalName: 'Dra. Ana',
          photos: [
            { id: 'ph1', url: 'https://example.com/before.jpg', type: 'BEFORE', takenAt: '2026-03-10T00:00:00.000Z' },
            { id: 'ph2', url: 'https://example.com/after.jpg', type: 'AFTER', takenAt: '2026-03-10T00:00:00.000Z' },
          ],
        }],
      }),
    }) as unknown as typeof fetch;

    renderDrawer();
    expect(await screen.findByAltText('Antes')).toHaveAttribute('src', 'https://example.com/before.jpg');
    expect(screen.getByAltText('Depois')).toHaveAttribute('src', 'https://example.com/after.jpg');
  });

  it('json.success = false: mostra estado de erro, não a mensagem enganosa de "nenhuma sessão"', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: false, error: 'Acesso negado' }),
    }) as unknown as typeof fetch;

    renderDrawer();

    expect(await screen.findByText(/não foi possível carregar/i)).toBeInTheDocument();
    expect(screen.queryByText('Nenhuma sessão realizada ainda.')).not.toBeInTheDocument();
  });

  it('falha de rede (fetch rejeita): mostra estado de erro em vez de "nenhuma sessão" e não deixa a Promise rejeitada sem tratamento', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

    renderDrawer();

    expect(await screen.findByText(/não foi possível carregar/i)).toBeInTheDocument();
    expect(screen.queryByText('Nenhuma sessão realizada ainda.')).not.toBeInTheDocument();
  });
});
