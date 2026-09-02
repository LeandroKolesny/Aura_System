// aura-backend/src/__tests__/api/companies.test.ts
// Testes para GET /api/companies

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: { company: { findUnique: vi.fn(), findMany: vi.fn() } },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))

import { GET } from '../../app/api/companies/route'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

const ADMIN = { id: 'u1', email: 'admin@clinica.com', role: 'ADMIN', companyId: 'c1' }
const OWNER = { id: 'u2', email: 'owner@saas.com', role: 'OWNER', companyId: null }

function makeRequest(qs = '') {
  return new NextRequest(`http://localhost/api/companies${qs}`)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/companies', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('não-OWNER recebe apenas a própria empresa, em formato de lista', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.company.findUnique).mockResolvedValue({ id: 'c1', name: 'Clínica Teste', paymentMethods: [] } as never)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(prisma.company.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'c1' } }))
    expect(body.companies).toEqual([expect.objectContaining({ id: 'c1' })])
  })

  it('retorna lista vazia se a empresa do usuário não for encontrada', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.company.findUnique).mockResolvedValue(null)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.companies).toEqual([])
  })

  it('normaliza e deduplica paymentMethods convertendo labels para IDs', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.company.findUnique).mockResolvedValue({
      id: 'c1', paymentMethods: ['Pix', 'PIX', 'Cartão de Crédito', 'money'],
    } as never)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.companies[0].paymentMethods).toEqual(['pix', 'credit_card', 'money'])
  })

  it('OWNER recebe todas as empresas com contagem de usuários e pacientes', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(OWNER as never)
    vi.mocked(prisma.company.findMany).mockResolvedValue([
      { id: 'c1', name: 'Clínica A', _count: { users: 3, patients: 10 } },
      { id: 'c2', name: 'Clínica B', _count: { users: 1, patients: 0 } },
    ] as never)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(prisma.company.findMany).toHaveBeenCalled()
    expect(prisma.company.findUnique).not.toHaveBeenCalled()
    expect(body.companies).toHaveLength(2)
  })

  it('OWNER respeita o parâmetro limit', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(OWNER as never)
    vi.mocked(prisma.company.findMany).mockResolvedValue([])

    await GET(makeRequest('?limit=5'))

    expect(prisma.company.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }))
  })

  it('retorna 500 em caso de erro inesperado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.company.findUnique).mockRejectedValue(new Error('db down'))
    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
  })
})
