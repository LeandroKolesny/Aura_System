// aura-backend/src/__tests__/api/plans-id.test.ts
// Testes para PATCH/DELETE /api/plans/[id]

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: { saasPlan: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() } },
}))
vi.mock('@/lib/auth', () => ({ verifyAuth: vi.fn() }))

import { PATCH, DELETE } from '../../app/api/plans/[id]/route'
import { verifyAuth } from '@/lib/auth'
import prisma from '@/lib/prisma'

const OWNER = { id: 'u1', email: 'owner@saas.com', role: 'OWNER', companyId: null }
const ADMIN = { id: 'u2', email: 'admin@clinica.com', role: 'ADMIN', companyId: 'c1' }

function makeRequest(method: string, body?: unknown) {
  return new NextRequest('http://localhost/api/plans/plan1', {
    method, ...(body !== undefined ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } } : {}),
  })
}
function makeParams(id = 'plan1') {
  return { params: Promise.resolve({ id }) }
}

const EXISTING_PLAN = { id: 'plan1', name: 'Starter', price: { toString: () => '99.90' } as unknown as number, features: [], isActive: true, stripeProductId: null }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PATCH /api/plans/[id]', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({ success: false, user: null })
    const res = await PATCH(makeRequest('PATCH', { name: 'Novo' }), makeParams())
    expect(res.status).toBe(401)
  })

  it('retorna 403 quando o solicitante não é OWNER', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({ success: true, user: ADMIN as never })
    const res = await PATCH(makeRequest('PATCH', { name: 'Novo' }), makeParams())
    expect(res.status).toBe(403)
  })

  it('retorna 404 quando o plano não existe', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({ success: true, user: OWNER as never })
    vi.mocked(prisma.saasPlan.findUnique).mockResolvedValue(null)
    const res = await PATCH(makeRequest('PATCH', { name: 'Novo' }), makeParams())
    expect(res.status).toBe(404)
  })

  it('atualiza apenas os campos enviados', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({ success: true, user: OWNER as never })
    vi.mocked(prisma.saasPlan.findUnique).mockResolvedValue(EXISTING_PLAN as never)
    vi.mocked(prisma.saasPlan.update).mockResolvedValue({ ...EXISTING_PLAN, name: 'Renomeado' } as never)

    const res = await PATCH(makeRequest('PATCH', { name: 'Renomeado' }), makeParams())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.plan.name).toBe('Renomeado')
    expect(prisma.saasPlan.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'plan1' }, data: { name: 'Renomeado' } })
    )
  })

  it('mapeia "active" para isActive e "stripePaymentLink" para stripeProductId', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({ success: true, user: OWNER as never })
    vi.mocked(prisma.saasPlan.findUnique).mockResolvedValue(EXISTING_PLAN as never)
    vi.mocked(prisma.saasPlan.update).mockResolvedValue(EXISTING_PLAN as never)

    await PATCH(makeRequest('PATCH', { active: false, stripePaymentLink: 'https://stripe.com/x' }), makeParams())

    expect(prisma.saasPlan.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false, stripeProductId: 'https://stripe.com/x' } })
    )
  })
})

describe('DELETE /api/plans/[id]', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({ success: false, user: null })
    const res = await DELETE(makeRequest('DELETE'), makeParams())
    expect(res.status).toBe(401)
  })

  it('retorna 403 quando o solicitante não é OWNER', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({ success: true, user: ADMIN as never })
    const res = await DELETE(makeRequest('DELETE'), makeParams())
    expect(res.status).toBe(403)
  })

  it('retorna 404 quando o plano não existe', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({ success: true, user: OWNER as never })
    vi.mocked(prisma.saasPlan.findUnique).mockResolvedValue(null)
    const res = await DELETE(makeRequest('DELETE'), makeParams())
    expect(res.status).toBe(404)
  })

  it('exclui o plano quando o solicitante é OWNER', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({ success: true, user: OWNER as never })
    vi.mocked(prisma.saasPlan.findUnique).mockResolvedValue(EXISTING_PLAN as never)

    const res = await DELETE(makeRequest('DELETE'), makeParams())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(prisma.saasPlan.delete).toHaveBeenCalledWith({ where: { id: 'plan1' } })
  })
})
