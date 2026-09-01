// aura-backend/src/__tests__/api/billing-checkout.test.ts
// Testes para POST /api/billing/checkout — cria assinatura paga na Asaas

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    saasPlan: { findUnique: vi.fn() },
    company: { findUnique: vi.fn(), update: vi.fn() },
  },
}))

vi.mock('@/lib/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth')
  return { ...actual, getAuthUser: vi.fn() }
})

vi.mock('@/lib/asaas', () => ({
  findCustomerByEmail: vi.fn(),
  createCustomer: vi.fn(),
  createSubscription: vi.fn(),
  getSubscriptionPayments: vi.fn(),
}))

import { POST } from '../../app/api/billing/checkout/route'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  findCustomerByEmail,
  createCustomer,
  createSubscription,
  getSubscriptionPayments,
} from '@/lib/asaas'

const ADMIN = { id: 'u1', email: 'admin@clinica.com', role: 'ADMIN', companyId: 'c1' }
const NON_ADMIN = { id: 'u2', email: 'staff@clinica.com', role: 'RECEPTIONIST', companyId: 'c1' }

const SAAS_PLAN = {
  id: 'plan-starter',
  name: 'Starter',
  displayName: 'Starter',
  price: 97,
  isActive: true,
}

const COMPANY_NO_ASAAS = {
  id: 'c1',
  name: 'Clínica Teste',
  cnpj: null,
  asaasCustomerId: null,
  asaasSubscriptionId: null,
}

const COMPANY_WITH_ASAAS = {
  ...COMPANY_NO_ASAAS,
  asaasCustomerId: 'cus_existing123',
}

function makeRequest(body: Record<string, unknown> = { planId: 'plan-starter' }) {
  return new NextRequest('http://localhost/api/billing/checkout', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.ASAAS_SANDBOX
  vi.mocked(prisma.company.update).mockResolvedValue({} as never)
  vi.mocked(createSubscription).mockResolvedValue({
    id: 'sub_123', customer: 'cus_1', status: 'PENDING', value: 97, nextDueDate: '2026-01-01',
  } as never)
  vi.mocked(getSubscriptionPayments).mockResolvedValue([
    { id: 'pay_1', status: 'PENDING', value: 97, invoiceUrl: 'https://asaas.test/invoice/1', bankSlipUrl: null, pixQrCodeUrl: null, billingType: 'UNDEFINED' },
  ] as never)
})

