// aura-backend/src/__tests__/api/leads.test.ts
// Testes para GET/POST /api/leads

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    lead: { findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
    activity: { create: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))

import { GET, POST } from '../../app/api/leads/route'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

const ADMIN = { id: 'u1', email: 'admin@clinica.com', role: 'ADMIN', companyId: 'c1' }

const VALID_LEAD = { name: 'Novo Lead', email: 'lead@email.com' }

function makeGetRequest(qs = '') {
  return new NextRequest(`http://localhost/api/leads${qs}`)
}
function makePostRequest(body: unknown) {
  return new NextRequest('http://localhost/api/leads', {
    method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.lead.findMany).mockResolvedValue([])
  vi.mocked(prisma.lead.count).mockResolvedValue(0)
})

describe('GET /api/leads', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(401)
  })

  it('retorna 403 quando o usuário não tem empresa', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ ...ADMIN, companyId: null } as never)
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(403)
  })

  it('escopa a listagem à empresa do usuário', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    await GET(makeGetRequest())
    expect(prisma.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ companyId: 'c1' }) })
    )
  })

  it('filtra por status quando informado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    await GET(makeGetRequest('?status=WON'))
    expect(prisma.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'WON' }) })
    )
  })

  it('busca por nome ou email quando search é informado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    await GET(makeGetRequest('?search=joao'))
    expect(prisma.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ OR: expect.any(Array) }) })
    )
  })

  it('retorna paginação calculada corretamente', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.lead.count).mockResolvedValue(45)
    const res = await GET(makeGetRequest('?page=2&limit=20'))
    const body = await res.json()
    expect(body.pagination).toEqual({ page: 2, limit: 20, total: 45, totalPages: 3 })
  })
})

describe('POST /api/leads', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await POST(makePostRequest(VALID_LEAD))
    expect(res.status).toBe(401)
  })

  it('retorna 403 quando o usuário não tem empresa', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ ...ADMIN, companyId: null } as never)
    const res = await POST(makePostRequest(VALID_LEAD))
    expect(res.status).toBe(403)
  })

  it('retorna 400 para dados inválidos (nome curto)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    const res = await POST(makePostRequest({ name: 'A' }))
    expect(res.status).toBe(400)
  })

  it('cria o lead vinculado à empresa e registra atividade LEAD_CREATED', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.lead.create).mockResolvedValue({ id: 'lead1', name: 'Novo Lead' } as never)

    const res = await POST(makePostRequest(VALID_LEAD))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.lead.id).toBe('lead1')
    expect(prisma.lead.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ companyId: 'c1', name: 'Novo Lead' }) })
    )
    expect(prisma.activity.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'LEAD_CREATED' }) })
    )
  })

  it('converte lastContact e nextFollowUp para Date', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.lead.create).mockResolvedValue({ id: 'lead1' } as never)

    await POST(makePostRequest({ ...VALID_LEAD, lastContact: '2026-01-01T10:00:00.000Z' }))

    expect(prisma.lead.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ lastContact: expect.any(Date) }) })
    )
  })
})
