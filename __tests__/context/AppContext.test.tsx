// __tests__/context/AppContext.test.tsx
//
// Testes de regressão para as funções do AppContext que gravam dados via API.
// Foco: garantir que toda mutação (a) realmente chama a rota certa do backend,
// (b) propaga falhas da API pro chamador em vez de engolir silenciosamente —
// essa foi exatamente a causa dos bugs de "assinatura não salva" e "foto não
// salva" (a função disparava a chamada e ignorava o resultado).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';

vi.mock('../../services/api', () => ({
  authApi: {
    me: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    googleSetupCompany: vi.fn(),
  },
  patientsApi: {
    list: vi.fn(),
    signConsent: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  appointmentsApi: {
    list: vi.fn(),
    signConsent: vi.fn(),
    updateStatus: vi.fn(),
    create: vi.fn(),
    createPublic: vi.fn(),
    processPayment: vi.fn(),
  },
  photosApi: {
    create: vi.fn(),
    delete: vi.fn(),
  },
  transactionsApi: {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  proceduresApi: {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  inventoryApi: {
    create: vi.fn(),
    update: vi.fn(),
    adjust: vi.fn(),
    delete: vi.fn(),
  },
  dashboardApi: {},
  companiesApi: {
    update: vi.fn(),
  },
  usersApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    resetPassword: vi.fn(),
  },
  leadsApi: { create: vi.fn(), update: vi.fn() },
  unavailabilityApi: {
    delete: vi.fn(),
  },
  ticketsApi: {
    list: vi.fn(),
    create: vi.fn(),
    reply: vi.fn(),
    close: vi.fn(),
  },
  systemAlertsApi: {
    create: vi.fn(),
    toggleStatus: vi.fn(),
  },
  notificationsApi: {
    create: vi.fn(),
    markAsRead: vi.fn(),
  },
  plansApi: {
    list: vi.fn().mockResolvedValue({ success: true, data: { plans: [] } }),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  kingApi: { updateLead: vi.fn() },
  subscriptionsApi: {},
  setAuthToken: vi.fn(),
  getAuthToken: vi.fn(() => null),
}));

vi.mock('../../services/installmentsApi', () => ({
  installmentsApi: { markInstallmentPaid: vi.fn() },
}));

import { AppProvider, useApp, normalizeProfessional } from '../../context/AppContext';
import { authApi, patientsApi, appointmentsApi, photosApi, usersApi, inventoryApi, companiesApi, ticketsApi, systemAlertsApi, unavailabilityApi, leadsApi, notificationsApi, transactionsApi, proceduresApi, plansApi } from '../../services/api';
import { installmentsApi } from '../../services/installmentsApi';

function wrapper({ children }: { children: ReactNode }) {
  return <AppProvider>{children}</AppProvider>;
}

async function renderReadyApp() {
  vi.mocked(authApi.me).mockResolvedValue({ success: false } as never);
  const view = renderHook(() => useApp(), { wrapper });
  await waitFor(() => expect(view.result.current.isInitializing).toBe(false));
  return view;
}

// Alguns dados (ex: photos) são filtrados por companyId do usuário logado
// no próprio contexto (isolamento de tenant no client) — pra testar isso
// direito, simula uma sessão restaurada com sucesso via authApi.me.
async function renderReadyAppLoggedIn(companyId = 'c1', role: 'ADMIN' | 'OWNER' = 'ADMIN') {
  vi.mocked(authApi.me).mockResolvedValue({
    success: true,
    data: { user: { id: 'u1', name: 'Admin Teste', email: 'admin@teste.com', role, companyId } },
  } as never);
  const view = renderHook(() => useApp(), { wrapper });
  await waitFor(() => expect(view.result.current.isInitializing).toBe(false));
  await waitFor(() => expect(view.result.current.user?.companyId).toBe(companyId));
  return view;
}

const MOCK_API_PATIENT: {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  consentSignedAt: string | null;
  consentSignatureUrl: string | null;
} = {
  id: 'p1',
  name: 'Paciente Teste',
  email: 'paciente@teste.com',
  phone: '(11) 90000-0000',
  status: 'ACTIVE',
  consentSignedAt: null,
  consentSignatureUrl: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AppContext > signConsent (consentimento LGPD do paciente)', () => {
  it('chama patientsApi.signConsent (não o update genérico) e atualiza o paciente em memória', async () => {
    const { result } = await renderReadyApp();

    vi.mocked(patientsApi.list).mockResolvedValue({ success: true, data: { patients: [MOCK_API_PATIENT] } } as never);
    await act(async () => { await result.current.loadPatients(true); });
    expect(result.current.patients).toHaveLength(1);

    vi.mocked(patientsApi.signConsent).mockResolvedValue({
      success: true,
      data: { success: true, consentSignedAt: '2026-09-07T00:00:00.000Z', message: 'ok' },
    } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.signConsent('p1', 'data:image/png;base64,xxx');
    });

    expect(patientsApi.signConsent).toHaveBeenCalledWith('p1', 'data:image/png;base64,xxx', undefined, undefined);
    expect(outcome).toEqual({ success: true });
    expect(result.current.patients[0].consentSignedAt).toBe('2026-09-07T00:00:00.000Z');
    // Regressão: NÃO deve usar o PUT genérico de paciente para isso.
    expect(patientsApi.update).not.toHaveBeenCalled();
  });

  it('corrigir a assinatura do consentimento repassa o motivo pra API', async () => {
    const { result } = await renderReadyApp();

    vi.mocked(patientsApi.list).mockResolvedValue({ success: true, data: { patients: [MOCK_API_PATIENT] } } as never);
    await act(async () => { await result.current.loadPatients(true); });

    vi.mocked(patientsApi.signConsent).mockResolvedValue({
      success: true,
      data: {
        success: true,
        consentSignedAt: '2026-09-09T00:00:00.000Z',
        consentSignatureUrl: 'data:image/png;base64,nova',
        consentCorrectionCount: 1,
        lastConsentCorrectionAt: '2026-09-09T00:00:00.000Z',
        lastConsentCorrectionReason: 'Assinatura ilegível',
        message: 'ok',
      },
    } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.signConsent('p1', 'data:image/png;base64,nova', 'Assinatura ilegível');
    });

    expect(patientsApi.signConsent).toHaveBeenCalledWith('p1', 'data:image/png;base64,nova', undefined, 'Assinatura ilegível');
    expect(outcome).toEqual({ success: true });
  });

  it('REGRESSÃO: quando a API falha, retorna {success:false, error} em vez de fingir sucesso', async () => {
    const { result } = await renderReadyApp();

    vi.mocked(patientsApi.signConsent).mockResolvedValue({ success: false, error: 'Dados inválidos' } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.signConsent('p1', 'data:image/png;base64,xxx');
    });

    expect(outcome).toEqual({ success: false, error: 'Dados inválidos' });
  });

  it('REGRESSÃO: quando a chamada de rede lança exceção, retorna {success:false} em vez de propagar o throw', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(patientsApi.signConsent).mockRejectedValue(new Error('network down'));

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.signConsent('p1', 'data:image/png;base64,xxx');
    });

    expect(outcome?.success).toBe(false);
  });
});

