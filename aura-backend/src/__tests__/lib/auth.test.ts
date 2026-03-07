// aura-backend/src/__tests__/lib/auth.test.ts
// Testes de segurança e autenticação para auth.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import jwt from 'jsonwebtoken'
import { NextRequest, NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// Mock do Prisma — deve vir ANTES do import de auth.ts
// ---------------------------------------------------------------------------
vi.mock('../../lib/prisma', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
    },
  },
}))

import {
  generateJWT,
  verifyJWT,
  getAuthUser,
  isAdmin,
  requirePermission,
  clearUserCache,
} from '../../lib/auth'
import type { AuthUser } from '../../lib/auth'
import prisma from '../../lib/prisma'

// ---------------------------------------------------------------------------
// Constantes de teste
// ---------------------------------------------------------------------------
const TEST_SECRET = 'test-secret-aura-system-vitest-32chars!!'

const BASE_USER = {
  id: 'user-001',
  email: 'test@aura.com',
  role: 'ADMIN',
  companyId: 'company-001',
}

const DB_USER_ACTIVE = {
  id: 'user-001',
  email: 'test@aura.com',
  name: 'Test User',
  role: 'ADMIN',
  companyId: 'company-001',
  isActive: true,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const makeRequestWithCookie = (token: string) => {
  const req = new NextRequest('http://localhost/api/test')
  req.cookies.set('aura_session', token)
  return req
}

const makeRequestWithHeader = (token: string) =>
  new NextRequest('http://localhost/api/test', {
    headers: { Authorization: `Bearer ${token}` },
  })

const makeRequestNoAuth = () => new NextRequest('http://localhost/api/test')

const makeAuthUser = (role: string, overrides: Partial<AuthUser> = {}): AuthUser => ({
  id: 'user-001',
  email: 'test@aura.com',
  name: 'Test User',
  role,
  companyId: 'company-001',
  ...overrides,
})

// JWT assinado com secret ERRADO (para simular token forjado)
const makeForgedToken = (payload: object) =>
  jwt.sign(payload, 'wrong-secret-totally-different', { expiresIn: '1h' })

// JWT já expirado
const makeExpiredToken = (user = BASE_USER) =>
  jwt.sign(
    { userId: user.id, email: user.email, role: user.role, companyId: user.companyId },
    TEST_SECRET,
    { expiresIn: -1 }
  )

// ---------------------------------------------------------------------------
// Limpar cache e mocks entre testes
// ---------------------------------------------------------------------------
beforeEach(() => {
  clearUserCache()
  vi.clearAllMocks()
})

afterEach(() => {
  clearUserCache()
})

// ===========================================================================
// generateJWT
// ===========================================================================
describe('generateJWT', () => {
  it('retorna uma string não vazia', () => {
    const token = generateJWT(BASE_USER)
    expect(typeof token).toBe('string')
    expect(token.length).toBeGreaterThan(0)
  })

  it('token pode ser decodificado com verifyJWT', () => {
    const token = generateJWT(BASE_USER)
    const payload = verifyJWT(token)
    expect(payload).not.toBeNull()
  })

  it('payload contém userId correto', () => {
    const token = generateJWT(BASE_USER)
    const payload = verifyJWT(token)
    expect(payload?.userId).toBe(BASE_USER.id)
  })

  it('payload contém email correto', () => {
    const token = generateJWT(BASE_USER)
    const payload = verifyJWT(token)
    expect(payload?.email).toBe(BASE_USER.email)
  })

  it('payload contém role correto', () => {
    const token = generateJWT(BASE_USER)
    const payload = verifyJWT(token)
    expect(payload?.role).toBe(BASE_USER.role)
  })

  it('payload contém companyId correto', () => {
    const token = generateJWT(BASE_USER)
    const payload = verifyJWT(token)
    expect(payload?.companyId).toBe(BASE_USER.companyId)
  })

  it('diferentes usuários geram tokens diferentes', () => {
    const userA = { id: 'u-A', email: 'a@a.com', role: 'ADMIN', companyId: 'c-A' }
    const userB = { id: 'u-B', email: 'b@b.com', role: 'PATIENT', companyId: 'c-B' }
    const tokenA = generateJWT(userA)
    const tokenB = generateJWT(userB)
    expect(tokenA).not.toBe(tokenB)
  })

  it('usuário com companyId null gera token válido', () => {
    const user = { id: 'u-1', email: 'owner@saas.com', role: 'OWNER', companyId: null }
    const token = generateJWT(user)
    const payload = verifyJWT(token)
    expect(payload).not.toBeNull()
    expect(payload?.companyId).toBeNull()
  })

  it('token é formato JWT válido (três partes separadas por ponto)', () => {
    const token = generateJWT(BASE_USER)
    const parts = token.split('.')
    expect(parts).toHaveLength(3)
  })
})

// ===========================================================================
// verifyJWT
// ===========================================================================
describe('verifyJWT', () => {
  it('token válido retorna payload com userId', () => {
    const token = generateJWT(BASE_USER)
    const payload = verifyJWT(token)
    expect(payload?.userId).toBe(BASE_USER.id)
  })

  it('token válido retorna payload com email', () => {
    const token = generateJWT(BASE_USER)
    const payload = verifyJWT(token)
    expect(payload?.email).toBe(BASE_USER.email)
  })

  it('token válido retorna payload com role', () => {
    const token = generateJWT(BASE_USER)
    const payload = verifyJWT(token)
    expect(payload?.role).toBe(BASE_USER.role)
  })

  it('token válido retorna payload com companyId', () => {
    const token = generateJWT(BASE_USER)
    const payload = verifyJWT(token)
    expect(payload?.companyId).toBe(BASE_USER.companyId)
  })

  it('token com assinatura forjada (secret errado) → null', () => {
    const forgedToken = makeForgedToken({
      userId: BASE_USER.id,
      email: BASE_USER.email,
      role: BASE_USER.role,
      companyId: BASE_USER.companyId,
    })
    expect(verifyJWT(forgedToken)).toBeNull()
  })

  it('token expirado → null', () => {
    const expiredToken = makeExpiredToken()
    expect(verifyJWT(expiredToken)).toBeNull()
  })

  it('string aleatória/malformada → null', () => {
    expect(verifyJWT('nao.e.um.jwt.valido')).toBeNull()
  })

  it('string sem pontos → null', () => {
    expect(verifyJWT('completamente-invalido-sem-estrutura-jwt')).toBeNull()
  })

  it('string vazia → null', () => {
    expect(verifyJWT('')).toBeNull()
  })

  it('token válido inclui iat e exp no payload', () => {
    const token = generateJWT(BASE_USER)
    const payload = verifyJWT(token)
    expect(payload?.iat).toBeDefined()
    expect(payload?.exp).toBeDefined()
  })

  it('token de outro sistema (signed com secret diferente) → null', () => {
    const alienToken = jwt.sign({ userId: 'x', email: 'x@x.com' }, 'outro-sistema-secret')
    expect(verifyJWT(alienToken)).toBeNull()
  })
})

// ===========================================================================
// getAuthUser — casos principais
// ===========================================================================
describe('getAuthUser', () => {
  describe('sem token', () => {
    it('requisição sem cookie e sem header → null', async () => {
      const req = makeRequestNoAuth()
      const user = await getAuthUser(req)
      expect(user).toBeNull()
    })

    it('prisma.user.findUnique NÃO é chamado quando não há token', async () => {
      const req = makeRequestNoAuth()
      await getAuthUser(req)
      expect(vi.mocked(prisma.user.findUnique)).not.toHaveBeenCalled()
    })
  })

  describe('token via cookie aura_session', () => {
    it('cookie válido com usuário ativo retorna AuthUser', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(DB_USER_ACTIVE as any)
      const token = generateJWT(BASE_USER)
      const req = makeRequestWithCookie(token)
      const user = await getAuthUser(req)
      expect(user).not.toBeNull()
      expect(user?.id).toBe(DB_USER_ACTIVE.id)
      expect(user?.email).toBe(DB_USER_ACTIVE.email)
    })

    it('cookie válido retorna name do banco', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(DB_USER_ACTIVE as any)
      const token = generateJWT(BASE_USER)
      const req = makeRequestWithCookie(token)
      const user = await getAuthUser(req)
      expect(user?.name).toBe(DB_USER_ACTIVE.name)
    })

    it('cookie inválido (token forjado) → null', async () => {
      const forgedToken = makeForgedToken({ userId: 'u1', email: 'x@x.com', role: 'ADMIN', companyId: 'c1' })
      const req = makeRequestWithCookie(forgedToken)
      const user = await getAuthUser(req)
      expect(user).toBeNull()
    })

    it('cookie com token expirado → null', async () => {
      const expiredToken = makeExpiredToken()
      const req = makeRequestWithCookie(expiredToken)
      const user = await getAuthUser(req)
      expect(user).toBeNull()
    })
  })

  describe('token via header Authorization: Bearer', () => {
    it('header válido com usuário ativo retorna AuthUser', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(DB_USER_ACTIVE as any)
      const token = generateJWT(BASE_USER)
      const req = makeRequestWithHeader(token)
      const user = await getAuthUser(req)
      expect(user).not.toBeNull()
      expect(user?.id).toBe(DB_USER_ACTIVE.id)
    })

    it('header Bearer com token expirado → null', async () => {
      const expiredToken = makeExpiredToken()
      const req = makeRequestWithHeader(expiredToken)
      const user = await getAuthUser(req)
      expect(user).toBeNull()
    })
  })

  describe('usuário não encontrado no banco', () => {
    it('JWT válido mas userId não existe no banco → null', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
      const token = generateJWT(BASE_USER)
      const req = makeRequestWithCookie(token)
      const user = await getAuthUser(req)
      expect(user).toBeNull()
    })
  })

  describe('usuário inativo', () => {
    it('usuário com isActive: false → null', async () => {
      const inactiveUser = { ...DB_USER_ACTIVE, isActive: false }
      vi.mocked(prisma.user.findUnique).mockResolvedValue(inactiveUser as any)
      const token = generateJWT(BASE_USER)
      const req = makeRequestWithCookie(token)
      const user = await getAuthUser(req)
      expect(user).toBeNull()
    })

    it('prisma não é chamado mais de 1x quando usuário inativo (sem cache para inativo)', async () => {
      const inactiveUser = { ...DB_USER_ACTIVE, isActive: false }
      vi.mocked(prisma.user.findUnique).mockResolvedValue(inactiveUser as any)
      const token = generateJWT(BASE_USER)
      const req = makeRequestWithCookie(token)
      await getAuthUser(req)
      await getAuthUser(makeRequestWithCookie(token))
      // Usuário inativo não é cacheado — cada chamada vai ao banco
      expect(vi.mocked(prisma.user.findUnique)).toHaveBeenCalledTimes(2)
    })
  })

  // =========================================================================
  // CRITICO — Segurança: role vem do BANCO, não do JWT
  // =========================================================================
  describe('CRITICO: role vem do BANCO, não do JWT', () => {
    it('JWT com role OWNER mas banco retorna PATIENT → AuthUser com role PATIENT', async () => {
      // Atacante poderia tentar criar JWT com role elevado
      // O sistema deve ignorar o role do JWT e usar o do banco
      const dbUserAsPatient = {
        ...DB_USER_ACTIVE,
        role: 'PATIENT', // banco tem PATIENT
      }
      vi.mocked(prisma.user.findUnique).mockResolvedValue(dbUserAsPatient as any)

      // JWT afirma OWNER — isso seria um JWT forjado com role elevado
      const jwtWithOwner = generateJWT({ ...BASE_USER, role: 'OWNER' })
      const req = makeRequestWithCookie(jwtWithOwner)
      const user = await getAuthUser(req)

      // Resultado deve usar role do banco (PATIENT), não do JWT (OWNER)
      expect(user).not.toBeNull()
      expect(user?.role).toBe('PATIENT')
      expect(user?.role).not.toBe('OWNER')
    })

    it('JWT com role ADMIN mas banco retorna RECEPTIONIST → retorna RECEPTIONIST', async () => {
      const dbUserReceptionist = { ...DB_USER_ACTIVE, role: 'RECEPTIONIST' }
      vi.mocked(prisma.user.findUnique).mockResolvedValue(dbUserReceptionist as any)

      const jwtWithAdmin = generateJWT({ ...BASE_USER, role: 'ADMIN' })
      const req = makeRequestWithHeader(jwtWithAdmin)
      const user = await getAuthUser(req)

      expect(user?.role).toBe('RECEPTIONIST')
    })

    it('JWT com role PATIENT mas banco retorna OWNER → retorna OWNER (banco prevalece sempre)', async () => {
      const dbUserOwner = { ...DB_USER_ACTIVE, role: 'OWNER' }
      vi.mocked(prisma.user.findUnique).mockResolvedValue(dbUserOwner as any)

      const jwtWithPatient = generateJWT({ ...BASE_USER, role: 'PATIENT' })
      const req = makeRequestWithCookie(jwtWithPatient)
      const user = await getAuthUser(req)

      expect(user?.role).toBe('OWNER')
    })
  })

  // =========================================================================
  // Cache de 15 segundos
  // =========================================================================
  describe('cache de 15s', () => {
    it('segunda chamada com mesmo token usa cache (findUnique chamado só 1x)', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(DB_USER_ACTIVE as any)
      const token = generateJWT(BASE_USER)

      // Primeira chamada — vai ao banco
      await getAuthUser(makeRequestWithCookie(token))
      // Segunda chamada — deve usar cache
      await getAuthUser(makeRequestWithCookie(token))

      expect(vi.mocked(prisma.user.findUnique)).toHaveBeenCalledTimes(1)
    })

    it('após clearUserCache(token), próxima chamada busca no banco novamente', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(DB_USER_ACTIVE as any)
      const token = generateJWT(BASE_USER)

      // Primeira chamada — popula cache
      await getAuthUser(makeRequestWithCookie(token))
      expect(vi.mocked(prisma.user.findUnique)).toHaveBeenCalledTimes(1)

      // Limpar cache para este token específico
      clearUserCache(token)

      // Segunda chamada — cache foi limpo, deve ir ao banco
      await getAuthUser(makeRequestWithCookie(token))
      expect(vi.mocked(prisma.user.findUnique)).toHaveBeenCalledTimes(2)
    })

    it('após clearUserCache() sem argumento, próxima chamada busca no banco', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(DB_USER_ACTIVE as any)
      const token = generateJWT(BASE_USER)

      // Popula cache
      await getAuthUser(makeRequestWithCookie(token))
      expect(vi.mocked(prisma.user.findUnique)).toHaveBeenCalledTimes(1)

      // Limpar TODO o cache
      clearUserCache()

      // Deve buscar no banco novamente
      await getAuthUser(makeRequestWithCookie(token))
      expect(vi.mocked(prisma.user.findUnique)).toHaveBeenCalledTimes(2)
    })

    it('tokens diferentes não compartilham cache', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(DB_USER_ACTIVE as any)

      const userA = { id: 'user-A', email: 'a@a.com', role: 'ADMIN', companyId: 'c-A' }
      const userB = { id: 'user-B', email: 'b@b.com', role: 'PATIENT', companyId: 'c-B' }
      const tokenA = generateJWT(userA)
      const tokenB = generateJWT(userB)

      await getAuthUser(makeRequestWithCookie(tokenA))
      await getAuthUser(makeRequestWithCookie(tokenB))

      // Cada token faz sua própria chamada ao banco
      expect(vi.mocked(prisma.user.findUnique)).toHaveBeenCalledTimes(2)
    })
  })
})

