// aura-backend/src/__tests__/api/webhooks-google-calendar.test.ts
// Testes para POST /api/webhooks/google-calendar

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    googleCalendarWatch: { findUnique: vi.fn() },
    user: { update: vi.fn() },
    unavailabilityRule: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
  },
}))
vi.mock('@/lib/google', () => ({ refreshAccessToken: vi.fn() }))
vi.mock('@/lib/calendarSync', () => ({ AURA_SOURCE_TAG: 'aura-system' }))
vi.mock('@/lib/crypto', () => ({
  encrypt: vi.fn((v: string) => `encrypted(${v})`),
  decrypt: vi.fn((v: string) => v.replace('encrypted(', '').replace(')', '')),
}))

import { POST } from '../../app/api/webhooks/google-calendar/route'
import { refreshAccessToken } from '@/lib/google'
import prisma from '@/lib/prisma'

const CONNECTED_USER = {
  id: 'u1', companyId: 'c1', googleAccessToken: 'encrypted(valid-token)', googleRefreshToken: 'encrypted(refresh-token)',
  googleTokenExpiresAt: new Date(Date.now() + 3600_000), googleCalendarId: 'primary',
}

function makeRequest(headers: Record<string, string> = { 'x-goog-channel-id': 'chan1', 'x-goog-resource-state': 'exists' }) {
  return new NextRequest('http://localhost/api/webhooks/google-calendar', { method: 'POST', headers })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', vi.fn())
  vi.mocked(prisma.unavailabilityRule.findFirst).mockResolvedValue(null)
})

describe('POST /api/webhooks/google-calendar', () => {
  it('reconhece a notificação inicial "sync" sem processar nada', async () => {
    const res = await POST(makeRequest({ 'x-goog-channel-id': 'chan1', 'x-goog-resource-state': 'sync' }))
    const body = await res.json()
    expect(body).toEqual({ ok: true })
    expect(prisma.googleCalendarWatch.findUnique).not.toHaveBeenCalled()
  })

  it('ignora quando o channelId está ausente', async () => {
    const res = await POST(makeRequest({}))
    const body = await res.json()
    expect(body).toEqual({ ok: true })
  })

  it('ignora quando o canal não corresponde a nenhum watch conhecido', async () => {
    vi.mocked(prisma.googleCalendarWatch.findUnique).mockResolvedValue(null)
    const res = await POST(makeRequest())
    const body = await res.json()
    expect(body).toEqual({ ok: true })
  })

  it('ignora quando o profissional dono do watch não tem empresa', async () => {
    vi.mocked(prisma.googleCalendarWatch.findUnique).mockResolvedValue({ user: { ...CONNECTED_USER, companyId: null } } as never)
    const res = await POST(makeRequest())
    const body = await res.json()
    expect(body).toEqual({ ok: true })
  })

  it('renova o token expirado antes de buscar eventos', async () => {
    vi.mocked(prisma.googleCalendarWatch.findUnique).mockResolvedValue({
      user: { ...CONNECTED_USER, googleTokenExpiresAt: new Date(Date.now() - 1000) },
    } as never)
    vi.mocked(refreshAccessToken).mockResolvedValue({ access_token: 'new-token', expires_in: 3600 } as never)
    vi.mocked(global.fetch).mockResolvedValue({ ok: true, json: async () => ({ items: [] }) } as never)

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    expect(refreshAccessToken).toHaveBeenCalledWith('refresh-token')
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ googleAccessToken: 'encrypted(new-token)' }) })
    )
  })

  it('prossegue sem token quando a renovação falha, retornando ok sem processar eventos', async () => {
    vi.mocked(prisma.googleCalendarWatch.findUnique).mockResolvedValue({
      user: { ...CONNECTED_USER, googleAccessToken: null, googleTokenExpiresAt: new Date(Date.now() - 1000) },
    } as never)
    vi.mocked(refreshAccessToken).mockRejectedValue(new Error('invalid_grant'))

    const res = await POST(makeRequest())
    const body = await res.json()
    expect(body).toEqual({ ok: true })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('retorna ok quando a API do Google Calendar falha', async () => {
    vi.mocked(prisma.googleCalendarWatch.findUnique).mockResolvedValue({ user: CONNECTED_USER } as never)
    vi.mocked(global.fetch).mockResolvedValue({ ok: false } as never)

    const res = await POST(makeRequest())
    const body = await res.json()
    expect(body).toEqual({ ok: true })
  })

  it('ignora eventos criados pelo próprio Aura System (previne loop de eco)', async () => {
    vi.mocked(prisma.googleCalendarWatch.findUnique).mockResolvedValue({ user: CONNECTED_USER } as never)
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true, json: async () => ({ items: [{ id: 'ev1', extendedProperties: { private: { source: 'aura-system' } }, start: { dateTime: '2026-03-05T10:00:00-03:00' }, end: { dateTime: '2026-03-05T11:00:00-03:00' } }] }),
    } as never)

    await POST(makeRequest())
    expect(prisma.unavailabilityRule.create).not.toHaveBeenCalled()
  })

  it('ignora eventos cancelados ou de dia inteiro (sem dateTime)', async () => {
    vi.mocked(prisma.googleCalendarWatch.findUnique).mockResolvedValue({ user: CONNECTED_USER } as never)
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true, json: async () => ({ items: [{ id: 'ev1', status: 'cancelled', start: {} }] }),
    } as never)

    await POST(makeRequest())
    expect(prisma.unavailabilityRule.create).not.toHaveBeenCalled()
  })

  it('cria uma regra de indisponibilidade a partir de um novo evento externo', async () => {
    vi.mocked(prisma.googleCalendarWatch.findUnique).mockResolvedValue({ user: CONNECTED_USER } as never)
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true, json: async () => ({ items: [{ id: 'ev1', start: { dateTime: '2026-03-05T10:00:00-03:00' }, end: { dateTime: '2026-03-05T11:00:00-03:00' } }] }),
    } as never)

    await POST(makeRequest())

    expect(prisma.unavailabilityRule.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ description: 'google:ev1', startTime: '10:00', endTime: '11:00', dates: ['2026-03-05'] }) })
    )
  })

  it('atualiza a regra existente em vez de duplicar quando o evento já foi processado antes', async () => {
    vi.mocked(prisma.googleCalendarWatch.findUnique).mockResolvedValue({ user: CONNECTED_USER } as never)
    vi.mocked(prisma.unavailabilityRule.findFirst).mockResolvedValue({ id: 'rule-existing' } as never)
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true, json: async () => ({ items: [{ id: 'ev1', start: { dateTime: '2026-03-05T10:00:00-03:00' }, end: { dateTime: '2026-03-05T11:00:00-03:00' } }] }),
    } as never)

    await POST(makeRequest())

    expect(prisma.unavailabilityRule.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'rule-existing' } }))
    expect(prisma.unavailabilityRule.create).not.toHaveBeenCalled()
  })
})
