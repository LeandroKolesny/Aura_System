// __tests__/components/patient-portal/PlanProcedurePickerModal.test.tsx
// Testes do seletor de procedimentos de um plano ao agendar
// (components/patient-portal/PlanProcedurePickerModal.tsx), usado por
// pages/PublicBooking.tsx (fora do escopo desta auditoria — aqui testamos só
// o componente em si). Sem teste antes desta auditoria.

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlanProcedurePickerModal } from '../../../components/patient-portal/PlanProcedurePickerModal';

const ITEMS = [
  { procedureId: 'proc-1', procedureName: 'Limpeza de Pele', sessionsPerCycle: 2, sessionsRemaining: 1 },
  { procedureId: 'proc-2', procedureName: 'Peeling', sessionsPerCycle: 1, sessionsRemaining: 0 },
  { procedureId: 'proc-3', procedureName: 'Massagem', sessionsPerCycle: 4, sessionsRemaining: -1 },
];

function renderModal(items = ITEMS) {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  render(
    <PlanProcedurePickerModal
      planName="Plano Facial"
      items={items}
      primaryColor="#8b5cf6"
      cardBg="#fff"
      cardText="#1e293b"
      borderColor="#eee"
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
  return { onConfirm, onClose };
}

describe('components/patient-portal/PlanProcedurePickerModal', () => {
  it('mostra "restante(s)" quando sessionsRemaining >= 0', () => {
    renderModal();
    expect(screen.getByText('1 restante')).toBeInTheDocument();
  });

  it('mostra "Sem sessões" e desabilita o item quando sessionsRemaining === 0', () => {
    renderModal();
    const button = screen.getByText('Peeling').closest('button')!;
    expect(button).toBeDisabled();
    expect(screen.getByText('Sem sessões')).toBeInTheDocument();
  });

  it('sessionsRemaining === -1 (plano ainda não ativo): mostra "Nx/mês" em vez de contagem, e item fica habilitado', () => {
    renderModal();
    expect(screen.getByText('4x/mês')).toBeInTheDocument();
    const button = screen.getByText('Massagem').closest('button')!;
    expect(button).not.toBeDisabled();
  });

  it('clicar em um item habilitado seleciona/desseleciona (toggle) e não chama onConfirm sozinho', () => {
    const { onConfirm } = renderModal();
    const button = screen.getByText('Limpeza de Pele').closest('button')!;
    fireEvent.click(button);
    expect(screen.getByRole('button', { name: /Confirmar \(1\)/ })).toBeInTheDocument();
    fireEvent.click(button);
    expect(screen.getByRole('button', { name: /Confirmar \(0\)/ })).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('clicar num item sem sessões (disabled) não seleciona nada', () => {
    renderModal();
    const button = screen.getByText('Peeling').closest('button')!;
    fireEvent.click(button);
    expect(screen.getByRole('button', { name: /Confirmar \(0\)/ })).toBeInTheDocument();
  });

  it('botão Confirmar fica desabilitado com zero selecionados, habilita com >=1 e chama onConfirm com os ids selecionados', () => {
    const { onConfirm } = renderModal();
    const confirmBtn = () => screen.getByRole('button', { name: /Confirmar/ });
    expect(confirmBtn()).toBeDisabled();

    fireEvent.click(screen.getByText('Limpeza de Pele').closest('button')!);
    fireEvent.click(screen.getByText('Massagem').closest('button')!);
    expect(confirmBtn()).not.toBeDisabled();

    fireEvent.click(confirmBtn());
    expect(onConfirm).toHaveBeenCalledWith(['proc-1', 'proc-3']);
  });

  it('botão Cancelar chama onClose', () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
