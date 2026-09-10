// __tests__/components/SignatureModal.test.tsx
// Testes de componente do SignatureModal (components/Modals.tsx)

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Estado compartilhado do canvas mockado (react-signature-canvas usa <canvas>
// real, que não funciona de forma útil no jsdom).
const sig = vi.hoisted(() => ({ empty: true }));

vi.mock('react-signature-canvas', async () => {
  const ReactMod = await import('react');
  const Mock = ReactMod.forwardRef(
    (props: { onEnd?: () => void }, ref: React.Ref<unknown>) => {
      ReactMod.useImperativeHandle(ref, () => ({
        getCanvas: () => document.createElement('canvas'),
        isEmpty: () => sig.empty,
        clear: () => {
          sig.empty = true;
        },
        toDataURL: () => 'data:image/png;base64,ASSINATURA',
      }));
      return ReactMod.createElement('canvas', {
        'data-testid': 'sig-canvas',
        onClick: () => {
          sig.empty = false;
          props.onEnd?.();
        },
      });
    }
  );
  return { default: Mock };
});

import { SignatureModal } from '../../components/Modals';

const confirmBtn = () => screen.getByRole('button', { name: /Confirmar Assinatura/i });
const clearBtn = () => screen.getByRole('button', { name: /Limpar/i });
const drawSignature = () => fireEvent.click(screen.getByTestId('sig-canvas'));

beforeEach(() => {
  vi.clearAllMocks();
  sig.empty = true;
});

describe('SignatureModal — assinatura normal', () => {
  it('mantém "Confirmar" desabilitado com o canvas vazio', () => {
    render(<SignatureModal onClose={vi.fn()} onSave={vi.fn()} />);
    expect(confirmBtn()).toBeDisabled();
  });

  it('habilita "Confirmar" depois de desenhar', () => {
    render(<SignatureModal onClose={vi.fn()} onSave={vi.fn()} />);
    drawSignature();
    expect(confirmBtn()).toBeEnabled();
  });

  it('"Limpar" volta a desabilitar "Confirmar"', () => {
    render(<SignatureModal onClose={vi.fn()} onSave={vi.fn()} />);
    drawSignature();
    expect(confirmBtn()).toBeEnabled();
    fireEvent.click(clearBtn());
    expect(confirmBtn()).toBeDisabled();
  });

  it('ao confirmar, chama onSave com o dataURL e sem motivo, e fecha', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(<SignatureModal onClose={onClose} onSave={onSave} />);
    drawSignature();
    fireEvent.click(confirmBtn());
    expect(onSave).toHaveBeenCalledWith('data:image/png;base64,ASSINATURA', undefined);
    expect(onClose).toHaveBeenCalled();
  });
});

describe('SignatureModal — modo correção', () => {
  it('mesmo com assinatura desenhada, "Confirmar" só habilita com motivo de 3+ caracteres', () => {
    render(<SignatureModal onClose={vi.fn()} onSave={vi.fn()} isCorrection />);
    drawSignature();
    expect(confirmBtn()).toBeDisabled();

    const reason = screen.getByPlaceholderText(/assinatura ilegível/i);
    fireEvent.change(reason, { target: { value: 'ab' } });
    expect(confirmBtn()).toBeDisabled();

    fireEvent.change(reason, { target: { value: 'ilegível' } });
    expect(confirmBtn()).toBeEnabled();
  });

  it('ao confirmar em modo correção, repassa o motivo (trim) para onSave', () => {
    const onSave = vi.fn();
    render(<SignatureModal onClose={vi.fn()} onSave={onSave} isCorrection />);
    drawSignature();
    fireEvent.change(screen.getByPlaceholderText(/assinatura ilegível/i), { target: { value: '  pessoa errada  ' } });
    fireEvent.click(confirmBtn());
    expect(onSave).toHaveBeenCalledWith('data:image/png;base64,ASSINATURA', 'pessoa errada');
  });
});
