// src/__tests__/security/middleware.test.ts
// Testes de segurança para CORS/CSRF no middleware

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/middleware', () => ({
  updateSession: vi.fn().mockImplementation((_req: NextRequest) =>
    Promise.resolve(new Response(null, { status: 200 }))
  ),
}))

import { middleware, isOriginAllowed } from '../../middleware'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeRequest(method: string, origin: string | null, path = '/api/test') {
  const headers: Record<string, string> = {}
  if (origin !== null) headers['origin'] = origin
  return new NextRequest(`http://localhost${path}`, { method, headers })
}

// ---------------------------------------------------------------------------
// isOriginAllowed — função pura testada em isolamento
// ---------------------------------------------------------------------------
describe('isOriginAllowed', () => {
  it('retorna false para origin null', () => {
    expect(isOriginAllowed(null)).toBe(false)
  })

  it('retorna false para string vazia', () => {
    expect(isOriginAllowed('')).toBe(false)
  })

  it('permite http://localhost:3000', () => {
    expect(isOriginAllowed('http://localhost:3000')).toBe(true)
  })

  it('permite http://localhost:5173', () => {
    expect(isOriginAllowed('http://localhost:5173')).toBe(true)
  })

  it('permite https://aura-system-mu.vercel.app', () => {
    expect(isOriginAllowed('https://aura-system-mu.vercel.app')).toBe(true)
  })

  it('permite IP local 192.168.x.x:3000 (regex)', () => {
    expect(isOriginAllowed('http://192.168.1.100:3000')).toBe(true)
    expect(isOriginAllowed('http://192.168.0.1:3000')).toBe(true)
  })

  it('bloqueia domínio desconhecido', () => {
    expect(isOriginAllowed('https://evil.com')).toBe(false)
  })

  it('bloqueia porta incorreta em localhost', () => {
    expect(isOriginAllowed('http://localhost:4000')).toBe(false)
  })

  it('bloqueia domínio similar ao permitido (subdomain attack)', () => {
    expect(isOriginAllowed('https://evil-aura-system-mu.vercel.app')).toBe(false)
    expect(isOriginAllowed('https://aura-system-mu.vercel.app.evil.com')).toBe(false)
  })

  it('bloqueia IP fora da faixa 192.168.x.x', () => {
    expect(isOriginAllowed('http://10.0.0.1:3000')).toBe(false)
    expect(isOriginAllowed('http://172.16.0.1:3000')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// middleware — proteção CSRF (null-origin bypass VULN-01)
// ---------------------------------------------------------------------------
describe('middleware CSRF protection', () => {
  beforeEach(() => vi.clearAllMocks())

  it('SECURITY: bloqueia POST sem Origin (null-origin bypass)', async () => {
    const req = makeRequest('POST', null)
    const res = await middleware(req)
    expect(res.status).toBe(403)
  })

  it('SECURITY: bloqueia PUT sem Origin', async () => {
    const req = makeRequest('PUT', null)
    const res = await middleware(req)
    expect(res.status).toBe(403)
  })

  it('SECURITY: bloqueia POST de origem desconhecida', async () => {
    const req = makeRequest('POST', 'https://evil.com')
    const res = await middleware(req)
    expect(res.status).toBe(403)
  })

  it('permite POST de localhost:3000', async () => {
    const req = makeRequest('POST', 'http://localhost:3000')
    const res = await middleware(req)
    expect(res.status).not.toBe(403)
  })

  it('permite GET sem Origin (requests server-to-server)', async () => {
    const req = makeRequest('GET', null)
    const res = await middleware(req)
    expect(res.status).not.toBe(403)
  })

  it('permite POST para /api/webhooks/ sem Origin (webhook externo)', async () => {
    const req = makeRequest('POST', null, '/api/webhooks/asaas')
    const res = await middleware(req)
    expect(res.status).not.toBe(403)
  })

  it('responde OPTIONS (preflight) com 200', async () => {
    const req = makeRequest('OPTIONS', 'http://localhost:3000')
    const res = await middleware(req)
    expect(res.status).toBe(200)
  })

  it('inclui Access-Control-Allow-Origin na resposta quando origin é permitida', async () => {
    const req = makeRequest('GET', 'http://localhost:3000')
    const res = await middleware(req)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000')
  })

  it('não inclui Access-Control-Allow-Origin quando origin é desconhecida', async () => {
    const req = makeRequest('GET', 'https://evil.com')
    const res = await middleware(req)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })
})
