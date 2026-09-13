// src/__tests__/lib/kingGuard.test.ts
// Testes unitários de requireOwner() — guard usado por TODAS as rotas /api/king/*.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('../../lib/auth', () => ({
  getAuthUser: vi.fn(),
}))

import { requireOwner } from '../../lib/kingGuard'
import { getAuthUser } from '../../lib/auth'
import type { AuthUser } from '../../lib/auth'

function makeRequest() {
  return new NextRequest('http://localhost/api/king/qualquer-coisa', { method: 'GET' })
}

const OWNER: AuthUser = {
  id: 'owner-1',
  email: 'king@aura.system',
  name: 'King',
  role: 'OWNER',
  companyId: null,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('requireOwner', () => {
  it('sem token/sessão (getAuthUser retorna null) → 401, authorized=false, user=null', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)

    const result = await requireOwner(makeRequest())

    expect(result.authorized).toBe(false)
    expect(result.user).toBeNull()
    expect(result.response).not.toBeNull()
    expect(result.response!.status).toBe(401)
    const body = await result.response!.json()
    expect(body.error).toBe('Não autenticado')
  })

  it('usuário autenticado com role OWNER → authorized=true, response=null, retorna o AuthUser', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(OWNER)

    const result = await requireOwner(makeRequest())

    expect(result.authorized).toBe(true)
    expect(result.response).toBeNull()
    expect(result.user).toEqual(OWNER)
  })

  it.each(['ADMIN', 'RECEPTIONIST', 'ESTHETICIAN', 'PATIENT'])(
    'usuário autenticado com role %s → 403, authorized=false, user=null',
    async (role) => {
      vi.mocked(getAuthUser).mockResolvedValue({
        id: 'u1',
        email: 'u1@test.com',
        name: 'Fulano',
        role,
        companyId: 'company-1',
      })

      const result = await requireOwner(makeRequest())

      expect(result.authorized).toBe(false)
      expect(result.user).toBeNull()
      expect(result.response!.status).toBe(403)
      const body = await result.response!.json()
      expect(body.error).toBe('Acesso restrito ao Owner')
    }
  )

  it('role vazio/malformado (string vazia) → tratado como não-OWNER → 403', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({
      id: 'u1',
      email: 'u1@test.com',
      name: 'Fulano',
      role: '',
      companyId: null,
    })

    const result = await requireOwner(makeRequest())

    expect(result.authorized).toBe(false)
    expect(result.response!.status).toBe(403)
  })

  it('comparação de role é case-sensitive: "owner" minúsculo NÃO é aceito como OWNER', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({
      id: 'u1',
      email: 'u1@test.com',
      name: 'Fulano',
      role: 'owner',
      companyId: null,
    })

    const result = await requireOwner(makeRequest())

    expect(result.authorized).toBe(false)
    expect(result.response!.status).toBe(403)
  })

  it('OWNER com companyId preenchido (cenário atípico) ainda é autorizado — o guard não escopa por empresa', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ ...OWNER, companyId: 'company-999' })

    const result = await requireOwner(makeRequest())

    expect(result.authorized).toBe(true)
    expect(result.user?.companyId).toBe('company-999')
  })
})
