// aura-backend/src/__tests__/api/system-maintenance.test.ts
// Testes para GET/POST /api/system/maintenance

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: { systemSettings: { upsert: vi.fn(), findUnique: vi.fn(), create: vi.fn() } },
}))
vi.mock('@/lib/auth', () => ({ verifyAuth: vi.fn() }))

import { GET, POST } from '../../app/api/system/maintenance/route'
import { verifyAuth } from '@/lib/auth'
import prisma from '@/lib/prisma'

const OWNER = { id: 'u1', email: 'owner@saas.com', role: 'OWNER', companyId: null }
const ADMIN = { id: 'u2', email: 'admin@clinica.com', role: 'ADMIN', companyId: 'c1' }

function makePostRequest(body: unknown) {
  return new NextRequest('http://localhost/api/system/maintenance', {
    method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' },
  })
}
function makeGetRequest() {
  return new NextRequest('http://localhost/api/system/maintenance')
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/system/maintenance', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({ success: false, user: null })
    const res = await POST(makePostRequest({ enabled: true }))
    expect(res.status).toBe(401)
  })

  it('retorna 403 quando o solicitante não é OWNER', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({ success: true, user: ADMIN as never })
    const res = await POST(makePostRequest({ enabled: true }))
    expect(res.status).toBe(403)
  })

  it('retorna 400 quando "enabled" não é boolean', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({ success: true, user: OWNER as never })
    const res = await POST(makePostRequest({ enabled: 'sim' }))
    expect(res.status).toBe(400)
  })

  it('ativa o modo manutenção registrando quem ativou e quando', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({ success: true, user: OWNER as never })
    vi.mocked(prisma.systemSettings.upsert).mockResolvedValue({ maintenanceMode: true } as never)

    const res = await POST(makePostRequest({ enabled: true, message: 'Manutenção programada' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.maintenanceMode).toBe(true)
    expect(prisma.systemSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ maintenanceMode: true, maintenanceStartedBy: 'u1', maintenanceMessage: 'Manutenção programada' }),
      })
    )
  })

  it('desativa o modo manutenção limpando startedAt/startedBy', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({ success: true, user: OWNER as never })
    vi.mocked(prisma.systemSettings.upsert).mockResolvedValue({ maintenanceMode: false } as never)

    await POST(makePostRequest({ enabled: false }))

    expect(prisma.systemSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ maintenanceMode: false, maintenanceStartedAt: null, maintenanceStartedBy: null }),
      })
    )
  })
})

describe('GET /api/system/maintenance', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({ success: false, user: null })
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(401)
  })

  it('retorna 403 quando o solicitante não é OWNER', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({ success: true, user: ADMIN as never })
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(403)
  })

  it('cria configurações padrão quando ainda não existem', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({ success: true, user: OWNER as never })
    vi.mocked(prisma.systemSettings.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.systemSettings.create).mockResolvedValue({ maintenanceMode: false, maintenanceMessage: null, maintenanceStartedAt: null, maintenanceStartedBy: null } as never)

    const res = await GET(makeGetRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.maintenanceMode).toBe(false)
    expect(prisma.systemSettings.create).toHaveBeenCalled()
  })

  it('retorna as configurações existentes', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({ success: true, user: OWNER as never })
    vi.mocked(prisma.systemSettings.findUnique).mockResolvedValue({ maintenanceMode: true, maintenanceMessage: 'x', maintenanceStartedAt: new Date(), maintenanceStartedBy: 'u1' } as never)

    const res = await GET(makeGetRequest())
    const body = await res.json()

    expect(body.maintenanceMode).toBe(true)
    expect(prisma.systemSettings.create).not.toHaveBeenCalled()
  })
})
