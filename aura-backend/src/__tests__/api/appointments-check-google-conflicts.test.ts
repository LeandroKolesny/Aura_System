// aura-backend/src/__tests__/api/appointments-check-google-conflicts.test.ts
// Testes para GET /api/appointments/check-google-conflicts

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: { user: { findUnique: vi.fn(), update: vi.fn() } },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))
vi.mock('@/lib/google', () => ({ refreshAccessToken: vi.fn() }))
vi.mock('@/lib/crypto', () => ({
  encrypt: vi.fn((v: string) => `encrypted(${v})`),
  decrypt: vi.fn((v: string) => v.replace('encrypted(', '').replace(')', '')),
}))

import { GET } from '../../app/api/appointments/check-google-conflicts/route'
import { getAuthUser } from '@/lib/auth'
import { refreshAccessToken } from '@/lib/google'
import prisma from '@/lib/prisma'

const ADMIN = { id: 'u1', email: 'admin@clinica.com', role: 'ADMIN', companyId: 'c1' }

const CONNECTED_PROFESSIONAL = {
  googleAccessToken: 'encrypted(valid-token)', googleRefreshToken: 'encrypted(refresh-token)',
  googleTokenExpiresAt: new Date(Date.now() + 3600_000), googleCalendarId: 'primary', googleCalendarConnected: true,
}

function makeRequest(qs = '?professionalId=prof1&startTime=2026-02-01T10:00:00Z&endTime=2026-02-01T11:00:00Z') {
  return new NextRequest(`http://localhost/api/appointments/check-google-conflicts${qs}`)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', vi.fn())
})

describe('GET /api/appointments/check-google-conflicts', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('retorna hasConflict=false quando parâmetros obrigatórios estão ausentes', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    const res = await GET(makeRequest('?professionalId=prof1'))
    const body = await res.json()
    expect(body.hasConflict).toBe(false)
  })

  it('retorna hasConflict=false quando o profissional não tem calendário conectado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ googleCalendarConnected: false } as never)

    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.hasConflict).toBe(false)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('renova o token de acesso expirado antes de consultar o Google Calendar', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...CONNECTED_PROFESSIONAL, googleTokenExpiresAt: new Date(Date.now() - 1000),
    } as never)
    vi.mocked(refreshAccessToken).mockResolvedValue({ access_token: 'new-token', expires_in: 3600 } as never)
    vi.mocked(global.fetch).mockResolvedValue({ ok: true, json: async () => ({ items: [] }) } as never)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(refreshAccessToken).toHaveBeenCalledWith('refresh-token')
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ googleAccessToken: 'encrypted(new-token)' }) })
    )
    expect(body.hasConflict).toBe(false)
  })

  it('retorna hasConflict=false quando o token expirou e não há refresh token', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...CONNECTED_PROFESSIONAL, googleTokenExpiresAt: new Date(Date.now() - 1000), googleRefreshToken: null,
    } as never)

    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.hasConflict).toBe(false)
  })

  it('retorna hasConflict=false quando a renovação do token falha', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...CONNECTED_PROFESSIONAL, googleTokenExpiresAt: new Date(Date.now() - 1000),
    } as never)
    vi.mocked(refreshAccessToken).mockRejectedValue(new Error('invalid_grant'))

    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.hasConflict).toBe(false)
  })

  it('retorna hasConflict=false quando a API do Google Calendar falha', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(CONNECTED_PROFESSIONAL as never)
    vi.mocked(global.fetch).mockResolvedValue({ ok: false } as never)

    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.hasConflict).toBe(false)
  })

  it('ignora eventos criados pelo próprio Aura System (extendedProperties.source)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(CONNECTED_PROFESSIONAL as never)
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true, json: async () => ({ items: [{ extendedProperties: { private: { source: 'aura-system' } }, start: { dateTime: '2026-02-01T10:00:00Z' } }] }),
    } as never)

    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.hasConflict).toBe(false)
  })

  it('ignora eventos cancelados', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(CONNECTED_PROFESSIONAL as never)
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true, json: async () => ({ items: [{ status: 'cancelled', start: { dateTime: '2026-02-01T10:00:00Z' } }] }),
    } as never)

    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.hasConflict).toBe(false)
  })

  it('detecta conflito com evento externo real e retorna horário formatado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(CONNECTED_PROFESSIONAL as never)
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true, json: async () => ({
        items: [{ summary: 'Dentista', start: { dateTime: '2026-02-01T10:00:00Z' }, end: { dateTime: '2026-02-01T10:30:00Z' } }],
      }),
    } as never)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.hasConflict).toBe(true)
    expect(body.event.title).toBe('Dentista')
  })

  it('retorna hasConflict=false em caso de erro inesperado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error('db down'))

    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.hasConflict).toBe(false)
  })
})
