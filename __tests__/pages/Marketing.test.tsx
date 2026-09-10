// __tests__/pages/Marketing.test.tsx
// Testes de componente da aba "Marketing & IA" (pages/Marketing.tsx)

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UserRole } from '../../types';

const render = (ui: React.ReactElement) =>
  rtlRender(ui, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });

// ---- mocks ----
const updatePatient = vi.fn();
const updateCompany = vi.fn();
const checkModuleAccess = vi.fn(() => true);
const showAlert = vi.fn();
const genReturn = vi.fn(async () => 'Olá! Sentimos sua falta 💙');
const genBirthday = vi.fn(async () => 'Feliz aniversário!');
const genRetention = vi.fn(async () => 'Renove seu plano Pro');

type St = {
  patients: unknown[];
  appointments: unknown[];
  procedures: unknown[];
  companies: unknown[];
  saasPlans: unknown[];
  currentCompany: unknown;
  isReadOnly: boolean;
  loadingStates: Record<string, boolean>;
  user: { id: string; role: UserRole; companyId: string | null };
};

const st: St = {
  patients: [],
  appointments: [],
  procedures: [],
  companies: [],
  saasPlans: [],
  currentCompany: { id: 'c1', name: 'Clínica X' },
  isReadOnly: false,
  loadingStates: { patients: false, appointments: false, procedures: false },
  user: { id: 'u1', role: UserRole.ADMIN, companyId: 'c1' },
};

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({
    patients: st.patients,
    appointments: st.appointments,
    procedures: st.procedures,
    companies: st.companies,
    saasPlans: st.saasPlans,
    currentCompany: st.currentCompany,
    isReadOnly: st.isReadOnly,
    loadingStates: st.loadingStates,
    user: st.user,
    updatePatient,
    updateCompany,
    checkModuleAccess,
    loadPatients: vi.fn(),
    loadAppointments: vi.fn(),
    loadProcedures: vi.fn(),
  }),
}));
vi.mock('../../context/DialogContext', () => ({
  useDialog: () => ({ showAlert, confirm: vi.fn() }),
}));
vi.mock('../../services/geminiService', () => ({
  generateReturnMessage: () => genReturn(),
  generateBirthdayMessage: () => genBirthday(),
  generateRetentionMessage: () => genRetention(),
}));

import Marketing from '../../pages/Marketing';

// paciente elegível para "Recuperação": último atendimento concluído há muito tempo
function eligiblePatient(over: Record<string, unknown> = {}) {
  return {
    id: 'p1', name: 'Maria Recuperar', phone: '11999990000', email: 'm@x.com',
    companyId: 'c1', status: 'active', marketingOptOut: false,
    lastVisit: '2025-01-01T00:00:00.000Z', lastMarketingMessageSentAt: null as string | null,
    ...over,
  };
}
function oldAppt(patientId: string) {
  return {
    id: 'a-' + patientId, patientId, companyId: 'c1', status: 'completed',
    date: '2025-01-01T00:00:00.000Z', service: 'Limpeza de Pele', price: 200,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('open', vi.fn());
  st.patients = [];
  st.appointments = [];
  st.procedures = [];
  st.companies = [];
  st.saasPlans = [];
  st.isReadOnly = false;
  st.user = { id: 'u1', role: UserRole.ADMIN, companyId: 'c1' };
  checkModuleAccess.mockReturnValue(true);
  updatePatient.mockResolvedValue({ success: true });
});

describe('pages/Marketing — roteamento por papel e gate de plano', () => {
  it('ADMIN vê a visão da clínica (ClinicMarketing)', () => {
    render(<Marketing />);
    expect(screen.getByText(/Recupera(ç|c)/i)).toBeInTheDocument(); // aba "Recuperação"
  });

  it('OWNER vê a visão SaaS (Customer Success / churn-upsell)', () => {
    st.user = { id: 'u9', role: UserRole.OWNER, companyId: null };
    render(<Marketing />);
    expect(screen.getByText(/Churn|Preven(ç|c)ão de Churn/i)).toBeInTheDocument();
  });

  it('sem acesso ao módulo, o conteúdo é envolvido pelo UpgradeOverlay', () => {
    checkModuleAccess.mockReturnValue(false);
    render(<Marketing />);
    expect(screen.getByText(/Ative a vers[aã]o Pro ou superior/i)).toBeInTheDocument();
  });
});

describe('pages/Marketing — LGPD (opt-out de marketing)', () => {
  it('paciente com marketingOptOut=true não aparece na segmentação de Recuperação', () => {
    st.patients = [
      eligiblePatient({ id: 'p1', name: 'Maria Recuperar', marketingOptOut: false }),
      eligiblePatient({ id: 'p2', name: 'Joao Optou Fora', marketingOptOut: true }),
    ];
    st.appointments = [oldAppt('p1'), oldAppt('p2')];
    render(<Marketing />);
    expect(screen.getByText('Maria Recuperar')).toBeInTheDocument();
    expect(screen.queryByText('Joao Optou Fora')).not.toBeInTheDocument();
  });
});

describe('pages/Marketing — envio verifica o retorno da API', () => {
  it('se updatePatient falhar, mostra showAlert e NÃO abre o WhatsApp', async () => {
    updatePatient.mockResolvedValue({ success: false, error: 'Falha ao registrar' });
    st.patients = [eligiblePatient({ id: 'p1', name: 'Maria Recuperar' })];
    st.appointments = [oldAppt('p1')];
    render(<Marketing />);

    fireEvent.click(screen.getByRole('button', { name: /Gerar Msg/i }));
    const enviar = await screen.findByRole('button', { name: /^Enviar$/i });
    fireEvent.click(enviar);

    await waitFor(() => expect(updatePatient).toHaveBeenCalledWith('p1', expect.objectContaining({ lastMarketingMessageSentAt: expect.any(String) })));
    await waitFor(() => expect(showAlert).toHaveBeenCalledWith('Falha ao registrar', expect.objectContaining({ variant: 'danger' })));
    expect(window.open).not.toHaveBeenCalled();
  });

  it('se updatePatient der certo, registra o envio e abre o WhatsApp', async () => {
    updatePatient.mockResolvedValue({ success: true });
    st.patients = [eligiblePatient({ id: 'p1', name: 'Maria Recuperar' })];
    st.appointments = [oldAppt('p1')];
    render(<Marketing />);

    fireEvent.click(screen.getByRole('button', { name: /Gerar Msg/i }));
    const enviar = await screen.findByRole('button', { name: /^Enviar$/i });
    fireEvent.click(enviar);

    await waitFor(() => expect(window.open).toHaveBeenCalledWith(expect.stringContaining('wa.me/5511999990000'), '_blank'));
    expect(showAlert).not.toHaveBeenCalled();
  });
});
