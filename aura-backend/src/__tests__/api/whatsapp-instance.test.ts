import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { WhatsappInstance } from '@prisma/client'

vi.mock('@/lib/prisma', () => ({
  default: {
    whatsappInstance: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
    company: { findUnique: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))
vi.mock('@/lib/apiGuards', () => ({ checkWriteAccess: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/planPermissions', () => ({ hasModuleAccess: vi.fn() }))
vi.mock('@/lib/whatsapp', () => ({
  createInstance: vi.fn().mockResolvedValue({ instanceName: 'aura-c1' }),
  getQRCode: vi.fn().mockResolvedValue('data:image/png;base64,qr'),
  getInstanceStatus: vi.fn().mockResolvedValue('DISCONNECTED'),
  deleteInstance: vi.fn().mockResolvedValue(undefined),
  getInstanceName: vi.fn().mockReturnValue('aura-c1'),
  setWebhook: vi.fn().mockResolvedValue(true),
}))

import { GET, POST, DELETE, PATCH } from '../../app/api/whatsapp/instance/route'
import { getAuthUser } from '@/lib/auth'
import { hasModuleAccess } from '@/lib/planPermissions'
import { setWebhook } from '@/lib/whatsapp'
import prisma from '@/lib/prisma'

const MOCK_USER = { id: 'u1', companyId: 'c1', role: 'ADMIN', email: 'a@b.com', name: 'A' }
const MOCK_COMPANY = { plan: 'PREMIUM', subscriptionStatus: 'ACTIVE', subscriptionExpiresAt: null }

function makeReq(method = 'GET') {
  return new NextRequest('http://localhost/api/whatsapp/instance', { method })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.EVOLUTION_API_URL = 'https://evo.test'
  vi.mocked(getAuthUser).mockResolvedValue(MOCK_USER as never)
  vi.mocked(prisma.company.findUnique).mockResolvedValue(MOCK_COMPANY as never)
  vi.mocked(hasModuleAccess).mockResolvedValue(true)
})

describe('GET /api/whatsapp/instance', () => {
  it('retorna 401 sem autenticação', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await GET(makeReq())
    expect(res.status).toBe(401)
  })

  it('retorna 403 se plano não tem módulo whatsapp_notifications', async () => {
    vi.mocked(hasModuleAccess).mockResolvedValue(false)
    const res = await GET(makeReq())
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.code).toBe('MODULE_NOT_AVAILABLE')
  })

  it('retorna status DISCONNECTED quando não há instância', async () => {
    vi.mocked(prisma.whatsappInstance.findUnique).mockResolvedValue(null)
    const res = await GET(makeReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('DISCONNECTED')
    expect(body.termsAccepted).toBe(false)
  })

  it('retorna dados da instância existente', async () => {
    const { getInstanceStatus } = await import('@/lib/whatsapp')
    vi.mocked(getInstanceStatus).mockResolvedValueOnce('CONNECTED')
    vi.mocked(prisma.whatsappInstance.findUnique).mockResolvedValue({
      status: 'CONNECTED',
      phoneNumber: '5511999990000',
      termsAccepted: true,
    } as unknown as WhatsappInstance)
    vi.mocked(prisma.whatsappInstance.update).mockResolvedValue({} as WhatsappInstance)
    const res = await GET(makeReq())
    const body = await res.json()
    expect(body.status).toBe('CONNECTED')
    expect(body.termsAccepted).toBe(true)
  })
})

describe('POST /api/whatsapp/instance', () => {
  it('retorna 403 se plano não tem módulo whatsapp_notifications', async () => {
    vi.mocked(hasModuleAccess).mockResolvedValue(false)
    const req = new NextRequest('http://localhost/api/whatsapp/instance', {
      method: 'POST',
      body: JSON.stringify({ acceptTerms: true }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.code).toBe('MODULE_NOT_AVAILABLE')
  })

  it('retorna 403 se termos não foram aceitos no body', async () => {
    vi.mocked(prisma.whatsappInstance.findUnique).mockResolvedValue(null)
    const req = new NextRequest('http://localhost/api/whatsapp/instance', {
      method: 'POST',
      body: JSON.stringify({ acceptTerms: false }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('retorna 503 com mensagem clara quando EVOLUTION_API_URL não está configurado', async () => {
    delete process.env.EVOLUTION_API_URL
    const req = new NextRequest('http://localhost/api/whatsapp/instance', {
      method: 'POST',
      body: JSON.stringify({ acceptTerms: true }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })

  it('retorna 500 quando createInstance falha inesperadamente, sem quebrar a resposta', async () => {
    const { createInstance } = await import('@/lib/whatsapp')
    vi.mocked(createInstance).mockRejectedValueOnce(new Error('Falha inesperada de rede'))
    const req = new NextRequest('http://localhost/api/whatsapp/instance', {
      method: 'POST',
      body: JSON.stringify({ acceptTerms: true }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })

  it('cria instância e retorna QR code quando termos aceitos', async () => {
    vi.mocked(prisma.whatsappInstance.upsert).mockResolvedValue({} as WhatsappInstance)
    const req = new NextRequest('http://localhost/api/whatsapp/instance', {
      method: 'POST',
      body: JSON.stringify({ acceptTerms: true }),
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '177.10.20.30',
        'user-agent': 'Mozilla/5.0 TestBrowser',
      },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.qrCode).toBe('data:image/png;base64,qr')
  })

  it('registra o webhook do Evolution API apontando pro backend com o secret configurado', async () => {
    process.env.EVOLUTION_WEBHOOK_SECRET = 'my-webhook-secret'
    vi.mocked(prisma.whatsappInstance.upsert).mockResolvedValue({} as WhatsappInstance)
    const req = new NextRequest('http://localhost/api/whatsapp/instance', {
      method: 'POST',
      body: JSON.stringify({ acceptTerms: true }),
      headers: { 'content-type': 'application/json' },
    })
    await POST(req)
    expect(setWebhook).toHaveBeenCalledWith(
      'c1',
      expect.stringContaining('/api/webhooks/whatsapp'),
      'my-webhook-secret'
    )
    delete process.env.EVOLUTION_WEBHOOK_SECRET
  })

  it('grava IP, email do usuário e hash dos termos no upsert', async () => {
    vi.mocked(prisma.whatsappInstance.upsert).mockResolvedValue({} as WhatsappInstance)
    const req = new NextRequest('http://localhost/api/whatsapp/instance', {
      method: 'POST',
      body: JSON.stringify({ acceptTerms: true }),
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '200.1.2.3',
        'user-agent': 'TestAgent/1.0',
      },
    })
    await POST(req)
    const upsertCall = vi.mocked(prisma.whatsappInstance.upsert).mock.calls[0][0]
    expect(upsertCall.create.termsAcceptedByEmail).toBe('a@b.com')
    expect(upsertCall.create.termsAcceptedIp).toBe('200.1.2.3')
    expect(upsertCall.create.termsAcceptedAgent).toBe('TestAgent/1.0')
    expect(upsertCall.create.termsTextHash).toMatch(/^[a-f0-9]{64}$/) // SHA-256
    expect(upsertCall.create.termsAcceptedAt).toBeInstanceOf(Date)
  })
})

describe('DELETE /api/whatsapp/instance', () => {
  it('retorna 403 se plano não tem módulo whatsapp_notifications', async () => {
    vi.mocked(hasModuleAccess).mockResolvedValue(false)
    const res = await DELETE(makeReq('DELETE'))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.code).toBe('MODULE_NOT_AVAILABLE')
  })

  it('desconecta e deleta instância', async () => {
    vi.mocked(prisma.whatsappInstance.delete).mockResolvedValue({} as WhatsappInstance)
    const res = await DELETE(makeReq('DELETE'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })
})

describe('PATCH /api/whatsapp/instance', () => {
  function makePatchReq(chatbotEnabled: boolean) {
    return new NextRequest('http://localhost/api/whatsapp/instance', {
      method: 'PATCH',
      body: JSON.stringify({ chatbotEnabled }),
      headers: { 'content-type': 'application/json' },
    })
  }

  it('retorna 403 se plano não tem módulo whatsapp_notifications', async () => {
    vi.mocked(hasModuleAccess).mockResolvedValue(false)
    const res = await PATCH(makePatchReq(true))
    expect(res.status).toBe(403)
  })

  it('retorna 404 se a empresa ainda não conectou nenhum WhatsApp', async () => {
    vi.mocked(prisma.whatsappInstance.findUnique).mockResolvedValue(null)
    const res = await PATCH(makePatchReq(true))
    expect(res.status).toBe(404)
  })

  it('ativa o chatbot quando a instância existe', async () => {
    vi.mocked(prisma.whatsappInstance.findUnique).mockResolvedValue({ id: 'wi1' } as WhatsappInstance)
    vi.mocked(prisma.whatsappInstance.update).mockResolvedValue({ chatbotEnabled: true } as WhatsappInstance)
    const res = await PATCH(makePatchReq(true))
    expect(res.status).toBe(200)
    expect(prisma.whatsappInstance.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 'c1' }, data: { chatbotEnabled: true } })
    )
    const body = await res.json()
    expect(body.chatbotEnabled).toBe(true)
  })

  it('desativa o chatbot', async () => {
    vi.mocked(prisma.whatsappInstance.findUnique).mockResolvedValue({ id: 'wi1' } as WhatsappInstance)
    vi.mocked(prisma.whatsappInstance.update).mockResolvedValue({ chatbotEnabled: false } as WhatsappInstance)
    const res = await PATCH(makePatchReq(false))
    const body = await res.json()
    expect(body.chatbotEnabled).toBe(false)
  })
})

describe('RBAC: só ADMIN/OWNER podem configurar o WhatsApp (POST/DELETE/PATCH)', () => {
  function postReq() {
    return new NextRequest('http://localhost/api/whatsapp/instance', {
      method: 'POST',
      body: JSON.stringify({ acceptTerms: true }),
      headers: { 'content-type': 'application/json' },
    })
  }
  function patchReq() {
    return new NextRequest('http://localhost/api/whatsapp/instance', {
      method: 'PATCH',
      body: JSON.stringify({ chatbotEnabled: true }),
      headers: { 'content-type': 'application/json' },
    })
  }

  function expectNoDbAccess() {
    // A checagem de papel acontece ANTES de qualquer acesso ao banco
    expect(prisma.company.findUnique).not.toHaveBeenCalled()
    expect(prisma.whatsappInstance.findUnique).not.toHaveBeenCalled()
    expect(prisma.whatsappInstance.upsert).not.toHaveBeenCalled()
    expect(prisma.whatsappInstance.update).not.toHaveBeenCalled()
    expect(prisma.whatsappInstance.delete).not.toHaveBeenCalled()
  }

  for (const role of ['RECEPTIONIST', 'ESTHETICIAN'] as const) {
    it(`${role}: POST /api/whatsapp/instance → 403 sem tocar no banco`, async () => {
      vi.mocked(getAuthUser).mockResolvedValue({ ...MOCK_USER, role } as never)
      const res = await POST(postReq())
      expect(res.status).toBe(403)
      expectNoDbAccess()
    })

    it(`${role}: DELETE /api/whatsapp/instance → 403 sem tocar no banco`, async () => {
      vi.mocked(getAuthUser).mockResolvedValue({ ...MOCK_USER, role } as never)
      const res = await DELETE(makeReq('DELETE'))
      expect(res.status).toBe(403)
      expectNoDbAccess()
    })

    it(`${role}: PATCH /api/whatsapp/instance → 403 sem tocar no banco`, async () => {
      vi.mocked(getAuthUser).mockResolvedValue({ ...MOCK_USER, role } as never)
      const res = await PATCH(patchReq())
      expect(res.status).toBe(403)
      expectNoDbAccess()
    })

    it(`${role}: GET /api/whatsapp/instance continua liberado`, async () => {
      vi.mocked(getAuthUser).mockResolvedValue({ ...MOCK_USER, role } as never)
      vi.mocked(prisma.whatsappInstance.findUnique).mockResolvedValue(null)
      const res = await GET(makeReq())
      expect(res.status).toBe(200)
    })
  }

  for (const role of ['ADMIN', 'OWNER'] as const) {
    it(`${role}: POST /api/whatsapp/instance passa da checagem de papel`, async () => {
      vi.mocked(getAuthUser).mockResolvedValue({ ...MOCK_USER, role } as never)
      vi.mocked(prisma.whatsappInstance.upsert).mockResolvedValue({} as WhatsappInstance)
      const res = await POST(postReq())
      expect(res.status).toBe(200)
    })

    it(`${role}: DELETE /api/whatsapp/instance passa da checagem de papel`, async () => {
      vi.mocked(getAuthUser).mockResolvedValue({ ...MOCK_USER, role } as never)
      vi.mocked(prisma.whatsappInstance.delete).mockResolvedValue({} as WhatsappInstance)
      const res = await DELETE(makeReq('DELETE'))
      expect(res.status).toBe(200)
    })

    it(`${role}: PATCH /api/whatsapp/instance passa da checagem de papel`, async () => {
      vi.mocked(getAuthUser).mockResolvedValue({ ...MOCK_USER, role } as never)
      vi.mocked(prisma.whatsappInstance.findUnique).mockResolvedValue({ id: 'wi1' } as WhatsappInstance)
      vi.mocked(prisma.whatsappInstance.update).mockResolvedValue({ chatbotEnabled: true } as WhatsappInstance)
      const res = await PATCH(patchReq())
      expect(res.status).toBe(200)
    })
  }
})