describe('AppContext > signAppointmentConsent (consentimento do procedimento)', () => {
  it('chama appointmentsApi.signConsent e retorna sucesso', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(appointmentsApi.signConsent).mockResolvedValue({
      success: true,
      data: { success: true, signatureUrl: 'data:image/png;base64,xxx', signatureMetadata: {} },
    } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.signAppointmentConsent('appt-1', 'data:image/png;base64,xxx');
    });

    expect(appointmentsApi.signConsent).toHaveBeenCalledWith('appt-1', 'data:image/png;base64,xxx', undefined, undefined);
    expect(outcome).toEqual({ success: true });
  });

  it('REGRESSÃO: propaga erro da API em vez de engolir silenciosamente', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(appointmentsApi.signConsent).mockResolvedValue({ success: false, error: 'Sem permissão' } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.signAppointmentConsent('appt-1', 'x');
    });

    expect(outcome).toEqual({ success: false, error: 'Sem permissão' });
  });

  it('corrigir uma assinatura repassa o motivo pra API', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(appointmentsApi.signConsent).mockResolvedValue({
      success: true,
      data: {
        success: true,
        signatureUrl: 'data:image/png;base64,nova',
        signatureMetadata: {},
        signatureCorrectionCount: 1,
        lastSignatureCorrectionAt: '2026-09-09T00:00:00.000Z',
        lastSignatureCorrectionReason: 'Assinatura ilegível',
      },
    } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.signAppointmentConsent('appt-1', 'data:image/png;base64,nova', 'Assinatura ilegível');
    });

    expect(appointmentsApi.signConsent).toHaveBeenCalledWith('appt-1', 'data:image/png;base64,nova', undefined, 'Assinatura ilegível');
    expect(outcome).toEqual({ success: true });
  });
});

describe('AppContext > addPhoto (foto de evolução antes/depois)', () => {
  const PHOTO_INPUT = {
    patientId: 'p1',
    date: '2026-09-07',
    url: 'data:image/png;base64,xxx',
    type: 'before' as const,
    procedure: 'Botox',
    groupId: 'group_1',
  };

  it('cria a foto e retorna {success:true, photo}', async () => {
    const { result } = await renderReadyAppLoggedIn('c1');
    vi.mocked(photosApi.create).mockResolvedValue({
      success: true,
      data: { photo: { id: 'photo-1', companyId: 'c1', patientId: 'p1', url: PHOTO_INPUT.url, type: 'BEFORE', procedure: 'Botox', date: '2026-09-07', groupId: 'group_1' } },
    } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.addPhoto(PHOTO_INPUT);
    });

    expect(photosApi.create).toHaveBeenCalledWith(PHOTO_INPUT);
    expect(outcome?.success).toBe(true);
    await waitFor(() => expect(result.current.photos).toHaveLength(1));
  });

  it('REGRESSÃO: quando a API rejeita (ex: URL inválida), retorna {success:false} — quem chama DEVE checar isso antes de fechar o modal', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(photosApi.create).mockResolvedValue({ success: false, error: 'Dados inválidos' } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.addPhoto(PHOTO_INPUT);
    });

    expect(outcome).toEqual({ success: false, error: 'Dados inválidos' });
    expect(result.current.photos).toHaveLength(0);
  });
});

describe('AppContext > changeAppointmentStatus (confirmar/cancelar/concluir agendamento)', () => {
  // REGRESSÃO GRAVE: existia uma `updateAppointmentStatus` (removida) que só
  // mexia no estado local, sem NENHUMA chamada de API — aprovar ou cancelar
  // um agendamento nos modais de revisão/checkout nunca persistia, revertendo
  // ao recarregar a página. `changeAppointmentStatus` é a única função correta.
  it('chama appointmentsApi.updateStatus e recarrega os agendamentos', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(appointmentsApi.updateStatus).mockResolvedValue({ success: true } as never);
    vi.mocked(appointmentsApi.list).mockResolvedValue({ success: true, data: { appointments: [], pagination: {} } } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.changeAppointmentStatus('appt-1', 'SCHEDULED');
    });

    expect(appointmentsApi.updateStatus).toHaveBeenCalledWith('appt-1', 'SCHEDULED');
    expect(outcome).toEqual({ success: true, error: undefined });
  });

  it('REGRESSÃO: propaga erro da API (ex: transição de status inválida) em vez de fingir sucesso', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(appointmentsApi.updateStatus).mockResolvedValue({ success: false, error: 'Transição de CANCELED para CONFIRMED não permitida' } as never);
    vi.mocked(appointmentsApi.list).mockResolvedValue({ success: true, data: { appointments: [], pagination: {} } } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.changeAppointmentStatus('appt-1', 'CONFIRMED');
    });

    expect(outcome).toEqual({ success: false, error: 'Transição de CANCELED para CONFIRMED não permitida' });
  });
});

describe('normalizeProfessional (normalização de dados vindos da API)', () => {
  it('contractType ausente cai no fallback "pj"', () => {
    const out = normalizeProfessional({ id: 'p1', name: 'X' });
    expect(out.contractType).toBe('pj');
  });

  it('contractType "CLT" (maiúsculo, como o Prisma envia) vira "clt"', () => {
    const out = normalizeProfessional({ id: 'p1', name: 'X', contractType: 'CLT' });
    expect(out.contractType).toBe('clt');
  });

  it('remunerationType ausente cai no fallback "comissao"', () => {
    const out = normalizeProfessional({ id: 'p1', name: 'X' });
    expect(out.remunerationType).toBe('comissao');
  });

  it('remunerationType do enum ("FIXED"/"MIXED") vira minúsculo PT-BR', () => {
    expect(normalizeProfessional({ id: 'p1', name: 'X', remunerationType: 'FIXED' }).remunerationType).toBe('fixo');
    expect(normalizeProfessional({ id: 'p1', name: 'X', remunerationType: 'MIXED' }).remunerationType).toBe('misto');
  });

  it('commissionRate/fixedSalary ausentes viram 0 (nunca NaN)', () => {
    const out = normalizeProfessional({ id: 'p1', name: 'X' });
    expect(out.commissionRate).toBe(0);
    expect(out.fixedSalary).toBe(0);
    expect(Number.isNaN(out.commissionRate)).toBe(false);
    expect(Number.isNaN(out.fixedSalary)).toBe(false);
  });

  it('commissionRate como string do Prisma ("45.00") vira number 45', () => {
    const out = normalizeProfessional({ id: 'p1', name: 'X', commissionRate: '45.00' });
    expect(out.commissionRate).toBe(45);
    expect(typeof out.commissionRate).toBe('number');
  });
});

describe('AppContext > addProfessional', () => {
  it('sucesso: chama usersApi.create e adiciona o profissional normalizado ao estado', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(usersApi.create).mockResolvedValue({
      success: true,
      data: { user: { id: 'np1', name: 'Nova Prof', commissionRate: '20', remunerationType: 'MIXED', contractType: 'CLT' } },
    } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.addProfessional({ name: 'Nova Prof', email: 'nova@x.com' });
    });

    expect(usersApi.create).toHaveBeenCalled();
    expect(outcome?.success).toBe(true);
    const created = result.current.professionals.find(p => p.id === 'np1')!;
    expect(created).toBeDefined();
    expect(created.commissionRate).toBe(20); // number, não string
    expect(created.remunerationType).toBe('misto'); // minúsculo PT-BR
    expect(created.contractType).toBe('clt');
  });

  it('REGRESSÃO: propaga erro da API em vez de fingir sucesso', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(usersApi.create).mockResolvedValue({ success: false, error: 'A taxa de comissão não pode passar de 100%' } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.addProfessional({ name: 'X', email: 'x@x.com', commissionRate: 150 });
    });

    expect(outcome).toEqual({ success: false, error: 'A taxa de comissão não pode passar de 100%' });
  });
});

