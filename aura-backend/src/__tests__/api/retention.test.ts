// aura-backend/src/__tests__/api/retention.test.ts
// Testes para GET /api/retention (relatório de retenção de pacientes)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: { appointment: { findMany: vi.fn() } },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))

import { GET } from '../../app/api/retention/route'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

const ADMIN = { id: 'u1', email: 'admin@clinica.com', role: 'ADMIN', companyId: 'c1' }
const NOW = new Date('2026-06-01T12:00:00Z')

function makeRequest(qs = '') {
  return new NextRequest(`http://localhost/api/retention${qs}`)
}

function apptFor(daysAgo: number, opts: { intervalDays?: number | null; patientId?: string } = {}) {
  const date = new Date(NOW)
  date.setDate(date.getDate() - daysAgo)
  return {
    date, patientId: opts.patientId ?? 'p1',
    patient: { id: opts.patientId ?? 'p1', name: 'Paciente Teste', phone: '11999999999' },
    procedure: { id: 'proc1', name: 'Limpeza', maintenanceIntervalDays: opts.intervalDays ?? null },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  vi.mocked(prisma.appointment.findMany).mockResolvedValue([])
})

afterEach(() => {
  vi.useRealTimers()
})

describe('GET /api/retention', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('retorna 403 quando o usuário não tem empresa', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ ...ADMIN, companyId: null } as never)
    const res = await GET(makeRequest())
    expect(res.status).toBe(403)
  })

  it('usa 90 dias como período padrão e cai para 90 se o valor for inválido', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    await GET(makeRequest('?period=45'))

    const call = vi.mocked(prisma.appointment.findMany).mock.calls[0][0] as unknown as { where: { date: { gte: Date } } }
    const expectedStart = new Date(NOW)
    expectedStart.setDate(expectedStart.getDate() - 90)
    expect(call.where.date.gte.getTime()).toBe(expectedStart.getTime())
  })

  it('aceita period=30 como válido', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    await GET(makeRequest('?period=30'))

    const call = vi.mocked(prisma.appointment.findMany).mock.calls[0][0] as unknown as { where: { date: { gte: Date } } }
    const expectedStart = new Date(NOW)
    expectedStart.setDate(expectedStart.getDate() - 30)
    expect(call.where.date.gte.getTime()).toBe(expectedStart.getTime())
  })

  it('usa o intervalo padrão de 60 dias quando o procedimento não define maintenanceIntervalDays', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([apptFor(70)] as never)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.data.patients).toHaveLength(1)
    expect(body.data.patients[0].isDefaultInterval).toBe(true)
    expect(body.data.patients[0].intervalUsed).toBe(60)
  })

  it('não inclui pacientes cujo retorno esperado ainda não passou', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([apptFor(10, { intervalDays: 60 })] as never)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.data.patients).toHaveLength(0)
  })

  it('classifica risco "attention" para até 10 dias de atraso', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([apptFor(65, { intervalDays: 60 })] as never)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.data.patients[0].risk).toBe('attention')
  })

  it('classifica risco "at_risk" entre 11 e 30 dias de atraso', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([apptFor(80, { intervalDays: 60 })] as never)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.data.patients[0].risk).toBe('at_risk')
  })

  it('classifica risco "lost" acima de 30 dias de atraso', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([apptFor(120, { intervalDays: 60 })] as never)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.data.patients[0].risk).toBe('lost')
  })

  it('mantém apenas o agendamento mais recente por paciente (findMany já ordenado desc)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      apptFor(65, { intervalDays: 60, patientId: 'p1' }),
      apptFor(200, { intervalDays: 60, patientId: 'p1' }),
    ] as never)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.data.patients).toHaveLength(1)
    expect(body.data.patients[0].daysOverdue).toBe(5)
  })

  it('calcula a taxa de retenção corretamente', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      apptFor(65, { intervalDays: 60, patientId: 'p1' }),
      apptFor(5, { intervalDays: 60, patientId: 'p2' }),
    ] as never)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.data.summary.retentionRate).toBe(50)
  })

  it('retorna retentionRate 100 quando não há pacientes no período', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.data.summary.retentionRate).toBe(100)
  })

  it('filtra por professionalId quando informado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    await GET(makeRequest('?professionalId=prof1'))
    expect(prisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ professionalId: 'prof1' }) })
    )
  })
})
