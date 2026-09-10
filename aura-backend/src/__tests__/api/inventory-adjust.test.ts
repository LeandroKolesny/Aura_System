// aura-backend/src/__tests__/api/inventory-adjust.test.ts
// Testes para POST /api/inventory/[id]/adjust

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    inventoryItem: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    stockMovement: { create: vi.fn() },
    activity: { create: vi.fn() },
    appNotification: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))

import { POST } from '../../app/api/inventory/[id]/adjust/route'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

const ADMIN = { id: 'u1', email: 'admin@clinica.com', role: 'ADMIN', companyId: 'c1' }
const ESTHETICIAN = { id: 'u2', email: 'esth@clinica.com', role: 'ESTHETICIAN', companyId: 'c1' }

const ITEM = { id: 'item1', name: 'Luvas', unit: 'cx', currentStock: 10, minStock: 5, lastRestockDate: null };

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/inventory/item1/adjust', {
    method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' },
  })
}
function makeParams(id = 'item1') {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.$transaction).mockImplementation((cb: unknown) => (cb as (tx: unknown) => Promise<unknown>)(prisma))
  vi.mocked(prisma.inventoryItem.update).mockResolvedValue({ ...ITEM, currentStock: 0 } as never)
  vi.mocked(prisma.inventoryItem.updateMany).mockResolvedValue({ count: 1 } as never)
  vi.mocked(prisma.stockMovement.create).mockResolvedValue({ id: 'mov1' } as never)
})

describe('POST /api/inventory/[id]/adjust', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await POST(makeRequest({ quantity: 5, type: 'IN', reason: 'Reposição' }), makeParams())
    expect(res.status).toBe(401)
  })

  it('retorna 403 quando o solicitante não é ADMIN nem OWNER', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ESTHETICIAN as never)
    const res = await POST(makeRequest({ quantity: 5, type: 'IN', reason: 'Reposição' }), makeParams())
    expect(res.status).toBe(403)
  })

  it('retorna 404 quando o item não existe', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.inventoryItem.findFirst).mockResolvedValue(null)
    const res = await POST(makeRequest({ quantity: 5, type: 'IN', reason: 'Reposição' }), makeParams())
    expect(res.status).toBe(404)
  })

  it('retorna 400 para dados inválidos (quantidade zero)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.inventoryItem.findFirst).mockResolvedValue(ITEM as never)
    const res = await POST(makeRequest({ quantity: 0, type: 'IN', reason: 'Reposição' }), makeParams())
    expect(res.status).toBe(400)
  })

  it('soma a entrada (IN) com increment atômico (não grava valor absoluto)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.inventoryItem.findFirst).mockResolvedValue(ITEM as never)

    await POST(makeRequest({ quantity: 5, type: 'IN', reason: 'Reposição' }), makeParams())

    expect(prisma.inventoryItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { currentStock: { increment: 5 } } })
    )
    // nunca grava o valor absoluto lido fora da transação
    expect(prisma.inventoryItem.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ currentStock: 15 }) })
    )
  })

  it('subtrai a saída (OUT) com updateMany CONDICIONAL + decrement atômico', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.inventoryItem.findFirst).mockResolvedValue(ITEM as never)

    await POST(makeRequest({ quantity: 3, type: 'OUT', reason: 'Uso em procedimento' }), makeParams())

    expect(prisma.inventoryItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'item1', currentStock: { gte: 3 } }),
        data: { currentStock: { decrement: 3 } },
      })
    )
  })

  it('retorna 400 quando o ajuste deixaria o estoque negativo', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.inventoryItem.findFirst).mockResolvedValue(ITEM as never)

    const res = await POST(makeRequest({ quantity: 999, type: 'OUT', reason: 'Uso excessivo' }), makeParams())
    expect(res.status).toBe(400)
    expect(prisma.inventoryItem.update).not.toHaveBeenCalled()
  })

  it('permite ADJUSTMENT negativo dentro do limite do estoque (decrement condicional)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.inventoryItem.findFirst).mockResolvedValue(ITEM as never)

    await POST(makeRequest({ quantity: -4, type: 'ADJUSTMENT', reason: 'Correção de inventário' }), makeParams())

    expect(prisma.inventoryItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'item1', currentStock: { gte: 4 } }),
        data: { currentStock: { decrement: 4 } },
      })
    )
  })

  it('registra o movimento de estoque com a quantidade em valor absoluto', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.inventoryItem.findFirst).mockResolvedValue(ITEM as never)

    await POST(makeRequest({ quantity: 3, type: 'LOSS', reason: 'Produto vencido' }), makeParams())

    expect(prisma.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ quantity: 3, type: 'LOSS' }) })
    )
  })

  it('registra atividade de auditoria com estoque anterior e novo', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.inventoryItem.findFirst).mockResolvedValue(ITEM as never)

    await POST(makeRequest({ quantity: 5, type: 'IN', reason: 'Reposição' }), makeParams())

    expect(prisma.activity.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'STOCK_ADJUSTED', metadata: expect.objectContaining({ previousStock: 10, newStock: 15 }) }) })
    )
  })

  it('cria notificação de estoque baixo quando o novo estoque fica no ou abaixo do mínimo', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.inventoryItem.findFirst).mockResolvedValue(ITEM as never)

    await POST(makeRequest({ quantity: 8, type: 'OUT', reason: 'Uso' }), makeParams())

    expect(prisma.appNotification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'WARNING', companyId: 'c1' }) })
    )
  })

  it('não cria notificação quando o estoque continua acima do mínimo', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.inventoryItem.findFirst).mockResolvedValue(ITEM as never)

    await POST(makeRequest({ quantity: 2, type: 'IN', reason: 'Reposição' }), makeParams())

    expect(prisma.appNotification.create).not.toHaveBeenCalled()
  })
})

