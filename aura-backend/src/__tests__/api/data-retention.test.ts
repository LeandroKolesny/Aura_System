import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    company: { findMany: vi.fn(), update: vi.fn() },
    user: { updateMany: vi.fn() },
    patient: { updateMany: vi.fn() },
  },
}))

import { GET } from '../../app/api/cron/data-retention/route'
import prisma from '@/lib/prisma'

function makeReq(token = 'test-secret') {
  return new NextRequest('http://localhost/api/cron/data-retention', {
    headers: { authorization: `Bearer ${token}` },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = 'test-secret'
})

describe('GET /api/cron/data-retention', () => {
  it('retorna 401 sem Authorization header', async () => {
    const res = await GET(new NextRequest('http://localhost/api/cron/data-retention'))
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

  it('retorna processed=0 quando não há empresas elegíveis', async () => {
    vi.mocked(prisma.company.findMany).mockResolvedValue([])
    const res = await GET(makeReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.processed).toBe(0)
    expect(body.total).toBe(0)
  })

  it('processa empresas canceladas há mais de 90 dias', async () => {
    vi.mocked(prisma.company.findMany).mockResolvedValue([
      { id: 'c1', name: 'Clínica X' } as never,
    ])
    vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 2 } as never)
    vi.mocked(prisma.patient.updateMany).mockResolvedValue({ count: 5 } as never)
    vi.mocked(prisma.company.update).mockResolvedValue({} as never)

    const res = await GET(makeReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.processed).toBe(1)
    expect(body.total).toBe(1)
  })

  it('verifica que patient.updateMany é chamado com dados de anonimização corretos', async () => {
    vi.mocked(prisma.company.findMany).mockResolvedValue([
      { id: 'c1', name: 'Clínica X' } as never,
    ])
    vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 1 } as never)
    vi.mocked(prisma.patient.updateMany).mockResolvedValue({ count: 3 } as never)
    vi.mocked(prisma.company.update).mockResolvedValue({} as never)

    await GET(makeReq())

    const patientCall = vi.mocked(prisma.patient.updateMany).mock.calls[0][0]
    expect(patientCall.where.companyId).toBe('c1')
    expect(patientCall.data.name).toBe('Paciente Removido')
    expect(patientCall.data.cpf).toBeNull()
    expect(patientCall.data.birthDate).toBeNull()
  })
})
