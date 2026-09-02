// aura-backend/src/__tests__/api/auth-forgot-password.test.ts
// Testes para POST /api/auth/forgot-password

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: { user: { findUnique: vi.fn(), update: vi.fn() } },
}))
vi.mock('@/lib/email', () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}))

import { POST } from '../../app/api/auth/forgot-password/route'
import prisma from '@/lib/prisma'
import { sendPasswordResetEmail } from '@/lib/email'

const GENERIC_MESSAGE = 'Se o email estiver cadastrado, você receberá as instruções de recuperação.'

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/auth/forgot-password', () => {
  it('retorna 400 quando o email é inválido', async () => {
    const res = await POST(makeRequest({ email: 'not-an-email' }))
    expect(res.status).toBe(400)
  })

  it('retorna mensagem genérica (200) quando o usuário não existe — não revela existência do email', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    const res = await POST(makeRequest({ email: 'ghost@email.com' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.message).toBe(GENERIC_MESSAGE)
    expect(sendPasswordResetEmail).not.toHaveBeenCalled()
  })

  it('retorna a mesma mensagem genérica quando a conta está desativada — não revela status da conta', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'u1', name: 'User', isActive: false } as never)
    const res = await POST(makeRequest({ email: 'user@email.com' }))
    const body = await res.json()

    expect(body.message).toBe(GENERIC_MESSAGE)
    expect(prisma.user.update).not.toHaveBeenCalled()
    expect(sendPasswordResetEmail).not.toHaveBeenCalled()
  })

  it('gera novo token de reset com expiração de 2h e envia o email', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'u1', name: 'User Test', isActive: true } as never)
    const before = Date.now()

    await POST(makeRequest({ email: 'user@email.com' }))

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({ resetPasswordToken: expect.any(String), resetPasswordExpiry: expect.any(Date) }),
      })
    )
    const updateCall = vi.mocked(prisma.user.update).mock.calls[0][0] as unknown as { data: { resetPasswordExpiry: Date } }
    const expiryMs = updateCall.data.resetPasswordExpiry.getTime()
    expect(expiryMs).toBeGreaterThan(before + 1 * 60 * 60 * 1000)
    expect(expiryMs).toBeLessThan(before + 3 * 60 * 60 * 1000)

    expect(sendPasswordResetEmail).toHaveBeenCalledWith('user@email.com', 'User Test', expect.any(String))
  })

  it('usa "Usuário" como nome padrão quando o usuário não tem nome cadastrado', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'u1', name: null, isActive: true } as never)
    await POST(makeRequest({ email: 'user@email.com' }))
    expect(sendPasswordResetEmail).toHaveBeenCalledWith('user@email.com', 'Usuário', expect.any(String))
  })

  it('não falha a requisição se o envio do email rejeitar (fire-and-forget)', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'u1', name: 'User', isActive: true } as never)
    vi.mocked(sendPasswordResetEmail).mockRejectedValue(new Error('resend down'))

    const res = await POST(makeRequest({ email: 'user@email.com' }))
    expect(res.status).toBe(200)
  })

  it('retorna 500 em caso de erro inesperado', async () => {
    vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error('db down'))
    const res = await POST(makeRequest({ email: 'user@email.com' }))
    expect(res.status).toBe(500)
  })
})
