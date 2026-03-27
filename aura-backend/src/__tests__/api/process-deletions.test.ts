import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    deletionRequest: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    user: { update: vi.fn() },
  },
}))

import { GET } from '../../app/api/cron/process-deletions/route'
import prisma from '@/lib/prisma'

function makeReq(token = 'test-secret') {
  return new NextRequest('http://localhost/api/cron/process-deletions', {
    headers: { authorization: `Bearer ${token}` },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = 'test-secret'
})

describe('GET /api/cron/process-deletions', () => {
  it('retorna 401 sem Authorization header', async () => {
    const res = await GET(new NextRequest('http://localhost/api/cron/process-deletions'))
    expect(res.status).toBe(401)
  })

  it('retorna 401 com token errado', async () => {
    const res = await GET(makeReq('wrong-secret'))
    expect(res.status).toBe(401)
  })

  it('retorna 401 quando CRON_SECRET não está definido', async () => {
    delete process.env.CRON_SECRET
    const res = await GET(makeReq('any-token'))
    expect(res.status).toBe(401)
  })

  it('retorna processed=0 quando não há pedidos vencidos', async () => {
    vi.mocked(prisma.deletionRequest.findMany).mockResolvedValue([])
    const res = await GET(makeReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.processed).toBe(0)
    expect(body.total).toBe(0)
  })

  it('anonimiza usuário e atualiza status para PROCESSED', async () => {
    vi.mocked(prisma.deletionRequest.findMany).mockResolvedValue([
      { id: 'dr1', userId: 'u1' } as never,
    ])
    vi.mocked(prisma.user.update).mockResolvedValue({} as never)
    vi.mocked(prisma.deletionRequest.update).mockResolvedValue({} as never)

    const res = await GET(makeReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.processed).toBe(1)

    const userUpdateCall = vi.mocked(prisma.user.update).mock.calls[0][0]
    expect(userUpdateCall.where.id).toBe('u1')
    expect(userUpdateCall.data.isActive).toBe(false)
    expect(userUpdateCall.data.email).toMatch(/^deleted_/)

    const drUpdateCall = vi.mocked(prisma.deletionRequest.update).mock.calls[0][0]
    expect(drUpdateCall.data.status).toBe('PROCESSED')
    expect(drUpdateCall.data.processedAt).toBeInstanceOf(Date)
  })
})
