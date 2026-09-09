// aura-backend/src/__tests__/lib/asaas.test.ts
//
// NOTA: `asaas.ts` lê `process.env.ASAAS_API_KEY` uma única vez, no topo do
// módulo (`const ASAAS_API_KEY = process.env.ASAAS_API_KEY`) — não dentro de
// cada função. Por isso, mudar a env var depois que o módulo já foi
// importado não tem efeito. Cada teste usa `vi.resetModules()` + `import()`
// dinâmico para reavaliar o módulo com a env var certa.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

beforeEach(() => {
  vi.resetModules()
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  delete process.env.ASAAS_API_KEY
  delete process.env.ASAAS_BASE_URL
  delete process.env.ASAAS_SANDBOX
  vi.unstubAllGlobals()
})

async function loadAsaasWithKey(key = 'test-api-key') {
  process.env.ASAAS_API_KEY = key
  return import('@/lib/asaas')
}

describe('asaas.ts — configuração de ambiente', () => {
  it('REGRESSÃO: lança erro claro quando ASAAS_API_KEY não está configurada (não falha silenciosamente)', async () => {
    delete process.env.ASAAS_API_KEY
    const { findCustomerByEmail } = await import('@/lib/asaas')

    await expect(findCustomerByEmail('ana@x.com')).rejects.toThrow('ASAAS_API_KEY not configured')
  })

  it('usa a URL de sandbox quando ASAAS_SANDBOX=true', async () => {
    process.env.ASAAS_SANDBOX = 'true'
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: [], totalCount: 0 }) } as never)

    const { findCustomerByEmail } = await loadAsaasWithKey()
    await findCustomerByEmail('ana@x.com')

    const [url] = vi.mocked(fetch).mock.calls[0]
    expect(url).toContain('https://sandbox.asaas.com/api/v3')
  })

  it('usa ASAAS_BASE_URL quando explicitamente configurada, ignorando o sandbox flag', async () => {
    process.env.ASAAS_BASE_URL = 'https://custom.asaas.example/api/v3'
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: [], totalCount: 0 }) } as never)

    const { findCustomerByEmail } = await loadAsaasWithKey()
    await findCustomerByEmail('ana@x.com')

    const [url] = vi.mocked(fetch).mock.calls[0]
    expect(url).toContain('https://custom.asaas.example/api/v3')
  })
})

describe('findCustomerByEmail', () => {
  it('retorna o primeiro cliente encontrado, com a query codificada corretamente', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ id: 'cus_1', name: 'Ana', email: 'ana+teste@x.com' }], totalCount: 1 }),
    } as never)

    const { findCustomerByEmail } = await loadAsaasWithKey()
    const result = await findCustomerByEmail('ana+teste@x.com')

    const [url, options] = vi.mocked(fetch).mock.calls[0]
    expect(url).toContain(encodeURIComponent('ana+teste@x.com'))
    expect((options?.headers as Record<string, string>)['access_token']).toBe('test-api-key')
    expect(result?.id).toBe('cus_1')
  })

  it('retorna null quando nenhum cliente é encontrado', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: [], totalCount: 0 }) } as never)

    const { findCustomerByEmail } = await loadAsaasWithKey()
    const result = await findCustomerByEmail('inexistente@x.com')

    expect(result).toBeNull()
  })

  it('REGRESSÃO: lança erro com status e corpo quando a API do Asaas retorna erro', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 401, text: () => Promise.resolve('Invalid API key') } as never)

    const { findCustomerByEmail } = await loadAsaasWithKey()
    await expect(findCustomerByEmail('ana@x.com')).rejects.toThrow('Asaas API error 401: Invalid API key')
  })
})

describe('createCustomer', () => {
  it('faz POST /customers com os dados do cliente', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'cus_2', name: 'Bruna', email: 'bruna@x.com' }),
    } as never)

    const { createCustomer } = await loadAsaasWithKey()
    const result = await createCustomer({ name: 'Bruna', email: 'bruna@x.com', cpfCnpj: '52998224725' })

    const [url, options] = vi.mocked(fetch).mock.calls[0]
    expect(url).toContain('/customers')
    expect(options?.method).toBe('POST')
    expect(JSON.parse(options?.body as string)).toEqual({ name: 'Bruna', email: 'bruna@x.com', cpfCnpj: '52998224725' })
    expect(result.id).toBe('cus_2')
  })
})

describe('createSubscription', () => {
  it('faz POST /subscriptions com cycle=MONTHLY sempre incluído', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'sub_1', customer: 'cus_1', status: 'ACTIVE', value: 199, nextDueDate: '2026-10-01' }),
    } as never)

    const { createSubscription } = await loadAsaasWithKey()
    await createSubscription({ customer: 'cus_1', billingType: 'PIX', value: 199, nextDueDate: '2026-10-01', description: 'Plano Premium' })

    const [, options] = vi.mocked(fetch).mock.calls[0]
    const body = JSON.parse(options?.body as string)
    expect(body.cycle).toBe('MONTHLY')
    expect(body.billingType).toBe('PIX')
  })
})

describe('getSubscriptionPayments', () => {
  it('busca o primeiro pagamento da assinatura', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ id: 'pay_1', status: 'PENDING', value: 199, invoiceUrl: 'https://x', bankSlipUrl: null, pixQrCodeUrl: null, billingType: 'PIX' }] }),
    } as never)

    const { getSubscriptionPayments } = await loadAsaasWithKey()
    const result = await getSubscriptionPayments('sub_1')

    const [url] = vi.mocked(fetch).mock.calls[0]
    expect(url).toContain('/subscriptions/sub_1/payments')
    expect(result).toHaveLength(1)
  })
})

describe('cancelSubscription', () => {
  it('faz DELETE /subscriptions/:id', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: () => Promise.resolve({}) } as never)

    const { cancelSubscription } = await loadAsaasWithKey()
    await cancelSubscription('sub_1')

    const [url, options] = vi.mocked(fetch).mock.calls[0]
    expect(url).toContain('/subscriptions/sub_1')
    expect(options?.method).toBe('DELETE')
  })

  it('REGRESSÃO: propaga erro quando o cancelamento falha em vez de engolir silenciosamente', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 404, text: () => Promise.resolve('Subscription not found') } as never)

    const { cancelSubscription } = await loadAsaasWithKey()
    await expect(cancelSubscription('sub-inexistente')).rejects.toThrow('Asaas API error 404')
  })
})
