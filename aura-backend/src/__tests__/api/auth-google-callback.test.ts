// aura-backend/src/__tests__/api/auth-google-callback.test.ts
// Testes para GET /api/auth/google/callback

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createHmac } from 'crypto'

vi.mock('@/lib/google', () => ({
  exchangeCodeForTokens: vi.fn(),
  getGoogleUserInfo: vi.fn(),
}))
vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
  generateJWT: vi.fn().mockReturnValue('mocked.jwt.token'),
}))
vi.mock('@/lib/prisma', () => ({
  default: {
    user: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
  },
}))
vi.mock('@/lib/crypto', () => ({
  encrypt: vi.fn((v: string) => `encrypted(${v})`),
}))
vi.mock('@/lib/auditLog', () => ({
  logLogin: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn().mockResolvedValue('hashed-temp-password') },
}))

import { GET } from '../../app/api/auth/google/callback/route'
import { exchangeCodeForTokens, getGoogleUserInfo } from '@/lib/google'
import { getAuthUser, generateJWT } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { encrypt } from '@/lib/crypto'
import { logLogin } from '@/lib/auditLog'

const FRONTEND_URL = 'http://localhost:5173'
const SESSION_SECRET = 'test-session-secret-32-characters!!'

function signState(mode: string, returnTo = '/') {
  const payload = JSON.stringify({ mode, returnTo, nonce: 'abc123' })
  const sig = createHmac('sha256', SESSION_SECRET).update(payload).digest('hex')
  return Buffer.from(JSON.stringify({ payload, sig })).toString('base64url')
}

function makeRequest(qs: string) {
  return new NextRequest(`http://localhost/api/auth/google/callback${qs}`)
}

function locationOf(res: Response) {
  return res.headers.get('location') || ''
}

const VERIFIED_USER_INFO = {
  sub: 'google-sub-1', email: 'user@email.com', email_verified: true, name: 'User Test', picture: 'http://pic.jpg',
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.SESSION_SECRET = SESSION_SECRET
  process.env.FRONTEND_URL = FRONTEND_URL
  vi.mocked(exchangeCodeForTokens).mockResolvedValue({ access_token: 'at', refresh_token: 'rt', expires_in: 3600 } as never)
  vi.mocked(getGoogleUserInfo).mockResolvedValue(VERIFIED_USER_INFO as never)
})

