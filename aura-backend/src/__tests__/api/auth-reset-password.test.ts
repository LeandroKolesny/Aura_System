// src/__tests__/api/auth-reset-password.test.ts
// Testes para POST /api/auth/reset-password

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { User } from '@prisma/client'

vi.mock('@/lib/prisma', () => ({
  default: {
    user: { findFirst: vi.fn(), update: vi.fn() },
  },
}))
vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn().mockResolvedValue('$2b$12$newhashed') },
}))

import { POST } from '../../app/api/auth/reset-password/route'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// ── fixtures ──────────────────────────────────────────────────────────────────

const VALID_TOKEN = 'valid-reset-token-abc123'
const MOCK_USER = { id: 'user-001' } as User
const VALID_BODY = { token: VALID_TOKEN, password: 'novaSenha123' }

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.user.findFirst).mockResolvedValue(MOCK_USER)
  vi.mocked(prisma.user.update).mockResolvedValue(MOCK_USER)
})

// ── testes ────────────────────────────────────────────────────────────────────

describe('POST /api/auth/reset-password', () => {

  it('redefine senha com sucesso e retorna 200', async () => {
    const res = await POST(makeRequest(VALID_BODY))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.message).toContain('sucesso')
  })

  it('faz hash da nova senha antes de salvar', async () => {
    await POST(makeRequest(VALID_BODY))
    expect(bcrypt.hash).toHaveBeenCalledWith(VALID_BODY.password, 12)
    const updateCall = vi.mocked(prisma.user.update).mock.calls[0][0]
    expect((updateCall.data as { password: string }).password).toBe('$2b$12$newhashed')
  })

  it('incrementa tokenVersion para invalidar JWTs ativos', async () => {
    await POST(makeRequest(VALID_BODY))
    const updateCall = vi.mocked(prisma.user.update).mock.calls[0][0]
    expect((updateCall.data as { tokenVersion: { increment: number } }).tokenVersion).toEqual({ increment: 1 })
  })

  it('limpa resetPasswordToken e resetPasswordExpiry após uso', async () => {
    await POST(makeRequest(VALID_BODY))
    const updateCall = vi.mocked(prisma.user.update).mock.calls[0][0]
    const data = updateCall.data as Record<string, unknown>
    expect(data.resetPasswordToken).toBeNull()
    expect(data.resetPasswordExpiry).toBeNull()
  })

  it('retorna 400 quando token inválido ou expirado', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null)
    const res = await POST(makeRequest(VALID_BODY))
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toContain('inválido')
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('retorna 400 para senha com menos de 8 caracteres', async () => {
    const res = await POST(makeRequest({ token: VALID_TOKEN, password: '123' }))
    expect(res.status).toBe(400)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('retorna 400 quando token ausente', async () => {
    const res = await POST(makeRequest({ password: 'novaSenha123' }))
    expect(res.status).toBe(400)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('busca token apenas com expiry no futuro (não aceita expirado)', async () => {
    await POST(makeRequest(VALID_BODY))
    const findCall = vi.mocked(prisma.user.findFirst).mock.calls[0]?.[0]
    expect((findCall?.where as Record<string, unknown>).resetPasswordExpiry).toEqual(
      expect.objectContaining({ gt: expect.any(Date) })
    )
  })
})
