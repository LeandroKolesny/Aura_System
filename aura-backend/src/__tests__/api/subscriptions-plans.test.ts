// src/__tests__/api/subscriptions-plans.test.ts
// Testes para GET/POST /api/subscriptions/plans e PUT/DELETE /api/subscriptions/plans/[id]

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    subscriptionPlan: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
}))
vi.mock('@/lib/apiGuards', () => ({
  checkWriteAccess: vi.fn().mockResolvedValue(null),
}))

import { GET, POST } from '../../app/api/subscriptions/plans/route'
import { PUT, DELETE } from '../../app/api/subscriptions/plans/[id]/route'
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { checkWriteAccess } from '@/lib/apiGuards'

// ── fixtures ──────────────────────────────────────────────────────────────────

const COMPANY_ID = 'company-001'
const PLAN_ID = 'plan-001'
const PROCEDURE_ID = 'procedure-001'

const MOCK_ADMIN_USER = { id: 'user-001', role: 'ADMIN', companyId: COMPANY_ID }

const MOCK_PLAN = {
  id: PLAN_ID,
  name: 'Plano Básico',
  price: 199,
  description: 'Descrição do plano',
  imageUrl: null,
  isActive: true,
  companyId: COMPANY_ID,
  items: [{ procedureId: PROCEDURE_ID, sessionsPerCycle: 4, procedure: { id: PROCEDURE_ID, name: 'Limpeza', price: 80 } }],
  _count: { subscribers: 2 },
}

const VALID_CREATE_BODY = {
  name: 'Plano Gold',
  price: 299,
  items: [{ procedureId: PROCEDURE_ID, sessionsPerCycle: 4 }],
}

const VALID_UPDATE_BODY = {
  name: 'Plano Gold Atualizado',
  price: 349,
}

function makeRequest(method: string, url: string, body?: Record<string, unknown>) {
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { 'content-type': 'application/json' } : {},
  })
}

const ID_PARAMS = { params: Promise.resolve({ id: PLAN_ID }) }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAuthUser).mockResolvedValue(MOCK_ADMIN_USER as never)
  vi.mocked(checkWriteAccess).mockResolvedValue(null)
  vi.mocked(prisma.subscriptionPlan.findMany).mockResolvedValue([MOCK_PLAN] as never)
  vi.mocked(prisma.subscriptionPlan.findFirst).mockResolvedValue(MOCK_PLAN as never)
  vi.mocked(prisma.subscriptionPlan.create).mockResolvedValue(MOCK_PLAN as never)
  vi.mocked(prisma.subscriptionPlan.update).mockResolvedValue(MOCK_PLAN as never)
})

// ── GET /api/subscriptions/plans ──────────────────────────────────────────────

describe('GET /api/subscriptions/plans', () => {

  it('lista planos ativos da empresa → 200 com array', async () => {
    const res = await GET(makeRequest('GET', 'http://localhost/api/subscriptions/plans'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(1)
  })

  it('filtra por isActive=true por padrão', async () => {
    await GET(makeRequest('GET', 'http://localhost/api/subscriptions/plans'))
    expect(prisma.subscriptionPlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isActive: true }) })
    )
  })

  it('inclui inativos quando includeInactive=true', async () => {
    await GET(makeRequest('GET', 'http://localhost/api/subscriptions/plans?includeInactive=true'))
    const call = vi.mocked(prisma.subscriptionPlan.findMany).mock.calls[0]?.[0]
    // O where não deve ter isActive quando includeInactive=true
    expect((call?.where as Record<string, unknown>)?.isActive).toBeUndefined()
  })

  it('retorna 401 sem autenticação', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null as never)
    const res = await GET(makeRequest('GET', 'http://localhost/api/subscriptions/plans'))
    expect(res.status).toBe(401)
  })

  it('retorna 403 sem empresa', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ ...MOCK_ADMIN_USER, companyId: null } as never)
    const res = await GET(makeRequest('GET', 'http://localhost/api/subscriptions/plans'))
    expect(res.status).toBe(403)
  })
})

// ── POST /api/subscriptions/plans ─────────────────────────────────────────────