describe('AppContext > updateProfessional / removeProfessional', () => {
  // REGRESSÃO GRAVE: estas funções eram stubs comentados "API não existe
  // ainda" — só mexiam em estado local (setProfessionals), NUNCA chamavam o
  // backend. Editar ou remover um profissional nunca funcionou de verdade.
  it('updateProfessional chama usersApi.update (não é mais estado local puro)', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(usersApi.update).mockResolvedValue({ success: true, data: { user: { id: 'prof-1', name: 'Nome Novo' } } } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.updateProfessional('prof-1', { name: 'Nome Novo' });
    });

    expect(usersApi.update).toHaveBeenCalledWith('prof-1', { name: 'Nome Novo' });
    expect(outcome).toEqual({ success: true });
  });

  // REGRESSÃO: o card "Comissão Média" chegou a mostrar 151180% em produção.
  // Causa: o Prisma retorna campos Decimal (commissionRate) serializados como
  // STRING em JSON. updateProfessional espalhava a resposta da API direto no
  // estado sem converter pra number nem normalizar remunerationType/contractType
  // (minúsculo PT-BR, como o resto do app espera) — a soma num reduce virava
  // concatenação de string ("30"+"45"="3045") em vez de soma numérica.
  it('REGRESSÃO: normaliza commissionRate (string do Prisma) para number e remunerationType para minúsculo PT-BR', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(usersApi.list).mockResolvedValue({
      success: true,
      data: { users: [{ id: 'prof-1', name: 'Bruna', commissionRate: '30', remunerationType: 'COMMISSION', contractType: 'PJ' }] },
    } as never);
    await act(async () => { await result.current.loadProfessionals(); });

    // Simula a resposta real da API: Decimal do Prisma volta como string.
    vi.mocked(usersApi.update).mockResolvedValue({
      success: true,
      data: { user: { id: 'prof-1', name: 'Bruna', commissionRate: '45.00', remunerationType: 'COMMISSION', contractType: 'PJ' } },
    } as never);

    await act(async () => {
      await result.current.updateProfessional('prof-1', { commissionRate: 45 });
    });

    const updatedProf = result.current.professionals.find(p => p.id === 'prof-1')!;
    expect(updatedProf.commissionRate).toBe(45); // number, não "45.00"
    expect(typeof updatedProf.commissionRate).toBe('number');
    expect(updatedProf.remunerationType).toBe('comissao'); // minúsculo PT-BR, não "COMMISSION"

    // Prova que a soma agora é numérica, não concatenação de string.
    const soma = result.current.professionals.reduce((s, p) => s + (p.commissionRate || 0), 0);
    expect(soma).toBe(45);
  });

  it('REGRESSÃO: updateProfessional propaga erro da API em vez de fingir sucesso', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(usersApi.update).mockResolvedValue({ success: false, error: 'Já existe um usuário com este e-mail' } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.updateProfessional('prof-1', { email: 'duplicado@x.com' });
    });

    expect(outcome).toEqual({ success: false, error: 'Já existe um usuário com este e-mail' });
  });

  it('removeProfessional chama usersApi.delete (não é mais estado local puro)', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(usersApi.delete).mockResolvedValue({ success: true, data: { success: true, message: 'ok' } } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.removeProfessional('prof-1');
    });

    expect(usersApi.delete).toHaveBeenCalledWith('prof-1');
    expect(outcome).toEqual({ success: true });
  });

  it('REGRESSÃO: removeProfessional propaga erro da API (ex: sem permissão) em vez de fingir sucesso', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(usersApi.delete).mockResolvedValue({ success: false, error: 'Sem permissão' } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.removeProfessional('prof-1');
    });

    expect(outcome).toEqual({ success: false, error: 'Sem permissão' });
  });
});

describe('AppContext > updateCompany (configurações da empresa)', () => {
  // REGRESSÃO GRAVE: updateCompany atualizava o estado local (setCompanies)
  // ANTES de confirmar com a API (otimista) e não desfazia em caso de falha —
  // a tela mostrava "salvo com sucesso" mesmo quando o servidor rejeitava a
  // mudança (ex: Settings.tsx, BusinessHoursSettings.tsx, AccessLink.tsx).
  async function renderWithSeededCompany() {
    vi.mocked(authApi.me).mockResolvedValue({
      success: true,
      data: {
        user: {
          id: 'u1', name: 'Admin', email: 'admin@teste.com', role: 'ADMIN',
          company: { id: 'c1', name: 'Empresa Original', slug: 'empresa-original', plan: 'BASIC', subscriptionStatus: 'ACTIVE' },
        },
      },
    } as never);
    const view = renderHook(() => useApp(), { wrapper });
    await waitFor(() => expect(view.result.current.isInitializing).toBe(false));
    await waitFor(() => expect(view.result.current.companies).toHaveLength(1));
    expect(view.result.current.companies[0].name).toBe('Empresa Original');
    return view;
  }

  it('REGRESSÃO: quando a API falha, NÃO atualiza o estado local (sem ghost success)', async () => {
    const { result } = await renderWithSeededCompany();
    vi.mocked(companiesApi.update).mockResolvedValue({ success: false, error: 'Nome inválido' } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.updateCompany('c1', { name: 'Nome Que Não Deveria Persistir' });
    });

    expect(outcome).toEqual({ success: false, error: 'Nome inválido' });
    expect(result.current.companies[0].name).toBe('Empresa Original');
  });

  it('atualiza o estado local somente com o valor confirmado pelo servidor', async () => {
    const { result } = await renderWithSeededCompany();
    vi.mocked(companiesApi.update).mockResolvedValue({
      success: true,
      data: { company: { id: 'c1', name: 'Nome Confirmado Pelo Servidor', slug: 'empresa-original', plan: 'BASIC', subscriptionStatus: 'ACTIVE' } },
    } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.updateCompany('c1', { name: 'Nome Confirmado Pelo Servidor' });
    });

    expect(outcome?.success).toBe(true);
    expect(result.current.companies[0].name).toBe('Nome Confirmado Pelo Servidor');
  });
});

describe('AppContext > closeTicket / toggleSystemAlertStatus / removePhoto / moveLead / removeUnavailabilityRule (erro de conexão)', () => {
  // REGRESSÃO GRAVE: todas essas funções tinham um catch que, em caso de erro
  // de CONEXÃO (não erro de negócio da API), fingia sucesso e alterava o
  // estado local mesmo assim — desincronizando do backend silenciosamente.
  it('closeTicket: erro de conexão retorna {success:false} em vez de fechar o ticket só localmente', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(ticketsApi.close).mockRejectedValue(new Error('network down'));

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.closeTicket('ticket-1');
    });

    expect(outcome).toEqual({ success: false, error: 'Erro de sistema. Tente novamente.' });
  });

  it('toggleSystemAlertStatus: erro de conexão retorna {success:false} em vez de alternar status só localmente', async () => {
    const { result } = await renderReadyAppLoggedIn('c1', 'OWNER');
    vi.mocked(systemAlertsApi.toggleStatus).mockRejectedValue(new Error('network down'));

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.toggleSystemAlertStatus('alert-1');
    });

    expect(outcome).toEqual({ success: false, error: 'Erro de sistema. Tente novamente.' });
  });

  it('removePhoto: erro de conexão retorna {success:false} em vez de remover a foto só localmente', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(photosApi.delete).mockRejectedValue(new Error('network down'));

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.removePhoto('photo-1');
    });

    expect(outcome).toEqual({ success: false, error: 'Erro de sistema. Tente novamente.' });
  });

  it('moveLead: erro de conexão retorna {success:false} em vez de mover o lead só localmente', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(leadsApi.update).mockRejectedValue(new Error('network down'));

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.moveLead('lead-1', 'won');
    });

    expect(outcome).toEqual({ success: false, error: 'Erro de sistema. Tente novamente.' });
  });

  it('removeUnavailabilityRule: erro de conexão retorna {success:false} em vez de remover a regra só localmente', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(unavailabilityApi.delete).mockRejectedValue(new Error('network down'));

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.removeUnavailabilityRule('rule-1');
    });

    expect(outcome).toEqual({ success: false, error: 'Erro de sistema. Tente novamente.' });
  });
});

