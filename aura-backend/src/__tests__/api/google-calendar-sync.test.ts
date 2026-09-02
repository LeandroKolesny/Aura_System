// aura-backend/src/__tests__/api/google-calendar-sync.test.ts
// Testes para POST /api/auth/google/calendar/sync

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    unavailabilityRule: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))
vi.mock('@/lib/google', () => ({ refreshAccessToken: vi.fn() }))
vi.mock('@/lib/crypto', () => ({
  encrypt: vi.fn((v: string) => `encrypted(${v})`),
  decrypt: vi.fn((v: string) => v.replace('encrypted(', '').replace(')', '')),
}))

import { POST } from '../../app/api/auth/google/calendar/sync/route'
import { getAuthUser } from '@/lib/auth'
import { refreshAccessToken } from '@/lib/google'
import prisma from '@/lib/prisma'

const ADMIN = { id: 'u1', email: 'admin@clinica.com', role: 'ADMIN', companyId: 'c1' }

const CONNECTED_USER = {
  id: 'u1', companyId: 'c1', googleAccessToken: 'encrypted(valid-token)', googleRefreshToken: 'encrypted(refresh-token)',
  googleTokenExpiresAt: new Date(Date.now() + 3600_000), googleCalendarId: 'primary', googleCalendarConnected: true,
}

function makeRequest() {
  return new NextRequest('http://localhost/api/auth/google/calendar/sync', { method: 'POST' })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', vi.fn())
  vi.mocked(prisma.unavailabilityRule.findFirst).mockResolvedValue(null)
  vi.mocked(prisma.unavailabilityRule.create).mockResolvedValue({ id: 'rule1' } as never)
})

describe('POST /api/auth/google/calendar/sync', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await POST(makeRequest())
    expect(res.status).toBe(401)
  })

  it('retorna 400 quando o Google Calendar não está conectado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ googleCalendarConnected: false } as never)

    const res = await POST(makeRequest())
    expect(res.status).toBe(400)
  })

  it('retorna 400 quando o usuário não tem empresa', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...CONNECTED_USER, companyId: null } as never)

    const res = await POST(makeRequest())
    expect(res.status).toBe(400)
  })

  it('renova o token expirado antes de buscar eventos', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...CONNECTED_USER, googleTokenExpiresAt: new Date(Date.now() - 1000) } as never)
    vi.mocked(refreshAccessToken).mockResolvedValue({ access_token: 'new-token', expires_in: 3600 } as never)
    vi.mocked(global.fetch).mockResolvedValue({ ok: true, json: async () => ({ items: [] }) } as never)

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    expect(refreshAccessToken).toHaveBeenCalledWith('refresh-token')
  })

  it('retorna 401 quando a renovação do token falha', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...CONNECTED_USER, googleTokenExpiresAt: new Date(Date.now() - 1000) } as never)
    vi.mocked(refreshAccessToken).mockRejectedValue(new Error('invalid_grant'))

    const res = await POST(makeRequest())
    expect(res.status).toBe(401)
  })

  it('retorna 502 quando a API do Google Calendar falha', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(CONNECTED_USER as never)
    vi.mocked(global.fetch).mockResolvedValue({ ok: false } as never)

    const res = await POST(makeRequest())
    expect(res.status).toBe(502)
  })

  it('ignora eventos criados pelo próprio Aura System', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(CONNECTED_USER as never)
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true, json: async () => ({ items: [{ id: 'ev1', extendedProperties: { private: { source: 'aura-system' } }, start: { dateTime: '2026-03-05T10:00:00-03:00' }, end: { dateTime: '2026-03-05T11:00:00-03:00' } }] }),
    } as never)

    const res = await POST(makeRequest())
    const body = await res.json()

    expect(body.synced).toBe(0)
    expect(prisma.unavailabilityRule.create).not.toHaveBeenCalled()
  })

  it('ignora eventos cancelados ou sem horário definido', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(CONNECTED_USER as never)
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true, json: async () => ({ items: [{ id: 'ev1', status: 'cancelled', start: { dateTime: '2026-03-05T10:00:00-03:00' } }] }),
    } as never)

    const res = await POST(makeRequest())
    const body = await res.json()
    expect(body.synced).toBe(0)
  })

  it('cria uma nova regra de indisponibilidade a partir de um evento externo real', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(CONNECTED_USER as never)
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true, json: async () => ({ items: [{ id: 'ev1', start: { dateTime: '2026-03-05T10:00:00-03:00' }, end: { dateTime: '2026-03-05T11:00:00-03:00' } }] }),
    } as never)

    const res = await POST(makeRequest())
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(body.synced).toBe(1)
    expect(prisma.unavailabilityRule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ description: 'google:ev1', startTime: '10:00', endTime: '11:00', dates: ['2026-03-05'], professionalIds: ['u1'] }),
      })
    )
  })

  it('atualiza uma regra existente em vez de duplicar quando o evento já foi sincronizado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(CONNECTED_USER as never)
    vi.mocked(prisma.unavailabilityRule.findFirst).mockResolvedValue({ id: 'rule-existing' } as never)
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true, json: async () => ({ items: [{ id: 'ev1', start: { dateTime: '2026-03-05T10:00:00-03:00' }, end: { dateTime: '2026-03-05T11:00:00-03:00' } }] }),
    } as never)

    const res = await POST(makeRequest())
    const body = await res.json()

    expect(prisma.unavailabilityRule.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'rule-existing' } })
    )
    expect(prisma.unavailabilityRule.create).not.toHaveBeenCalled()
    expect(body.synced).toBe(0)
  })

  it('retorna 500 em caso de erro inesperado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error('db down'))

    const res = await POST(makeRequest())
    expect(res.status).toBe(500)
  })
})
