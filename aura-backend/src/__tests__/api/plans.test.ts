// aura-backend/src/__tests__/api/plans.test.ts
// Testes para GET/POST /api/plans (planos SaaS do sistema, gerenciados pelo OWNER)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: { saasPlan: { findMany: vi.fn(), create: vi.fn() } },
}))
vi.mock('@/lib/auth', () => ({ verifyAuth: vi.fn() }))

import { GET, POST } from '../../app/api/plans/route'
import { verifyAuth } from '@/lib/auth'
import prisma from '@/lib/prisma'

const OWNER = { id: 'u1', email: 'owner@saas.com', role: 'OWNER', companyId: null }
const ADMIN = { id: 'u2', email: 'admin@clinica.com', role: 'ADMIN', companyId: 'c1' }

function makeGetRequest(qs = '') {
  return new NextRequest(`http://localhost/api/plans${qs}`)
}
function makePostRequest(body: unknown) {
  return new NextRequest('http://localhost/api/plans', {
    method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' },
  })
}

const SAAS_PLAN = {
  id: 'plan1', name: 'Starter', displayName: 'Starter', price: { toString: () => '99.90' } as unknown as number,
  maxProfessionals: 2, maxPatients: 100, modules: ['agenda'], features: ['x'], isActive: true, stripeProductId: null,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/plans', () => {
  it('é uma rota pública — não exige autenticação', async () => {
    vi.mocked(prisma.saasPlan.findMany).mockResolvedValue([SAAS_PLAN] as never)
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(200)
  })

  it('converte o preço Decimal para number na resposta', async () => {
    vi.mocked(prisma.saasPlan.findMany).mockResolvedValue([SAAS_PLAN] as never)
    const res = await GET(makeGetRequest())
    const body = await res.json()
    expect(body[0].price).toBe(99.9)
  })

  it('filtra apenas planos ativos quando active=true', async () => {
    vi.mocked(prisma.saasPlan.findMany).mockResolvedValue([])
    await GET(makeGetRequest('?active=true'))
    expect(prisma.saasPlan.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { isActive: true } }))
  })

  it('retorna todos os planos (ativos e inativos) por padrão', async () => {
    vi.mocked(prisma.saasPlan.findMany).mockResolvedValue([])
    await GET(makeGetRequest())
    expect(prisma.saasPlan.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: undefined }))
  })

  it('retorna 500 em caso de erro inesperado', async () => {
    vi.mocked(prisma.saasPlan.findMany).mockRejectedValue(new Error('db down'))
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(500)
  })
})

describe('POST /api/plans', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({ success: false, user: null })
    const res = await POST(makePostRequest({ name: 'Novo Plano', price: 50 }))
    expect(res.status).toBe(401)
  })

  it('retorna 403 quando o solicitante não é OWNER', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({ success: true, user: ADMIN as never })
    const res = await POST(makePostRequest({ name: 'Novo Plano', price: 50 }))
    expect(res.status).toBe(403)
  })

  it('retorna 400 quando faltam nome ou preço', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({ success: true, user: OWNER as never })
    const res = await POST(makePostRequest({ name: 'Novo Plano' }))
    expect(res.status).toBe(400)
  })

  it('cria o plano com valores padrão para campos opcionais', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({ success: true, user: OWNER as never })
    vi.mocked(prisma.saasPlan.create).mockResolvedValue({ ...SAAS_PLAN, id: 'new-plan' } as never)

    const res = await POST(makePostRequest({ name: 'Novo Plano', price: 50 }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(prisma.saasPlan.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ maxProfessionals: 1, maxPatients: 50, isActive: true, modules: [], features: [] }) })
    )
  })
})
