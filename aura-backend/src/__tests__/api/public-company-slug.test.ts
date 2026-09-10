// aura-backend/src/__tests__/api/public-company-slug.test.ts
// Testes para GET /api/public/company/[slug]

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    company: { findUnique: vi.fn() },
    procedure: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
    appointment: { findMany: vi.fn() },
    unavailabilityRule: { findMany: vi.fn() },
    subscriptionPlan: { findMany: vi.fn() },
  },
}))
vi.mock('@/lib/rateLimiter', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
}))

import { GET } from '../../app/api/public/company/[slug]/route'
import { checkRateLimit } from '@/lib/rateLimiter'
import prisma from '@/lib/prisma'

const COMPANY = { id: 'c1', name: 'Clínica Teste', slug: 'clinica-teste' }

function makeRequest() {
  return new NextRequest('http://localhost/api/public/company/clinica-teste')
}
function makeParams(slug = 'clinica-teste') {
  return { params: Promise.resolve({ slug }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 59 } as never)
  vi.mocked(prisma.procedure.findMany).mockResolvedValue([])
  vi.mocked(prisma.user.findMany).mockResolvedValue([])
  vi.mocked(prisma.appointment.findMany).mockResolvedValue([])
  vi.mocked(prisma.unavailabilityRule.findMany).mockResolvedValue([])
  vi.mocked(prisma.subscriptionPlan.findMany).mockResolvedValue([])
})

describe('GET /api/public/company/[slug]', () => {
  it('é uma rota pública — não exige autenticação', async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValue(COMPANY as never)
    const res = await GET(makeRequest(), makeParams())
    expect(res.status).toBe(200)
  })

  it('retorna 429 quando o rate limit é excedido (anti-enumeração de slugs)', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, remaining: 0, retryAfter: 900 } as never)
    const res = await GET(makeRequest(), makeParams())
    expect(res.status).toBe(429)
    expect(prisma.company.findUnique).not.toHaveBeenCalled()
  })

  it('retorna 404 quando a empresa não existe', async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValue(null)
    const res = await GET(makeRequest(), makeParams())
    expect(res.status).toBe(404)
  })

  it('converte o preço dos procedimentos de Decimal para number', async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValue(COMPANY as never)
    vi.mocked(prisma.procedure.findMany).mockResolvedValue([
      { id: 'proc1', name: 'Limpeza', price: { toString: () => '150.00' } as unknown as number },
    ] as never)

    const res = await GET(makeRequest(), makeParams())
    const body = await res.json()

    expect(body.procedures[0].price).toBe(150)
  })

  it('inclui apenas profissionais ADMIN/ESTHETICIAN ativos (exclui OWNER/PATIENT)', async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValue(COMPANY as never)
    await GET(makeRequest(), makeParams())

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isActive: true, role: { in: ['ADMIN', 'ESTHETICIAN'] } }) })
    )
  })

  it('busca apenas agendamentos futuros com status ativo para checagem de disponibilidade', async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValue(COMPANY as never)
    await GET(makeRequest(), makeParams())

    expect(prisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ date: { gte: expect.any(Date) }, status: { in: ['SCHEDULED', 'CONFIRMED', 'PENDING_APPROVAL'] } }),
      })
    )
  })

  it('normaliza o status dos agendamentos para minúsculas na resposta', async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValue(COMPANY as never)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      { id: 'a1', date: new Date(), durationMinutes: 60, professionalId: 'p1', roomId: null, status: 'CONFIRMED' },
    ] as never)

    const res = await GET(makeRequest(), makeParams())
    const body = await res.json()

    expect(body.appointments[0].status).toBe('confirmed')
  })

  it('converte o preço dos planos de assinatura e dos procedimentos vinculados', async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValue(COMPANY as never)
    vi.mocked(prisma.subscriptionPlan.findMany).mockResolvedValue([
      {
        id: 'plan1', name: 'Mensal', price: { toString: () => '99.90' } as unknown as number, description: null, imageUrl: null,
        items: [{ procedure: { id: 'proc1', name: 'Limpeza', price: { toString: () => '150.00' } as unknown as number, durationMinutes: 60 } }],
      },
    ] as never)

    const res = await GET(makeRequest(), makeParams())
    const body = await res.json()

    expect(body.subscriptionPlans[0].price).toBe(99.9)
    expect(body.subscriptionPlans[0].items[0].procedure.price).toBe(150)
  })

  it('retorna 500 em caso de erro inesperado', async () => {
    vi.mocked(prisma.company.findUnique).mockRejectedValue(new Error('db down'))
    const res = await GET(makeRequest(), makeParams())
    expect(res.status).toBe(500)
  })

  it('inclui layoutConfig e onlineBookingConfig no payload da resposta pública', async () => {
    // A página pública (PublicBooking.tsx) depende desses campos para aplicar
    // cores/fonte e limitar a janela de agendamento. Este teste trava contra a
    // remoção acidental dos campos do `select` da rota.
    const layoutConfig = { primaryColor: '#bd7b65', fontFamily: 'inter', baseFontSize: 'md' }
    const onlineBookingConfig = { slotInterval: 30, minAdvanceTime: 60, maxBookingPeriod: 30 }
    vi.mocked(prisma.company.findUnique).mockResolvedValue({
      ...COMPANY,
      layoutConfig,
      onlineBookingConfig,
    } as never)

    const res = await GET(makeRequest(), makeParams())
    const body = await res.json()

    expect(body.company.layoutConfig).toEqual(layoutConfig)
    expect(body.company.onlineBookingConfig).toEqual(onlineBookingConfig)
    expect(prisma.company.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({ layoutConfig: true, onlineBookingConfig: true }),
      })
    )
  })
})
