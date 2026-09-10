// __tests__/pages/AccessLink.test.tsx
// Testes de componente da aba "Agenda Online" (pages/AccessLink.tsx) — tela de
// configuração do link público de agendamento: exibição/cópia do link, regras
// de horário (onlineBookingConfig), gate de role para o layout, reset e presets.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UserRole } from '../../types';

const render = (ui: React.ReactElement) =>
  rtlRender(ui, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });

const updateCompany = vi.fn();
const setHasUnsavedChanges = vi.fn();
const showAlert = vi.fn();
const clipboardWriteText = vi.fn();

type LayoutConfig = Record<string, string | undefined>;
type OnlineConfig = Record<string, number | string | undefined>;
type Company = {
  id: string;
  slug?: string;
  layoutConfig?: LayoutConfig;
  onlineBookingConfig?: OnlineConfig;
};

const appState: {
  currentCompany: Company | null;
  user: { id: string; role: UserRole } | null;
} = {
  currentCompany: null,
  user: { id: 'u1', role: UserRole.ADMIN },
};

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({
    currentCompany: appState.currentCompany,
    user: appState.user,
    updateCompany,
    setHasUnsavedChanges,
  }),
}));

vi.mock('../../context/DialogContext', () => ({
  useDialog: () => ({ showAlert, confirm: vi.fn() }),
}));

import AccessLink from '../../pages/AccessLink';

function company(over: Partial<Company> = {}): Company {
  return {
    id: 'c1',
    slug: 'clinica-teste',
    layoutConfig: undefined,
    onlineBookingConfig: undefined,
    ...over,
  };
}

const DEFAULT_LAYOUT = {
  backgroundColor: '#fdfcfb',
  primaryColor: '#bd7b65',
  textColor: '#1c1917',
};

// "Aura Premium" preset (STYLE_PRESETS[0].config)
const AURA_PRESET = {
  backgroundColor: '#fdfcfb',
  primaryColor: '#bd7b65',
  headerBackgroundColor: '#f5ebe0',
};
// "Midnight Gold" preset (STYLE_PRESETS[1].config)
const MIDNIGHT_PRESET = {
  backgroundColor: '#0a0a0a',
  primaryColor: '#d4af37',
};

function openScheduleAccordion() {
  fireEvent.click(screen.getByText('Configurações de Horários dos Clientes'));
}
function openLayoutAccordion() {
  fireEvent.click(screen.getByText('Configurar Layout de Acesso Público'));
}
function selectByLabel(labelText: string): HTMLSelectElement {
  const label = screen.getByText(labelText);
  const select = label.parentElement?.querySelector('select');
  if (!select) throw new Error(`<select> não encontrado para o label "${labelText}"`);
  return select as HTMLSelectElement;
}
function colorTextInput(labelText: string): HTMLInputElement {
  const label = screen.getByText(labelText);
  const input = label.parentElement?.querySelector('input[type="text"]');
  if (!input) throw new Error(`input de texto de cor não encontrado para "${labelText}"`);
  return input as HTMLInputElement;
}
function colorPickerInput(labelText: string): HTMLInputElement {
  const label = screen.getByText(labelText);
  const input = label.parentElement?.querySelector('input[type="color"]');
  if (!input) throw new Error(`input de cor não encontrado para "${labelText}"`);
  return input as HTMLInputElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  appState.currentCompany = company();
  appState.user = { id: 'u1', role: UserRole.ADMIN };
  updateCompany.mockResolvedValue({ success: true });
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: clipboardWriteText },
    configurable: true,
    writable: true,
  });
});

describe('pages/AccessLink — link público', () => {
  it('exibe o link como origin + "/" + slug', () => {
    render(<AccessLink />);
    const expected = `${window.location.origin}/clinica-teste`;
    expect(screen.getByDisplayValue(expected)).toBeInTheDocument();
  });

  it('cai no id da empresa quando não há slug', () => {
    appState.currentCompany = company({ slug: undefined });
    render(<AccessLink />);
    expect(screen.getByDisplayValue(`${window.location.origin}/c1`)).toBeInTheDocument();
  });

  it('clicar em "Copiar" chama navigator.clipboard.writeText com o link certo', () => {
    render(<AccessLink />);
    fireEvent.click(screen.getByRole('button', { name: /Copiar/i }));
    expect(clipboardWriteText).toHaveBeenCalledWith(`${window.location.origin}/clinica-teste`);
  });
});

