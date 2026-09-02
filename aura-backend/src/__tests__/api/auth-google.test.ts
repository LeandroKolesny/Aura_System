// aura-backend/src/__tests__/api/auth-google.test.ts
// Testes para GET /api/auth/google (inicia o fluxo OAuth)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createHmac } from 'crypto'

vi.mock('@/lib/google', () => ({
  getGoogleAuthUrl: vi.fn().mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?mock=1'),
}))

import { GET } from '../../app/api/auth/google/route'
import { getGoogleAuthUrl } from '@/lib/google'

function makeRequest(qs = '') {
  return new NextRequest(`http://localhost/api/auth/google${qs}`)
}

function decodeState(state: string): { payload: string; sig: string } {
  return JSON.parse(Buffer.from(state, 'base64url').toString())
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.SESSION_SECRET = 'test-session-secret-32-characters!!'
})

describe('GET /api/auth/google', () => {
  it('retorna 500 quando SESSION_SECRET não está configurado', async () => {
    delete process.env.SESSION_SECRET
    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
  })

  it('redireciona para a URL de autenticação do Google', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(307) // NextResponse.redirect default
    expect(res.headers.get('location')).toBe('https://accounts.google.com/o/oauth2/v2/auth?mock=1')
  })

  it('usa mode=signin por padrão quando não especificado (sem escopo de calendário)', async () => {
    await GET(makeRequest())
    expect(getGoogleAuthUrl).toHaveBeenCalledWith(expect.any(String), false)
  })

  it('inclui escopo de calendário quando mode=calendar', async () => {
    await GET(makeRequest('?mode=calendar'))
    expect(getGoogleAuthUrl).toHaveBeenCalledWith(expect.any(String), true)
  })

  it('propaga returnTo válido (caminho relativo) no state assinado', async () => {
    await GET(makeRequest('?returnTo=/dashboard'))
    const state = vi.mocked(getGoogleAuthUrl).mock.calls[0][0]
    const { payload } = decodeState(state)
    expect(JSON.parse(payload).returnTo).toBe('/dashboard')
  })

  it('bloqueia returnTo protocol-relative (//evil.com) e usa "/" — previne open redirect', async () => {
    await GET(makeRequest('?returnTo=//evil.com'))
    const state = vi.mocked(getGoogleAuthUrl).mock.calls[0][0]
    const { payload } = decodeState(state)
    expect(JSON.parse(payload).returnTo).toBe('/')
  })

  it('bloqueia returnTo absoluto (https://evil.com) e usa "/"', async () => {
    await GET(makeRequest('?returnTo=https://evil.com'))
    const state = vi.mocked(getGoogleAuthUrl).mock.calls[0][0]
    const { payload } = decodeState(state)
    expect(JSON.parse(payload).returnTo).toBe('/')
  })

  it('assina o state com HMAC-SHA256 verificável usando SESSION_SECRET', async () => {
    await GET(makeRequest())
    const state = vi.mocked(getGoogleAuthUrl).mock.calls[0][0]
    const { payload, sig } = decodeState(state)
    const expectedSig = createHmac('sha256', process.env.SESSION_SECRET!).update(payload).digest('hex')
    expect(sig).toBe(expectedSig)
  })
})
