// aura-backend/src/__tests__/api/auth-resend-verification.test.ts
// Testes para POST /api/auth/resend-verification

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: { user: { findUnique: vi.fn(), update: vi.fn() } },
}))
vi.mock('@/lib/email', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
}))

import { POST } from '../../app/api/auth/resend-verification/route'
import prisma from '@/lib/prisma'
import { sendVerificationEmail } from '@/lib/email'

const GENERIC_MESSAGE = 'Se o email estiver cadastrado e não verificado, você receberá um novo link.'

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/auth/resend-verification', () => {
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
    expect(sendVerificationEmail).not.toHaveBeenCalled()
  })

  it('retorna a mesma mensagem genérica quando o email já está verificado', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'u1', name: 'User', emailVerified: true } as never)
    const res = await POST(makeRequest({ email: 'user@email.com' }))
    const body = await res.json()

    expect(body.message).toBe(GENERIC_MESSAGE)
    expect(prisma.user.update).not.toHaveBeenCalled()
    expect(sendVerificationEmail).not.toHaveBeenCalled()
  })

  it('gera novo token de verificação com expiração de 24h e envia o email', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'u1', name: 'User Test', emailVerified: false } as never)
    const before = Date.now()

    await POST(makeRequest({ email: 'user@email.com' }))

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({ verificationToken: expect.any(String), verificationTokenExpiry: expect.any(Date) }),
      })
    )
    const updateCall = vi.mocked(prisma.user.update).mock.calls[0][0] as unknown as { data: { verificationTokenExpiry: Date } }
    const expiryMs = updateCall.data.verificationTokenExpiry.getTime()
    expect(expiryMs).toBeGreaterThan(before + 23 * 60 * 60 * 1000)
    expect(expiryMs).toBeLessThan(before + 25 * 60 * 60 * 1000)

    expect(sendVerificationEmail).toHaveBeenCalledWith('user@email.com', 'User Test', expect.any(String))
  })

  it('usa "Usuário" como nome padrão quando o usuário não tem nome cadastrado', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'u1', name: null, emailVerified: false } as never)
    await POST(makeRequest({ email: 'user@email.com' }))
    expect(sendVerificationEmail).toHaveBeenCalledWith('user@email.com', 'Usuário', expect.any(String))
  })

  it('não falha a requisição se o envio do email rejeitar (fire-and-forget)', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'u1', name: 'User', emailVerified: false } as never)
    vi.mocked(sendVerificationEmail).mockRejectedValue(new Error('resend down'))

    const res = await POST(makeRequest({ email: 'user@email.com' }))
    expect(res.status).toBe(200)
  })

  it('retorna 500 em caso de erro inesperado', async () => {
    vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error('db down'))
    const res = await POST(makeRequest({ email: 'user@email.com' }))
    expect(res.status).toBe(500)
  })
})
