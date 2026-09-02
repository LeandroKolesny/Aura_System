// aura-backend/src/__tests__/api/inventory-import.test.ts
// Testes para POST /api/inventory/import

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    inventoryItem: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))
vi.mock('@/lib/apiGuards', () => ({ checkWriteAccess: vi.fn().mockResolvedValue(null) }))

import { POST } from '../../app/api/inventory/import/route'
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

const MOCK_USER = { id: 'u1', role: 'ADMIN', companyId: 'c1' }

function makeCSV(content: string) {
  const file = new File([new Blob([content], { type: 'text/csv' })], 'inventory.csv', { type: 'text/csv' })
  const formData = new FormData()
  formData.append('file', file)
  return new NextRequest('http://localhost/api/inventory/import', { method: 'POST', body: formData })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAuthUser).mockResolvedValue(MOCK_USER as never)
  vi.mocked(prisma.inventoryItem.findFirst).mockResolvedValue(null)
  vi.mocked(prisma.inventoryItem.create).mockResolvedValue({ id: 'item1' } as never)
  vi.mocked(prisma.inventoryItem.update).mockResolvedValue({ id: 'item1' } as never)
})

describe('POST /api/inventory/import', () => {
  it('retorna 401 sem autenticação', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null as never)
    const res = await POST(makeCSV('nome,unidade,custo\nLuvas,cx,25'))
    expect(res.status).toBe(401)
  })

  it('retorna 403 para role RECEPTIONIST (apenas ADMIN e OWNER)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ ...MOCK_USER, role: 'RECEPTIONIST' } as never)
    const res = await POST(makeCSV('nome,unidade,custo\nLuvas,cx,25'))
    expect(res.status).toBe(403)
    expect(prisma.inventoryItem.create).not.toHaveBeenCalled()
  })

  it('importa itens com sucesso e retorna resumo', async () => {
    const csv = 'nome,unidade,custo,estoque\nLuvas,cx,25,10\nAlgodão,pct,5,50'
    const res = await POST(makeCSV(csv))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.imported).toBe(2)
    expect(body.updated).toBe(0)
    expect(body.errors).toHaveLength(0)
  })

  it('atualiza item existente com o mesmo nome', async () => {
    vi.mocked(prisma.inventoryItem.findFirst).mockResolvedValue({ id: 'item-existente' } as never)
    const csv = 'nome,unidade,custo\nLuvas,cx,30'
    const res = await POST(makeCSV(csv))
    const body = await res.json()

    expect(body.updated).toBe(1)
    expect(body.imported).toBe(0)
    expect(prisma.inventoryItem.create).not.toHaveBeenCalled()
    expect(prisma.inventoryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ costPerUnit: 30 }) })
    )
  })

  it('registra erro quando nome está ausente', async () => {
    const csv = 'nome,unidade,custo\n,cx,25'
    const res = await POST(makeCSV(csv))
    const body = await res.json()
    expect(body.errors).toHaveLength(1)
    expect(body.errors[0].reason).toContain('Nome')
  })

  it('registra erro quando unidade está ausente', async () => {
    const csv = 'nome,unidade,custo\nLuvas,,25'
    const res = await POST(makeCSV(csv))
    const body = await res.json()
    expect(body.errors).toHaveLength(1)
    expect(body.errors[0].reason).toContain('Unidade')
  })

  it('registra erro quando custo é inválido', async () => {
    const csv = 'nome,unidade,custo\nLuvas,cx,abc'
    const res = await POST(makeCSV(csv))
    const body = await res.json()
    expect(body.errors).toHaveLength(1)
    expect(body.errors[0].reason).toContain('Custo')
  })

  it('aceita custo no formato brasileiro com vírgula', async () => {
    const csv = 'nome,unidade,custo\nLuvas,cx,"25,50"'
    const res = await POST(makeCSV(csv))
    const body = await res.json()

    expect(body.imported).toBe(1)
    const call = vi.mocked(prisma.inventoryItem.create).mock.calls[0][0] as unknown as { data: { costPerUnit: number } }
    expect(call.data.costPerUnit).toBe(25.5)
  })

  it('usa estoque 0 e estoque mínimo 5 como padrão quando ausentes', async () => {
    const csv = 'nome,unidade,custo\nLuvas,cx,25'
    await POST(makeCSV(csv))
    const call = vi.mocked(prisma.inventoryItem.create).mock.calls[0][0] as unknown as { data: { currentStock: number; minStock: number } }
    expect(call.data.currentStock).toBe(0)
    expect(call.data.minStock).toBe(5)
  })

  it('retorna 400 quando coluna obrigatória "custo" está ausente', async () => {
    const csv = 'nome,unidade\nLuvas,cx'
    const res = await POST(makeCSV(csv))
    expect(res.status).toBe(400)
    expect(prisma.inventoryItem.create).not.toHaveBeenCalled()
  })

  it('retorna 400 para CSV vazio', async () => {
    const res = await POST(makeCSV('nome,unidade,custo'))
    expect(res.status).toBe(400)
  })

  it('mistura válidos e inválidos: importa válidos e registra erros nos inválidos', async () => {
    const csv = 'nome,unidade,custo\nLuvas,cx,25\n,pct,10\nAlgodão,pct,5'
    const res = await POST(makeCSV(csv))
    const body = await res.json()

    expect(body.imported).toBe(2)
    expect(body.errors).toHaveLength(1)
  })
})
