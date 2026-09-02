// aura-backend/src/__tests__/api/auth-logout.test.ts
// Testes para POST /api/auth/logout

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { POST } from '../../app/api/auth/logout/route'

describe('POST /api/auth/logout', () => {
  afterEach(() => {
    ;(process.env as Record<string, string>).NODE_ENV = 'test'
  })

  it('retorna 200 com mensagem de sucesso', async () => {
    const res = await POST()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.message).toBe('Logout realizado com sucesso!')
  })

  it('limpa o cookie de sessão (aura_session) com maxAge 0', async () => {
    const res = await POST()
    const cookie = res.cookies.get('aura_session')

    expect(cookie?.value).toBe('')
    expect(cookie?.maxAge).toBe(0)
    expect(cookie?.path).toBe('/')
  })

  it('define o cookie como httpOnly e sameSite=none', async () => {
    const res = await POST()
    const cookie = res.cookies.get('aura_session')

    expect(cookie?.httpOnly).toBe(true)
    expect(cookie?.sameSite).toBe('none')
  })

  it('define secure=true em produção', async () => {
    ;(process.env as Record<string, string>).NODE_ENV = 'production'
    const res = await POST()
    const cookie = res.cookies.get('aura_session')

    expect(cookie?.secure).toBe(true)
  })

  it('define secure=false fora de produção', async () => {
    ;(process.env as Record<string, string>).NODE_ENV = 'test'
    const res = await POST()
    const cookie = res.cookies.get('aura_session')

    expect(cookie?.secure).toBe(false)
  })
})
