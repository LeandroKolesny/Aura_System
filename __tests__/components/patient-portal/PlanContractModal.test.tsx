// __tests__/components/patient-portal/PlanContractModal.test.tsx
// Testes do modal de contratação de plano (components/patient-portal/PlanContractModal.tsx).
// Sem teste antes desta auditoria (docs/test-audit/cliente-planos-assinaturas.md).

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PlanContractModal } from '../../../components/patient-portal/PlanContractModal';
import type { PlanForCard } from '../../../components/patient-portal/PlanCard';

const PLAN: PlanForCard = {
  id: 'plan-1',
  name: 'Plano Facial Mensal',
  price: 199.9,
  description: 'Cuidados faciais completos',
  imageUrl: null,
  items: [{ procedureId: 'proc-1', procedureName: 'Limpeza de Pele', sessionsPerCycle: 2 }],
};

function renderModal(onConfirm = vi.fn().mockResolvedValue(undefined)) {
  const onClose = vi.fn();
  render(
    <PlanContractModal
      plan={PLAN}
      primaryColor="#8b5cf6"
      cardBg="#fff"
      cardText="#1e293b"
      borderColor="#eee"
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
  return { onClose, onConfirm };
}

describe('components/patient-portal/PlanContractModal', () => {
  it('exibe nome, preço e procedimentos inclusos do plano', () => {
    renderModal();
    expect(screen.getByText('Plano Facial Mensal')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*199,90/)).toBeInTheDocument();
    expect(screen.getByText('Limpeza de Pele')).toBeInTheDocument();
    expect(screen.getByText('2x por mês')).toBeInTheDocument();
  });

  it('avisa que o pagamento é combinado com a clínica via WhatsApp/telefone', () => {
    renderModal();
    expect(screen.getByText(/pagamento é combinado diretamente com a clínica/i)).toBeInTheDocument();
  });

  it('botão Cancelar chama onClose sem chamar onConfirm', () => {
    const { onClose, onConfirm } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('botão Confirmar Plano chama onConfirm, mostra "Aguarde..." durante o loading e volta ao normal ao concluir', async () => {
    let resolveConfirm: () => void = () => {};
    const onConfirm = vi.fn().mockImplementation(() => new Promise<void>((resolve) => { resolveConfirm = resolve; }));
    renderModal(onConfirm);

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Plano' }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(await screen.findByRole('button', { name: 'Aguarde...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();

    resolveConfirm();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmar Plano' })).not.toBeDisabled());
  });

  it('reabilita os botões mesmo se onConfirm rejeitar (erro de rede/API)', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('falha de rede'));
    renderModal(onConfirm);

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Plano' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmar Plano' })).not.toBeDisabled());
    expect(screen.getByRole('button', { name: 'Cancelar' })).not.toBeDisabled();
  });

  it('clicar no backdrop chama onClose', () => {
    const onClose = vi.fn();
    render(
      <PlanContractModal
        plan={PLAN}
        primaryColor="#8b5cf6"
        cardBg="#fff"
        cardText="#1e293b"
        borderColor="#eee"
        onClose={onClose}
        onConfirm={vi.fn()}
      />
    );
    const backdrop = document.querySelector('.bg-black\\/50');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop as Element);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
