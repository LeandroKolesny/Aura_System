// __tests__/services/api.test.ts
//
// Cobertura da camada de API (services/api.ts) para as áreas que NÃO passam
// pelo AppContext e chamam essas funções direto das páginas: Assinaturas
// (Subscriptions.tsx / Dashboard.tsx), Google Calendar (Settings.tsx /
// Schedule.tsx), importação de CSV (Financial/Inventory/Patients/Procedures)
// e login com Google (Login.tsx).
//
// Escopo deliberadamente mais raso que os testes do AppContext: aqui provamos
// que cada função monta a requisição certa (URL, método, corpo) e repassa
// corretamente sucesso/erro do backend — não que a página reage certo a isso
// (essa lógica vive dentro dos componentes, não é testável sem renderizar).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  dashboardApi,
  subscriptionsApi,
  calendarApi,
  authApi,
  patientsApi,
  transactionsApi,
  proceduresApi,
  inventoryApi,
  companiesApi,
  whatsappApi,
  setAuthToken,
} from '../../services/api';

function mockFetchOnce(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

beforeEach(() => {
  setAuthToken(null);
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('dashboardApi.getStats', () => {
  it('chama GET /api/dashboard com o parâmetro "days" e repassa os dados', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(200, { revenue: 1000 }));

    const result = await dashboardApi.getStats(30);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/dashboard?days=30'),
      expect.objectContaining({ credentials: 'include' })
    );
    expect(result).toEqual({ success: true, data: { revenue: 1000 } });
  });

  it('usa 7 dias por padrão quando nenhum parâmetro é passado', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(200, {}));
    await dashboardApi.getStats();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('days=7'), expect.anything());
  });

  it('REGRESSÃO: repassa erro HTTP do backend em vez de fingir sucesso', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(500, { error: 'Erro ao calcular estatísticas' }));

    const result = await dashboardApi.getStats();

    expect(result).toEqual({ success: false, error: 'Erro ao calcular estatísticas' });
  });
});

describe('subscriptionsApi (Clube de Assinaturas)', () => {
  it('listPlans chama GET /api/subscriptions/plans', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(200, [{ id: 'plan-1' }]));
    const result = await subscriptionsApi.listPlans();
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/api\/subscriptions\/plans$/), expect.anything());
    expect(result).toEqual({ success: true, data: [{ id: 'plan-1' }] });
  });

  it('listPlans(true) inclui planos inativos na query string', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(200, []));
    await subscriptionsApi.listPlans(true);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('includeInactive=true'), expect.anything());
  });

  it('listPending chama GET /api/subscriptions/patients?status=PENDING', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(200, [{ id: 'sub-1' }]));
    const result = await subscriptionsApi.listPending();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/subscriptions/patients?status=PENDING'), expect.anything());
    expect(result.success).toBe(true);
  });

  it('listSubscribers chama GET /api/subscriptions/patients com status opcional', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(200, []));
    await subscriptionsApi.listSubscribers('ACTIVE');
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/subscriptions/patients?status=ACTIVE'), expect.anything());
  });

  it('subscribe chama POST /api/subscriptions/patients com o corpo correto', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(200, { id: 'sub-1' }));
    const payload = { patientId: 'p1', planId: 'plan-1', nextBillingDate: '2026-10-01' };

    const result = await subscriptionsApi.subscribe(payload);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/subscriptions/patients'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify(payload) })
    );
    expect(result).toEqual({ success: true, data: { id: 'sub-1' } });
  });

  it('REGRESSÃO: subscribe repassa erro de validação em vez de fingir sucesso', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(400, { error: 'Paciente já possui assinatura ativa neste plano' }));

    const result = await subscriptionsApi.subscribe({ patientId: 'p1', planId: 'plan-1', nextBillingDate: '2026-10-01' });

    expect(result).toEqual({ success: false, error: 'Paciente já possui assinatura ativa neste plano' });
  });

  it('cancel chama PUT /api/subscriptions/patients/:id/cancel', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(200, { id: 'sub-1', status: 'CANCELED' }));

    const result = await subscriptionsApi.cancel('sub-1');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/subscriptions/patients/sub-1/cancel'),
      expect.objectContaining({ method: 'PUT' })
    );
    expect(result.success).toBe(true);
  });

  it('REGRESSÃO: cancel repassa erro do backend (ex: assinatura já cancelada) em vez de fingir sucesso', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(409, { error: 'Assinatura já está cancelada' }));

    const result = await subscriptionsApi.cancel('sub-1');

    expect(result).toEqual({ success: false, error: 'Assinatura já está cancelada' });
  });

  it('activate chama PATCH /api/subscriptions/patients/:id/activate', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(200, { id: 'sub-1', status: 'ACTIVE' }));

    const result = await subscriptionsApi.activate('sub-1');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/subscriptions/patients/sub-1/activate'),
      expect.objectContaining({ method: 'PATCH' })
    );
    expect(result.success).toBe(true);
  });

  it('REGRESSÃO: activate repassa erro do backend em vez de fingir sucesso', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(400, { error: 'Cobrança inicial falhou' }));

    const result = await subscriptionsApi.activate('sub-1');

    expect(result).toEqual({ success: false, error: 'Cobrança inicial falhou' });
  });

  it('deactivatePlan chama DELETE /api/subscriptions/plans/:id', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(200, { success: true }));

    const result = await subscriptionsApi.deactivatePlan('plan-1');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/subscriptions/plans/plan-1'),
      expect.objectContaining({ method: 'DELETE' })
    );
    expect(result.success).toBe(true);
  });

  it('REGRESSÃO: deactivatePlan repassa erro do backend em vez de fingir sucesso', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(500, { error: 'Erro inesperado.' }));

    const result = await subscriptionsApi.deactivatePlan('plan-1');

    expect(result).toEqual({ success: false, error: 'Erro inesperado.' });
  });
});

