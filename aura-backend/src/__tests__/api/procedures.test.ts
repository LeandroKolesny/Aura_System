// aura-backend/src/__tests__/api/procedures.test.ts
// Testes para GET/POST /api/procedures

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    procedure: { findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
    inventoryItem: { findMany: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))

import { GET, POST } from '../../app/api/procedures/route'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

const ADMIN = { id: 'u1', email: 'admin@clinica.com', role: 'ADMIN', companyId: 'c1' }
const ESTHETICIAN = { id: 'u2', email: 'esth@clinica.com', role: 'ESTHETICIAN', companyId: 'c1' }

const VALID_PROCEDURE = { name: 'Limpeza de Pele', price: 150, durationMinutes: 60 }

function makeGetRequest(qs = '') {
  return new NextRequest(`http://localhost/api/procedures${qs}`)
}
function makePostRequest(body: unknown) {
  return new NextRequest('http://localhost/api/procedures', {
    method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.procedure.findMany).mockResolvedValue([])
  vi.mocked(prisma.procedure.count).mockResolvedValue(0)
})

describe('GET /api/procedures', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(401)
  })

  it('retorna 403 quando o usuário não tem empresa', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ ...ADMIN, companyId: null } as never)
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(403)
  })

  it('retorna 400 para parâmetros de paginação inválidos', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    const res = await GET(makeGetRequest('?limit=999'))
    expect(res.status).toBe(400)
  })

  it('filtra por isActive=true por padrão', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    await GET(makeGetRequest())

    expect(prisma.procedure.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isActive: true, companyId: 'c1' }) })
    )
  })

  it('não filtra por isActive quando isActive=all', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    await GET(makeGetRequest('?isActive=all'))

    expect(prisma.procedure.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.not.objectContaining({ isActive: expect.anything() }) })
    )
  })

  it('busca por nome ou descrição quando search é informado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    await GET(makeGetRequest('?search=limpeza'))

    expect(prisma.procedure.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ OR: expect.any(Array) }) })
    )
  })

  it('retorna paginação calculada corretamente', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.procedure.count).mockResolvedValue(45)

    const res = await GET(makeGetRequest('?page=2&limit=20'))
    const body = await res.json()

    expect(body.pagination).toEqual({ page: 2, limit: 20, total: 45, totalPages: 3 })
  })
})

describe('POST /api/procedures', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await POST(makePostRequest(VALID_PROCEDURE))
    expect(res.status).toBe(401)
  })

  it('retorna 403 quando o solicitante não é ADMIN nem OWNER', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ESTHETICIAN as never)
    const res = await POST(makePostRequest(VALID_PROCEDURE))
    expect(res.status).toBe(403)
  })

  it('retorna 400 para dados inválidos (preço negativo)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    const res = await POST(makePostRequest({ ...VALID_PROCEDURE, price: -10 }))
    expect(res.status).toBe(400)
  })

  it('retorna 400 quando algum item de estoque informado não existe', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.inventoryItem.findMany).mockResolvedValue([])

    const res = await POST(makePostRequest({ ...VALID_PROCEDURE, supplies: [{ inventoryItemId: 'inv1', quantityUsed: 2 }] }))
    expect(res.status).toBe(400)
  })

  it('cria o procedimento sem insumos usando o custo informado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.procedure.create).mockResolvedValue({ id: 'proc1', ...VALID_PROCEDURE } as never)

    const res = await POST(makePostRequest({ ...VALID_PROCEDURE, cost: 30 }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(prisma.procedure.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ cost: 30, companyId: 'c1' }) })
    )
    expect(body.procedure.id).toBe('proc1')
  })

  it('calcula o custo a partir dos insumos e usa o maior valor entre calculado e informado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.inventoryItem.findMany).mockResolvedValue([
      { id: 'inv1', costPerUnit: 10 },
    ] as never)
    vi.mocked(prisma.procedure.create).mockResolvedValue({ id: 'proc1' } as never)

    await POST(makePostRequest({ ...VALID_PROCEDURE, cost: 5, supplies: [{ inventoryItemId: 'inv1', quantityUsed: 3 }] }))

    expect(prisma.procedure.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ cost: 30 }) })
    )
  })

  it('CARACTERIZAÇÃO: dois procedimentos com o MESMO name na mesma companyId são ambos aceitos (duplicata não é bloqueada)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.procedure.create)
      .mockResolvedValueOnce({ id: 'proc1', ...VALID_PROCEDURE } as never)
      .mockResolvedValueOnce({ id: 'proc2', ...VALID_PROCEDURE } as never)

    const res1 = await POST(makePostRequest(VALID_PROCEDURE))
    const res2 = await POST(makePostRequest(VALID_PROCEDURE))

    expect(res1.status).toBe(201)
    expect(res2.status).toBe(201)
    // A rota não faz nenhuma checagem de unicidade de nome — cria os dois.
    expect(prisma.procedure.create).toHaveBeenCalledTimes(2)
  })

  it('CARACTERIZAÇÃO (Bug 3 / Opção B): supply manual (sem inventoryItemId) é rejeitado com 400 pelo schema', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)

    const res = await POST(makePostRequest({
      ...VALID_PROCEDURE,
      supplies: [{ name: 'Luva descartável', quantityUsed: 1, cost: 2 }],
    }))

    expect(res.status).toBe(400)
    expect(prisma.procedure.create).not.toHaveBeenCalled()
  })
})
