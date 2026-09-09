// aura-backend/src/__tests__/api/inventory-id.test.ts
// Testes para PUT/DELETE /api/inventory/[id]
//
// Regressão: editar/remover um item de estoque nunca funcionou de verdade —
// o frontend chamava funções que só mexiam no estado local (comentário no
// código: "API de update/delete não existe ainda"). Esta rota é a correção.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    inventoryItem: { findFirst: vi.fn(), update: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))

import { PUT, DELETE } from '../../app/api/inventory/[id]/route'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

const ADMIN = { id: 'admin-1', email: 'admin@clinica.com', role: 'ADMIN', companyId: 'c1' }
const RECEPTIONIST = { id: 'r1', email: 'recep@clinica.com', role: 'RECEPTIONIST', companyId: 'c1' }
const EXISTING_ITEM = { id: 'i1', companyId: 'c1', name: 'Botox 100U' }

function makePutRequest(body: unknown) {
  return new NextRequest('http://localhost/api/inventory/i1', {
    method: 'PUT', body: JSON.stringify(body), headers: { 'content-type': 'application/json' },
  })
}
function makeDeleteRequest() {
  return new NextRequest('http://localhost/api/inventory/i1', { method: 'DELETE' })
}
function makeParams(id = 'i1') {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PUT /api/inventory/[id]', () => {
  it('retorna 401 sem autenticação', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await PUT(makePutRequest({ currentStock: 10 }), makeParams())
    expect(res.status).toBe(401)
  })

  it('SECURITY: bloqueia quem não é ADMIN/OWNER (ex: RECEPTIONIST)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(RECEPTIONIST as never)
    const res = await PUT(makePutRequest({ currentStock: 10 }), makeParams())
    expect(res.status).toBe(403)
    expect(prisma.inventoryItem.update).not.toHaveBeenCalled()
  })

  it('retorna 404 quando o item não existe (ou é de outra empresa)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.inventoryItem.findFirst).mockResolvedValue(null)
    const res = await PUT(makePutRequest({ currentStock: 10 }), makeParams())
    expect(res.status).toBe(404)
  })

  it('retorna 400 com dados inválidos (ex: estoque negativo)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.inventoryItem.findFirst).mockResolvedValue(EXISTING_ITEM as never)
    const res = await PUT(makePutRequest({ currentStock: -5 }), makeParams())
    expect(res.status).toBe(400)
  })

  it('atualiza o item de estoque com sucesso', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.inventoryItem.findFirst).mockResolvedValue(EXISTING_ITEM as never)
    vi.mocked(prisma.inventoryItem.update).mockResolvedValue({ ...EXISTING_ITEM, currentStock: 25 } as never)

    const res = await PUT(makePutRequest({ currentStock: 25 }), makeParams())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.item.currentStock).toBe(25)
    expect(prisma.inventoryItem.update).toHaveBeenCalledWith({ where: { id: 'i1' }, data: { currentStock: 25 } })
  })

  it('retorna 500 e mensagem genérica quando o banco falha inesperadamente', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.inventoryItem.findFirst).mockResolvedValue(EXISTING_ITEM as never)
    vi.mocked(prisma.inventoryItem.update).mockRejectedValue(new Error('conexão perdida'))

    const res = await PUT(makePutRequest({ currentStock: 5 }), makeParams())
    const body = await res.json()
    expect(res.status).toBe(500)
    expect(body.error).toBe('Erro inesperado.')
  })
})

describe('DELETE /api/inventory/[id]', () => {
  it('retorna 401 sem autenticação', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await DELETE(makeDeleteRequest(), makeParams())
    expect(res.status).toBe(401)
  })

  it('SECURITY: bloqueia quem não é ADMIN/OWNER', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(RECEPTIONIST as never)
    const res = await DELETE(makeDeleteRequest(), makeParams())
    expect(res.status).toBe(403)
  })

  it('retorna 404 quando o item não existe (ou é de outra empresa)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.inventoryItem.findFirst).mockResolvedValue(null)
    const res = await DELETE(makeDeleteRequest(), makeParams())
    expect(res.status).toBe(404)
  })

  it('desativa o item (soft delete, isActive:false) em vez de apagar de verdade', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.inventoryItem.findFirst).mockResolvedValue(EXISTING_ITEM as never)
    vi.mocked(prisma.inventoryItem.update).mockResolvedValue({ ...EXISTING_ITEM, isActive: false } as never)

    const res = await DELETE(makeDeleteRequest(), makeParams())
    expect(res.status).toBe(200)
    expect(prisma.inventoryItem.update).toHaveBeenCalledWith({ where: { id: 'i1' }, data: { isActive: false } })
  })
})