describe('AppContext > updateInventoryItem / removeInventoryItem', () => {
  // REGRESSÃO GRAVE: mesmo padrão dos profissionais — stubs comentados "API
  // não existe ainda", só mexiam em estado local. Editar/remover um item de
  // estoque nunca funcionou de verdade.
  it('updateInventoryItem chama inventoryApi.update (não é mais estado local puro)', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(inventoryApi.update).mockResolvedValue({ success: true, data: { item: { id: 'item-1', currentStock: 20 } } } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.updateInventoryItem('item-1', { currentStock: 20 });
    });

    expect(inventoryApi.update).toHaveBeenCalledWith('item-1', { currentStock: 20 });
    expect(outcome).toEqual({ success: true });
  });

  it('REGRESSÃO: updateInventoryItem propaga erro da API em vez de fingir sucesso', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(inventoryApi.update).mockResolvedValue({ success: false, error: 'Dados inválidos' } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.updateInventoryItem('item-1', { currentStock: -5 });
    });

    expect(outcome).toEqual({ success: false, error: 'Dados inválidos' });
  });

  it('removeInventoryItem chama inventoryApi.delete (não é mais estado local puro)', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(inventoryApi.delete).mockResolvedValue({ success: true, data: { success: true, message: 'ok' } } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.removeInventoryItem('item-1');
    });

    expect(inventoryApi.delete).toHaveBeenCalledWith('item-1');
    expect(outcome).toEqual({ success: true });
  });

  it('REGRESSÃO: removeInventoryItem propaga erro da API em vez de fingir sucesso', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(inventoryApi.delete).mockResolvedValue({ success: false, error: 'Sem permissão' } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.removeInventoryItem('item-1');
    });

    expect(outcome).toEqual({ success: false, error: 'Sem permissão' });
  });
});

describe('AppContext > adjustInventoryStock', () => {
  it('chama inventoryApi.adjust com o delta e o tipo ADJUSTMENT e atualiza o item na lista', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(inventoryApi.adjust).mockResolvedValue({
      success: true,
      data: { item: { id: 'item-1', currentStock: 7 } },
    } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.adjustInventoryStock('item-1', {
        type: 'ADJUSTMENT',
        quantity: -3,
        reason: 'Ajuste manual pela ficha do item',
      });
    });

    expect(inventoryApi.adjust).toHaveBeenCalledWith('item-1', {
      type: 'ADJUSTMENT',
      quantity: -3,
      reason: 'Ajuste manual pela ficha do item',
    });
    expect(outcome).toEqual({ success: true });
  });

  it('propaga o erro da API em vez de fingir sucesso', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(inventoryApi.adjust).mockResolvedValue({ success: false, error: 'Estoque insuficiente' } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.adjustInventoryStock('item-1', {
        type: 'OUT',
        quantity: 999,
        reason: 'Uso excessivo',
      });
    });

    expect(outcome).toEqual({ success: false, error: 'Estoque insuficiente' });
  });
});

describe('AppContext > addLead / createTicket / replyTicket / addSystemAlert / addNotification (caminho feliz + erro de negócio)', () => {
  it('addLead chama leadsApi.create e adiciona o lead à lista', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(leadsApi.create).mockResolvedValue({
      success: true,
      data: { id: 'lead-1', clinicName: 'Clínica X', contactName: 'Fulano', phone: '11999999999', email: 'x@x.com', value: 100, status: 'NEW', createdAt: '2026-09-08T00:00:00.000Z' },
    } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.addLead({ clinicName: 'Clínica X', contactName: 'Fulano', phone: '11999999999', email: 'x@x.com', value: 100, status: 'new', createdAt: '2026-09-08T00:00:00.000Z' });
    });

    expect(leadsApi.create).toHaveBeenCalled();
    expect(outcome?.success).toBe(true);
    expect(result.current.leads).toHaveLength(1);
  });

  it('REGRESSÃO: addLead propaga erro da API em vez de fingir sucesso', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(leadsApi.create).mockResolvedValue({ success: false, error: 'Dados inválidos' } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.addLead({ clinicName: 'Clínica X', contactName: 'Fulano', phone: '11999999999', email: 'x@x.com', value: 100, status: 'new', createdAt: '2026-09-08T00:00:00.000Z' });
    });

    expect(outcome).toEqual({ success: false, error: 'Dados inválidos' });
    expect(result.current.leads).toHaveLength(0);
  });

  it('createTicket chama ticketsApi.create e adiciona o ticket à lista', async () => {
    const { result } = await renderReadyAppLoggedIn('c1');
    vi.mocked(ticketsApi.create).mockResolvedValue({
      success: true,
      data: { ticket: { id: 'ticket-1', companyId: 'c1', subject: 'Dúvida', status: 'OPEN', messages: [], createdAt: '2026-09-08T00:00:00.000Z', updatedAt: '2026-09-08T00:00:00.000Z' } },
    } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.createTicket('Dúvida', 'Como funciona X?');
    });

    expect(ticketsApi.create).toHaveBeenCalledWith({ subject: 'Dúvida', message: 'Como funciona X?' });
    expect(outcome?.success).toBe(true);
    expect(result.current.tickets).toHaveLength(1);
  });

  it('REGRESSÃO: createTicket propaga erro da API em vez de fingir sucesso', async () => {
    const { result } = await renderReadyAppLoggedIn('c1');
    vi.mocked(ticketsApi.create).mockResolvedValue({ success: false, error: 'Dados inválidos' } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.createTicket('', '');
    });

    expect(outcome).toEqual({ success: false, error: 'Dados inválidos' });
  });

  it('replyTicket chama ticketsApi.reply e atualiza o ticket em memória', async () => {
    const { result } = await renderReadyAppLoggedIn('c1');
    vi.mocked(ticketsApi.reply).mockResolvedValue({
      success: true,
      data: { ticket: { id: 'ticket-1', subject: 'Dúvida', status: 'OPEN', messages: [{ id: 'm1', content: 'Resposta', senderId: 'u1', senderName: 'Admin', isAdmin: true, timestamp: '2026-09-08T00:00:00.000Z' }], createdAt: '2026-09-08T00:00:00.000Z', updatedAt: '2026-09-08T00:00:00.000Z' } },
    } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.replyTicket('ticket-1', 'Resposta');
    });

    expect(ticketsApi.reply).toHaveBeenCalledWith('ticket-1', 'Resposta');
    expect(outcome).toEqual({ success: true });
  });

  it('REGRESSÃO: replyTicket propaga erro da API em vez de fingir sucesso', async () => {
    const { result } = await renderReadyAppLoggedIn('c1');
    vi.mocked(ticketsApi.reply).mockResolvedValue({ success: false, error: 'Ticket já encerrado' } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.replyTicket('ticket-1', 'Resposta');
    });

    expect(outcome).toEqual({ success: false, error: 'Ticket já encerrado' });
  });

  it('closeTicket: caminho de sucesso marca o ticket como closed no estado', async () => {
    const { result } = await renderReadyAppLoggedIn('c1');
    vi.mocked(ticketsApi.list).mockResolvedValue({ success: true, data: { tickets: [
      { id: 'ticket-1', companyId: 'c1', subject: 'X', status: 'OPEN', company: { id: 'c1', name: 'Clínica X' }, messages: [] },
    ] } } as never);
    vi.mocked(ticketsApi.close).mockResolvedValue({ success: true } as never);

    await act(async () => { await result.current.loadTickets(true); });
    expect(result.current.tickets).toHaveLength(1);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => { outcome = await result.current.closeTicket('ticket-1'); });

    expect(ticketsApi.close).toHaveBeenCalledWith('ticket-1');
    expect(outcome).toEqual({ success: true });
    expect(result.current.tickets[0].status).toBe('closed');
  });

  it('loadTickets chama ticketsApi.list e popula o estado tickets (antes não era chamado em lugar nenhum)', async () => {
    const { result } = await renderReadyAppLoggedIn('c1');
    vi.mocked(ticketsApi.list).mockResolvedValue({ success: true, data: { tickets: [
      { id: 't1', companyId: 'c1', subject: 'A', status: 'OPEN', company: { id: 'c1', name: 'Clínica X' }, messages: [] },
      { id: 't2', companyId: 'c1', subject: 'B', status: 'CLOSED', company: { id: 'c1', name: 'Clínica X' }, messages: [] },
    ] } } as never);

    await act(async () => { await result.current.loadTickets(true); });

    expect(ticketsApi.list).toHaveBeenCalled();
    expect(result.current.tickets).toHaveLength(2);
    expect(result.current.tickets[0].status).toBe('open');
    expect(result.current.tickets[1].status).toBe('closed');
  });

  it('addSystemAlert (OWNER) chama systemAlertsApi.create e adiciona o alerta', async () => {
    const { result } = await renderReadyAppLoggedIn('c1', 'OWNER');
    vi.mocked(systemAlertsApi.create).mockResolvedValue({
      success: true,
      data: { alert: { id: 'alert-1', title: 'Manutenção', message: 'Sistema em manutenção', type: 'WARNING', target: 'all', status: 'ACTIVE', createdAt: '2026-09-08T00:00:00.000Z' } },
    } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.addSystemAlert({ title: 'Manutenção', message: 'Sistema em manutenção', type: 'warning', target: 'all' });
    });

    expect(systemAlertsApi.create).toHaveBeenCalled();
    expect(outcome?.success).toBe(true);
    expect(result.current.systemAlerts).toHaveLength(1);
  });

  it('REGRESSÃO: addSystemAlert propaga erro da API em vez de fingir sucesso', async () => {
    const { result } = await renderReadyAppLoggedIn('c1', 'OWNER');
    vi.mocked(systemAlertsApi.create).mockResolvedValue({ success: false, error: 'Dados inválidos' } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.addSystemAlert({ title: '', message: '', type: 'info', target: 'all' });
    });

    expect(outcome).toEqual({ success: false, error: 'Dados inválidos' });
  });

  it('addNotification chama notificationsApi.create e adiciona a notificação', async () => {
    // Notificações são filtradas por companyId do usuário logado no contexto
    // (isolamento de tenant no client) — precisa de sessão restaurada com o
    // mesmo companyId da notificação criada, senão o filtro descarta ela.
    const { result } = await renderReadyAppLoggedIn('c1');
    vi.mocked(notificationsApi.create).mockResolvedValue({
      success: true,
      data: { notification: { id: 'notif-1', message: 'Olá', type: 'INFO', createdAt: '2026-09-08T00:00:00.000Z', isRead: false } },
    } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.addNotification({ companyId: 'c1', message: 'Olá', type: 'info' });
    });

    expect(notificationsApi.create).toHaveBeenCalled();
    expect(outcome?.success).toBe(true);
    expect(result.current.notifications).toHaveLength(1);
  });

  it('REGRESSÃO: addNotification propaga erro da API em vez de fingir sucesso silenciosamente', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(notificationsApi.create).mockResolvedValue({ success: false, error: 'Dados inválidos' } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.addNotification({ companyId: 'c1', message: 'Olá', type: 'info' });
    });

    expect(outcome).toEqual({ success: false, error: 'Dados inválidos' });
    expect(result.current.notifications).toHaveLength(0);
  });
});

