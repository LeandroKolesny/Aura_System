// aura-backend/src/__tests__/api/transactions-diagnose.test.ts
// Testes para GET/DELETE /api/transactions/diagnose

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    appointment: { findMany: vi.fn() },
    transaction: { findMany: vi.fn(), deleteMany: vi.fn(), create: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))

import { GET, DELETE } from '../../app/api/transactions/diagnose/route'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

const ADMIN = { id: 'u1', email: 'admin@clinica.com', role: 'ADMIN', companyId: 'c1' }
const ESTHETICIAN = { id: 'u2', email: 'esth@clinica.com', role: 'ESTHETICIAN', companyId: 'c1' }

function makeRequest() {
  return new NextRequest('http://localhost/api/transactions/diagnose')
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/transactions/diagnose', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('retorna 403 quando o usuário não tem empresa', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ ...ADMIN, companyId: null } as never)
    const res = await GET(makeRequest())
    expect(res.status).toBe(403)
  })

  it('monta o diagnóstico com custo de insumos e transações vinculadas', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([{
      id: 'appt1', date: new Date(), price: 150,
      patient: { name: 'Paciente Teste' },
      procedure: { name: 'Limpeza', cost: 8, supplies: [{ inventoryItemId: 'inv1', quantityUsed: 2, inventoryItem: { name: 'Luvas', costPerUnit: 5 } }] },
    }] as never)
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      { id: 'inc1', type: 'INCOME', description: 'Receita', amount: 150 },
      { id: 'exp1', type: 'EXPENSE', description: 'Custo Insumos Paciente Teste', amount: 10 },
    ] as never)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.diagnostics[0].supplies.calculatedCost).toBe(10)
    expect(body.diagnostics[0].transactions.income.amount).toBe(150)
    expect(body.diagnostics[0].transactions.expense.isAmountCorrect).toBe(true)
    expect(body.diagnostics[0].analysis.needsFix).toBe(false)
  })

  it('marca needsFix=true quando a despesa não bate com o custo calculado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([{
      id: 'appt1', date: new Date(), price: 150,
      patient: { name: 'Paciente Teste' },
      procedure: { name: 'Limpeza', cost: 8, supplies: [{ inventoryItemId: 'inv1', quantityUsed: 2, inventoryItem: { name: 'Luvas', costPerUnit: 5 } }] },
    }] as never)
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      { id: 'exp1', type: 'EXPENSE', description: 'Custo Insumos Paciente Teste', amount: 999 },
    ] as never)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.diagnostics[0].analysis.needsFix).toBe(true)
  })
})

describe('DELETE /api/transactions/diagnose', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await DELETE(makeRequest())
    expect(res.status).toBe(401)
  })

  it('retorna 403 quando o solicitante não é ADMIN nem OWNER', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ESTHETICIAN as never)
    const res = await DELETE(makeRequest())
    expect(res.status).toBe(403)
  })

  it('apaga todas as despesas de insumos e recria a partir dos agendamentos pagos', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.transaction.deleteMany).mockResolvedValue({ count: 5 } as never)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([{
      id: 'appt1', date: new Date(),
      patient: { name: 'Paciente Teste' },
      procedure: { name: 'Limpeza', supplies: [{ quantityUsed: 2, inventoryItem: { costPerUnit: 5 } }] },
    }] as never)
    vi.mocked(prisma.transaction.create).mockResolvedValue({ id: 'exp-new' } as never)

    const res = await DELETE(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.deleted).toBe(5)
    expect(body.created).toBe(1)
  })

  it('pula agendamentos sem custo de insumos ao recriar', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.transaction.deleteMany).mockResolvedValue({ count: 0 } as never)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([{
      id: 'appt1', date: new Date(), patient: { name: 'P' }, procedure: { name: 'Proc', supplies: [] },
    }] as never)

    const res = await DELETE(makeRequest())
    const body = await res.json()

    expect(body.created).toBe(0)
    expect(prisma.transaction.create).not.toHaveBeenCalled()
  })
})
