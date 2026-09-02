// aura-backend/src/__tests__/api/cron-renew-calendar-watches.test.ts
// Testes para GET /api/cron/renew-calendar-watches

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: { googleCalendarWatch: { findMany: vi.fn() } },
}))
vi.mock('@/lib/calendarSync', () => ({ registerCalendarWatch: vi.fn().mockResolvedValue(undefined) }))

import { GET } from '../../app/api/cron/renew-calendar-watches/route'
import { registerCalendarWatch } from '@/lib/calendarSync'
import prisma from '@/lib/prisma'

function makeReq(token = 'test-secret') {
  return new NextRequest('http://localhost/api/cron/renew-calendar-watches', {
    headers: { authorization: `Bearer ${token}` },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = 'test-secret'
  vi.mocked(prisma.googleCalendarWatch.findMany).mockResolvedValue([])
})

describe('GET /api/cron/renew-calendar-watches', () => {
  it('retorna 401 sem Authorization header', async () => {
    const res = await GET(new NextRequest('http://localhost/api/cron/renew-calendar-watches'))
    expect(res.status).toBe(401)
  })

  it('retorna 401 com token errado', async () => {
    const res = await GET(makeReq('wrong-secret'))
    expect(res.status).toBe(401)
  })

  it('retorna 401 quando CRON_SECRET não está definido', async () => {
    delete process.env.CRON_SECRET
    const res = await GET(makeReq('any-token'))
    expect(res.status).toBe(401)
  })

  it('busca apenas watches expirando nos próximos 2 dias', async () => {
    await GET(makeReq())
    expect(prisma.googleCalendarWatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { expiration: { lte: expect.any(Date) } } })
    )
  })

  it('retorna renewed=0 e total=0 quando não há watches expirando', async () => {
    const res = await GET(makeReq())
    const body = await res.json()
    expect(body).toEqual({ renewed: 0, total: 0 })
  })

  it('renova cada watch expirando chamando registerCalendarWatch por usuário', async () => {
    vi.mocked(prisma.googleCalendarWatch.findMany).mockResolvedValue([
      { userId: 'u1' }, { userId: 'u2' },
    ] as never)

    const res = await GET(makeReq())
    const body = await res.json()

    expect(body).toEqual({ renewed: 2, total: 2 })
    expect(registerCalendarWatch).toHaveBeenCalledWith('u1')
    expect(registerCalendarWatch).toHaveBeenCalledWith('u2')
  })

  it('continua processando os demais mesmo se a renovação de um usuário falhar', async () => {
    vi.mocked(prisma.googleCalendarWatch.findMany).mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }] as never)
    vi.mocked(registerCalendarWatch).mockRejectedValueOnce(new Error('falha')).mockResolvedValueOnce(undefined)

    const res = await GET(makeReq())
    const body = await res.json()

    expect(body.renewed).toBe(2)
    expect(registerCalendarWatch).toHaveBeenCalledTimes(2)
  })
})