describe('calendarApi (Google Calendar)', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    // Substitui window.location por um stub gravável só para este bloco —
    // Object.defineProperty evita o erro de tipagem de reatribuir `Location` direto.
    Object.defineProperty(window, 'location', { writable: true, value: { href: '' } });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { writable: true, value: originalLocation });
  });

  it('getStatus chama GET /api/auth/google/calendar/status', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(200, { connected: true, calendarId: 'cal-1' }));

    const result = await calendarApi.getStatus();

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/auth/google/calendar/status'), expect.anything());
    expect(result).toEqual({ success: true, data: { connected: true, calendarId: 'cal-1' } });
  });

  it('connect redireciona o navegador para o OAuth do Google com o modo "calendar"', async () => {
    await calendarApi.connect('/settings');
    expect(window.location.href).toContain('/api/auth/google?mode=calendar');
    expect(window.location.href).toContain('returnTo=%2Fsettings');
  });

  it('disconnect chama POST /api/auth/google/calendar/disconnect', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(200, { success: true }));

    const result = await calendarApi.disconnect();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/google/calendar/disconnect'),
      expect.objectContaining({ method: 'POST' })
    );
    expect(result.success).toBe(true);
  });

  it('REGRESSÃO: disconnect repassa erro do backend em vez de fingir sucesso', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(500, { error: 'Erro inesperado.' }));

    const result = await calendarApi.disconnect();

    expect(result).toEqual({ success: false, error: 'Erro inesperado.' });
  });

  it('sync chama POST /api/auth/google/calendar/sync e repassa a contagem sincronizada', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(200, { success: true, synced: 5 }));

    const result = await calendarApi.sync();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/google/calendar/sync'),
      expect.objectContaining({ method: 'POST' })
    );
    expect(result).toEqual({ success: true, data: { success: true, synced: 5 } });
  });

  it('REGRESSÃO: sync repassa erro do backend (ex: token expirado) em vez de fingir sucesso', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(401, { error: 'Sessão do Google expirada. Reconecte sua agenda.' }));

    const result = await calendarApi.sync();

    expect(result).toEqual({ success: false, error: 'Sessão do Google expirada. Reconecte sua agenda.' });
  });
});

