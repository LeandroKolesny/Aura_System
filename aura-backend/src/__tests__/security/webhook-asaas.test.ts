// src/__tests__/security/webhook-asaas.test.ts
// Testes de segurança para POST /api/webhooks/asaas

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { Company } from '@prisma/client'

vi.mock('@/lib/prisma', () => ({
  default: {
    company: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}))
vi.mock('@/lib/billingUtils', () => ({
  resolvePlanFromPayment: vi.fn().mockReturnValue('STARTER'),
}))

import { POST } from '../../app/api/webhooks/asaas/route'
import prisma from '@/lib/prisma'

const VALID_TOKEN = 'super-secret-webhook-token'

function makeWebhookRequest(token: string | null, body: Record<string, unknown> = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (token !== null) headers['asaas-access-token'] = token
  return new NextRequest('http://localhost/api/webhooks/asaas', {
    method: 'POST',
    headers,
    body: JSON.stringify({ event: 'PAYMENT_CONFIRMED', ...body }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.ASAAS_WEBHOOK_TOKEN = VALID_TOKEN
  vi.mocked(prisma.company.findFirst).mockResolvedValue(null)
  vi.mocked(prisma.company.update).mockResolvedValue({} as Company)
})

afterEach(() => {
  delete process.env.ASAAS_WEBHOOK_TOKEN
})

describe('SECURITY: autenticação do webhook Asaas (VULN-09)', () => {
  it('retorna 401 quando token ausente', async () => {
    const res = await POST(makeWebhookRequest(null))
    expect(res.status).toBe(401)
  })

  it('retorna 401 quando token incorreto', async () => {
    const res = await POST(makeWebhookRequest('wrong-token'))
    expect(res.status).toBe(401)
  })

  it('retorna 401 quando ASAAS_WEBHOOK_TOKEN não está configurado', async () => {
    delete process.env.ASAAS_WEBHOOK_TOKEN
    const res = await POST(makeWebhookRequest(VALID_TOKEN))
    expect(res.status).toBe(401)
  })

  it('retorna 401 quando token é string vazia', async () => {
    const res = await POST(makeWebhookRequest(''))
    expect(res.status).toBe(401)
  })

  it('processa evento com token correto', async () => {
    const res = await POST(makeWebhookRequest(VALID_TOKEN))
    expect(res.status).toBe(200)
  })

  it('não acessa banco de dados quando token inválido', async () => {
    await POST(makeWebhookRequest('bad-token'))
    expect(prisma.company.findFirst).not.toHaveBeenCalled()
    expect(prisma.company.update).not.toHaveBeenCalled()
  })

  it('retorna 400 para JSON inválido mesmo com token correto', async () => {
    const req = new NextRequest('http://localhost/api/webhooks/asaas', {
      method: 'POST',
      headers: {
        'asaas-access-token': VALID_TOKEN,
        'content-type': 'application/json',
      },
      body: 'not-valid-json{{{',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