describe('GET /api/auth/google/callback', () => {
  it('redireciona com google_denied quando o Google retorna erro', async () => {
    const res = await GET(makeRequest('?error=access_denied'))
    expect(locationOf(res)).toBe(`${FRONTEND_URL}/login?error=google_denied`)
  })

  it('redireciona com invalid_callback quando faltam code ou state', async () => {
    const res = await GET(makeRequest('?state=abc'))
    expect(locationOf(res)).toBe(`${FRONTEND_URL}/login?error=invalid_callback`)
  })

  it('retorna 500 quando SESSION_SECRET não está configurado', async () => {
    delete process.env.SESSION_SECRET
    const res = await GET(makeRequest('?code=c&state=s'))
    expect(res.status).toBe(500)
  })

  it('redireciona com invalid_state quando a assinatura do state é inválida', async () => {
    const tampered = Buffer.from(JSON.stringify({ payload: JSON.stringify({ mode: 'login', returnTo: '/' }), sig: 'a'.repeat(64) })).toString('base64url')
    const res = await GET(makeRequest(`?code=c&state=${tampered}`))
    expect(locationOf(res)).toBe(`${FRONTEND_URL}/login?error=invalid_state`)
  })

  it('redireciona com invalid_state quando o state é base64/JSON malformado', async () => {
    const res = await GET(makeRequest('?code=c&state=not-valid-base64url-json'))
    expect(locationOf(res)).toBe(`${FRONTEND_URL}/login?error=invalid_state`)
  })

  it('redireciona com email_not_verified quando o e-mail do Google não é verificado', async () => {
    vi.mocked(getGoogleUserInfo).mockResolvedValue({ ...VERIFIED_USER_INFO, email_verified: false } as never)
    const res = await GET(makeRequest(`?code=c&state=${signState('login')}`))
    expect(locationOf(res)).toBe(`${FRONTEND_URL}/login?error=email_not_verified`)
  })

  describe('modo calendar', () => {
    it('redireciona com not_authenticated quando não há usuário logado', async () => {
      vi.mocked(getAuthUser).mockResolvedValue(null)
      const res = await GET(makeRequest(`?code=c&state=${signState('calendar')}`))
      expect(locationOf(res)).toBe(`${FRONTEND_URL}/login?error=not_authenticated`)
    })

    it('salva os tokens do Google criptografados e redireciona para settings', async () => {
      vi.mocked(getAuthUser).mockResolvedValue({ id: 'u1' } as never)
      const res = await GET(makeRequest(`?code=c&state=${signState('calendar')}`))

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u1' },
          data: expect.objectContaining({
            googleAccessToken: 'encrypted(at)',
            googleRefreshToken: 'encrypted(rt)',
            googleCalendarId: 'primary',
            googleCalendarConnected: true,
          }),
        })
      )
      expect(encrypt).toHaveBeenCalledWith('at')
      expect(locationOf(res)).toBe(`${FRONTEND_URL}/settings?google_calendar=connected`)
    })
  })

  describe('modo login/signin', () => {
    it('redireciona com google_no_account quando nenhum usuário corresponde', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null)
      const res = await GET(makeRequest(`?code=c&state=${signState('login')}`))
      expect(locationOf(res)).toBe(`${FRONTEND_URL}/login?error=google_no_account`)
    })

    it('redireciona com account_disabled quando a conta está inativa', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'u1', isActive: false } as never)
      const res = await GET(makeRequest(`?code=c&state=${signState('login')}`))
      expect(locationOf(res)).toBe(`${FRONTEND_URL}/login?error=account_disabled`)
    })

    it('vincula o googleId automaticamente quando ausente, sem promover o role (SEC-FIX)', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        id: 'u1', email: 'user@email.com', role: 'RECEPTIONIST', isActive: true, googleId: null, company: { id: 'c1' },
      } as never)

      await GET(makeRequest(`?code=c&state=${signState('login')}`))

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'u1' }, data: expect.objectContaining({ googleId: 'google-sub-1' }) })
      )
      expect(generateJWT).toHaveBeenCalledWith(expect.objectContaining({ role: 'RECEPTIONIST', companyId: 'c1' }))
    })

    it('não atualiza googleId quando já está vinculado', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        id: 'u1', email: 'user@email.com', role: 'ADMIN', isActive: true, googleId: 'google-sub-1', company: null,
      } as never)

      await GET(makeRequest(`?code=c&state=${signState('login')}`))

      expect(prisma.user.update).not.toHaveBeenCalled()
    })

    it('gera JWT e redireciona com o token no fragmento da URL em caso de sucesso', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        id: 'u1', email: 'user@email.com', role: 'ADMIN', isActive: true, googleId: 'google-sub-1', company: { id: 'c1' },
      } as never)

      const res = await GET(makeRequest(`?code=c&state=${signState('login')}`))

      expect(locationOf(res)).toBe(`${FRONTEND_URL}/login#google_token=mocked.jwt.token`)
    })

    it('chama logLogin de forma fire-and-forget sem bloquear o redirect', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        id: 'u1', email: 'user@email.com', role: 'ADMIN', isActive: true, googleId: 'google-sub-1', company: null,
      } as never)

      await GET(makeRequest(`?code=c&state=${signState('login')}`))

      expect(logLogin).toHaveBeenCalledWith('u1', 'user@email.com', expect.anything())
    })
  })

  describe('modo register', () => {
    it('redireciona com google_already_registered quando a conta já existe (sem promover role)', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'existing' } as never)
      const res = await GET(makeRequest(`?code=c&state=${signState('register')}`))
      expect(locationOf(res)).toBe(`${FRONTEND_URL}/login?error=google_already_registered`)
      expect(prisma.user.create).not.toHaveBeenCalled()
    })

    it('cria novo usuário ADMIN sem companyId e redireciona com token', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.user.create).mockResolvedValue({ id: 'new-u1', email: 'user@email.com', role: 'ADMIN' } as never)

      const res = await GET(makeRequest(`?code=c&state=${signState('register')}`))

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'user@email.com', role: 'ADMIN', isActive: true, googleId: 'google-sub-1' }),
        })
      )
      expect(generateJWT).toHaveBeenCalledWith(expect.objectContaining({ companyId: null }))
      expect(locationOf(res)).toBe(`${FRONTEND_URL}/login#google_token=mocked.jwt.token`)
    })
  })

  it('redireciona com invalid_mode para um modo desconhecido', async () => {
    const res = await GET(makeRequest(`?code=c&state=${signState('bogus-mode')}`))
    expect(locationOf(res)).toBe(`${FRONTEND_URL}/login?error=invalid_mode`)
  })

  it('redireciona com google_error em caso de falha inesperada (ex.: exchangeCodeForTokens falha)', async () => {
    vi.mocked(exchangeCodeForTokens).mockRejectedValue(new Error('boom'))
    const res = await GET(makeRequest(`?code=c&state=${signState('login')}`))
    expect(locationOf(res)).toBe(`${FRONTEND_URL}/login?error=google_error`)
  })
})