describe('companiesApi (Perfil do Negócio — Settings.tsx)', () => {
  it('get chama GET /api/companies/:id e repassa os dados', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(200, { company: { id: 'c1', name: 'Clínica X' } }));

    const result = await companiesApi.get('c1');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/companies/c1'),
      expect.objectContaining({ credentials: 'include' })
    );
    expect(result).toEqual({ success: true, data: { company: { id: 'c1', name: 'Clínica X' } } });
  });

  it('update chama PUT /api/companies/:id com o corpo serializado', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(200, { company: { id: 'c1', name: 'Novo Nome' } }));
    const payload = { name: 'Novo Nome', cnpj: '', phones: ['(11) 99999-9999'] };

    const result = await companiesApi.update('c1', payload);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/companies/c1'),
      expect.objectContaining({ method: 'PUT', body: JSON.stringify(payload) })
    );
    expect(result.success).toBe(true);
  });

  it('REGRESSÃO: update repassa erro de validação do backend (ex: CNPJ inválido) em vez de fingir sucesso', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(400, { error: 'Dados inválidos' }));

    const result = await companiesApi.update('c1', { cnpj: '11.111.111/1111-11' });

    expect(result).toEqual({ success: false, error: 'Dados inválidos' });
  });
});

describe('whatsappApi (Integração WhatsApp — WhatsAppSettings.tsx)', () => {
  it('getStatus chama GET /api/whatsapp/instance', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(200, { status: 'CONNECTED', termsAccepted: true }));

    const result = await whatsappApi.getStatus();

    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(url).toContain('/api/whatsapp/instance');
    expect(options?.method ?? 'GET').toBe('GET');
    expect(result).toEqual({ success: true, data: { status: 'CONNECTED', termsAccepted: true } });
  });

  it('connect chama POST /api/whatsapp/instance com { acceptTerms } no corpo', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(200, { qrCode: 'data:image/png;base64,x', status: 'CONNECTING' }));

    const result = await whatsappApi.connect(true);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/whatsapp/instance'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ acceptTerms: true }) })
    );
    expect(result.data?.status).toBe('CONNECTING');
  });

  it('disconnect chama DELETE /api/whatsapp/instance', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(200, { success: true }));

    const result = await whatsappApi.disconnect();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/whatsapp/instance'),
      expect.objectContaining({ method: 'DELETE' })
    );
    expect(result.success).toBe(true);
  });

  it('setChatbotEnabled chama PATCH /api/whatsapp/instance com { chatbotEnabled }', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(200, { chatbotEnabled: false }));

    const result = await whatsappApi.setChatbotEnabled(false);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/whatsapp/instance'),
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ chatbotEnabled: false }) })
    );
    expect(result.data?.chatbotEnabled).toBe(false);
  });

  it('REGRESSÃO: connect repassa erro do backend (ex: 403 sem permissão) em vez de fingir sucesso', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(403, { error: 'Sem permissão' }));

    const result = await whatsappApi.connect(true);

    expect(result).toEqual({ success: false, error: 'Sem permissão' });
  });
});

describe('authApi.googleSignIn', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    // Substitui window.location por um stub gravável só para este bloco —
    // Object.defineProperty evita o erro de tipagem de reatribuir `Location` direto.
    Object.defineProperty(window, 'location', { writable: true, value: { href: '' } });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { writable: true, value: originalLocation });
  });

  it('redireciona para o OAuth do Google com o modo e returnTo corretos', async () => {
    await authApi.googleSignIn('register', '/onboarding');
    expect(window.location.href).toContain('/api/auth/google?');
    expect(window.location.href).toContain('mode=register');
    expect(window.location.href).toContain('returnTo=%2Fonboarding');
  });

  it('usa mode=login e returnTo=/ por padrão', async () => {
    await authApi.googleSignIn();
    expect(window.location.href).toContain('mode=login');
  });
});

