// aura-backend/src/__tests__/api/google-calendar-status.test.ts
// Testes para GET /api/auth/google/calendar/status

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: { user: { findUnique: vi.fn() } },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))

import { GET } from '../../app/api/auth/google/calendar/status/route'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

const ADMIN = { id: 'u1', email: 'admin@clinica.com', role: 'ADMIN', companyId: 'c1' }

function makeRequest() {
  return new NextRequest('http://localhost/api/auth/google/calendar/status')
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/auth/google/calendar/status', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('retorna connected=true com o calendarId quando conectado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ googleCalendarConnected: true, googleCalendarId: 'primary' } as never)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body).toEqual({ connected: true, calendarId: 'primary' })
  })

  it('retorna connected=false quando não conectado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ googleCalendarConnected: false, googleCalendarId: null } as never)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body).toEqual({ connected: false, calendarId: null })
  })

  it('retorna connected=false quando o usuário não é encontrado no banco', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body).toEqual({ connected: false, calendarId: null })
  })
})
