// __tests__/pages/Billing.test.tsx
// Testes de componente da aba "Planos e Assinatura" (pages/admin/Billing.tsx) —
// assinatura da CLÍNICA com o SaaS, checkout via Asaas.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});

const getPlans = vi.fn();
const checkout = vi.fn();

vi.mock('../../services/api', () => ({
  api: { billing: { getPlans: (...a: unknown[]) => getPlans(...a), checkout: (...a: unknown[]) => checkout(...a) } },
}));

import Billing from '../../pages/admin/Billing';

const PLANS = [
  { id: 'plan-starter', name: 'Starter', displayName: 'Starter', price: 97, features: ['Agenda'], maxProfessionals: 1, maxPatients: 50 },
  { id: 'plan-pro', name: 'Pro', displayName: 'Pro', price: 197, features: ['Tudo do Starter', 'CRM'], maxProfessionals: 3, maxPatients: 200 },
];

function plansResponse(over: Record<string, unknown> = {}) {
  return {
    success: true,
    data: {
      plans: PLANS,
      currentPlan: 'Starter',
      currentStatus: 'ACTIVE',
      subscriptionExpiresAt: '2026-12-31T00:00:00.000Z',
      ...over,
    },
  };
}

const render = (entry = '/billing') =>
  rtlRender(<Billing />, { wrapper: ({ children }) => <MemoryRouter initialEntries={[entry]}>{children}</MemoryRouter> });

beforeEach(() => {
  vi.clearAllMocks();
  getPlans.mockResolvedValue(plansResponse());
  checkout.mockResolvedValue({ success: true, data: { paymentUrl: 'https://asaas.test/pay/1' } });
  vi.spyOn(window, 'open').mockReturnValue({} as Window);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('pages/admin/Billing', () => {
  it('renderiza a lista de planos e destaca o plano atual com botão desabilitado "Plano atual"', async () => {
    render();

    expect(await screen.findByText('Pro')).toBeInTheDocument();
    expect(screen.getByText('Seu Plano')).toBeInTheDocument();

    const currentBtn = screen.getByRole('button', { name: /Plano atual/i });
    expect(currentBtn).toBeDisabled();

    // o plano não-atual tem o botão "Assinar" habilitado
    expect(screen.getByRole('button', { name: /Assinar/i })).toBeEnabled();
  });

  it('clique em "Assinar" chama api.billing.checkout e, com popup liberado, navega para /billing/aguardando', async () => {
    render();
    fireEvent.click(await screen.findByRole('button', { name: /Assinar/i }));

    await waitFor(() => expect(checkout).toHaveBeenCalledWith('plan-pro'));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/billing/aguardando'));
  });

  it('popup bloqueado (window.open → null) mostra o link manual e NÃO navega', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    render();
    fireEvent.click(await screen.findByRole('button', { name: /Assinar/i }));

    expect(await screen.findByText(/Pop-up bloqueado pelo navegador/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ir para o pagamento/i })).toHaveAttribute('href', 'https://asaas.test/pay/1');
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('erro de checkout (success:false) exibe a mensagem no banner', async () => {
    checkout.mockResolvedValue({ success: false, error: 'Pagamento recusado pela operadora' });
    render();
    fireEvent.click(await screen.findByRole('button', { name: /Assinar/i }));

    expect(await screen.findByText('Pagamento recusado pela operadora')).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('erro de rede no checkout exibe "Erro de conexão"', async () => {
    checkout.mockRejectedValue(new Error('Failed to fetch'));
    render();
    fireEvent.click(await screen.findByRole('button', { name: /Assinar/i }));

    expect(await screen.findByText(/Erro de conexão/i)).toBeInTheDocument();
  });

  it('falha ao carregar planos (success:false) exibe mensagem de sessão expirada', async () => {
    getPlans.mockResolvedValue({ success: false });
    render();

    expect(await screen.findByText('Sessão expirada. Faça login novamente.')).toBeInTheDocument();
  });

  it('auto-checkout (?plan=X&autoCheckout=true) dispara handleSubscribe uma única vez mesmo com re-render', async () => {
    const { rerender } = render('/billing?plan=plan-pro&autoCheckout=true');

    await waitFor(() => expect(checkout).toHaveBeenCalledTimes(1));
    expect(checkout).toHaveBeenCalledWith('plan-pro');

    rerender(<Billing />);
    await waitFor(() => expect(checkout).toHaveBeenCalledTimes(1));
  });
});