describe('pages/AccessLink — regras de horário (onlineBookingConfig)', () => {
  it('alterar os selects e "Salvar Regras" chama updateCompany com o onlineBookingConfig completo', async () => {
    render(<AccessLink />);
    openScheduleAccordion();

    fireEvent.change(selectByLabel('Intervalo de Horários'), { target: { value: '15' } });
    fireEvent.change(selectByLabel('Tempo de Antecedência Mínimo'), { target: { value: '1440' } });
    fireEvent.change(selectByLabel('Até quantos dias à frente o cliente pode agendar'), { target: { value: '60' } });
    fireEvent.change(selectByLabel('Antecedência mínima para cancelamento'), { target: { value: '720' } });

    fireEvent.click(screen.getByRole('button', { name: /Salvar Regras/i }));

    await waitFor(() => expect(updateCompany).toHaveBeenCalledTimes(1));
    expect(updateCompany).toHaveBeenCalledWith('c1', {
      onlineBookingConfig: {
        slotInterval: 15,
        minAdvanceTime: 1440,
        maxBookingPeriod: 60,
        cancellationNotice: 720,
        cancellationPolicy: '',
      },
    });
  });

  it('quando updateCompany retorna { success: false }, mostra showAlert com a mensagem', async () => {
    updateCompany.mockResolvedValue({ success: false, error: 'Falha ao salvar regras.' });
    render(<AccessLink />);
    openScheduleAccordion();

    fireEvent.click(screen.getByRole('button', { name: /Salvar Regras/i }));

    await waitFor(() => expect(showAlert).toHaveBeenCalledWith('Falha ao salvar regras.', expect.anything()));
  });
});

describe('pages/AccessLink — gate de role para o layout', () => {
  it('RECEPTIONIST não vê a seção de layout, mas vê o link e as regras de horário', () => {
    appState.user = { id: 'u3', role: UserRole.RECEPTIONIST };
    render(<AccessLink />);

    expect(screen.queryByText('Configurar Layout de Acesso Público')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue(`${window.location.origin}/clinica-teste`)).toBeInTheDocument();
    expect(screen.getByText('Configurações de Horários dos Clientes')).toBeInTheDocument();
  });

  it('ESTHETICIAN também não vê a seção de layout', () => {
    appState.user = { id: 'u4', role: UserRole.ESTHETICIAN };
    render(<AccessLink />);
    expect(screen.queryByText('Configurar Layout de Acesso Público')).not.toBeInTheDocument();
  });

  it('ADMIN vê a seção de layout', () => {
    render(<AccessLink />);
    expect(screen.getByText('Configurar Layout de Acesso Público')).toBeInTheDocument();
  });
});

describe('pages/AccessLink — reset de layout', () => {
  it('sucesso: volta os campos para o defaultLayout e mostra a mensagem', async () => {
    appState.currentCompany = company({
      layoutConfig: { backgroundColor: '#0a0a0a', primaryColor: '#d4af37', headerBackgroundColor: '#171717' },
    });
    render(<AccessLink />);
    openLayoutAccordion();

    expect(colorTextInput('Cor de Fundo Página').value).toBe('#0a0a0a');

    fireEvent.click(screen.getByRole('button', { name: /Resetar/i }));

    await waitFor(() =>
      expect(updateCompany).toHaveBeenCalledWith('c1', { layoutConfig: undefined })
    );
    await waitFor(() =>
      expect(colorTextInput('Cor de Fundo Página').value).toBe(DEFAULT_LAYOUT.backgroundColor)
    );
    expect(screen.getByText('Layout restaurado para o padrão.')).toBeInTheDocument();
  });

  it('erro: mostra showAlert e não altera os campos', async () => {
    updateCompany.mockResolvedValue({ success: false, error: 'Erro no reset.' });
    appState.currentCompany = company({
      layoutConfig: { backgroundColor: '#0a0a0a', primaryColor: '#d4af37' },
    });
    render(<AccessLink />);
    openLayoutAccordion();

    fireEvent.click(screen.getByRole('button', { name: /Resetar/i }));

    await waitFor(() => expect(showAlert).toHaveBeenCalledWith('Erro no reset.', expect.anything()));
    expect(colorTextInput('Cor de Fundo Página').value).toBe('#0a0a0a');
  });
});

describe('pages/AccessLink — presets de layout', () => {
  it('aplicar um preset atualiza os inputs de cor e marca hasUnsavedChanges', () => {
    render(<AccessLink />);
    openLayoutAccordion();

    fireEvent.click(screen.getByRole('button', { name: /Midnight Gold/i }));

    expect(colorPickerInput('Cor Principal (Destaque)').value).toBe(MIDNIGHT_PRESET.primaryColor);
    expect(colorTextInput('Cor de Fundo Página').value).toBe(MIDNIGHT_PRESET.backgroundColor);
    expect(setHasUnsavedChanges).toHaveBeenCalledWith(true);
  });

  it('isPresetActive: 3 cores batendo mas fontFamily diferente ainda marca "Em uso" (fragilidade documentada)', () => {
    appState.currentCompany = company({
      layoutConfig: { ...AURA_PRESET, fontFamily: 'serif' }, // preset Aura usa fontFamily 'inter'
    });
    render(<AccessLink />);
    openLayoutAccordion();

    const auraButton = screen.getByRole('button', { name: /Aura Premium/i });
    expect(within(auraButton).getByText('Em uso')).toBeInTheDocument();
  });
});