describe('POST /api/subscriptions/plans', () => {

  it('cria plano com itens → 201', async () => {
    const res = await POST(makeRequest('POST', 'http://localhost/api/subscriptions/plans', VALID_CREATE_BODY))
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body.success).toBe(true)
    expect(body.data).toBeDefined()
  })

  it('cria items do plano via nested create', async () => {
    await POST(makeRequest('POST', 'http://localhost/api/subscriptions/plans', VALID_CREATE_BODY))
    expect(prisma.subscriptionPlan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          items: expect.objectContaining({ create: expect.any(Array) }),
        }),
      })
    )
  })

  it('retorna 400 quando name ausente', async () => {
    const res = await POST(makeRequest('POST', 'http://localhost/api/subscriptions/plans', {
      price: 199,
      items: [{ procedureId: PROCEDURE_ID, sessionsPerCycle: 2 }],
    }))
    expect(res.status).toBe(400)
    expect(prisma.subscriptionPlan.create).not.toHaveBeenCalled()
  })

  it('retorna 400 quando items está vazio', async () => {
    const res = await POST(makeRequest('POST', 'http://localhost/api/subscriptions/plans', {
      name: 'Plano Vazio',
      price: 99,
      items: [],
    }))
    expect(res.status).toBe(400)
    expect(prisma.subscriptionPlan.create).not.toHaveBeenCalled()
  })

  it('chama checkWriteAccess', async () => {
    await POST(makeRequest('POST', 'http://localhost/api/subscriptions/plans', VALID_CREATE_BODY))
    expect(checkWriteAccess).toHaveBeenCalledOnce()
  })

  it('retorna 401 sem autenticação', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null as never)
    const res = await POST(makeRequest('POST', 'http://localhost/api/subscriptions/plans', VALID_CREATE_BODY))
    expect(res.status).toBe(401)
  })
})

// ── PUT /api/subscriptions/plans/[id] ─────────────────────────────────────────

describe('PUT /api/subscriptions/plans/[id]', () => {

  it('edita plano → 200 com dados atualizados', async () => {
    vi.mocked(prisma.subscriptionPlan.update).mockResolvedValue({ ...MOCK_PLAN, ...VALID_UPDATE_BODY } as never)
    const res = await PUT(makeRequest('PUT', `http://localhost/api/subscriptions/plans/${PLAN_ID}`, VALID_UPDATE_BODY), ID_PARAMS)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(prisma.subscriptionPlan.update).toHaveBeenCalledOnce()
  })

  it('recria items quando items está no body', async () => {
    const newItems = [{ procedureId: PROCEDURE_ID, sessionsPerCycle: 6 }]
    await PUT(makeRequest('PUT', `http://localhost/api/subscriptions/plans/${PLAN_ID}`, { ...VALID_UPDATE_BODY, items: newItems }), ID_PARAMS)
    expect(prisma.subscriptionPlan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          items: expect.objectContaining({ deleteMany: {}, create: expect.any(Array) }),
        }),
      })
    )
  })

  it('retorna 404 quando plano não encontrado', async () => {
    vi.mocked(prisma.subscriptionPlan.findFirst).mockResolvedValue(null)
    const res = await PUT(makeRequest('PUT', `http://localhost/api/subscriptions/plans/${PLAN_ID}`, VALID_UPDATE_BODY), ID_PARAMS)
    expect(res.status).toBe(404)
    expect(prisma.subscriptionPlan.update).not.toHaveBeenCalled()
  })

  it('retorna 401 sem autenticação', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null as never)
    const res = await PUT(makeRequest('PUT', `http://localhost/api/subscriptions/plans/${PLAN_ID}`, VALID_UPDATE_BODY), ID_PARAMS)
    expect(res.status).toBe(401)
  })

  it('pode desativar plano via isActive=false', async () => {
    await PUT(makeRequest('PUT', `http://localhost/api/subscriptions/plans/${PLAN_ID}`, { isActive: false }), ID_PARAMS)
    expect(prisma.subscriptionPlan.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isActive: false }) })
    )
  })
})

// ── DELETE /api/subscriptions/plans/[id] ──────────────────────────────────────

describe('DELETE /api/subscriptions/plans/[id]', () => {

  it('desativa plano (soft delete) → 200', async () => {
    const res = await DELETE(makeRequest('DELETE', `http://localhost/api/subscriptions/plans/${PLAN_ID}`), ID_PARAMS)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
  })

  it('faz soft delete — atualiza isActive=false, não deleta', async () => {
    await DELETE(makeRequest('DELETE', `http://localhost/api/subscriptions/plans/${PLAN_ID}`), ID_PARAMS)
    expect(prisma.subscriptionPlan.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isActive: false }) })
    )
  })

  it('retorna 404 quando plano não encontrado', async () => {
    vi.mocked(prisma.subscriptionPlan.findFirst).mockResolvedValue(null)
    const res = await DELETE(makeRequest('DELETE', `http://localhost/api/subscriptions/plans/${PLAN_ID}`), ID_PARAMS)
    expect(res.status).toBe(404)
    expect(prisma.subscriptionPlan.update).not.toHaveBeenCalled()
  })

  it('retorna 401 sem autenticação', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null as never)
    const res = await DELETE(makeRequest('DELETE', `http://localhost/api/subscriptions/plans/${PLAN_ID}`), ID_PARAMS)
    expect(res.status).toBe(401)
  })

  it('chama checkWriteAccess', async () => {
    await DELETE(makeRequest('DELETE', `http://localhost/api/subscriptions/plans/${PLAN_ID}`), ID_PARAMS)
    expect(checkWriteAccess).toHaveBeenCalledOnce()
  })
})
