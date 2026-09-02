// aura-backend/src/__tests__/api/leads-id.test.ts
// Testes para GET/PATCH/DELETE /api/leads/[id]

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    lead: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    activity: { create: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))

import { GET, PATCH, DELETE } from '../../app/api/leads/[id]/route'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

const ADMIN = { id: 'u1', email: 'admin@clinica.com', role: 'ADMIN', companyId: 'c1' }

function makeRequest(method: string, body?: unknown) {
  return new NextRequest('http://localhost/api/leads/lead1', {
    method, ...(body !== undefined ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } } : {}),
  })
}
function makeParams(id = 'lead1') {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/leads/[id]', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await GET(makeRequest('GET'), makeParams())
    expect(res.status).toBe(401)
  })

  it('retorna 404 quando o lead não existe', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.lead.findUnique).mockResolvedValue(null)
    const res = await GET(makeRequest('GET'), makeParams())
    expect(res.status).toBe(404)
  })

  it('retorna o lead com dados do responsável e empresa', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.lead.findUnique).mockResolvedValue({ id: 'lead1', name: 'Lead Teste' } as never)
    const res = await GET(makeRequest('GET'), makeParams())
    const body = await res.json()
    expect(body.lead.id).toBe('lead1')
  })
})

describe('PATCH /api/leads/[id]', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await PATCH(makeRequest('PATCH', { name: 'Novo Nome' }), makeParams())
    expect(res.status).toBe(401)
  })

  it('retorna 400 para dados inválidos', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    const res = await PATCH(makeRequest('PATCH', { email: 'invalido' }), makeParams())
    expect(res.status).toBe(400)
  })

  it('retorna 404 quando o lead não existe', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.lead.findUnique).mockResolvedValue(null)
    const res = await PATCH(makeRequest('PATCH', { name: 'Novo Nome' }), makeParams())
    expect(res.status).toBe(404)
  })

  it('atualiza o lead sem registrar atividade quando o status não muda', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.lead.findUnique).mockResolvedValue({ id: 'lead1', status: 'NEW' } as never)
    vi.mocked(prisma.lead.update).mockResolvedValue({ id: 'lead1', name: 'Novo Nome' } as never)

    const res = await PATCH(makeRequest('PATCH', { name: 'Novo Nome' }), makeParams())
    expect(res.status).toBe(200)
    expect(prisma.activity.create).not.toHaveBeenCalled()
  })

  it('registra atividade LEAD_STATUS_CHANGED quando o status muda', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.lead.findUnique).mockResolvedValue({ id: 'lead1', status: 'NEW' } as never)
    vi.mocked(prisma.lead.update).mockResolvedValue({ id: 'lead1', status: 'WON' } as never)

    await PATCH(makeRequest('PATCH', { status: 'WON' }), makeParams())

    expect(prisma.activity.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'LEAD_STATUS_CHANGED', description: 'De NEW para WON' }) })
    )
  })
})

describe('DELETE /api/leads/[id]', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await DELETE(makeRequest('DELETE'), makeParams())
    expect(res.status).toBe(401)
  })

  it('exclui o lead', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    const res = await DELETE(makeRequest('DELETE'), makeParams())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.message).toContain('sucesso')
    expect(prisma.lead.delete).toHaveBeenCalledWith({ where: { id: 'lead1' } })
  })

  it('retorna 500 quando a exclusão falha', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.lead.delete).mockRejectedValue(new Error('FK constraint'))
    const res = await DELETE(makeRequest('DELETE'), makeParams())
    expect(res.status).toBe(500)
  })
})
