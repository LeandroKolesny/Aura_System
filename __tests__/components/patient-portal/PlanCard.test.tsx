// __tests__/components/patient-portal/PlanCard.test.tsx
// Testes do card de plano exibido em pages/patient-portal/PatientPlans.tsx
// (components/patient-portal/PlanCard.tsx). Sem teste antes desta auditoria
// (docs/test-audit/cliente-planos-assinaturas.md).

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlanCard, PlanForCard } from '../../../components/patient-portal/PlanCard';

const PLAN: PlanForCard = {
  id: 'plan-1',
  name: 'Plano Facial Mensal',
  price: 199.9,
  description: 'Cuidados faciais completos',
  imageUrl: null,
  items: [
    { procedureId: 'proc-1', procedureName: 'Limpeza de Pele', sessionsPerCycle: 2 },
    { procedureId: 'proc-2', procedureName: 'Peeling', sessionsPerCycle: 1 },
  ],
};

function renderCard(overrides: Partial<React.ComponentProps<typeof PlanCard>> = {}) {
  const onContract = vi.fn();
  const onViewHistory = vi.fn();
  render(
    <PlanCard
      plan={PLAN}
      status="available"
      primaryColor="#8b5cf6"
      cardBg="#ffffff"
      cardText="#1e293b"
      borderColor="#eee"
      onContract={onContract}
      onViewHistory={onViewHistory}
      {...overrides}
    />
  );
  return { onContract, onViewHistory };
}

describe('components/patient-portal/PlanCard', () => {
  it('exibe nome, preço formatado em R$ e os procedimentos inclusos', () => {
    renderCard();
    expect(screen.getByText('Plano Facial Mensal')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*199,90/)).toBeInTheDocument();
    expect(screen.getByText(/Limpeza de Pele — 2x\/mês/)).toBeInTheDocument();
    expect(screen.getByText(/Peeling — 1x\/mês/)).toBeInTheDocument();
  });

  it('status "available": mostra botão Contratar Plano e chama onContract ao clicar', () => {
    const { onContract } = renderCard({ status: 'available' });
    const btn = screen.getByRole('button', { name: 'Contratar Plano' });
    fireEvent.click(btn);
    expect(onContract).toHaveBeenCalledOnce();
    expect(screen.queryByText('Ativo')).not.toBeInTheDocument();
  });

  it('status "active": mostra badge Ativo e botão Ver Histórico, que chama onViewHistory', () => {
    const { onViewHistory } = renderCard({ status: 'active' });
    expect(screen.getByText('Ativo')).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: 'Ver Histórico de Sessões' });
    fireEvent.click(btn);
    expect(onViewHistory).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Contratar Plano' })).not.toBeInTheDocument();
  });

  it('status "pending": mostra aviso de aguardando agendamento e nenhum botão de ação', () => {
    renderCard({ status: 'pending' });
    expect(screen.getByText('Aguardando agendamento')).toBeInTheDocument();
    expect(screen.getByText('Agende sua 1ª sessão para ativar')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Contratar Plano' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver Histórico de Sessões' })).not.toBeInTheDocument();
  });

  it('sem imageUrl, renderiza o placeholder (sem <img>)', () => {
    renderCard();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('com imageUrl, renderiza a imagem do plano', () => {
    renderCard({ plan: { ...PLAN, imageUrl: 'https://example.com/plan.jpg' } });
    const img = screen.getByRole('img', { name: 'Plano Facial Mensal' });
    expect(img).toHaveAttribute('src', 'https://example.com/plan.jpg');
  });

  it('não renderiza descrição quando plan.description é null', () => {
    renderCard({ plan: { ...PLAN, description: null } });
    expect(screen.queryByText('Cuidados faciais completos')).not.toBeInTheDocument();
  });
});
