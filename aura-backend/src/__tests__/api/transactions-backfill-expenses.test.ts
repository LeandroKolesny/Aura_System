// aura-backend/src/__tests__/api/transactions-backfill-expenses.test.ts
// Testes para GET/POST /api/transactions/backfill-expenses

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    appointment: { findMany: vi.fn() },
    transaction: { findFirst: vi.fn(), create: vi.fn(), delete: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))

import { GET, POST } from '../../app/api/transactions/backfill-expenses/route'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

const ADMIN = { id: 'u1', email: 'admin@clinica.com', role: 'ADMIN', companyId: 'c1' }
const ESTHETICIAN = { id: 'u2', email: 'esth@clinica.com', role: 'ESTHETICIAN', companyId: 'c1' }

const APPOINTMENT_WITH_SUPPLIES = {
  id: 'appt1', date: new Date('2026-01-10'),
  patient: { name: 'Paciente Teste' },
  procedure: {
    name: 'Limpeza de Pele',
    supplies: [{ quantityUsed: 2, inventoryItem: { name: 'Luvas', costPerUnit: 5 } }],
  },
};

function makePostRequest(body?: unknown) {
  return new NextRequest('http://localhost/api/transactions/backfill-expenses', {
    method: 'POST', body: JSON.stringify(body ?? {}), headers: { 'content-type': 'application/json' },
  })
}
function makeGetRequest() {
  return new NextRequest('http://localhost/api/transactions/backfill-expenses')
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/transactions/backfill-expenses', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await POST(makePostRequest())
    expect(res.status).toBe(401)
  })

  it('retorna 403 quando o solicitante não é ADMIN nem OWNER', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ESTHETICIAN as never)
    const res = await POST(makePostRequest())
    expect(res.status).toBe(403)
  })

  it('ignora agendamentos cujo procedimento não tem insumos cadastrados', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      { id: 'appt1', patient: { name: 'P' }, procedure: { name: 'Proc', supplies: [] } },
    ] as never)

    const res = await POST(makePostRequest())
    const body = await res.json()

    expect(body.results.skipped).toBe(1)
    expect(body.results.created).toBe(0)
  })

  it('cria a despesa de insumos quando não existe transação prévia', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([APPOINTMENT_WITH_SUPPLIES] as never)
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.transaction.create).mockResolvedValue({ id: 'exp1' } as never)

    const res = await POST(makePostRequest())
    const body = await res.json()

    expect(body.results.created).toBe(1)
    expect(prisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amount: 10, type: 'EXPENSE', category: 'Insumos' }) })
    )
  })

  it('corrige a despesa existente quando o valor está incorreto', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([APPOINTMENT_WITH_SUPPLIES] as never)
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue({ id: 'exp-old', amount: 999, description: 'Custo Insumos: Limpeza de Pele - Paciente Teste' } as never)
    vi.mocked(prisma.transaction.create).mockResolvedValue({ id: 'exp-new' } as never)

    const res = await POST(makePostRequest())
    const body = await res.json()

    expect(prisma.transaction.delete).toHaveBeenCalledWith({ where: { id: 'exp-old' } })
    expect(body.results.updated).toBe(1)
  })

  it('não altera a despesa quando já está correta e forceRecreate não foi solicitado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([APPOINTMENT_WITH_SUPPLIES] as never)
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue({ id: 'exp-ok', amount: 10, description: 'Custo Insumos: Limpeza de Pele - Paciente Teste' } as never)

    const res = await POST(makePostRequest())
    const body = await res.json()

    expect(prisma.transaction.delete).not.toHaveBeenCalled()
    expect(body.results.skipped).toBe(1)
  })

  it('força a recriação mesmo quando o valor já está correto se forceRecreate=true', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([APPOINTMENT_WITH_SUPPLIES] as never)
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue({ id: 'exp-ok', amount: 10, description: 'Custo Insumos: Limpeza de Pele - Paciente Teste' } as never)
    vi.mocked(prisma.transaction.create).mockResolvedValue({ id: 'exp-new' } as never)

    await POST(makePostRequest({ forceRecreate: true }))

    expect(prisma.transaction.delete).toHaveBeenCalledWith({ where: { id: 'exp-ok' } })
  })
})

describe('GET /api/transactions/backfill-expenses', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(401)
  })

  it('reporta problema "missing" quando não há despesa para insumos existentes', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([{
      id: 'appt1', date: new Date(), price: 150,
      patient: { name: 'Paciente Teste' },
      procedure: { name: 'Limpeza', supplies: [{ quantityUsed: 2, inventoryItemId: 'inv1', inventoryItem: { name: 'Luvas', costPerUnit: 5 } }] },
    }] as never)
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null)

    const res = await GET(makeGetRequest())
    const body = await res.json()

    expect(body.missingExpenses).toBe(1)
    expect(body.appointments[0].problem).toBe('missing')
  })

  it('não reporta problema quando a despesa já está correta', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([{
      id: 'appt1', date: new Date(), price: 150,
      patient: { name: 'Paciente Teste' },
      procedure: { name: 'Limpeza', supplies: [{ quantityUsed: 2, inventoryItemId: 'inv1', inventoryItem: { name: 'Luvas', costPerUnit: 5 } }] },
    }] as never)
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue({ amount: 10, description: 'x Paciente Teste' } as never)

    const res = await GET(makeGetRequest())
    const body = await res.json()

    expect(body.missingExpenses).toBe(0)
  })
})