// ===========================================================================
// clearUserCache
// ===========================================================================
describe('clearUserCache', () => {
  it('clearUserCache(token) remove apenas o token específico do cache', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(DB_USER_ACTIVE as any)

    const tokenA = generateJWT(BASE_USER)
    const userB = { id: 'user-B', email: 'b@b.com', role: 'PATIENT', companyId: 'c-B' }
    const tokenB = generateJWT(userB)

    // Popula cache para ambos
    await getAuthUser(makeRequestWithCookie(tokenA))
    await getAuthUser(makeRequestWithCookie(tokenB))
    expect(vi.mocked(prisma.user.findUnique)).toHaveBeenCalledTimes(2)

    // Remove apenas tokenA do cache
    clearUserCache(tokenA)

    // tokenA vai ao banco de novo; tokenB ainda no cache
    await getAuthUser(makeRequestWithCookie(tokenA))
    await getAuthUser(makeRequestWithCookie(tokenB))
    expect(vi.mocked(prisma.user.findUnique)).toHaveBeenCalledTimes(3) // +1 apenas para tokenA
  })

  it('clearUserCache() sem argumento limpa todos os tokens', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(DB_USER_ACTIVE as any)

    const tokenA = generateJWT(BASE_USER)
    const tokenB = generateJWT({ id: 'u-B', email: 'b@b.com', role: 'PATIENT', companyId: 'c-B' })

    // Popula cache
    await getAuthUser(makeRequestWithCookie(tokenA))
    await getAuthUser(makeRequestWithCookie(tokenB))
    expect(vi.mocked(prisma.user.findUnique)).toHaveBeenCalledTimes(2)

    // Limpa tudo
    clearUserCache()

    // Ambos vão ao banco novamente
    await getAuthUser(makeRequestWithCookie(tokenA))
    await getAuthUser(makeRequestWithCookie(tokenB))
    expect(vi.mocked(prisma.user.findUnique)).toHaveBeenCalledTimes(4)
  })

  it('clearUserCache pode ser chamado sem cache populado sem erro', () => {
    expect(() => clearUserCache()).not.toThrow()
    expect(() => clearUserCache('token-inexistente')).not.toThrow()
  })
})