describe('AppContext > addPatient / updatePatient / removePatient / toggleAnamnesisSent', () => {
  it('addPatient chama patientsApi.create e adiciona o paciente à lista', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(patientsApi.create).mockResolvedValue({
      success: true,
      data: { patient: { id: 'p1', name: 'Nova Paciente', email: 'p@x.com', phone: '11999999999', status: 'ACTIVE' } },
    } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.addPatient({ name: 'Nova Paciente', email: 'p@x.com', phone: '11999999999' });
    });

    expect(patientsApi.create).toHaveBeenCalled();
    expect(outcome?.success).toBe(true);
    expect(result.current.patients).toHaveLength(1);
    expect(result.current.patients[0].status).toBe('active');
  });

  it('REGRESSÃO: addPatient propaga erro da API em vez de fingir sucesso', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(patientsApi.create).mockResolvedValue({ success: false, error: 'Dados inválidos' } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.addPatient({ name: '', email: '', phone: '' });
    });

    expect(outcome).toEqual({ success: false, error: 'Dados inválidos' });
    expect(result.current.patients).toHaveLength(0);
  });

  it('updatePatient chama patientsApi.update e atualiza o paciente em memória', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(patientsApi.update).mockResolvedValue({
      success: true,
      data: { patient: { id: 'p1', name: 'Nome Atualizado' } },
    } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.updatePatient('p1', { name: 'Nome Atualizado' });
    });

    expect(patientsApi.update).toHaveBeenCalledWith('p1', { name: 'Nome Atualizado' });
    expect(outcome).toEqual({ success: true });
  });

  it('REGRESSÃO: updatePatient propaga erro da API em vez de fingir sucesso', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(patientsApi.update).mockResolvedValue({ success: false, error: 'E-mail já cadastrado' } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.updatePatient('p1', { email: 'duplicado@x.com' });
    });

    expect(outcome).toEqual({ success: false, error: 'E-mail já cadastrado' });
  });

  it('removePatient chama patientsApi.delete e remove o paciente da lista', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(patientsApi.list).mockResolvedValue({ success: true, data: { patients: [MOCK_API_PATIENT] } } as never);
    await act(async () => { await result.current.loadPatients(true); });
    expect(result.current.patients).toHaveLength(1);

    vi.mocked(patientsApi.delete).mockResolvedValue({ success: true, data: { success: true, message: 'ok' } } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.removePatient('p1');
    });

    expect(patientsApi.delete).toHaveBeenCalledWith('p1');
    expect(outcome).toEqual({ success: true });
    expect(result.current.patients).toHaveLength(0);
  });

  it('REGRESSÃO: removePatient propaga erro da API (ex: paciente com histórico vinculado) em vez de fingir sucesso', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(patientsApi.delete).mockResolvedValue({ success: false, error: 'Paciente possui agendamentos vinculados' } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.removePatient('p1');
    });

    expect(outcome).toEqual({ success: false, error: 'Paciente possui agendamentos vinculados' });
  });

  it('toggleAnamnesisSent delega para updatePatient com anamnesisLinkSent:true', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(patientsApi.update).mockResolvedValue({ success: true, data: { patient: { id: 'p1', anamnesisLinkSent: true } } } as never);

    await act(async () => {
      result.current.toggleAnamnesisSent('p1');
      // toggleAnamnesisSent não retorna a Promise (fire-and-forget) — aguarda o
      // microtask da chamada interna a updatePatient terminar antes de checar.
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(patientsApi.update).toHaveBeenCalledWith('p1', { anamnesisLinkSent: true });
  });
});

