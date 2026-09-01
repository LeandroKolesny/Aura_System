// src/__tests__/api/auth-verify-email.test.ts
// Testes para POST /api/auth/verify-email

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { User } from '@prisma/client'

vi.mock('@/lib/prisma', () => ({
  default: {
    user: { findFirst: vi.fn(), update: vi.fn() },
  },
}))

import { POST } from '../../app/api/auth/verify-email/route'
import prisma from '@/lib/prisma'

// ── fixtures ──────────────────────────────────────────────────────────────────

const VALID_TOKEN = 'valid-verification-token-abc123'

const MOCK_USER_UNVERIFIED = {
  id: 'user-001',
  email: 'user@test.com',
  emailVerified: null,
} as unknown as User

const MOCK_USER_VERIFIED = {
  id: 'user-001',
  email: 'user@test.com',
  emailVerified: new Date('2024-01-01'),
} as unknown as User

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.user.findFirst).mockResolvedValue(MOCK_USER_UNVERIFIED)
  vi.mocked(prisma.user.update).mockResolvedValue(MOCK_USER_VERIFIED)
})

// ── testes ────────────────────────────────────────────────────────────────────

describe('POST /api/auth/verify-email', () => {

  it('verifica email com sucesso e retorna 200', async () => {
    const res = await POST(makeRequest({ token: VALID_TOKEN }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.message).toContain('sucesso')
  })

  it('seta emailVerified e limpa o token após verificação', async () => {
    await POST(makeRequest({ token: VALID_TOKEN }))
    expect(prisma.user.update).toHaveBeenCalledOnce()
    const updateCall = vi.mocked(prisma.user.update).mock.calls[0][0]
    const data = updateCall.data as Record<string, unknown>
    expect(data.emailVerified).toBeInstanceOf(Date)
    expect(data.verificationToken).toBeNull()
    expect(data.verificationTokenExpiry).toBeNull()
  })

  it('é idempotente — retorna 200 se email já verificado sem chamar update', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(MOCK_USER_VERIFIED)
    const res = await POST(makeRequest({ token: VALID_TOKEN }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.message).toContain('verificado')
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('retorna 400 quando token inválido ou expirado', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null)
    const res = await POST(makeRequest({ token: 'token-invalido' }))
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toContain('inválido')
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('retorna 400 quando token ausente', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('busca token apenas com expiry no futuro (não aceita expirado)', async () => {
    await POST(makeRequest({ token: VALID_TOKEN }))
    const findCall = vi.mocked(prisma.user.findFirst).mock.calls[0]?.[0]
    expect((findCall?.where as Record<string, unknown>).verificationTokenExpiry).toEqual(
      expect.objectContaining({ gt: expect.any(Date) })
    )
  })
})
