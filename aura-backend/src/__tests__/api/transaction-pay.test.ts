import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    transaction: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))
vi.mock('@/lib/apiGuards', () => ({ checkWriteAccess: vi.fn().mockResolvedValue(null) }))

import { PATCH } from '../../app/api/transactions/[id]/pay/route'
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

const mockUser = { id: 'u1', companyId: 'c1', role: 'ADMIN' }

function makeReq() {
  return new NextRequest('http://localhost/api/transactions/tx1/pay', {
    method: 'PATCH',
    headers: { authorization: 'Bearer token' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAuthUser).mockResolvedValue(mockUser as never)
})

describe('PATCH /api/transactions/[id]/pay', () => {
  it('retorna 401 sem autenticação', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null as never)
    const res = await PATCH(makeReq(), { params: Promise.resolve({ id: 'tx1' }) })
    expect(res.status).toBe(401)
  })

  it('retorna 404 quando transação não existe', async () => {
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null)
    const res = await PATCH(makeReq(), { params: Promise.resolve({ id: 'tx1' }) })
    expect(res.status).toBe(404)
  })

  it('retorna 400 quando transação já está paga', async () => {
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue({
      id: 'tx1', status: 'PAID', companyId: 'c1',
    } as never)
    const res = await PATCH(makeReq(), { params: Promise.resolve({ id: 'tx1' }) })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/já.*paga/i)
  })

  it('marca transação PENDING como PAID e retorna 200', async () => {
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue({
      id: 'tx1', status: 'PENDING', companyId: 'c1',
    } as never)
    vi.mocked(prisma.transaction.update).mockResolvedValue({
      id: 'tx1', status: 'PAID',
    } as never)
    const res = await PATCH(makeReq(), { params: Promise.resolve({ id: 'tx1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(vi.mocked(prisma.transaction.update).mock.calls[0][0].data.status).toBe('PAID')
  })

  it('não permite marcar transação de outra empresa', async () => {
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null)
    const res = await PATCH(makeReq(), { params: Promise.resolve({ id: 'tx1' }) })
    expect(res.status).toBe(404)
  })
})
