import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    googleCalendarWatch: { findUnique: vi.fn(), delete: vi.fn() },
    user: { findUnique: vi.fn(), update: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))
vi.mock('@/lib/crypto', () => ({ decrypt: vi.fn().mockReturnValue('decrypted-token') }))

const mockFetch = vi.fn().mockResolvedValue({ ok: true })
vi.stubGlobal('fetch', mockFetch)

import { POST } from '../../app/api/auth/google/calendar/disconnect/route'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

const ADMIN = { id: 'u1', role: 'ADMIN', companyId: 'c1', email: 'a@b.com', name: 'Admin' }

function makeReq() {
  return new NextRequest('http://localhost/api/auth/google/calendar/disconnect', { method: 'POST' })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.user.update).mockResolvedValue({} as never)
})

describe('POST /api/auth/google/calendar/disconnect', () => {
  it('retorna 401 sem autenticação', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await POST(makeReq())
    expect(res.status).toBe(401)
  })

  it('limpa credenciais quando não há watch configurado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.googleCalendarWatch.findUnique).mockResolvedValue(null)
    const res = await POST(makeReq())
    expect(res.status).toBe(200)
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ googleCalendarConnected: false }) })
    )
  })

  it('para o canal do Google e remove o watch quando existente', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.googleCalendarWatch.findUnique).mockResolvedValue({
      userId: 'u1', channelId: 'ch1', resourceId: 'res1',
    } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ googleAccessToken: 'enc-token' } as never)
    vi.mocked(prisma.googleCalendarWatch.delete).mockResolvedValue({} as never)
    const res = await POST(makeReq())
    expect(res.status).toBe(200)
    expect(prisma.googleCalendarWatch.delete).toHaveBeenCalledWith({ where: { userId: 'u1' } })
  })

  it('retorna 500 com mensagem clara quando o banco falha inesperadamente', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.googleCalendarWatch.findUnique).mockRejectedValue(new Error('conexão perdida'))
    const res = await POST(makeReq())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })
})