describe('POST /api/billing/checkout', () => {
  it('retorna 403 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await POST(makeRequest())
    expect(res.status).toBe(403)
  })

  it('retorna 403 quando autenticado mas não é admin', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(NON_ADMIN as never)
    const res = await POST(makeRequest())
    expect(res.status).toBe(403)
  })

  it('retorna 400 quando admin não tem empresa', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ ...ADMIN, companyId: null } as never)
    const res = await POST(makeRequest())
    expect(res.status).toBe(400)
  })

  it('retorna 400 quando planId não é enviado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
  })

  it('retorna 404 quando o plano não existe', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.saasPlan.findUnique).mockResolvedValue(null)
    const res = await POST(makeRequest())
    expect(res.status).toBe(404)
  })

  it('retorna 404 quando o plano existe mas está inativo', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.saasPlan.findUnique).mockResolvedValue({ ...SAAS_PLAN, isActive: false } as never)
    const res = await POST(makeRequest())
    expect(res.status).toBe(404)
  })

  it('retorna 404 quando a empresa não é encontrada no banco', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.saasPlan.findUnique).mockResolvedValue(SAAS_PLAN as never)
    vi.mocked(prisma.company.findUnique).mockResolvedValue(null)
    const res = await POST(makeRequest())
    expect(res.status).toBe(404)
  })

  it('reaproveita cliente Asaas existente sem chamar findCustomerByEmail/createCustomer', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.saasPlan.findUnique).mockResolvedValue(SAAS_PLAN as never)
    vi.mocked(prisma.company.findUnique).mockResolvedValue(COMPANY_WITH_ASAAS as never)

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(findCustomerByEmail).not.toHaveBeenCalled()
    expect(createCustomer).not.toHaveBeenCalled()
    expect(createSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_existing123' })
    )
  })

  it('reaproveita cliente Asaas encontrado por email quando a empresa ainda não tem asaasCustomerId', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.saasPlan.findUnique).mockResolvedValue(SAAS_PLAN as never)
    vi.mocked(prisma.company.findUnique).mockResolvedValue(COMPANY_NO_ASAAS as never)
    vi.mocked(findCustomerByEmail).mockResolvedValue({ id: 'cus_found', name: 'Clínica Teste', email: ADMIN.email } as never)

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(createCustomer).not.toHaveBeenCalled()
    expect(prisma.company.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { asaasCustomerId: 'cus_found' } })
    )
  })

  it('cria cliente novo na Asaas quando não encontra por email, sem CPF de teste fora do sandbox', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.saasPlan.findUnique).mockResolvedValue(SAAS_PLAN as never)
    vi.mocked(prisma.company.findUnique).mockResolvedValue(COMPANY_NO_ASAAS as never)
    vi.mocked(findCustomerByEmail).mockResolvedValue(null)
    vi.mocked(createCustomer).mockResolvedValue({ id: 'cus_new', name: 'Clínica Teste', email: ADMIN.email } as never)

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(createCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Clínica Teste', email: ADMIN.email, cpfCnpj: undefined })
    )
  })

  it('usa CPF de teste quando em sandbox e a empresa não tem CNPJ', async () => {
    process.env.ASAAS_SANDBOX = 'true'
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.saasPlan.findUnique).mockResolvedValue(SAAS_PLAN as never)
    vi.mocked(prisma.company.findUnique).mockResolvedValue(COMPANY_NO_ASAAS as never)
    vi.mocked(findCustomerByEmail).mockResolvedValue(null)
    vi.mocked(createCustomer).mockResolvedValue({ id: 'cus_new', name: 'Clínica Teste', email: ADMIN.email } as never)

    await POST(makeRequest())

    expect(createCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ cpfCnpj: '24971563792' })
    )
  })

  it('mapeia o nome do plano para o enum correto no externalReference da assinatura', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.saasPlan.findUnique).mockResolvedValue({ ...SAAS_PLAN, name: 'Pro' } as never)
    vi.mocked(prisma.company.findUnique).mockResolvedValue(COMPANY_WITH_ASAAS as never)

    await POST(makeRequest())

    expect(createSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ externalReference: 'PROFESSIONAL' })
    )
  })

  it('usa STARTER como fallback quando o nome do plano não está no mapa', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.saasPlan.findUnique).mockResolvedValue({ ...SAAS_PLAN, name: 'PlanoDesconhecido' } as never)
    vi.mocked(prisma.company.findUnique).mockResolvedValue(COMPANY_WITH_ASAAS as never)

    await POST(makeRequest())

    expect(createSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ externalReference: 'STARTER' })
    )
  })

  it('salva o asaasSubscriptionId na empresa após criar a assinatura', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.saasPlan.findUnique).mockResolvedValue(SAAS_PLAN as never)
    vi.mocked(prisma.company.findUnique).mockResolvedValue(COMPANY_WITH_ASAAS as never)

    await POST(makeRequest())

    expect(prisma.company.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { asaasSubscriptionId: 'sub_123' } })
    )
  })

  it('prioriza invoiceUrl como link de pagamento quando disponível', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.saasPlan.findUnique).mockResolvedValue(SAAS_PLAN as never)
    vi.mocked(prisma.company.findUnique).mockResolvedValue(COMPANY_WITH_ASAAS as never)
    vi.mocked(getSubscriptionPayments).mockResolvedValue([
      { id: 'pay_1', status: 'PENDING', value: 97, invoiceUrl: 'https://asaas.test/invoice', bankSlipUrl: 'https://asaas.test/boleto', pixQrCodeUrl: 'https://asaas.test/pix', billingType: 'UNDEFINED' },
    ] as never)

    const res = await POST(makeRequest())
    const body = await res.json()

    expect(body.data.paymentUrl).toBe('https://asaas.test/invoice')
  })

  it('cai para pixQrCodeUrl e depois bankSlipUrl quando invoiceUrl não existe', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.saasPlan.findUnique).mockResolvedValue(SAAS_PLAN as never)
    vi.mocked(prisma.company.findUnique).mockResolvedValue(COMPANY_WITH_ASAAS as never)
    vi.mocked(getSubscriptionPayments).mockResolvedValue([
      { id: 'pay_1', status: 'PENDING', value: 97, invoiceUrl: null, bankSlipUrl: 'https://asaas.test/boleto', pixQrCodeUrl: 'https://asaas.test/pix', billingType: 'UNDEFINED' },
    ] as never)

    const res = await POST(makeRequest())
    const body = await res.json()

    expect(body.data.paymentUrl).toBe('https://asaas.test/pix')
  })

  it('retorna paymentUrl null quando não há nenhum link disponível', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.saasPlan.findUnique).mockResolvedValue(SAAS_PLAN as never)
    vi.mocked(prisma.company.findUnique).mockResolvedValue(COMPANY_WITH_ASAAS as never)
    vi.mocked(getSubscriptionPayments).mockResolvedValue([])

    const res = await POST(makeRequest())
    const body = await res.json()

    expect(body.data.paymentUrl).toBeNull()
  })

  it('retorna erro genérico (sem vazar detalhes internos) quando a Asaas falha', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.saasPlan.findUnique).mockResolvedValue(SAAS_PLAN as never)
    vi.mocked(prisma.company.findUnique).mockResolvedValue(COMPANY_WITH_ASAAS as never)
    vi.mocked(createSubscription).mockRejectedValue(new Error('Asaas API error 500: chave inválida xyz123'))

    const res = await POST(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).not.toContain('xyz123')
    expect(body.error).toBeTruthy()
  })
})
