// aura-backend/src/__tests__/api/system-status.test.ts
// Testes para GET /api/system/status (endpoint público)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: { systemSettings: { findUnique: vi.fn(), create: vi.fn() } },
}))

import { GET } from '../../app/api/system/status/route'
import prisma from '@/lib/prisma'

function makeRequest() {
  return new NextRequest('http://localhost/api/system/status')
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/system/status', () => {
  it('é um endpoint público — não exige autenticação', async () => {
    vi.mocked(prisma.systemSettings.findUnique).mockResolvedValue({ maintenanceMode: false, maintenanceMessage: null, maintenanceStartedAt: null } as never)
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
  })

  it('cria configurações padrão quando ainda não existem', async () => {
    vi.mocked(prisma.systemSettings.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.systemSettings.create).mockResolvedValue({ maintenanceMode: false, maintenanceMessage: null, maintenanceStartedAt: null } as never)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.maintenanceMode).toBe(false)
    expect(prisma.systemSettings.create).toHaveBeenCalled()
  })

  it('retorna maintenanceMode=true quando ativado', async () => {
    vi.mocked(prisma.systemSettings.findUnique).mockResolvedValue({ maintenanceMode: true, maintenanceMessage: 'Voltamos logo', maintenanceStartedAt: new Date() } as never)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.maintenanceMode).toBe(true)
    expect(body.maintenanceMessage).toBe('Voltamos logo')
  })

  it('nunca expõe maintenanceStartedBy (dado interno)', async () => {
    vi.mocked(prisma.systemSettings.findUnique).mockResolvedValue({ maintenanceMode: true, maintenanceMessage: null, maintenanceStartedAt: null, maintenanceStartedBy: 'u1' } as never)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.maintenanceStartedBy).toBeUndefined()
  })

  it('faz fail-open (maintenanceMode=false, status 200) em caso de erro de banco', async () => {
    vi.mocked(prisma.systemSettings.findUnique).mockRejectedValue(new Error('db down'))

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.maintenanceMode).toBe(false)
  })
})
