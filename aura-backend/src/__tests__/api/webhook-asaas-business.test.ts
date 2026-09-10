// aura-backend/src/__tests__/api/webhook-asaas-business.test.ts
// Lógica de NEGÓCIO do webhook Asaas (complementa webhook-asaas.test.ts, que só
// cobre a camada de segurança/autenticação). Foco: mudança de plan/status/
// expiração por tipo de evento, resolução da empresa por asaasCustomerId,
// eventos sem customer, empresa inexistente, idempotência e o guard que impede
// um SUBSCRIPTION_INACTIVATED de assinatura antiga de derrubar a assinatura nova.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { Company } from '@prisma/client'

vi.mock('@/lib/prisma', () => ({
  default: {
    company: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    patientSubscription: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/billingUtils', () => ({
  resolvePlanFromPayment: vi.fn().mockReturnValue('PROFESSIONAL'),
}))

import { POST } from '../../app/api/webhooks/asaas/route'
import prisma from '@/lib/prisma'
import { resolvePlanFromPayment } from '@/lib/billingUtils'

const VALID_TOKEN = 'super-secret-webhook-token'

const COMPANY: Partial<Company> = {
  id: 'comp_1',
  asaasCustomerId: 'cus_123',
  asaasSubscriptionId: 'sub_current',
  plan: 'STARTER',
  subscriptionStatus: 'ACTIVE',
}

function makeWebhookRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/webhooks/asaas', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'asaas-access-token': VALID_TOKEN,
    },
    body: JSON.stringify(body),
  })
}

const basePayment = {
  id: 'pay_1',
  customer: 'cus_123',
  status: 'CONFIRMED',
  value: 197,
  dueDate: '2026-06-16',
  externalReference: 'PROFESSIONAL',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-06-15T12:00:00.000Z'))
  process.env.ASAAS_WEBHOOK_TOKEN = VALID_TOKEN
  vi.mocked(prisma.company.findFirst).mockResolvedValue(COMPANY as Company)
  vi.mocked(prisma.company.update).mockResolvedValue({} as Company)
  vi.mocked(resolvePlanFromPayment).mockReturnValue('PROFESSIONAL')
})

afterEach(() => {
  vi.useRealTimers()
  delete process.env.ASAAS_WEBHOOK_TOKEN
})

describe('webhook Asaas — PAYMENT_CONFIRMED', () => {
  it('atualiza plan (via resolvePlanFromPayment), status ACTIVE e expiração +1 mês', async () => {
    const res = await POST(makeWebhookRequest({ event: 'PAYMENT_CONFIRMED', payment: basePayment }))

    expect(res.status).toBe(200)
    expect(resolvePlanFromPayment).toHaveBeenCalledWith(basePayment)
    expect(prisma.company.update).toHaveBeenCalledTimes(1)

    const arg = vi.mocked(prisma.company.update).mock.calls[0][0]
    expect(arg.where).toEqual({ id: 'comp_1' })
    expect(arg.data.plan).toBe('PROFESSIONAL')
    expect(arg.data.subscriptionStatus).toBe('ACTIVE')

    const expiresAt = arg.data.subscriptionExpiresAt as Date
    expect(expiresAt).toBeInstanceOf(Date)
    // 2026-06-15 → 2026-07-15
    expect(expiresAt.getUTCFullYear()).toBe(2026)
    expect(expiresAt.getUTCMonth()).toBe(6) // julho (0-indexed)
    expect(expiresAt.getUTCDate()).toBe(15)
  })

  it('é idempotente: dois PAYMENT_CONFIRMED seguidos deixam plan/status finais iguais', async () => {
    await POST(makeWebhookRequest({ event: 'PAYMENT_CONFIRMED', payment: basePayment }))
    await POST(makeWebhookRequest({ event: 'PAYMENT_CONFIRMED', payment: basePayment }))

    const first = vi.mocked(prisma.company.update).mock.calls[0][0].data
    const second = vi.mocked(prisma.company.update).mock.calls[1][0].data
    expect(second.plan).toBe(first.plan)
    expect(second.subscriptionStatus).toBe(first.subscriptionStatus)
    expect((second.subscriptionExpiresAt as Date).getTime())
      .toBe((first.subscriptionExpiresAt as Date).getTime())
  })
})

