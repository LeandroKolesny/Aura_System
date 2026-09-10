// __tests__/components/WhatsAppSettings.test.tsx
// Testes de componente da integração WhatsApp (components/WhatsAppSettings.tsx),
// renderizada dentro da aba "Configurações".

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UserRole } from '../../types';

const getStatus = vi.fn();
const connect = vi.fn();
const disconnect = vi.fn();
const setChatbotEnabled = vi.fn();

vi.mock('../../services/api', () => ({
  whatsappApi: {
    getStatus: (...a: unknown[]) => getStatus(...a),
    connect: (...a: unknown[]) => connect(...a),
    disconnect: (...a: unknown[]) => disconnect(...a),
    setChatbotEnabled: (...a: unknown[]) => setChatbotEnabled(...a),
  },
}));

const appState: { user: { role: UserRole } } = { user: { role: UserRole.ADMIN } };
vi.mock('../../context/AppContext', () => ({
  useApp: () => ({ user: appState.user, currentCompany: { name: 'Clínica X' } }),
}));

const confirm = vi.fn();
const showAlert = vi.fn();
vi.mock('../../context/DialogContext', () => ({
  useDialog: () => ({ confirm, showAlert }),
}));

import WhatsAppSettings from '../../components/WhatsAppSettings';

async function openAccordion() {
  (await screen.findByText('WhatsApp — Confirmações')).click();
}

beforeEach(() => {
  vi.clearAllMocks();
  appState.user = { role: UserRole.ADMIN };
  getStatus.mockResolvedValue({ success: true, data: { status: 'DISCONNECTED', termsAccepted: false } });
  connect.mockResolvedValue({ success: true, data: { qrCode: 'data:image/png;base64,qr', status: 'CONNECTING' } });
  disconnect.mockResolvedValue({ success: true });
  setChatbotEnabled.mockResolvedValue({ success: true, data: { chatbotEnabled: true } });
});

describe('components/WhatsAppSettings — conectar', () => {
  it('"Conectar WhatsApp" fica desabilitado sem aceitar os termos e habilita ao aceitar', async () => {
    render(<WhatsAppSettings />);
    await openAccordion();

    const btn = await screen.findByRole('button', { name: /Conectar WhatsApp/i });
    expect(btn).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox'));
    expect(btn).toBeEnabled();
  });

  it('handleConnect chama whatsappApi.connect(true) e exibe o QR Code retornado', async () => {
    render(<WhatsAppSettings />);
    await openAccordion();

    fireEvent.click(await screen.findByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Conectar WhatsApp/i }));

    await waitFor(() => expect(connect).toHaveBeenCalledWith(true));
    expect(await screen.findByAltText('QR Code WhatsApp')).toHaveAttribute('src', 'data:image/png;base64,qr');
  });

  it('erro ao conectar chama showAlert e não transiciona para CONNECTING', async () => {
    connect.mockResolvedValue({ success: false, error: 'Sem permissão' });
    render(<WhatsAppSettings />);
    await openAccordion();

    fireEvent.click(await screen.findByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Conectar WhatsApp/i }));

    await waitFor(() => expect(showAlert).toHaveBeenCalledWith('Sem permissão', expect.objectContaining({ variant: 'danger' })));
    expect(screen.queryByAltText('QR Code WhatsApp')).not.toBeInTheDocument();
  });
});

describe('components/WhatsAppSettings — desconectar', () => {
  beforeEach(() => {
    getStatus.mockResolvedValue({
      success: true,
      data: { status: 'CONNECTED', phoneNumber: '5511999990000', chatbotEnabled: false, termsAccepted: true },
    });
  });

  it('handleDisconnect abre o confirm() do DialogContext e NÃO chama disconnect se cancelado', async () => {
    confirm.mockResolvedValue(false);
    render(<WhatsAppSettings />);
    await openAccordion();

    fireEvent.click(await screen.findByRole('button', { name: /Desconectar WhatsApp/i }));

    await waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(disconnect).not.toHaveBeenCalled();
  });

  it('confirma → chama whatsappApi.disconnect()', async () => {
    confirm.mockResolvedValue(true);
    render(<WhatsAppSettings />);
    await openAccordion();

    fireEvent.click(await screen.findByRole('button', { name: /Desconectar WhatsApp/i }));

    await waitFor(() => expect(disconnect).toHaveBeenCalledTimes(1));
  });
});

describe('components/WhatsAppSettings — chatbot', () => {
  beforeEach(() => {
    getStatus.mockResolvedValue({
      success: true,
      data: { status: 'CONNECTED', phoneNumber: '5511999990000', chatbotEnabled: false, termsAccepted: true },
    });
  });

  it('toggle chama setChatbotEnabled com o valor invertido', async () => {
    render(<WhatsAppSettings />);
    await openAccordion();

    const toggle = await screen.findByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(toggle);

    await waitFor(() => expect(setChatbotEnabled).toHaveBeenCalledWith(true));
    await waitFor(() => expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true'));
  });

  it('erro no toggle chama showAlert', async () => {
    setChatbotEnabled.mockResolvedValue({ success: false, error: 'Erro ao atualizar o chatbot.' });
    render(<WhatsAppSettings />);
    await openAccordion();

    fireEvent.click(await screen.findByRole('switch'));

    await waitFor(() =>
      expect(showAlert).toHaveBeenCalledWith('Erro ao atualizar o chatbot.', expect.objectContaining({ variant: 'danger' }))
    );
  });
});

describe('components/WhatsAppSettings — sem permissão (canManage falso)', () => {
  it('RECEPTIONIST não vê o botão "Conectar WhatsApp" quando DISCONNECTED', async () => {
    appState.user = { role: UserRole.RECEPTIONIST };
    render(<WhatsAppSettings />);
    await openAccordion();

    expect(await screen.findByText(/Apenas administradores podem configurar o WhatsApp/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Conectar WhatsApp/i })).not.toBeInTheDocument();
  });

  it('RECEPTIONIST não vê "Desconectar WhatsApp" nem o toggle de chatbot quando CONNECTED', async () => {
    appState.user = { role: UserRole.RECEPTIONIST };
    getStatus.mockResolvedValue({
      success: true,
      data: { status: 'CONNECTED', phoneNumber: '5511999990000', chatbotEnabled: true, termsAccepted: true },
    });
    render(<WhatsAppSettings />);
    await openAccordion();

    await screen.findByText('WhatsApp conectado!');
    expect(screen.queryByRole('button', { name: /Desconectar WhatsApp/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });
});
