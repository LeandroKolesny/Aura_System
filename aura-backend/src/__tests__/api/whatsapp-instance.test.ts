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
}))

import { GET, POST, DELETE } from '../../app/api/whatsapp/instance/route'
import { getAuthUser } from '@/lib/auth'
import { hasModuleAccess } from '@/lib/planPermissions'
import prisma from '@/lib/prisma'

const MOCK_USER = { id: 'u1', companyId: 'c1', role: 'ADMIN', email: 'a@b.com', name: 'A' }
const MOCK_COMPANY = { plan: 'PREMIUM', subscriptionStatus: 'ACTIVE', subscriptionExpiresAt: null }

function makeReq(method = 'GET') {
  return new NextRequest('http://localhost/api/whatsapp/instance', { method })
}

beforeEach(() => {
  vi.clearAllMocks()
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

  it('cria instância e retorna QR code quando termos aceitos', async () => {
    vi.mocked(prisma.whatsappInstance.upsert).mockResolvedValue({} as WhatsappInstance)
    const req = new NextRequest('http://localhost/api/whatsapp/instance', {
      method: 'POST',
      body: JSON.stringify({ acceptTerms: true }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.qrCode).toBe('data:image/png;base64,qr')
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
