// __tests__/components/BusinessHoursEditor.test.tsx
// Testes do editor de horário de funcionamento (empresa e profissional).

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BusinessHoursEditor, isDayRangeInvalid } from '../../components/BusinessHoursEditor';
import type { BusinessHours } from '../../types';

const DAY = { isOpen: true, start: '08:00', end: '18:00' };
const fullHours = (): BusinessHours => ({
  monday: { ...DAY },
  tuesday: { ...DAY },
  wednesday: { ...DAY },
  thursday: { ...DAY },
  friday: { ...DAY },
  saturday: { isOpen: true, start: '09:00', end: '13:00' },
  sunday: { isOpen: false, start: '00:00', end: '00:00' },
});

const DAY_LABELS = [
  'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira',
  'Sexta-feira', 'Sábado', 'Domingo',
];

let onChange: import('vitest').Mock<(newValue: BusinessHours) => void>;

beforeEach(() => {
  onChange = vi.fn<(newValue: BusinessHours) => void>();
});

describe('components/BusinessHoursEditor', () => {
  it('renderiza os 7 dias da semana', () => {
    render(<BusinessHoursEditor value={fullHours()} onChange={onChange} />);
    for (const label of DAY_LABELS) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('dia fechado (isOpen: false) desabilita os inputs de horário', () => {
    render(<BusinessHoursEditor value={fullHours()} onChange={onChange} />);
    expect(screen.getByLabelText('Domingo horário de abertura')).toBeDisabled();
    expect(screen.getByLabelText('Domingo horário de fechamento')).toBeDisabled();
    // Segunda (aberto) permanece habilitado
    expect(screen.getByLabelText('Segunda-feira horário de abertura')).toBeEnabled();
  });

  it('marcar um dia aberto como fechado dispara onChange com isOpen: false', () => {
    render(<BusinessHoursEditor value={fullHours()} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Segunda-feira aberto'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].monday.isOpen).toBe(false);
    // demais dias preservados
    expect(onChange.mock.calls[0][0].tuesday).toEqual(DAY);
  });

  it('alterar o horário de abertura dispara onChange com o objeto completo atualizado', () => {
    render(<BusinessHoursEditor value={fullHours()} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Terça-feira horário de abertura'), { target: { value: '10:00' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    const updated = onChange.mock.calls[0][0] as BusinessHours;
    expect(updated.tuesday).toEqual({ isOpen: true, start: '10:00', end: '18:00' });
    expect(updated.monday).toEqual(DAY);
  });

  it('quando um dia vem ausente no value, usa o horário padrão (safeValue)', () => {
    const partial = { ...fullHours() } as Partial<BusinessHours>;
    delete partial.wednesday;
    render(<BusinessHoursEditor value={partial as BusinessHours} onChange={onChange} />);
    // padrão de quarta: aberto 08:00–18:00
    expect(screen.getByLabelText('Quarta-feira horário de abertura')).toHaveValue('08:00');
    expect(screen.getByLabelText('Quarta-feira horário de fechamento')).toHaveValue('18:00');
  });

  it('start >= end num dia aberto: marca os campos como inválidos e mostra aviso, mas ainda chama onChange', () => {
    const invalid = fullHours();
    invalid.monday = { isOpen: true, start: '18:00', end: '08:00' };
    render(<BusinessHoursEditor value={invalid} onChange={onChange} />);

    const startInput = screen.getByLabelText('Segunda-feira horário de abertura');
    const endInput = screen.getByLabelText('Segunda-feira horário de fechamento');
    expect(startInput).toHaveAttribute('aria-invalid', 'true');
    expect(endInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent(/abertura deve ser menor que o de fechamento/i);

    // A validação forte é no backend — o editor não bloqueia a edição
    fireEvent.change(endInput, { target: { value: '19:00' } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('dia FECHADO com start >= end não é marcado como inválido', () => {
    const hours = fullHours();
    hours.sunday = { isOpen: false, start: '23:00', end: '01:00' };
    render(<BusinessHoursEditor value={hours} onChange={onChange} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('disabled=true desabilita também os checkboxes', () => {
    render(<BusinessHoursEditor value={fullHours()} onChange={onChange} disabled />);
    expect(screen.getByLabelText('Segunda-feira aberto')).toBeDisabled();
  });
});

describe('isDayRangeInvalid (helper puro)', () => {
  it('dia aberto com start >= end → true', () => {
    expect(isDayRangeInvalid({ isOpen: true, start: '18:00', end: '08:00' })).toBe(true);
    expect(isDayRangeInvalid({ isOpen: true, start: '09:00', end: '09:00' })).toBe(true);
  });
  it('dia aberto com start < end → false', () => {
    expect(isDayRangeInvalid({ isOpen: true, start: '08:00', end: '18:00' })).toBe(false);
  });
  it('dia fechado → sempre false', () => {
    expect(isDayRangeInvalid({ isOpen: false, start: '18:00', end: '08:00' })).toBe(false);
  });
});
