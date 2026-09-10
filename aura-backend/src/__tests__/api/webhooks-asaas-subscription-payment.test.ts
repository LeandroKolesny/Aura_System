// src/__tests__/api/webhooks-asaas-subscription-payment.test.ts
// Comportamento de negócio do evento SUBSCRIPTION_PAYMENT_RECEIVED do webhook
// Asaas: reinício do ciclo de sessões do Clube de Assinaturas.
// (a autenticação por token já é coberta em __tests__/security/webhook-asaas.test.ts)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { Company } from '@prisma/client'

vi.mock('@/lib/prisma', () => ({
  default: {
    company: { findFirst: vi.fn(), update: vi.fn() },
    patientSubscription: { findFirst: vi.fn(), update: vi.fn() },
  },
}))
vi.mock('@/lib/billingUtils', () => ({
  resolvePlanFromPayment: vi.fn().mockReturnValue('STARTER'),
}))

import { POST } from '../../app/api/webhooks/asaas/route'
import prisma from '@/lib/prisma'

const VALID_TOKEN = 'super-secret-webhook-token'
const ASAAS_SUB_ID = 'asaas-sub-123'

function makeRequest(body: Record<string, unknown>, token: string | null = VALID_TOKEN) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (token !== null) headers['asaas-access-token'] = token
  return new NextRequest('http://localhost/api/webhooks/asaas', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

function paymentReceivedBody() {
  return {
    event: 'SUBSCRIPTION_PAYMENT_RECEIVED',
    payment: {
      id: 'pay-1',
      customer: 'cus_1',
      subscription: ASAAS_SUB_ID,
      status: 'RECEIVED',
      value: 199,
      dueDate: '2026-09-10',
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.ASAAS_WEBHOOK_TOKEN = VALID_TOKEN
  vi.mocked(prisma.company.findFirst).mockResolvedValue({ id: 'company-1' } as Company)
  vi.mocked(prisma.company.update).mockResolvedValue({} as Company)
  vi.mocked(prisma.patientSubscription.update).mockResolvedValue({} as never)
})

afterEach(() => {
  delete process.env.ASAAS_WEBHOOK_TOKEN
})

describe('POST /api/webhooks/asaas — SUBSCRIPTION_PAYMENT_RECEIVED', () => {
  it('retorna 401 com token errado (não toca no banco)', async () => {
    const res = await POST(makeRequest(paymentReceivedBody(), 'wrong'))
    expect(res.status).toBe(401)
    expect(prisma.patientSubscription.findFirst).not.toHaveBeenCalled()
  })

  it('zera sessionsUsedThisCycle, atualiza lastCycleReset e avança nextBillingDate +1 mês', async () => {
    vi.mocked(prisma.patientSubscription.findFirst).mockResolvedValue({
      id: 'sub-1',
      status: 'ACTIVE',
      asaasSubscriptionId: ASAAS_SUB_ID,
      sessionsUsedThisCycle: { 'proc-a': 3, 'proc-b': 1 },
      plan: { items: [{ procedureId: 'proc-a' }, { procedureId: 'proc-b' }] },
    } as never)

    const before = new Date()
    const res = await POST(makeRequest(paymentReceivedBody()))
    expect(res.status).toBe(200)

    expect(prisma.patientSubscription.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ asaasSubscriptionId: ASAAS_SUB_ID, status: 'ACTIVE' }),
      })
    )

    const updateArg = vi.mocked(prisma.patientSubscription.update).mock.calls[0][0] as {
      where: { id: string }
      data: { sessionsUsedThisCycle: Record<string, number>; lastCycleReset: Date; nextBillingDate: Date }
    }
    expect(updateArg.where).toEqual({ id: 'sub-1' })
    expect(updateArg.data.sessionsUsedThisCycle).toEqual({ 'proc-a': 0, 'proc-b': 0 })
    expect(updateArg.data.lastCycleReset.getTime()).toBeGreaterThanOrEqual(before.getTime())

    const nextMonth = new Date(updateArg.data.lastCycleReset)
    nextMonth.setMonth(nextMonth.getMonth() + 1)
    expect(updateArg.data.nextBillingDate.getTime()).toBe(nextMonth.getTime())
  })

  it('recalcula com base nos items ATUAIS do plano mesmo se o plano foi editado', async () => {
    // sessionsUsedThisCycle ainda tem um procedimento antigo que saiu do plano
    vi.mocked(prisma.patientSubscription.findFirst).mockResolvedValue({
      id: 'sub-1',
      status: 'ACTIVE',
      asaasSubscriptionId: ASAAS_SUB_ID,
      sessionsUsedThisCycle: { 'proc-removido': 2, 'proc-novo': 1 },
      plan: { items: [{ procedureId: 'proc-novo' }, { procedureId: 'proc-recem-adicionado' }] },
    } as never)

    await POST(makeRequest(paymentReceivedBody()))

    const updateArg = vi.mocked(prisma.patientSubscription.update).mock.calls[0][0] as {
      data: { sessionsUsedThisCycle: Record<string, number> }
    }
    expect(updateArg.data.sessionsUsedThisCycle).toEqual({
      'proc-novo': 0,
      'proc-recem-adicionado': 0,
    })
    expect(updateArg.data.sessionsUsedThisCycle).not.toHaveProperty('proc-removido')
  })

  it('não faz nada quando não há PatientSubscription ACTIVE para o asaasSubscriptionId (sem erro)', async () => {
    vi.mocked(prisma.patientSubscription.findFirst).mockResolvedValue(null)

    const res = await POST(makeRequest(paymentReceivedBody()))

    expect(res.status).toBe(200)
    expect(prisma.patientSubscription.update).not.toHaveBeenCalled()
  })

  it('ignora o evento quando payment.subscription está ausente', async () => {
    const body = paymentReceivedBody()
    delete (body.payment as { subscription?: string }).subscription

    const res = await POST(makeRequest(body))

    expect(res.status).toBe(200)
    expect(prisma.patientSubscription.findFirst).not.toHaveBeenCalled()
    expect(prisma.patientSubscription.update).not.toHaveBeenCalled()
  })
})
