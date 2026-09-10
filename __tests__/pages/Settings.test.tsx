// __tests__/pages/Settings.test.tsx
// Testes de componente da aba "Configurações" (pages/Settings.tsx) — Perfil do
// Negócio, seção Google Calendar e renderização condicional do WhatsApp.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UserRole } from '../../types';

const render = (ui: React.ReactElement) =>
  rtlRender(ui, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });

const updateCompany = vi.fn();
const checkModuleAccess = vi.fn((_module?: string): boolean => false);

type Company = {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  logo: string;
  cnpj: string;
  presentation: string;
  phones: string[];
  targetAudience: { female: boolean; male: boolean; kids: boolean };
  socialMedia: { website: string; facebook: string; instagram: string };
  plan: string;
  subscriptionExpiresAt: string;
};

const appState: { currentCompany: Company | null; user: { id: string; role: UserRole } } = {
  currentCompany: null,
  user: { id: 'u1', role: UserRole.ADMIN },
};

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({
    currentCompany: appState.currentCompany,
    user: appState.user,
    updateCompany,
    setHasUnsavedChanges: vi.fn(),
    triggerSave: false,
    setTriggerSave: vi.fn(),
    pendingNavigationPath: null as string | null,
    setPendingNavigationPath: vi.fn(),
    setIsSubscriptionModalOpen: vi.fn(),
    checkModuleAccess,
  }),
}));

const getStatus = vi.fn();
const sync = vi.fn();
const connect = vi.fn();
const disconnect = vi.fn();
vi.mock('../../services/api', () => ({
  calendarApi: {
    getStatus: (...a: unknown[]) => getStatus(...a),
    sync: (...a: unknown[]) => sync(...a),
    connect: (...a: unknown[]) => connect(...a),
    disconnect: (...a: unknown[]) => disconnect(...a),
  },
}));

vi.mock('../../components/WhatsAppSettings', () => ({
  default: () => <div>WHATSAPP_SETTINGS_STUB</div>,
}));

import Settings from '../../pages/Settings';

function company(over: Partial<Company> = {}): Company {
  return {
    id: 'c1',
    name: 'Clínica Bella',
    address: 'Rua das Flores, 100',
    city: 'São Paulo',
    state: 'SP',
    logo: '',
    cnpj: '',
    presentation: 'A melhor clínica.',
    phones: ['(11) 98888-7777'],
    targetAudience: { female: true, male: false, kids: false },
    socialMedia: { website: 'https://bella.com', facebook: '', instagram: '' },
    plan: 'premium',
    subscriptionExpiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  appState.currentCompany = company();
  appState.user = { id: 'u1', role: UserRole.ADMIN };
  checkModuleAccess.mockReturnValue(false);
  updateCompany.mockResolvedValue({ success: true, company: company() });
  getStatus.mockResolvedValue({ success: true, data: { connected: false } });
  sync.mockResolvedValue({ success: true, data: { synced: 0 } });
  disconnect.mockResolvedValue({ success: true });
  vi.stubGlobal('scrollTo', vi.fn());
});

describe('pages/Settings — Perfil do Negócio', () => {
  it('popula os campos a partir de currentCompany', () => {
    appState.currentCompany = company({ cnpj: '11.222.333/0001-81', name: 'Clínica Aurora' });
    render(<Settings />);

    expect(screen.getByDisplayValue('Clínica Aurora')).toBeInTheDocument();
    expect(screen.getByDisplayValue('11.222.333/0001-81')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Rua das Flores, 100')).toBeInTheDocument();
    expect(screen.getByDisplayValue('A melhor clínica.')).toBeInTheDocument();
    expect(screen.getByDisplayValue('(11) 98888-7777')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://bella.com')).toBeInTheDocument();
  });

  it('CNPJ inválido bloqueia o submit: mostra erro e NÃO chama updateCompany', async () => {
    render(<Settings />);

    fireEvent.change(screen.getByPlaceholderText('00.000.000/0000-00'), {
      target: { value: '11.111.111/1111-11' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Salvar Alterações/i }));

    expect(await screen.findByText(/CNPJ\/CPF inválido/i)).toBeInTheDocument();
    expect(updateCompany).not.toHaveBeenCalled();
  });

  it('submit válido chama updateCompany (telefones vazios filtrados) e mostra sucesso', async () => {
    render(<Settings />);

    // adiciona um telefone vazio que deve ser descartado no envio
    fireEvent.click(screen.getByText(/Adicionar Telefone/i));
    fireEvent.click(screen.getByRole('button', { name: /Salvar Alterações/i }));

    await waitFor(() => expect(updateCompany).toHaveBeenCalledTimes(1));
    const [id, payload] = updateCompany.mock.calls[0];
    expect(id).toBe('c1');
    expect(payload.phones).toEqual(['(11) 98888-7777']);
    expect(await screen.findByText('Configurações salvas com sucesso!')).toBeInTheDocument();
  });

  it('erro retornado por updateCompany é exibido ao usuário', async () => {
    updateCompany.mockResolvedValue({ success: false, error: 'Nome do negócio já em uso.' });
    render(<Settings />);

    fireEvent.click(screen.getByRole('button', { name: /Salvar Alterações/i }));

    expect(await screen.findByText('Nome do negócio já em uso.')).toBeInTheDocument();
  });

  it('addPhone/removePhone nunca deixam a lista de telefones vazia', () => {
    const { container } = render(<Settings />);
    const phoneInputs = () => container.querySelectorAll('input[placeholder="(DDD) 99999-9999"]');

    expect(phoneInputs()).toHaveLength(1);

    fireEvent.click(screen.getByText(/Adicionar Telefone/i));
    expect(phoneInputs()).toHaveLength(2);

    // remove um: volta para 1 (nunca 0)
    const removeBtn = container.querySelector('button.text-red-500') as HTMLButtonElement;
    fireEvent.click(removeBtn);
    expect(phoneInputs()).toHaveLength(1);
  });
});

describe('pages/Settings — WhatsApp condicional ao módulo do plano', () => {
  it('renderiza WhatsAppSettings quando checkModuleAccess("whatsapp_notifications") é true', () => {
    checkModuleAccess.mockImplementation((m?: string) => m === 'whatsapp_notifications');
    render(<Settings />);
    expect(screen.getByText('WHATSAPP_SETTINGS_STUB')).toBeInTheDocument();
  });

  it('não renderiza WhatsAppSettings quando o módulo não está disponível', () => {
    checkModuleAccess.mockReturnValue(false);
    render(<Settings />);
    expect(screen.queryByText('WHATSAPP_SETTINGS_STUB')).not.toBeInTheDocument();
  });
});

describe('pages/Settings — seção Google Calendar', () => {
  it('mostra "Conectar Google Calendar" quando getStatus retorna connected: false', async () => {
    getStatus.mockResolvedValue({ success: true, data: { connected: false } });
    render(<Settings />);
    expect(await screen.findByRole('button', { name: /Conectar Google Calendar/i })).toBeInTheDocument();
  });

  it('mostra o estado conectado + botão "Desconectar" quando getStatus retorna connected: true', async () => {
    getStatus.mockResolvedValue({ success: true, data: { connected: true } });
    render(<Settings />);
    expect(await screen.findByText(/Google Calendar conectado/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Desconectar$/i })).toBeInTheDocument();
  });
});