describe('AppContext > addTransaction / updateTransaction / deleteTransaction / markInstallmentPaid / processPayment', () => {
  it('addTransaction chama transactionsApi.create e adiciona a transação', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(transactionsApi.create).mockResolvedValue({
      success: true,
      data: { transaction: { id: 't1', amount: '150.00', type: 'INCOME', status: 'PAID', description: 'Consulta', date: '2026-09-08' } },
    } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.addTransaction({ amount: 150, type: 'income', status: 'paid', description: 'Consulta', date: '2026-09-08', category: 'Serviços' } as never);
    });

    expect(transactionsApi.create).toHaveBeenCalled();
    expect(outcome?.success).toBe(true);
    expect(result.current.transactions).toHaveLength(1);
    expect(result.current.transactions[0].amount).toBe(150);
    expect(typeof result.current.transactions[0].amount).toBe('number');
  });

  it('REGRESSÃO: addTransaction propaga erro da API em vez de fingir sucesso', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(transactionsApi.create).mockResolvedValue({ success: false, error: 'Dados inválidos' } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.addTransaction({ amount: 150, type: 'income', status: 'paid', description: 'Consulta', date: '2026-09-08', category: 'Serviços' } as never);
    });

    expect(outcome).toEqual({ success: false, error: 'Dados inválidos' });
    expect(result.current.transactions).toHaveLength(0);
  });

  it('updateTransaction chama transactionsApi.update e atualiza em memória', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(transactionsApi.update).mockResolvedValue({
      success: true,
      data: { transaction: { id: 't1', amount: '200.00', type: 'INCOME', status: 'PAID', description: 'Consulta', date: '2026-09-08' } },
    } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.updateTransaction('t1', { amount: 200 });
    });

    expect(transactionsApi.update).toHaveBeenCalledWith('t1', { amount: 200 });
    expect(outcome).toEqual({ success: true });
  });

  it('REGRESSÃO: updateTransaction propaga erro da API em vez de fingir sucesso', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(transactionsApi.update).mockResolvedValue({ success: false, error: 'Transação já conciliada' } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.updateTransaction('t1', { amount: 999 });
    });

    expect(outcome).toEqual({ success: false, error: 'Transação já conciliada' });
  });

  it('deleteTransaction chama transactionsApi.delete e remove da lista', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(transactionsApi.delete).mockResolvedValue({ success: true } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.deleteTransaction('t1');
    });

    expect(transactionsApi.delete).toHaveBeenCalledWith('t1');
    expect(outcome).toEqual({ success: true });
  });

  it('REGRESSÃO: deleteTransaction propaga erro da API em vez de fingir sucesso', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(transactionsApi.delete).mockResolvedValue({ success: false, error: 'Sem permissão' } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.deleteTransaction('t1');
    });

    expect(outcome).toEqual({ success: false, error: 'Sem permissão' });
  });

  it('markInstallmentPaid chama installmentsApi.markInstallmentPaid e marca a transação como paga', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(installmentsApi.markInstallmentPaid).mockResolvedValue({ success: true } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.markInstallmentPaid('t1');
    });

    expect(installmentsApi.markInstallmentPaid).toHaveBeenCalledWith('t1');
    expect(outcome).toEqual({ success: true });
  });

  it('REGRESSÃO: markInstallmentPaid propaga erro da API em vez de fingir sucesso', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(installmentsApi.markInstallmentPaid).mockResolvedValue({ success: false, error: 'Parcela já paga' } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.markInstallmentPaid('t1');
    });

    expect(outcome).toEqual({ success: false, error: 'Parcela já paga' });
  });

  it('processPayment chama appointmentsApi.processPayment e cria as transações retornadas', async () => {
    const { result } = await renderReadyAppLoggedIn('c1');
    vi.mocked(appointmentsApi.processPayment).mockResolvedValue({
      success: true,
      data: {
        transactions: { income: { id: 'tx1', companyId: 'c1', date: '2026-09-08', description: 'Pagamento', amount: '150.00', category: 'Serviços' } },
        summary: {},
      },
    } as never);

    const appointment = { id: 'appt-1', companyId: 'c1' } as never;
    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.processPayment(appointment, 'pix', 1);
    });

    expect(appointmentsApi.processPayment).toHaveBeenCalledWith('appt-1', 'pix', 1);
    expect(outcome).toEqual({ success: true });
    expect(result.current.transactions).toHaveLength(1);
    expect(result.current.transactions[0].amount).toBe(150);
  });

  it('REGRESSÃO: processPayment propaga erro da API (ex: agendamento já pago) em vez de fingir sucesso', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(appointmentsApi.processPayment).mockResolvedValue({ success: false, error: 'Agendamento já pago' } as never);

    const appointment = { id: 'appt-1', companyId: 'c1' } as never;
    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.processPayment(appointment, 'pix', 1);
    });

    expect(outcome).toEqual({ success: false, error: 'Agendamento já pago' });
    expect(result.current.transactions).toHaveLength(0);
  });
});

describe('AppContext > addProcedure / updateProcedure / removeProcedure', () => {
  it('addProcedure chama proceduresApi.create e adiciona o procedimento', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(proceduresApi.create).mockResolvedValue({
      success: true,
      data: { procedure: { id: 'proc1', name: 'Botox', price: '800.00', cost: '200.00', supplies: [] } },
    } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.addProcedure({ name: 'Botox', price: 800, cost: 200, durationMinutes: 30 } as never);
    });

    expect(proceduresApi.create).toHaveBeenCalled();
    expect(outcome?.success).toBe(true);
    expect(result.current.procedures).toHaveLength(1);
    expect(result.current.procedures[0].price).toBe(800);
  });

  it('REGRESSÃO: addProcedure propaga erro da API em vez de fingir sucesso', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(proceduresApi.create).mockResolvedValue({ success: false, error: 'Dados inválidos' } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.addProcedure({ name: '', price: 0, cost: 0, durationMinutes: 0 } as never);
    });

    expect(outcome).toEqual({ success: false, error: 'Dados inválidos' });
    expect(result.current.procedures).toHaveLength(0);
  });

  it('updateProcedure chama proceduresApi.update e atualiza em memória', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(proceduresApi.update).mockResolvedValue({
      success: true,
      data: { procedure: { id: 'proc1', name: 'Botox Premium', price: '900.00', cost: '200.00', supplies: [] } },
    } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.updateProcedure('proc1', { name: 'Botox Premium', price: 900 });
    });

    expect(proceduresApi.update).toHaveBeenCalled();
    expect(outcome).toEqual({ success: true });
  });

  it('REGRESSÃO: updateProcedure propaga erro da API em vez de fingir sucesso', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(proceduresApi.update).mockResolvedValue({ success: false, error: 'Dados inválidos' } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.updateProcedure('proc1', { price: -10 });
    });

    expect(outcome).toEqual({ success: false, error: 'Dados inválidos' });
  });

  it('removeProcedure chama proceduresApi.delete e remove da lista', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(proceduresApi.delete).mockResolvedValue({ success: true } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.removeProcedure('proc1');
    });

    expect(proceduresApi.delete).toHaveBeenCalledWith('proc1');
    expect(outcome).toEqual({ success: true });
  });

  it('REGRESSÃO: removeProcedure propaga erro da API (ex: procedimento com agendamentos vinculados) em vez de fingir sucesso', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(proceduresApi.delete).mockResolvedValue({ success: false, error: 'Procedimento possui agendamentos vinculados' } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.removeProcedure('proc1');
    });

    expect(outcome).toEqual({ success: false, error: 'Procedimento possui agendamentos vinculados' });
  });
});

