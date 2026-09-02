// aura-backend/src/__tests__/api/auth-me.test.ts
// Testes para GET /api/auth/me

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: { user: { findUnique: vi.fn() } },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))

import { GET } from '../../app/api/auth/me/route'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

const AUTH_USER = { id: 'u1', email: 'user@email.com', role: 'ADMIN', companyId: 'c1' }

const DB_USER = {
  id: 'u1', email: 'user@email.com', name: 'User Test', avatar: null, role: 'ADMIN', isActive: true,
  phone: null, createdAt: new Date('2026-01-01'),
  company: { id: 'c1', name: 'Clínica Teste', slug: 'clinica-teste', logo: null, plan: 'FREE', state: 'SP', subscriptionStatus: 'TRIAL', subscriptionExpiresAt: null, onboardingCompleted: true, businessHours: {} },
}

function makeRequest(cookieValue?: string) {
  const req = new NextRequest('http://localhost/api/auth/me')
  if (cookieValue !== undefined) {
    req.cookies.set('aura_session', cookieValue)
  }
  return req
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/auth/me', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('retorna 404 quando o usuário autenticado não existe mais no banco', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(AUTH_USER as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    const res = await GET(makeRequest())
    expect(res.status).toBe(404)
  })

  it('retorna os dados do usuário e da empresa em caso de sucesso', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(AUTH_USER as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(DB_USER as never)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.user.id).toBe('u1')
    expect(body.user.company.slug).toBe('clinica-teste')
  })

  it('busca o usuário filtrando apenas os campos necessários (sem senha)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(AUTH_USER as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(DB_USER as never)

    await GET(makeRequest())

    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        select: expect.not.objectContaining({ password: true }),
      })
    )
  })

  it('retorna o token lido do cookie httpOnly aura_session', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(AUTH_USER as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(DB_USER as never)

    const res = await GET(makeRequest('cookie-jwt-value'))
    const body = await res.json()

    expect(body.token).toBe('cookie-jwt-value')
  })

  it('retorna token null quando não há cookie de sessão', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(AUTH_USER as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(DB_USER as never)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.token).toBeNull()
  })

  it('retorna 500 em caso de erro inesperado', async () => {
    vi.mocked(getAuthUser).mockRejectedValue(new Error('db down'))
    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
  })
})