describe('patientsApi.update (aba Marketing / PatientDetail)', () => {
  it('update chama PUT /api/patients/:id repassando marketingOptOut no corpo', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(200, { patient: { id: 'p1', marketingOptOut: true } }));

    const result = await patientsApi.update('p1', { marketingOptOut: true });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/patients/p1'),
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ marketingOptOut: true }) })
    );
    expect(result).toEqual({ success: true, data: { patient: { id: 'p1', marketingOptOut: true } } });
  });

  it('update repassa lastMarketingMessageSentAt no corpo (marca "já contatado" da aba Marketing)', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(200, { patient: { id: 'p1' } }));
    const iso = '2026-09-10T12:00:00.000Z';

    await patientsApi.update('p1', { lastMarketingMessageSentAt: iso });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/patients/p1'),
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ lastMarketingMessageSentAt: iso }) })
    );
  });

  it('REGRESSÃO: update repassa erro de validação do backend em vez de fingir sucesso', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(400, { error: 'Dados inválidos' }));

    const result = await patientsApi.update('p1', { lastMarketingMessageSentAt: 'data-ruim' });

    expect(result).toEqual({ success: false, error: 'Dados inválidos' });
  });
});

describe('Importação de CSV (patientsApi / transactionsApi / proceduresApi / inventoryApi)', () => {
  function makeFile() {
    return new File(['nome,email\nFulano,f@x.com'], 'pacientes.csv', { type: 'text/csv' });
  }

  it('patientsApi.importCSV envia o arquivo como FormData para /api/patients/import', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(200, { imported: 3, updated: 0, errors: [] }));

    const result = await patientsApi.importCSV(makeFile());

    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(url).toContain('/api/patients/import');
    expect(options?.method).toBe('POST');
    expect(options?.body).toBeInstanceOf(FormData);
    expect(result).toEqual({ success: true, data: { imported: 3, updated: 0, errors: [] } });
  });

  it('REGRESSÃO: patientsApi.importCSV repassa erros de linha do backend em vez de fingir sucesso total', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(200, { imported: 1, updated: 0, errors: [{ row: 2, name: 'Fulano', reason: 'E-mail inválido' }] }));

    const result = await patientsApi.importCSV(makeFile());

    expect(result.data?.errors).toHaveLength(1);
  });

  it('transactionsApi.importCSV envia o arquivo como FormData para /api/transactions/import', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(200, { imported: 5, updated: 0, errors: [] }));

    const result = await transactionsApi.importCSV(makeFile());

    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(url).toContain('/api/transactions/import');
    expect(options?.body).toBeInstanceOf(FormData);
    expect(result.success).toBe(true);
  });

  it('REGRESSÃO: transactionsApi.importCSV repassa erro HTTP (ex: arquivo inválido) em vez de fingir sucesso', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(400, { error: 'Arquivo CSV inválido ou vazio' }));

    const result = await transactionsApi.importCSV(makeFile());

    expect(result).toEqual({ success: false, error: 'Arquivo CSV inválido ou vazio' });
  });

  it('proceduresApi.importCSV envia o arquivo como FormData para /api/procedures/import', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(200, { imported: 2, updated: 1, errors: [] }));

    const result = await proceduresApi.importCSV(makeFile());

    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(url).toContain('/api/procedures/import');
    expect(options?.body).toBeInstanceOf(FormData);
    expect(result.success).toBe(true);
  });

  it('REGRESSÃO: proceduresApi.importCSV repassa erro HTTP em vez de fingir sucesso', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(500, { error: 'Erro inesperado.' }));

    const result = await proceduresApi.importCSV(makeFile());

    expect(result).toEqual({ success: false, error: 'Erro inesperado.' });
  });

  it('inventoryApi.importCSV envia o arquivo como FormData para /api/inventory/import', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(200, { imported: 4, updated: 0, errors: [] }));

    const result = await inventoryApi.importCSV(makeFile());

    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(url).toContain('/api/inventory/import');
    expect(options?.body).toBeInstanceOf(FormData);
    expect(result.success).toBe(true);
  });

  it('REGRESSÃO: inventoryApi.importCSV repassa erro HTTP em vez de fingir sucesso', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(400, { error: 'Coluna obrigatória "nome" ausente' }));

    const result = await inventoryApi.importCSV(makeFile());

    expect(result).toEqual({ success: false, error: 'Coluna obrigatória "nome" ausente' });
  });
});