describe('AppContext > addAppointment / updateAppointment', () => {
  it('addAppointment (autenticado) chama appointmentsApi.create e adiciona o agendamento', async () => {
    const { result } = await renderReadyAppLoggedIn('c1');
    vi.mocked(appointmentsApi.create).mockResolvedValue({
      success: true,
      data: { appointment: { id: 'appt-1', companyId: 'c1', price: '150.00', durationMinutes: 30, status: 'SCHEDULED' } },
    } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.addAppointment({ procedureId: 'proc1', professionalId: 'prof1', date: '2026-09-10T10:00:00.000Z' });
    });

    expect(appointmentsApi.create).toHaveBeenCalled();
    expect(outcome?.success).toBe(true);
    expect(result.current.appointments).toHaveLength(1);
  });

  it('REGRESSÃO: addAppointment propaga conflito de horário em vez de fingir sucesso', async () => {
    const { result } = await renderReadyAppLoggedIn('c1');
    vi.mocked(appointmentsApi.create).mockResolvedValue({ success: false, error: 'Conflito de horário (CONFLICT)' } as never);

    let outcome: { success: boolean; error?: string; conflict?: boolean } | undefined;
    await act(async () => {
      outcome = await result.current.addAppointment({ procedureId: 'proc1', professionalId: 'prof1', date: '2026-09-10T10:00:00.000Z' });
    });

    expect(outcome?.success).toBe(false);
    expect(outcome?.conflict).toBe(true);
  });

  it('addAppointment (público, booking online) chama appointmentsApi.createPublic', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(appointmentsApi.createPublic).mockResolvedValue({
      success: true,
      data: { appointment: { id: 'appt-2', companyId: 'c1', price: '150.00', durationMinutes: 30, status: 'PENDING_APPROVAL' } },
    } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.addAppointment(
        { procedureId: 'proc1', professionalId: 'prof1', date: '2026-09-10T10:00:00.000Z' },
        true,
        'c1',
        { name: 'Cliente', email: 'cliente@x.com', phone: '11999999999' }
      );
    });

    expect(appointmentsApi.createPublic).toHaveBeenCalled();
    expect(outcome?.success).toBe(true);
  });

  it('updateAppointment atualiza o agendamento em memória (usado internamente pelo processPayment)', async () => {
    const { result } = await renderReadyAppLoggedIn('c1');
    vi.mocked(appointmentsApi.create).mockResolvedValue({
      success: true,
      data: { appointment: { id: 'appt-1', companyId: 'c1', price: '150.00', durationMinutes: 30, status: 'SCHEDULED' } },
    } as never);
    await act(async () => {
      await result.current.addAppointment({ procedureId: 'proc1', professionalId: 'prof1', date: '2026-09-10T10:00:00.000Z' });
    });

    act(() => {
      result.current.updateAppointment('appt-1', { paid: true, status: 'completed' });
    });

    expect(result.current.appointments[0].paid).toBe(true);
    expect(result.current.appointments[0].status).toBe('completed');
  });
});

describe('AppContext > addInventoryItem', () => {
  it('addInventoryItem chama inventoryApi.create e adiciona o item', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(inventoryApi.create).mockResolvedValue({
      success: true,
      data: { item: { id: 'item-1', name: 'Toxina Botulínica', currentStock: 10 } },
    } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.addInventoryItem({ name: 'Toxina Botulínica', currentStock: 10 } as never);
    });

    expect(inventoryApi.create).toHaveBeenCalled();
    expect(outcome?.success).toBe(true);
    expect(result.current.inventory).toHaveLength(1);
  });

  it('REGRESSÃO: addInventoryItem propaga erro da API em vez de fingir sucesso', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(inventoryApi.create).mockResolvedValue({ success: false, error: 'Dados inválidos' } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.addInventoryItem({ name: '', currentStock: -1 } as never);
    });

    expect(outcome).toEqual({ success: false, error: 'Dados inválidos' });
    expect(result.current.inventory).toHaveLength(0);
  });
});

describe('AppContext > addPlan / updatePlan / removePlan (OWNER)', () => {
  it('addPlan chama plansApi.create e adiciona o plano', async () => {
    const { result } = await renderReadyAppLoggedIn('c1', 'OWNER');
    vi.mocked(plansApi.create).mockResolvedValue({
      success: true,
      data: { plan: { id: 'plan-1', name: 'Premium', price: '199.00', features: ['x'], active: true } },
    } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.addPlan({ name: 'Premium', price: 199, features: ['x'], active: true, maxProfessionals: -1, maxPatients: -1, modules: [], stripePaymentLink: '' });
    });

    expect(plansApi.create).toHaveBeenCalled();
    expect(outcome?.success).toBe(true);
    expect(result.current.saasPlans).toHaveLength(1);
  });

  it('REGRESSÃO: addPlan propaga erro da API em vez de fingir sucesso', async () => {
    const { result } = await renderReadyAppLoggedIn('c1', 'OWNER');
    vi.mocked(plansApi.create).mockResolvedValue({ success: false, error: 'Dados inválidos' } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.addPlan({ name: '', price: 0, features: [], active: true, maxProfessionals: -1, maxPatients: -1, modules: [], stripePaymentLink: '' });
    });

    expect(outcome).toEqual({ success: false, error: 'Dados inválidos' });
  });

  it('updatePlan chama plansApi.update e atualiza em memória', async () => {
    const { result } = await renderReadyAppLoggedIn('c1', 'OWNER');
    vi.mocked(plansApi.update).mockResolvedValue({
      success: true,
      data: { plan: { id: 'plan-1', name: 'Premium Plus', price: '249.00', features: ['x'], active: true } },
    } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.updatePlan('plan-1', { name: 'Premium Plus', price: 249 });
    });

    expect(plansApi.update).toHaveBeenCalledWith('plan-1', { name: 'Premium Plus', price: 249 });
    expect(outcome).toEqual({ success: true });
  });

  it('REGRESSÃO: updatePlan propaga erro da API em vez de fingir sucesso', async () => {
    const { result } = await renderReadyAppLoggedIn('c1', 'OWNER');
    vi.mocked(plansApi.update).mockResolvedValue({ success: false, error: 'Dados inválidos' } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.updatePlan('plan-1', { price: -1 });
    });

    expect(outcome).toEqual({ success: false, error: 'Dados inválidos' });
  });

  it('removePlan chama plansApi.delete e remove da lista', async () => {
    const { result } = await renderReadyAppLoggedIn('c1', 'OWNER');
    vi.mocked(plansApi.delete).mockResolvedValue({ success: true } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.removePlan('plan-1');
    });

    expect(plansApi.delete).toHaveBeenCalledWith('plan-1');
    expect(outcome).toEqual({ success: true });
  });

  it('REGRESSÃO: removePlan propaga erro da API (ex: plano em uso por empresas) em vez de fingir sucesso', async () => {
    const { result } = await renderReadyAppLoggedIn('c1', 'OWNER');
    vi.mocked(plansApi.delete).mockResolvedValue({ success: false, error: 'Plano em uso por empresas ativas' } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.removePlan('plan-1');
    });

    expect(outcome).toEqual({ success: false, error: 'Plano em uso por empresas ativas' });
  });
});

