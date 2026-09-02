// aura-backend/src/__tests__/api/unavailability-id.test.ts
// Testes para GET/DELETE /api/unavailability/[id]

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    unavailabilityRule: { findFirst: vi.fn(), delete: vi.fn() },
    activity: { create: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))
vi.mock('@/lib/apiGuards', () => ({ checkWriteAccess: vi.fn() }))

import { GET, DELETE } from '../../app/api/unavailability/[id]/route'
import { getAuthUser } from '@/lib/auth'
import { checkWriteAccess } from '@/lib/apiGuards'
import prisma from '@/lib/prisma'

const ADMIN = { id: 'u1', email: 'admin@clinica.com', role: 'ADMIN', companyId: 'c1' }
const ESTHETICIAN = { id: 'u2', email: 'esth@clinica.com', role: 'ESTHETICIAN', companyId: 'c1' }

function makeRequest(method: string) {
  return new NextRequest('http://localhost/api/unavailability/rule1', { method })
}
function makeParams(id = 'rule1') {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(checkWriteAccess).mockResolvedValue(null)
})

describe('GET /api/unavailability/[id]', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await GET(makeRequest('GET'), makeParams())
    expect(res.status).toBe(401)
  })

  it('retorna 403 quando o usuário não tem empresa', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ ...ADMIN, companyId: null } as never)
    const res = await GET(makeRequest('GET'), makeParams())
    expect(res.status).toBe(403)
  })

  it('retorna 404 quando a regra não existe ou é de outra empresa', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.unavailabilityRule.findFirst).mockResolvedValue(null)
    const res = await GET(makeRequest('GET'), makeParams())
    expect(res.status).toBe(404)
  })

  it('retorna a regra quando encontrada', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.unavailabilityRule.findFirst).mockResolvedValue({ id: 'rule1' } as never)
    const res = await GET(makeRequest('GET'), makeParams())
    const body = await res.json()
    expect(body.rule.id).toBe('rule1')
  })
})

describe('DELETE /api/unavailability/[id]', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await DELETE(makeRequest('DELETE'), makeParams())
    expect(res.status).toBe(401)
  })

  it('retorna 403 quando o solicitante não é ADMIN nem OWNER', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ESTHETICIAN as never)
    const res = await DELETE(makeRequest('DELETE'), makeParams())
    expect(res.status).toBe(403)
  })

  it('bloqueia quando o plano não permite escrita', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    const { NextResponse } = await import('next/server')
    vi.mocked(checkWriteAccess).mockResolvedValue(NextResponse.json({ error: 'bloqueado' }, { status: 402 }))

    const res = await DELETE(makeRequest('DELETE'), makeParams())
    expect(res.status).toBe(402)
  })

  it('retorna 404 quando a regra não existe', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.unavailabilityRule.findFirst).mockResolvedValue(null)
    const res = await DELETE(makeRequest('DELETE'), makeParams())
    expect(res.status).toBe(404)
  })

  it('remove a regra e registra atividade de auditoria', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.unavailabilityRule.findFirst).mockResolvedValue({ id: 'rule1', description: 'Férias' } as never)

    const res = await DELETE(makeRequest('DELETE'), makeParams())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(prisma.unavailabilityRule.delete).toHaveBeenCalledWith({ where: { id: 'rule1' } })
    expect(prisma.activity.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'SETTINGS_CHANGED', description: 'Férias' }) })
    )
  })
})
