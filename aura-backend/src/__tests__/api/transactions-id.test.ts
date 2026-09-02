// aura-backend/src/__tests__/api/transactions-id.test.ts
// Testes para PUT/DELETE /api/transactions/[id]

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: { transaction: { findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() } },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))

import { PUT, DELETE } from '../../app/api/transactions/[id]/route'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

const ADMIN = { id: 'u1', email: 'admin@clinica.com', role: 'ADMIN', companyId: 'c1' }
const ESTHETICIAN = { id: 'u2', email: 'esth@clinica.com', role: 'ESTHETICIAN', companyId: 'c1' }

function makeRequest(method: string, body?: unknown) {
  return new NextRequest('http://localhost/api/transactions/t1', {
    method, ...(body !== undefined ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } } : {}),
  })
}
function makeParams(id = 't1') {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PUT /api/transactions/[id]', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await PUT(makeRequest('PUT', { description: 'Nova desc' }), makeParams())
    expect(res.status).toBe(401)
  })

  it('retorna 403 quando o solicitante não é ADMIN nem OWNER', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ESTHETICIAN as never)
    const res = await PUT(makeRequest('PUT', { description: 'Nova desc' }), makeParams())
    expect(res.status).toBe(403)
  })

  it('retorna 404 quando a transação não existe', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null)
    const res = await PUT(makeRequest('PUT', { description: 'Nova desc' }), makeParams())
    expect(res.status).toBe(404)
  })

  it('retorna 409 quando a transação está vinculada a um agendamento', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue({ id: 't1', appointmentId: 'appt1' } as never)

    const res = await PUT(makeRequest('PUT', { description: 'Nova desc' }), makeParams())
    expect(res.status).toBe(409)
    expect(prisma.transaction.update).not.toHaveBeenCalled()
  })

  it('retorna 400 para dados inválidos', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue({ id: 't1', appointmentId: null } as never)

    const res = await PUT(makeRequest('PUT', { amount: -10 }), makeParams())
    expect(res.status).toBe(400)
  })

  it('atualiza a transação manual e normaliza a data para meio-dia UTC', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue({ id: 't1', appointmentId: null } as never)
    vi.mocked(prisma.transaction.update).mockResolvedValue({ id: 't1', description: 'Atualizada' } as never)

    const res = await PUT(makeRequest('PUT', { description: 'Atualizada', date: '2026-01-15' }), makeParams())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.transaction.description).toBe('Atualizada')
    expect(prisma.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ date: new Date('2026-01-15T12:00:00.000Z') }) })
    )
  })
})

describe('DELETE /api/transactions/[id]', () => {
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

  it('retorna 404 quando a transação não existe', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null)
    const res = await DELETE(makeRequest('DELETE'), makeParams())
    expect(res.status).toBe(404)
  })

  it('retorna 409 quando a transação está vinculada a um agendamento', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue({ id: 't1', appointmentId: 'appt1' } as never)

    const res = await DELETE(makeRequest('DELETE'), makeParams())
    expect(res.status).toBe(409)
    expect(prisma.transaction.delete).not.toHaveBeenCalled()
  })

  it('exclui a transação manual', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue({ id: 't1', appointmentId: null } as never)

    const res = await DELETE(makeRequest('DELETE'), makeParams())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(prisma.transaction.delete).toHaveBeenCalledWith({ where: { id: 't1' } })
  })
})
