// src/__tests__/api/king-leads.test.ts
// Testes para GET e PATCH /api/king/leads

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    company: {
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
}))

import { GET, PATCH } from '../../app/api/king/leads/route'
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

// ── fixtures ──────────────────────────────────────────────────────────────────

const MOCK_OWNER = { id: 'owner-001', role: 'OWNER', companyId: null }
const MOCK_ADMIN = { id: 'admin-001', role: 'ADMIN', companyId: 'company-001' }

const MOCK_COMPANY = {
  id: 'company-001',
  name: 'Clínica Teste',
  plan: 'FREE',
  subscriptionStatus: 'TRIAL',
  salesStatus: 'NEW',
  salesMovedAt: null,
  demoAt: null,
  demoNotes: null,
  lostReason: null,
  lostComment: null,
  seenByOwner: false,
  createdAt: new Date('2026-01-01'),
  users: [{ name: 'Maria Admin', email: 'maria@clinica.com', phone: '11999990000' }],
}

function makeGetRequest() {
  return new NextRequest('http://localhost/api/king/leads', { method: 'GET' })
}

function makePatchRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/king/leads', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAuthUser).mockResolvedValue(MOCK_OWNER as never)
  vi.mocked(prisma.company.findMany).mockResolvedValue([MOCK_COMPANY] as never)
  vi.mocked(prisma.company.update).mockResolvedValue(MOCK_COMPANY as never)
})

// ── GET /api/king/leads ───────────────────────────────────────────────────────

describe('GET /api/king/leads', () => {

  it('retorna lista de leads mapeada → 200', async () => {
    const res = await GET(makeGetRequest())
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.leads).toHaveLength(1)
    const lead = body.leads[0]
    expect(lead.id).toBe('company-001')
    expect(lead.clinicName).toBe('Clínica Teste')
    expect(lead.contactName).toBe('Maria Admin')
    expect(lead.phone).toBe('11999990000')
    expect(lead.email).toBe('maria@clinica.com')
    expect(lead.status).toBe('new')
    expect(lead.seenByOwner).toBe(false)
  })

  it('mapeia status NEW → new corretamente', async () => {
    vi.mocked(prisma.company.findMany).mockResolvedValue([
      { ...MOCK_COMPANY, salesStatus: 'CONTACTED' },
    ] as never)
    const res = await GET(makeGetRequest())
    const body = await res.json()
    expect(body.leads[0].status).toBe('contacted')
  })

  it('preenche contactName como "Sem contato" quando não há admin', async () => {
    vi.mocked(prisma.company.findMany).mockResolvedValue([
      { ...MOCK_COMPANY, users: [] },
    ] as never)
    const res = await GET(makeGetRequest())
    const body = await res.json()
    expect(body.leads[0].contactName).toBe('Sem contato')
    expect(body.leads[0].phone).toBe('')
    expect(body.leads[0].email).toBe('')
  })

  it('retorna 401 sem autenticação', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null as never)
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(401)
    expect(prisma.company.findMany).not.toHaveBeenCalled()
  })

  it('retorna 403 para role ADMIN (não é OWNER)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(MOCK_ADMIN as never)
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(403)
    expect(prisma.company.findMany).not.toHaveBeenCalled()
  })

  it('retorna 500 quando Prisma lança erro', async () => {
    vi.mocked(prisma.company.findMany).mockRejectedValue(new Error('DB error'))
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(500)
  })

  it('inclui campos novos (movedAt, demoAt, lostReason) na resposta', async () => {
    const demoDate = new Date('2026-05-01T10:00:00Z')
    vi.mocked(prisma.company.findMany).mockResolvedValue([
      { ...MOCK_COMPANY, salesStatus: 'DEMO', demoAt: demoDate, demoNotes: 'Ver apresentação', salesMovedAt: demoDate },
    ] as never)
    const res = await GET(makeGetRequest())
    const body = await res.json()
    const lead = body.leads[0]
    expect(lead.status).toBe('demo')
    expect(lead.demoAt).toBe(demoDate.toISOString())
    expect(lead.demoNotes).toBe('Ver apresentação')
    expect(lead.movedAt).toBe(demoDate.toISOString())
  })
})

// ── PATCH /api/king/leads ─────────────────────────────────────────────────────

describe('PATCH /api/king/leads', () => {

  it('atualiza status para contacted → 200', async () => {
    const res = await PATCH(makePatchRequest({ companyId: 'company-001', status: 'contacted' }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(prisma.company.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'company-001' },
        data: expect.objectContaining({ salesStatus: 'CONTACTED' }),
      })
    )
  })

  it('atualiza salesMovedAt ao mudar status', async () => {
    await PATCH(makePatchRequest({ companyId: 'company-001', status: 'demo' }))
    expect(prisma.company.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          salesStatus: 'DEMO',
          salesMovedAt: expect.any(Date),
        }),
      })
    )
  })

  it('salva demoAt e demoNotes ao mover para demo', async () => {
    const body = {
      companyId: 'company-001',
      status: 'demo',
      demoAt: '2026-05-10T14:00:00Z',
      demoNotes: 'Apresentar módulo financeiro',
    }
    await PATCH(makePatchRequest(body))
    expect(prisma.company.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          demoAt: new Date('2026-05-10T14:00:00Z'),
          demoNotes: 'Apresentar módulo financeiro',
        }),
      })
    )
  })

  it('salva lostReason e lostComment ao marcar como perdido', async () => {
    const body = {
      companyId: 'company-001',
      status: 'lost',
      lostReason: 'Preço muito alto',
      lostComment: 'Cliente achou caro para o porte da empresa',
    }
    await PATCH(makePatchRequest(body))
    expect(prisma.company.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          salesStatus: 'LOST',
          lostReason: 'Preço muito alto',
          lostComment: 'Cliente achou caro para o porte da empresa',
          plan: 'BASIC',
          subscriptionStatus: 'CANCELED',
        }),
      })
    )
  })

  it('ativa assinatura ao marcar como ganho com plano', async () => {
    await PATCH(makePatchRequest({ companyId: 'company-001', status: 'won', plan: 'PROFESSIONAL' }))
    expect(prisma.company.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          salesStatus: 'WON',
          plan: 'PROFESSIONAL',
          subscriptionStatus: 'ACTIVE',
        }),
      })
    )
  })

  it('retorna 400 quando companyId está ausente', async () => {
    const res = await PATCH(makePatchRequest({ status: 'contacted' }))
    expect(res.status).toBe(400)
    expect(prisma.company.update).not.toHaveBeenCalled()
  })

  it('retorna 401 sem autenticação', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null as never)
    const res = await PATCH(makePatchRequest({ companyId: 'company-001', status: 'contacted' }))
    expect(res.status).toBe(401)
    expect(prisma.company.update).not.toHaveBeenCalled()
  })

  it('retorna 403 para role ADMIN', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(MOCK_ADMIN as never)
    const res = await PATCH(makePatchRequest({ companyId: 'company-001', status: 'contacted' }))
    expect(res.status).toBe(403)
    expect(prisma.company.update).not.toHaveBeenCalled()
  })

  it('retorna 500 quando Prisma lança erro', async () => {
    vi.mocked(prisma.company.update).mockRejectedValue(new Error('DB error'))
    const res = await PATCH(makePatchRequest({ companyId: 'company-001', status: 'contacted' }))
    expect(res.status).toBe(500)
  })
})
