// aura-backend/src/__tests__/api/subscriptions-plans-id.test.ts
// Testes para PUT/DELETE /api/subscriptions/plans/[id]

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: { subscriptionPlan: { findFirst: vi.fn(), update: vi.fn() } },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))
vi.mock('@/lib/apiGuards', () => ({ checkWriteAccess: vi.fn() }))

import { PUT, DELETE } from '../../app/api/subscriptions/plans/[id]/route'
import { getAuthUser } from '@/lib/auth'
import { checkWriteAccess } from '@/lib/apiGuards'
import prisma from '@/lib/prisma'

const ADMIN = { id: 'u1', email: 'admin@clinica.com', role: 'ADMIN', companyId: 'c1' }

function makeRequest(method: string, body?: unknown) {
  return new NextRequest('http://localhost/api/subscriptions/plans/plan1', {
    method, ...(body !== undefined ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } } : {}),
  })
}
function makeParams(id = 'plan1') {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(checkWriteAccess).mockResolvedValue(null)
})

describe('PUT /api/subscriptions/plans/[id]', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await PUT(makeRequest('PUT', { name: 'Novo' }), makeParams())
    expect(res.status).toBe(401)
  })

  it('bloqueia quando o plano do sistema não permite escrita', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    const { NextResponse } = await import('next/server')
    vi.mocked(checkWriteAccess).mockResolvedValue(NextResponse.json({ error: 'bloqueado' }, { status: 402 }))

    const res = await PUT(makeRequest('PUT', { name: 'Novo' }), makeParams())
    expect(res.status).toBe(402)
  })

  it('retorna 404 quando o plano não existe ou é de outra empresa', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.subscriptionPlan.findFirst).mockResolvedValue(null)

    const res = await PUT(makeRequest('PUT', { name: 'Novo' }), makeParams())
    expect(res.status).toBe(404)
  })

  it('atualiza apenas os campos enviados', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.subscriptionPlan.findFirst).mockResolvedValue({ id: 'plan1' } as never)
    vi.mocked(prisma.subscriptionPlan.update).mockResolvedValue({ id: 'plan1', name: 'Renomeado' } as never)

    const res = await PUT(makeRequest('PUT', { name: 'Renomeado' }), makeParams())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.name).toBe('Renomeado')
    expect(prisma.subscriptionPlan.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'plan1' }, data: { name: 'Renomeado' } })
    )
  })

  it('recria todos os itens do plano quando items é enviado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.subscriptionPlan.findFirst).mockResolvedValue({ id: 'plan1' } as never)
    vi.mocked(prisma.subscriptionPlan.update).mockResolvedValue({ id: 'plan1' } as never)

    await PUT(makeRequest('PUT', { items: [{ procedureId: 'proc1', sessionsPerCycle: 4 }] }), makeParams())

    expect(prisma.subscriptionPlan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          items: { deleteMany: {}, create: [{ procedureId: 'proc1', sessionsPerCycle: 4 }] },
        }),
      })
    )
  })
})

describe('DELETE /api/subscriptions/plans/[id]', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await DELETE(makeRequest('DELETE'), makeParams())
    expect(res.status).toBe(401)
  })

  it('retorna 404 quando o plano não existe', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.subscriptionPlan.findFirst).mockResolvedValue(null)
    const res = await DELETE(makeRequest('DELETE'), makeParams())
    expect(res.status).toBe(404)
  })

  it('desativa o plano via soft delete (isActive: false)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.subscriptionPlan.findFirst).mockResolvedValue({ id: 'plan1' } as never)

    const res = await DELETE(makeRequest('DELETE'), makeParams())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(prisma.subscriptionPlan.update).toHaveBeenCalledWith({ where: { id: 'plan1' }, data: { isActive: false } })
  })
})