// ===========================================================================
// isAdmin
// ===========================================================================
describe('isAdmin', () => {
  it('OWNER → true', () => {
    expect(isAdmin(makeAuthUser('OWNER'))).toBe(true)
  })

  it('ADMIN → true', () => {
    expect(isAdmin(makeAuthUser('ADMIN'))).toBe(true)
  })

  it('RECEPTIONIST → false', () => {
    expect(isAdmin(makeAuthUser('RECEPTIONIST'))).toBe(false)
  })

  it('ESTHETICIAN → false', () => {
    expect(isAdmin(makeAuthUser('ESTHETICIAN'))).toBe(false)
  })

  it('PATIENT → false', () => {
    expect(isAdmin(makeAuthUser('PATIENT'))).toBe(false)
  })

  it('role desconhecido → false', () => {
    expect(isAdmin(makeAuthUser('HACKER'))).toBe(false)
  })

  it('role vazio → false', () => {
    expect(isAdmin(makeAuthUser(''))).toBe(false)
  })
})

// ===========================================================================
// requirePermission
// ===========================================================================
describe('requirePermission', () => {
  it('user null → NextResponse 401', () => {
    const result = requirePermission(null, 'patients', 'read')
    expect(result).toBeInstanceOf(NextResponse)
    expect(result?.status).toBe(401)
  })

  it('user null → corpo JSON contém erro de autenticação', async () => {
    const result = requirePermission(null, 'patients', 'read')
    const body = await result?.json()
    expect(body).toHaveProperty('error')
  })

  it('user sem permissão → NextResponse 403', () => {
    // PATIENT não pode "delete" em patients
    const patient = makeAuthUser('PATIENT')
    const result = requirePermission(patient, 'patients', 'delete')
    expect(result).toBeInstanceOf(NextResponse)
    expect(result?.status).toBe(403)
  })

  it('ESTHETICIAN sem acesso a transactions → 403', () => {
    const esthetician = makeAuthUser('ESTHETICIAN')
    const result = requirePermission(esthetician, 'transactions', 'create')
    expect(result).toBeInstanceOf(NextResponse)
    expect(result?.status).toBe(403)
  })

  it('RECEPTIONIST sem permissão de delete em appointments → 403', () => {
    const receptionist = makeAuthUser('RECEPTIONIST')
    const result = requirePermission(receptionist, 'appointments', 'delete')
    expect(result?.status).toBe(403)
  })

  it('user com permissão → null (autorizado, sem resposta de erro)', () => {
    // ADMIN pode "create" em patients
    const admin = makeAuthUser('ADMIN')
    const result = requirePermission(admin, 'patients', 'create')
    expect(result).toBeNull()
  })

  it('OWNER com permissão "manage" → null', () => {
    const owner = makeAuthUser('OWNER')
    const result = requirePermission(owner, 'patients', 'manage')
    expect(result).toBeNull()
  })

  it('RECEPTIONIST com permissão "create" em appointments → null', () => {
    const receptionist = makeAuthUser('RECEPTIONIST')
    const result = requirePermission(receptionist, 'appointments', 'create')
    expect(result).toBeNull()
  })

  it('PATIENT com permissão "read" em patients → null', () => {
    const patient = makeAuthUser('PATIENT')
    const result = requirePermission(patient, 'patients', 'read')
    expect(result).toBeNull()
  })

  it('403 corpo JSON contém mensagem de erro de permissão', async () => {
    const patient = makeAuthUser('PATIENT')
    const result = requirePermission(patient, 'patients', 'delete')
    const body = await result?.json()
    expect(body).toHaveProperty('error')
  })
})
