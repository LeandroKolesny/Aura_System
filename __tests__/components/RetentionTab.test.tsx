// __tests__/components/RetentionTab.test.tsx
// Aba "Retorno de Pacientes" (components/RetentionTab.tsx).
// Cobre buildWhatsAppLink/formatDate (lógica client-side de telefone BR) e o
// tratamento de sucesso/erro/loading da chamada a retentionApi.getReport.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  retentionApi: { getReport: vi.fn() },
}));

import RetentionTab, { buildWhatsAppLink, formatDate } from '../../components/RetentionTab';
import { retentionApi } from '../../services/api';

const getReport = vi.mocked(retentionApi.getReport);

function patient(over: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    name: 'Ana Souza',
    phone: '(11) 99999-9999',
    lastProcedure: 'Botox',
    lastVisit: '2026-01-15',
    expectedReturn: '2026-03-15',
    daysOverdue: 20,
    risk: 'at_risk' as const,
    intervalUsed: 60,
    isDefaultInterval: true,
    ...over,
  };
}

const OK_REPORT = {
  success: true as const,
  data: {
    summary: { attention: 1, at_risk: 2, lost: 3, retentionRate: 75 },
    patients: [patient()],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  getReport.mockResolvedValue(OK_REPORT as never);
});

// ─── funções puras ─────────────────────────────────────────────────────────

describe('formatDate', () => {
  it('converte ISO YYYY-MM-DD para DD/MM/YYYY', () => {
    expect(formatDate('2026-01-15')).toBe('15/01/2026');
  });
});

describe('buildWhatsAppLink', () => {
  it('telefone que já começa com 55 não é duplicado', () => {
    const link = buildWhatsAppLink('5511988887777', 'Ana', 'Botox', '2026-01-15', 'Clínica X');
    expect(link).toContain('wa.me/5511988887777?');
    expect(link).not.toContain('wa.me/555511');
  });

  it('telefone mascarado "(11) 99999-9999" é limpo e ganha o DDI 55', () => {
    const link = buildWhatsAppLink('(11) 99999-9999', 'Ana', 'Botox', '2026-01-15', 'Clínica X');
    expect(link).toContain('wa.me/5511999999999?');
  });

  it('a mensagem contém nome do paciente, procedimento, data formatada e clínica', () => {
    const link = buildWhatsAppLink('11999999999', 'Ana Souza', 'Preenchimento', '2026-02-03', 'Studio Bella');
    const msg = decodeURIComponent(link.split('?text=')[1]);
    expect(msg).toContain('Ana Souza');
    expect(msg).toContain('Preenchimento');
    expect(msg).toContain('03/02/2026');
    expect(msg).toContain('Studio Bella');
  });
});

// ─── componente ────────────────────────────────────────────────────────────

describe('RetentionTab — render', () => {
  it('busca na montagem (period 90) e renderiza KPIs + paciente em sucesso', async () => {
    render(<RetentionTab clinicName="Clínica X" professionalOptions={[]} />);

    await waitFor(() => expect(getReport).toHaveBeenCalledWith({ period: 90, professionalId: undefined }));
    expect(await screen.findByText('Ana Souza')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    // link do WhatsApp montado para o paciente
    const link = screen.getByRole('link', { name: /WhatsApp/i });
    expect(link).toHaveAttribute('href', expect.stringContaining('wa.me/5511999999999'));
  });

  it('quando res.success === false, mostra a mensagem de erro', async () => {
    getReport.mockResolvedValue({ success: false, error: 'Falha ao carregar relatório de retenção' } as never);
    render(<RetentionTab clinicName="Clínica X" professionalOptions={[]} />);
    expect(await screen.findByText('Falha ao carregar relatório de retenção')).toBeInTheDocument();
  });

  it('o botão "Atualizar" fica desabilitado durante o loading e reabilita depois', async () => {
    let resolve!: (v: unknown) => void;
    getReport.mockReturnValue(new Promise((r) => { resolve = r; }) as never);

    render(<RetentionTab clinicName="Clínica X" professionalOptions={[]} />);

    const btn = screen.getByRole('button', { name: /Atualizar/i });
    expect(btn).toBeDisabled();

    await act(async () => {
      resolve(OK_REPORT);
    });

    await waitFor(() => expect(btn).not.toBeDisabled());
  });
});
