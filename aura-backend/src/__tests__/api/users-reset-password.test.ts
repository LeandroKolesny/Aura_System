// aura-backend/src/__tests__/api/users-reset-password.test.ts
// Testes para POST /api/users/[id]/reset-password

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: { user: { findUnique: vi.fn(), update: vi.fn() } },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))
vi.mock('bcryptjs', () => ({ default: { hash: vi.fn().mockResolvedValue('hashed-password') } }))

import { POST } from '../../app/api/users/[id]/reset-password/route'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

const ADMIN = { id: 'u1', email: 'admin@clinica.com', role: 'ADMIN', companyId: 'c1' }
const OWNER = { id: 'u2', email: 'owner@saas.com', role: 'OWNER', companyId: null }
const RECEPTIONIST = { id: 'u3', email: 'recep@clinica.com', role: 'RECEPTIONIST', companyId: 'c1' }

function makeRequest(newPassword?: string) {
  return new NextRequest('http://localhost/api/users/target-u/reset-password', {
    method: 'POST', body: JSON.stringify({ newPassword }), headers: { 'content-type': 'application/json' },
  })
}
function makeParams() {
  return { params: Promise.resolve({ id: 'target-u' }) }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/users/[id]/reset-password', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await POST(makeRequest('senha12345'), makeParams())
    expect(res.status).toBe(401)
  })

  it('retorna 403 quando o solicitante não é ADMIN nem OWNER', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(RECEPTIONIST as never)
    const res = await POST(makeRequest('senha12345'), makeParams())
    expect(res.status).toBe(403)
  })

  it('retorna 400 quando a nova senha tem menos de 8 caracteres', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    const res = await POST(makeRequest('curta'), makeParams())
    expect(res.status).toBe(400)
  })

  it('retorna 404 quando o usuário alvo não existe', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    const res = await POST(makeRequest('senha12345'), makeParams())
    expect(res.status).toBe(404)
  })

  it('retorna 403 quando ADMIN tenta redefinir senha de usuário de outra empresa', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'target-u', companyId: 'outra-empresa' } as never)
    const res = await POST(makeRequest('senha12345'), makeParams())
    expect(res.status).toBe(403)
  })

  it('permite que OWNER redefina senha de usuário de qualquer empresa', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(OWNER as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'target-u', companyId: 'qualquer-empresa' } as never)
    const res = await POST(makeRequest('senha12345'), makeParams())
    expect(res.status).toBe(200)
  })

  it('atualiza a senha com hash e incrementa tokenVersion para invalidar sessões antigas', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'target-u', companyId: 'c1' } as never)

    const res = await POST(makeRequest('senha12345'), makeParams())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'target-u' },
        data: expect.objectContaining({ password: 'hashed-password', tokenVersion: { increment: 1 } }),
      })
    )
  })
})
