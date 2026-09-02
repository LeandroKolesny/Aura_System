// aura-backend/src/__tests__/api/inventory.test.ts
// Testes para GET/POST /api/inventory

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    inventoryItem: { findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
    stockMovement: { create: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))

import { GET, POST } from '../../app/api/inventory/route'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

const ADMIN = { id: 'u1', email: 'admin@clinica.com', role: 'ADMIN', companyId: 'c1' }
const ESTHETICIAN = { id: 'u2', email: 'esth@clinica.com', role: 'ESTHETICIAN', companyId: 'c1' }

const VALID_ITEM = { name: 'Luvas', unit: 'cx', currentStock: 10, costPerUnit: 25 }

function makeGetRequest(qs = '') {
  return new NextRequest(`http://localhost/api/inventory${qs}`)
}
function makePostRequest(body: unknown) {
  return new NextRequest('http://localhost/api/inventory', {
    method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.inventoryItem.findMany).mockResolvedValue([])
  vi.mocked(prisma.inventoryItem.count).mockResolvedValue(0)
})

describe('GET /api/inventory', () => {
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

  it('retorna 400 para parâmetros inválidos', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    const res = await GET(makeGetRequest('?limit=999'))
    expect(res.status).toBe(400)
  })

  it('filtra itens de estoque baixo em memória (lowStock=true)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.inventoryItem.findMany).mockResolvedValueOnce([
      { id: 'i1', currentStock: 2, minStock: 5, costPerUnit: 10, name: 'Baixo' },
      { id: 'i2', currentStock: 20, minStock: 5, costPerUnit: 10, name: 'Alto' },
    ] as never).mockResolvedValueOnce([])

    const res = await GET(makeGetRequest('?lowStock=true'))
    const body = await res.json()

    expect(body.items).toHaveLength(1)
    expect(body.items[0].id).toBe('i1')
  })

  it('calcula resumo (totalItems, lowStockCount, totalValue) sobre todos os itens ativos', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.inventoryItem.findMany)
      .mockResolvedValueOnce([{ id: 'i1', currentStock: 10, minStock: 5, costPerUnit: 2, name: 'Item' }] as never)
      .mockResolvedValueOnce([
        { id: 'i1', currentStock: 2, minStock: 5, costPerUnit: 10 },
        { id: 'i2', currentStock: 20, minStock: 5, costPerUnit: 3 },
      ] as never)

    const res = await GET(makeGetRequest())
    const body = await res.json()

    expect(body.summary).toEqual({ totalItems: 2, lowStockCount: 1, totalValue: 2 * 10 + 20 * 3 })
  })
})

describe('POST /api/inventory', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await POST(makePostRequest(VALID_ITEM))
    expect(res.status).toBe(401)
  })

  it('retorna 403 quando o solicitante não é ADMIN nem OWNER', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ESTHETICIAN as never)
    const res = await POST(makePostRequest(VALID_ITEM))
    expect(res.status).toBe(403)
  })

  it('retorna 400 para dados inválidos (estoque negativo)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    const res = await POST(makePostRequest({ ...VALID_ITEM, currentStock: -5 }))
    expect(res.status).toBe(400)
  })

  it('cria o item e registra movimento de entrada inicial quando currentStock > 0', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.inventoryItem.create).mockResolvedValue({ id: 'item1', ...VALID_ITEM } as never)

    const res = await POST(makePostRequest(VALID_ITEM))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.item.id).toBe('item1')
    expect(prisma.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ inventoryItemId: 'item1', type: 'IN', quantity: 10 }) })
    )
  })

  it('não registra movimento inicial quando currentStock é zero', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.inventoryItem.create).mockResolvedValue({ id: 'item1' } as never)

    await POST(makePostRequest({ ...VALID_ITEM, currentStock: 0 }))

    expect(prisma.stockMovement.create).not.toHaveBeenCalled()
  })
})