describe('webhook Asaas — PAYMENT_OVERDUE', () => {
  it('marca status OVERDUE SEM tocar em plan nem em subscriptionExpiresAt', async () => {
    const res = await POST(makeWebhookRequest({
      event: 'PAYMENT_OVERDUE',
      payment: { ...basePayment, status: 'OVERDUE' },
    }))

    expect(res.status).toBe(200)
    expect(prisma.company.update).toHaveBeenCalledTimes(1)
    expect(prisma.company.update).toHaveBeenCalledWith({
      where: { id: 'comp_1' },
      data: { subscriptionStatus: 'OVERDUE' },
    })
  })
})

describe('webhook Asaas — cancelamento (SUBSCRIPTION_INACTIVATED / PAYMENT_DELETED)', () => {
  it('SUBSCRIPTION_INACTIVATED da assinatura vigente → status CANCELED e asaasSubscriptionId null', async () => {
    const res = await POST(makeWebhookRequest({
      event: 'SUBSCRIPTION_INACTIVATED',
      subscription: { id: 'sub_current', customer: 'cus_123', status: 'INACTIVE' },
    }))

    expect(res.status).toBe(200)
    expect(prisma.company.update).toHaveBeenCalledWith({
      where: { id: 'comp_1' },
      data: { subscriptionStatus: 'CANCELED', asaasSubscriptionId: null },
    })
  })

  it('PAYMENT_DELETED (sem id de assinatura no evento) → status CANCELED e asaasSubscriptionId null', async () => {
    const res = await POST(makeWebhookRequest({
      event: 'PAYMENT_DELETED',
      payment: { ...basePayment, status: 'DELETED' },
    }))

    expect(res.status).toBe(200)
    expect(prisma.company.update).toHaveBeenCalledWith({
      where: { id: 'comp_1' },
      data: { subscriptionStatus: 'CANCELED', asaasSubscriptionId: null },
    })
  })

  it('SUBSCRIPTION_INACTIVATED de uma assinatura ANTIGA (já substituída) NÃO derruba a empresa', async () => {
    // Cenário: o checkout cancelou a assinatura anterior ao trocar de plano; o
    // Asaas dispara o inactivated da assinatura velha DEPOIS da nova já existir.
    const res = await POST(makeWebhookRequest({
      event: 'SUBSCRIPTION_INACTIVATED',
      subscription: { id: 'sub_old', customer: 'cus_123', status: 'INACTIVE' },
    }))

    expect(res.status).toBe(200)
    expect(prisma.company.update).not.toHaveBeenCalled()
  })
})

describe('webhook Asaas — casos de borda', () => {
  it('evento sem payment.customer nem subscription.customer → 200 sem tocar o banco', async () => {
    const res = await POST(makeWebhookRequest({ event: 'PAYMENT_CONFIRMED' }))

    expect(res.status).toBe(200)
    expect(prisma.company.findFirst).not.toHaveBeenCalled()
    expect(prisma.company.update).not.toHaveBeenCalled()
  })

  it('customerId sem empresa correspondente → 200 sem erro e sem update', async () => {
    vi.mocked(prisma.company.findFirst).mockResolvedValue(null)

    const res = await POST(makeWebhookRequest({ event: 'PAYMENT_CONFIRMED', payment: basePayment }))

    expect(res.status).toBe(200)
    expect(prisma.company.update).not.toHaveBeenCalled()
  })

  it('evento desconhecido com customer válido → 200 sem update', async () => {
    const res = await POST(makeWebhookRequest({
      event: 'PAYMENT_RECEIVED',
      payment: basePayment,
    }))

    expect(res.status).toBe(200)
    expect(prisma.company.update).not.toHaveBeenCalled()
  })
})
