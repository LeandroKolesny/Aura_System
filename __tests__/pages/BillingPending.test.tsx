// __tests__/pages/BillingPending.test.tsx
// Testes de componente da tela de aguardo de pagamento (pages/admin/BillingPending.tsx).
// Polling de /api/billing/status com fake timers.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render as rtlRender, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});

const getStatus = vi.fn();

vi.mock('../../services/api', () => ({
  api: { billing: { getStatus: (...a: unknown[]) => getStatus(...a) } },
}));

import BillingPending from '../../pages/admin/BillingPending';

const render = () =>
  rtlRender(<BillingPending />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });

const pending = { success: true, data: { data: { status: 'PENDING' } } };
const active = { success: true, data: { data: { status: 'ACTIVE' } } };

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  getStatus.mockResolvedValue(pending);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('pages/admin/BillingPending', () => {
  it('faz polling a cada 10s e, ao receber status ACTIVE, navega para /dashboard e PARA o polling', async () => {
    getStatus.mockResolvedValueOnce(pending).mockResolvedValue(active);

    render();
    // poll imediato
    await act(async () => { await Promise.resolve(); });
    expect(getStatus).toHaveBeenCalledTimes(1);
    expect(navigateMock).not.toHaveBeenCalled();

    // segundo poll (10s) → ACTIVE
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(getStatus).toHaveBeenCalledTimes(2);
    expect(navigateMock).toHaveBeenCalledWith('/dashboard', { replace: true, state: { paymentSuccess: true } });

    // polling parou — nenhum novo getStatus depois disso
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(getStatus).toHaveBeenCalledTimes(2);
  });

  it('sem confirmação após 30min mostra a tela de timeout; "Verificar novamente" reseta', async () => {
    render();
    await act(async () => { await Promise.resolve(); });

    await act(async () => { await vi.advanceTimersByTimeAsync(30 * 60_000 + 10_000); });

    expect(screen.getByText('Não identificamos seu pagamento ainda')).toBeInTheDocument();

    await act(async () => {
      screen.getByRole('button', { name: /Verificar novamente/i }).click();
    });

    expect(screen.getByText('Aguardando confirmação do pagamento')).toBeInTheDocument();
    expect(screen.queryByText('Não identificamos seu pagamento ainda')).not.toBeInTheDocument();
  });

  it('N falhas de rede consecutivas mostram aviso ao usuário e o polling continua', async () => {
    getStatus.mockRejectedValue(new Error('network down'));

    render();
    await act(async () => { await Promise.resolve(); }); // falha 1 (poll imediato)
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); }); // falha 2
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); }); // falha 3

    expect(screen.getByText(/Não conseguimos verificar o pagamento/i)).toBeInTheDocument();

    const callsSoFar = getStatus.mock.calls.length;
    expect(callsSoFar).toBeGreaterThanOrEqual(3);

    // polling não parou
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(getStatus.mock.calls.length).toBeGreaterThan(callsSoFar);
  });

  it('resposta HTTP de erro (success:false) conta como falha e não trava o polling', async () => {
    getStatus.mockResolvedValue({ success: false });

    render();
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });

    expect(screen.getByText(/Não conseguimos verificar o pagamento/i)).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
