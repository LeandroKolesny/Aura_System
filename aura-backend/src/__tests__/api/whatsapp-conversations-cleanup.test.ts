import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    whatsAppConversation: { updateMany: vi.fn() },
  },
}))

import { GET } from '../../app/api/cron/whatsapp-conversations-cleanup/route'
import prisma from '@/lib/prisma'

function makeReq(token = 'test-secret') {
  return new NextRequest('http://localhost/api/cron/whatsapp-conversations-cleanup', {
    headers: { authorization: `Bearer ${token}` },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = 'test-secret'
  vi.mocked(prisma.whatsAppConversation.updateMany).mockResolvedValue({ count: 0 })
})

describe('GET /api/cron/whatsapp-conversations-cleanup', () => {
  it('retorna 401 sem Authorization header', async () => {
    const res = await GET(new NextRequest('http://localhost/api/cron/whatsapp-conversations-cleanup'))
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

  it('reseta apenas conversas paradas há mais de 30min, em estados intermediários (não HUMANO/CONCLUIDO)', async () => {
    vi.mocked(prisma.whatsAppConversation.updateMany).mockResolvedValue({ count: 3 })
    const res = await GET(makeReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.reset).toBe(3)

    expect(prisma.whatsAppConversation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          state: { notIn: ['HUMANO', 'CONCLUIDO', 'START'] },
          updatedAt: { lt: expect.any(Date) },
        }),
        data: { state: 'START', context: {} },
      })
    )
  })
})