describe('AppContext > login / loginWithToken / logout / registerCompany / setupGoogleCompany / resetUserPassword', () => {
  const MOCK_API_USER = {
    id: 'u1', name: 'Admin', email: 'admin@teste.com', role: 'ADMIN', isActive: true,
    company: { id: 'c1', name: 'Clínica X', slug: 'clinica-x', plan: 'BASIC', subscriptionStatus: 'ACTIVE' },
  };

  it('login: sucesso mapeia o usuário e a empresa e retorna true', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(authApi.login).mockResolvedValue({ success: true, data: { user: MOCK_API_USER } } as never);

    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.login('admin@teste.com', 'senha123');
    });

    expect(authApi.login).toHaveBeenCalledWith('admin@teste.com', 'senha123');
    expect(outcome).toBe(true);
    expect(result.current.user?.email).toBe('admin@teste.com');
    expect(result.current.companies).toHaveLength(1);
  });

  it('REGRESSÃO: login com credenciais inválidas retorna false em vez de autenticar mesmo assim', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(authApi.login).mockResolvedValue({ success: false, error: 'Credenciais inválidas' } as never);

    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.login('admin@teste.com', 'senha-errada');
    });

    expect(outcome).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('loginWithToken: sucesso restaura sessão via authApi.me e retorna true', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(authApi.me).mockResolvedValue({ success: true, data: { user: MOCK_API_USER } } as never);

    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.loginWithToken('token-123');
    });

    expect(outcome).toBe(true);
    expect(result.current.user?.email).toBe('admin@teste.com');
  });

  it('REGRESSÃO: loginWithToken com token inválido retorna false', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(authApi.me).mockResolvedValue({ success: false } as never);

    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.loginWithToken('token-invalido');
    });

    expect(outcome).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('logout limpa o estado do usuário e dos dados carregados', async () => {
    const { result } = await renderReadyAppLoggedIn('c1');
    vi.mocked(authApi.logout).mockResolvedValue({ success: true } as never);

    await act(async () => {
      await result.current.logout();
    });

    expect(authApi.logout).toHaveBeenCalled();
    expect(result.current.user).toBeNull();
    expect(result.current.patients).toHaveLength(0);
  });

  it('logout limpa o estado local mesmo se a chamada de API falhar (sessão já é encerrada no cliente)', async () => {
    const { result } = await renderReadyAppLoggedIn('c1');
    vi.mocked(authApi.logout).mockRejectedValue(new Error('network down'));

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.user).toBeNull();
  });

  it('registerCompany: sucesso cria lead local e retorna {success:true}', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(authApi.register).mockResolvedValue({ success: true } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.registerCompany('Clínica Y', { name: 'Dona', email: 'dona@y.com', password: 'senha123' });
    });

    expect(authApi.register).toHaveBeenCalled();
    expect(outcome).toEqual({ success: true });
    expect(result.current.leads).toHaveLength(1);
  });

  it('REGRESSÃO: registerCompany propaga erro da API (ex: e-mail já cadastrado) em vez de fingir sucesso', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(authApi.register).mockResolvedValue({ success: false, error: 'E-mail já cadastrado' } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.registerCompany('Clínica Y', { name: 'Dona', email: 'duplicado@y.com', password: 'senha123' });
    });

    expect(outcome).toEqual({ success: false, error: 'E-mail já cadastrado' });
    expect(result.current.leads).toHaveLength(0);
  });

  it('setupGoogleCompany: sucesso retorna {success:true}', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(authApi.googleSetupCompany).mockResolvedValue({ success: true } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.setupGoogleCompany('Clínica Google');
    });

    expect(authApi.googleSetupCompany).toHaveBeenCalled();
    expect(outcome).toEqual({ success: true });
  });

  it('REGRESSÃO: setupGoogleCompany propaga erro da API em vez de fingir sucesso', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(authApi.googleSetupCompany).mockResolvedValue({ success: false, error: 'Nome já em uso' } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.setupGoogleCompany('Clínica Google');
    });

    expect(outcome).toEqual({ success: false, error: 'Nome já em uso' });
  });

  it('resetUserPassword chama usersApi.resetPassword e retorna sucesso', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(usersApi.resetPassword).mockResolvedValue({ success: true } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.resetUserPassword('u1', 'novaSenha123');
    });

    expect(usersApi.resetPassword).toHaveBeenCalledWith('u1', 'novaSenha123');
    expect(outcome).toEqual({ success: true });
  });

  it('REGRESSÃO: resetUserPassword propaga erro da API em vez de fingir sucesso', async () => {
    const { result } = await renderReadyApp();
    vi.mocked(usersApi.resetPassword).mockResolvedValue({ success: false, error: 'Senha muito curta' } as never);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.resetUserPassword('u1', '123');
    });

    expect(outcome).toEqual({ success: false, error: 'Senha muito curta' });
  });
});

describe('AppContext > markNotificationAsRead / completeOnboarding', () => {
  it('markNotificationAsRead chama notificationsApi.markAsRead e marca como lida em memória', async () => {
    // Idem: notificações são filtradas por companyId do usuário logado.
    const { result } = await renderReadyAppLoggedIn('c1');
    vi.mocked(notificationsApi.create).mockResolvedValue({
      success: true,
      data: { notification: { id: 'n1', message: 'Olá', type: 'INFO', createdAt: '2026-09-08T00:00:00.000Z', isRead: false } },
    } as never);
    await act(async () => { await result.current.addNotification({ companyId: 'c1', message: 'Olá', type: 'info' }); });
    expect(result.current.notifications[0].read).toBe(false);

    await act(async () => {
      await result.current.markNotificationAsRead('n1');
    });

    expect(notificationsApi.markAsRead).toHaveBeenCalledWith('n1');
    expect(result.current.notifications[0].read).toBe(true);
  });

  it('completeOnboarding chama updateCompany com onboardingCompleted:true', async () => {
    vi.mocked(authApi.me).mockResolvedValue({
      success: true,
      data: { user: { id: 'u1', name: 'Admin', email: 'admin@teste.com', role: 'ADMIN', company: { id: 'c1', name: 'Clínica X', slug: 'clinica-x', plan: 'BASIC', subscriptionStatus: 'ACTIVE' } } },
    } as never);
    const view = renderHook(() => useApp(), { wrapper });
    await waitFor(() => expect(view.result.current.isInitializing).toBe(false));
    await waitFor(() => expect(view.result.current.companies).toHaveLength(1));

    vi.mocked(companiesApi.update).mockResolvedValue({
      success: true,
      data: { company: { id: 'c1', name: 'Clínica X', slug: 'clinica-x', plan: 'BASIC', subscriptionStatus: 'ACTIVE', onboardingCompleted: true } },
    } as never);

    await act(async () => {
      view.result.current.completeOnboarding();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(companiesApi.update).toHaveBeenCalledWith('c1', { onboardingCompleted: true });
  });
});

describe('AppContext > isReadOnly (modo somente leitura por status de assinatura)', () => {
  // REGRESSÃO: isReadOnly só olhava a data de expiração. O webhook Asaas
  // PAYMENT_OVERDUE marca subscriptionStatus 'OVERDUE' SEM mexer na data —
  // o backend já bloqueava com 403, mas o frontend mostrava tudo liberado.
  async function renderWithCompany(over: { plan?: string; subscriptionStatus?: string; subscriptionExpiresAt?: string; role?: 'ADMIN' | 'OWNER' }) {
    vi.mocked(authApi.me).mockResolvedValue({
      success: true,
      data: {
        user: {
          id: 'u1', name: 'Admin', email: 'admin@teste.com', role: over.role ?? 'ADMIN',
          company: {
            id: 'c1', name: 'Clínica X', slug: 'clinica-x',
            plan: over.plan ?? 'STARTER',
            subscriptionStatus: over.subscriptionStatus ?? 'ACTIVE',
            subscriptionExpiresAt: over.subscriptionExpiresAt,
          },
        },
      },
    } as never);
    const view = renderHook(() => useApp(), { wrapper });
    await waitFor(() => expect(view.result.current.isInitializing).toBe(false));
    await waitFor(() => expect(view.result.current.companies).toHaveLength(1));
    return view;
  }

  const FUTURE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const PAST = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  it('retorna true quando subscriptionStatus é "overdue" mesmo com data de expiração no futuro', async () => {
    const { result } = await renderWithCompany({ subscriptionStatus: 'OVERDUE', subscriptionExpiresAt: FUTURE });
    expect(result.current.isReadOnly).toBe(true);
  });

  it('retorna true quando subscriptionStatus é "canceled" com data no futuro', async () => {
    const { result } = await renderWithCompany({ subscriptionStatus: 'CANCELED', subscriptionExpiresAt: FUTURE });
    expect(result.current.isReadOnly).toBe(true);
  });

  it('retorna false para assinatura ACTIVE com data futura', async () => {
    const { result } = await renderWithCompany({ subscriptionStatus: 'ACTIVE', subscriptionExpiresAt: FUTURE });
    expect(result.current.isReadOnly).toBe(false);
  });

  it('retorna true quando a data de expiração já passou, mesmo com status ACTIVE', async () => {
    const { result } = await renderWithCompany({ subscriptionStatus: 'ACTIVE', subscriptionExpiresAt: PAST });
    expect(result.current.isReadOnly).toBe(true);
  });

  it('OWNER nunca fica em modo somente leitura, mesmo com assinatura vencida', async () => {
    const { result } = await renderWithCompany({ subscriptionStatus: 'OVERDUE', subscriptionExpiresAt: PAST, role: 'OWNER' });
    expect(result.current.isReadOnly).toBe(false);
  });
});