describe('POST /api/inventory/[id]/adjust — concorrência / race condition', () => {
  beforeEach(() => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.inventoryItem.findFirst).mockResolvedValue(ITEM as never)
  })

  it('a saída usa updateMany CONDICIONAL (where currentStock >= |delta|) + decrement — nunca grava valor absoluto', async () => {
    await POST(makeRequest({ quantity: 4, type: 'OUT', reason: 'Uso' }), makeParams())

    const call = vi.mocked(prisma.inventoryItem.updateMany).mock.calls[0][0] as {
      where: Record<string, unknown>
      data: Record<string, unknown>
    }
    expect(call.where).toMatchObject({ id: 'item1', currentStock: { gte: 4 } })
    expect(call.data).toEqual({ currentStock: { decrement: 4 } })
    // sem escrita de valor absoluto de currentStock via update()
    for (const [arg] of vi.mocked(prisma.inventoryItem.update).mock.calls) {
      const data = (arg as { data?: Record<string, unknown> }).data ?? {}
      expect(typeof data.currentStock).not.toBe('number')
    }
  })

  it('quando um ajuste concorrente já baixou o estoque (updateMany afeta 0 linhas) → 400 e nenhum movimento é criado', async () => {
    // segundo request concorrente: o guard condicional não encontra saldo suficiente
    vi.mocked(prisma.inventoryItem.updateMany).mockResolvedValue({ count: 0 } as never)

    const res = await POST(makeRequest({ quantity: 8, type: 'OUT', reason: 'Uso concorrente' }), makeParams())
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('Estoque insuficiente')
    // nada foi registrado — o ajuste perdido NÃO é aplicado silenciosamente
    expect(prisma.stockMovement.create).not.toHaveBeenCalled()
    expect(prisma.activity.create).not.toHaveBeenCalled()
  })

  it('duas saídas concorrentes lendo o mesmo currentStock inicial: a segunda decrementa de forma atômica (não recalcula a partir da leitura obsoleta)', async () => {
    // Ambas as chamadas leem ITEM.currentStock = 10 (mesmo estado inicial).
    await POST(makeRequest({ quantity: 3, type: 'OUT', reason: 'Saída A' }), makeParams())
    await POST(makeRequest({ quantity: 3, type: 'OUT', reason: 'Saída B' }), makeParams())

    // As duas chamadas passam por decrement atômico via updateMany — o valor final
    // no banco é (10 - 3 - 3), não (10 - 3) sobrescrito duas vezes (lost update).
    const calls = vi.mocked(prisma.inventoryItem.updateMany).mock.calls
    expect(calls).toHaveLength(2)
    for (const [arg] of calls) {
      expect((arg as { data: Record<string, unknown> }).data).toEqual({ currentStock: { decrement: 3 } })
    }
  })
})
