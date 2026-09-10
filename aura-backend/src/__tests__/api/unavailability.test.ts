// aura-backend/src/__tests__/api/unavailability.test.ts
// Testes para GET/POST /api/unavailability

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    unavailabilityRule: { findMany: vi.fn(), create: vi.fn() },
    appointment: { findMany: vi.fn() },
    activity: { create: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))
vi.mock('@/lib/apiGuards', () => ({ checkWriteAccess: vi.fn() }))

import { GET, POST } from '../../app/api/unavailability/route'
import { getAuthUser } from '@/lib/auth'
import { checkWriteAccess } from '@/lib/apiGuards'
import prisma from '@/lib/prisma'

const ADMIN = { id: 'u1', email: 'admin@clinica.com', role: 'ADMIN', companyId: 'c1' }
const ESTHETICIAN = { id: 'u2', email: 'esth@clinica.com', role: 'ESTHETICIAN', companyId: 'c1' }

const VALID_RULE = { startTime: '08:00', endTime: '18:00', dates: ['2026-03-01'], professionalIds: [] }

function makeGetRequest(qs = '') {
  return new NextRequest(`http://localhost/api/unavailability${qs}`)
}
function makePostRequest(body: unknown) {
  return new NextRequest('http://localhost/api/unavailability', {
    method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(checkWriteAccess).mockResolvedValue(null)
  vi.mocked(prisma.unavailabilityRule.findMany).mockResolvedValue([])
  vi.mocked(prisma.appointment.findMany).mockResolvedValue([]) // sem agendamentos no período
})

describe('GET /api/unavailability', () => {
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

  it('inclui regras específicas do profissional e regras gerais (professionalIds vazio)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    await GET(makeGetRequest('?professionalId=prof1'))

    expect(prisma.unavailabilityRule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ professionalIds: { has: 'prof1' } }, { professionalIds: { isEmpty: true } }],
        }),
      })
    )
  })

  it('não filtra por professionalId quando não informado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    await GET(makeGetRequest())
    expect(prisma.unavailabilityRule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 'c1' } })
    )
  })
})

describe('POST /api/unavailability', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await POST(makePostRequest(VALID_RULE))
    expect(res.status).toBe(401)
  })

  it('retorna 403 quando o usuário não tem empresa', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ ...ADMIN, companyId: null } as never)
    const res = await POST(makePostRequest(VALID_RULE))
    expect(res.status).toBe(403)
  })

  it('bloqueia quando o plano não permite escrita', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    const { NextResponse } = await import('next/server')
    vi.mocked(checkWriteAccess).mockResolvedValue(NextResponse.json({ error: 'bloqueado' }, { status: 402 }))

    const res = await POST(makePostRequest(VALID_RULE))
    expect(res.status).toBe(402)
  })

  it('retorna 403 quando o solicitante não é ADMIN nem OWNER', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ESTHETICIAN as never)
    const res = await POST(makePostRequest(VALID_RULE))
    expect(res.status).toBe(403)
  })

  it('retorna 400 para dados inválidos (formato de horário)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    const res = await POST(makePostRequest({ ...VALID_RULE, startTime: '8h' }))
    expect(res.status).toBe(400)
  })

  it('retorna 400 quando startTime não é menor que endTime', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    const res = await POST(makePostRequest({ ...VALID_RULE, startTime: '18:00', endTime: '08:00' }))
    expect(res.status).toBe(400)
  })

  it('retorna 400 quando uma data não está no formato YYYY-MM-DD', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    const res = await POST(makePostRequest({ ...VALID_RULE, dates: ['01/03/2026'] }))
    expect(res.status).toBe(400)
  })

  it('cria a regra e registra atividade de auditoria', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.unavailabilityRule.create).mockResolvedValue({ id: 'rule1' } as never)

    const res = await POST(makePostRequest(VALID_RULE))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.rule.id).toBe('rule1')
    expect(prisma.activity.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'SETTINGS_CHANGED', metadata: { ruleId: 'rule1' } }) })
    )
  })
})

describe('POST /api/unavailability — conflito com agendamentos já marcados (409)', () => {
  beforeEach(() => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.unavailabilityRule.create).mockResolvedValue({ id: 'rule1' } as never)
  })

  it('retorna 409 e NÃO cria a regra quando há agendamento ativo do profissional afetado no período', async () => {
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      { id: 'appt-1', date: new Date(2026, 2, 1, 12, 0, 0), professionalId: 'prof-1' },
    ] as never)

    const res = await POST(
      makePostRequest({ startTime: '08:00', endTime: '18:00', dates: ['2026-03-01'], professionalIds: ['prof-1'] })
    )
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error).toMatch(/agendamento/i)
    expect(prisma.unavailabilityRule.create).not.toHaveBeenCalled()
  })

  it('regra geral (professionalIds vazio): agendamento ativo de QUALQUER profissional no período → 409', async () => {
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      { id: 'appt-2', date: new Date(2026, 2, 1, 10, 30, 0), professionalId: 'qualquer-prof' },
    ] as never)

    const res = await POST(
      makePostRequest({ startTime: '08:00', endTime: '18:00', dates: ['2026-03-01'], professionalIds: [] })
    )
    expect(res.status).toBe(409)
    expect(prisma.unavailabilityRule.create).not.toHaveBeenCalled()
  })

  it('agendamento fora da janela de horário da regra → NÃO conflita, cria normalmente (201)', async () => {
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      { id: 'appt-3', date: new Date(2026, 2, 1, 7, 0, 0), professionalId: 'prof-1' }, // 07:00, antes das 08:00
    ] as never)

    const res = await POST(
      makePostRequest({ startTime: '08:00', endTime: '18:00', dates: ['2026-03-01'], professionalIds: ['prof-1'] })
    )
    expect(res.status).toBe(201)
    expect(prisma.unavailabilityRule.create).toHaveBeenCalled()
  })

  it('período livre (sem agendamentos) → 201 normal', async () => {
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([] as never)

    const res = await POST(
      makePostRequest({ startTime: '08:00', endTime: '18:00', dates: ['2026-03-01'], professionalIds: ['prof-1'] })
    )
    expect(res.status).toBe(201)
    expect(prisma.unavailabilityRule.create).toHaveBeenCalled()
  })
})
