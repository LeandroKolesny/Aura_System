// aura-backend/src/__tests__/api/reports-commissions.test.ts
// Testes para GET /api/reports/commissions

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: { user: { findMany: vi.fn() }, appointment: { findMany: vi.fn() } },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))
vi.mock('@/lib/apiGuards', () => ({ checkModuleAccess: vi.fn() }))

import { GET } from '../../app/api/reports/commissions/route'
import { getAuthUser } from '@/lib/auth'
import { checkModuleAccess } from '@/lib/apiGuards'
import prisma from '@/lib/prisma'

const ADMIN = { id: 'u1', email: 'admin@clinica.com', role: 'ADMIN', companyId: 'c1' }
const ESTHETICIAN = { id: 'u2', email: 'esth@clinica.com', role: 'ESTHETICIAN', companyId: 'c1' }

function makeRequest(qs = '?startDate=2026-01-01&endDate=2026-01-31') {
  return new NextRequest(`http://localhost/api/reports/commissions${qs}`)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(checkModuleAccess).mockResolvedValue(null)
  vi.mocked(prisma.user.findMany).mockResolvedValue([])
  vi.mocked(prisma.appointment.findMany).mockResolvedValue([])
})

describe('GET /api/reports/commissions', () => {
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

  it('bloqueia quando o módulo de relatórios não está disponível no plano', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    const { NextResponse } = await import('next/server')
    vi.mocked(checkModuleAccess).mockResolvedValue(NextResponse.json({ error: 'módulo bloqueado' }, { status: 402 }))

    const res = await GET(makeRequest())
    expect(res.status).toBe(402)
  })

  it('retorna 403 quando o solicitante não é ADMIN nem OWNER', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ESTHETICIAN as never)
    const res = await GET(makeRequest())
    expect(res.status).toBe(403)
  })

  it('retorna 400 para parâmetros de data ausentes', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    const res = await GET(makeRequest('?startDate=2026-01-01'))
    expect(res.status).toBe(400)
  })

  it('não retorna 400 quando professionalId está ausente (regressão: searchParams.get retorna null, não undefined)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    const res = await GET(makeRequest('?startDate=2026-01-01&endDate=2026-01-31'))
    expect(res.status).toBe(200)
  })

  it('calcula comissão pura para remunerationType=COMMISSION', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 'prof1', name: 'Profissional A', commissionRate: 20, remunerationType: 'COMMISSION', fixedSalary: null },
    ] as never)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([{ id: 'a1', price: 100 }, { id: 'a2', price: 200 }] as never)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.commissions[0]).toEqual(expect.objectContaining({
      totalRevenue: 300, commissionAmount: 60, totalEarnings: 60, appointmentsCount: 2,
    }))
  })

  it('usa apenas o salário fixo para remunerationType=FIXED, ignorando comissão', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 'prof1', name: 'Profissional A', commissionRate: 20, remunerationType: 'FIXED', fixedSalary: 3000 },
    ] as never)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([{ id: 'a1', price: 500 }] as never)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.commissions[0].totalEarnings).toBe(3000)
  })

  it('soma fixo + comissão para remunerationType=MIXED', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 'prof1', name: 'Profissional A', commissionRate: 10, remunerationType: 'MIXED', fixedSalary: 1000 },
    ] as never)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([{ id: 'a1', price: 1000 }] as never)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.commissions[0].totalEarnings).toBe(1100)
  })

  it('filtra por professionalId quando informado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    await GET(makeRequest('?startDate=2026-01-01&endDate=2026-01-31&professionalId=prof1'))

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'prof1' }) })
    )
  })

  it('calcula os totais gerais somando todos os profissionais', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 'prof1', name: 'A', commissionRate: 10, remunerationType: 'COMMISSION', fixedSalary: null },
      { id: 'prof2', name: 'B', commissionRate: 20, remunerationType: 'COMMISSION', fixedSalary: null },
    ] as never)
    vi.mocked(prisma.appointment.findMany)
      .mockResolvedValueOnce([{ id: 'a1', price: 100 }] as never)
      .mockResolvedValueOnce([{ id: 'a2', price: 200 }] as never)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.totals).toEqual({ totalRevenue: 300, totalCommissions: 10 + 40, totalEarnings: 10 + 40 })
  })
})
