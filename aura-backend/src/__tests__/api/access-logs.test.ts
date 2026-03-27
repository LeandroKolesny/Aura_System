import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    activity: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))

import { GET } from '../../app/api/king/access-logs/route'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

const OWNER = { id: 'u1', role: 'OWNER', companyId: null, email: 'king@aura.system', name: 'King' }
const ADMIN = { id: 'u2', role: 'ADMIN', companyId: 'c1', email: 'a@b.com', name: 'Admin' }

function makeReq() {
  return new NextRequest('http://localhost/api/king/access-logs')
}

beforeEach(() => vi.clearAllMocks())

describe('GET /api/king/access-logs', () => {
  it('retorna 401 sem autenticação', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await GET(makeReq())
    expect(res.status).toBe(401)
  })

  it('retorna 403 para não-OWNER', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    const res = await GET(makeReq())
    expect(res.status).toBe(403)
  })

  it('retorna logs de USER_LOGIN para OWNER', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(OWNER as never)
    vi.mocked(prisma.activity.findMany).mockResolvedValue([
      { id: '1', type: 'USER_LOGIN', title: 'Login: a@b.com', ipAddress: '1.2.3.4', userAgent: 'Chrome', createdAt: new Date(), metadata: { email: 'a@b.com' }, userId: 'u2', description: null } as never,
    ])
    const res = await GET(makeReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].ipAddress).toBe('1.2.3.4')
  })
})
