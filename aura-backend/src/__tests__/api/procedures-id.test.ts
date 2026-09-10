// aura-backend/src/__tests__/api/procedures-id.test.ts
// Testes para GET/PUT/DELETE /api/procedures/[id]

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    procedure: { findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() },
    inventoryItem: { findMany: vi.fn() },
    procedureSupply: { deleteMany: vi.fn() },
    appointment: { count: vi.fn() },
    subscriptionPlanItem: { count: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))

import { GET, PUT, DELETE } from '../../app/api/procedures/[id]/route'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

const ADMIN = { id: 'u1', email: 'admin@clinica.com', role: 'ADMIN', companyId: 'c1' }
const ESTHETICIAN = { id: 'u2', email: 'esth@clinica.com', role: 'ESTHETICIAN', companyId: 'c1' }

function makeRequest(method: string, body?: unknown) {
  return new NextRequest('http://localhost/api/procedures/proc1', {
    method, ...(body !== undefined ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } } : {}),
  })
}
function makeParams(id = 'proc1') {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.appointment.count).mockResolvedValue(0)
  vi.mocked(prisma.subscriptionPlanItem.count).mockResolvedValue(0)
})

describe('GET /api/procedures/[id]', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await GET(makeRequest('GET'), makeParams())
    expect(res.status).toBe(401)
  })

  it('retorna 404 quando o procedimento não existe ou é de outra empresa', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.procedure.findFirst).mockResolvedValue(null)
    const res = await GET(makeRequest('GET'), makeParams())
    expect(res.status).toBe(404)
  })

  it('retorna o procedimento com os insumos', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.procedure.findFirst).mockResolvedValue({ id: 'proc1', name: 'Limpeza' } as never)
    const res = await GET(makeRequest('GET'), makeParams())
    const body = await res.json()
    expect(body.procedure.id).toBe('proc1')
  })
})

describe('PUT /api/procedures/[id]', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await PUT(makeRequest('PUT', { name: 'Novo Nome' }), makeParams())
    expect(res.status).toBe(401)
  })

  it('retorna 403 quando o solicitante não é ADMIN nem OWNER', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ESTHETICIAN as never)
    const res = await PUT(makeRequest('PUT', { name: 'Novo Nome' }), makeParams())
    expect(res.status).toBe(403)
  })

  it('retorna 400 para dados inválidos', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    const res = await PUT(makeRequest('PUT', { price: -5 }), makeParams())
    expect(res.status).toBe(400)
  })

  it('retorna 404 quando o procedimento não existe', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.procedure.findFirst).mockResolvedValue(null)
    const res = await PUT(makeRequest('PUT', { name: 'Novo Nome' }), makeParams())
    expect(res.status).toBe(404)
  })

  it('atualiza campos simples sem alterar o custo quando supplies não é enviado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.procedure.findFirst).mockResolvedValue({ id: 'proc1' } as never)
    vi.mocked(prisma.procedure.update).mockResolvedValue({ id: 'proc1', name: 'Nome Atualizado' } as never)

    const res = await PUT(makeRequest('PUT', { name: 'Nome Atualizado' }), makeParams())
    expect(res.status).toBe(200)
    expect(prisma.procedureSupply.deleteMany).not.toHaveBeenCalled()
  })

  it('supplies: [] explícito remove todos os insumos e recalcula cost para 0', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.procedure.findFirst).mockResolvedValue({ id: 'proc1' } as never)
    vi.mocked(prisma.procedure.update).mockResolvedValue({ id: 'proc1' } as never)

    const res = await PUT(makeRequest('PUT', { supplies: [] }), makeParams())

    expect(res.status).toBe(200)
    expect(prisma.procedureSupply.deleteMany).toHaveBeenCalledWith({ where: { procedureId: 'proc1' } })
    expect(prisma.procedure.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ cost: 0 }) })
    )
  })

  it('supplies: [] mas com cost enviado maior mantém o cost enviado (Math.max)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.procedure.findFirst).mockResolvedValue({ id: 'proc1' } as never)
    vi.mocked(prisma.procedure.update).mockResolvedValue({ id: 'proc1' } as never)

    await PUT(makeRequest('PUT', { supplies: [], cost: 45 }), makeParams())

    expect(prisma.procedureSupply.deleteMany).toHaveBeenCalledWith({ where: { procedureId: 'proc1' } })
    expect(prisma.procedure.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ cost: 45 }) })
    )
  })

  it('substitui os insumos e recalcula o custo quando supplies é enviado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.procedure.findFirst).mockResolvedValue({ id: 'proc1' } as never)
    vi.mocked(prisma.inventoryItem.findMany).mockResolvedValue([{ id: 'inv1', costPerUnit: 20 }] as never)
    vi.mocked(prisma.procedure.update).mockResolvedValue({ id: 'proc1' } as never)

    await PUT(makeRequest('PUT', { supplies: [{ inventoryItemId: 'inv1', quantityUsed: 2 }] }), makeParams())

    expect(prisma.procedureSupply.deleteMany).toHaveBeenCalledWith({ where: { procedureId: 'proc1' } })
    expect(prisma.procedure.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ cost: 40 }) })
    )
  })
})

describe('DELETE /api/procedures/[id]', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await DELETE(makeRequest('DELETE'), makeParams())
    expect(res.status).toBe(401)
  })

  it('retorna 403 quando o solicitante não é ADMIN nem OWNER', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ESTHETICIAN as never)
    const res = await DELETE(makeRequest('DELETE'), makeParams())
    expect(res.status).toBe(403)
  })

  it('retorna 404 quando o procedimento não existe', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.procedure.findFirst).mockResolvedValue(null)
    const res = await DELETE(makeRequest('DELETE'), makeParams())
    expect(res.status).toBe(404)
  })

  it('retorna 409 quando há agendamentos vinculados (proteção de FK)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.procedure.findFirst).mockResolvedValue({ id: 'proc1' } as never)
    vi.mocked(prisma.appointment.count).mockResolvedValue(3)

    const res = await DELETE(makeRequest('DELETE'), makeParams())
    expect(res.status).toBe(409)
    expect(prisma.procedure.delete).not.toHaveBeenCalled()
  })

  it('retorna 409 quando o procedimento está vinculado a um plano de assinatura', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.procedure.findFirst).mockResolvedValue({ id: 'proc1' } as never)
    vi.mocked(prisma.subscriptionPlanItem.count).mockResolvedValue(1)

    const res = await DELETE(makeRequest('DELETE'), makeParams())
    expect(res.status).toBe(409)
    expect(prisma.procedure.delete).not.toHaveBeenCalled()
  })

  it('remove o procedimento quando não há vínculos', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.procedure.findFirst).mockResolvedValue({ id: 'proc1' } as never)

    const res = await DELETE(makeRequest('DELETE'), makeParams())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(prisma.procedure.delete).toHaveBeenCalledWith({ where: { id: 'proc1' } })
  })
})
