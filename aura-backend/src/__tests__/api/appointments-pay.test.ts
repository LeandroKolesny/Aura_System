// src/__tests__/api/appointments-pay.test.ts
// Testes para POST /api/appointments/[id]/pay

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { Appointment, Activity } from '@prisma/client'

vi.mock('@/lib/prisma', () => ({
  default: {
    appointment: { findFirst: vi.fn(), update: vi.fn() },
    patient: { update: vi.fn() },
    transaction: { create: vi.fn() },
    procedureSupply: { findMany: vi.fn() },
    inventoryItem: { update: vi.fn() },
    stockMovement: { create: vi.fn() },
    activity: { create: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
}))

import { POST } from '../../app/api/appointments/[id]/pay/route'
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

// ── fixtures ──────────────────────────────────────────────────────────────────

const COMPANY_ID = 'company-001'
const APPOINTMENT_ID = 'appointment-001'
const PATIENT_ID = 'patient-001'
const PROCEDURE_ID = 'procedure-001'

const MOCK_ADMIN_USER = {
  id: 'user-001',
  role: 'ADMIN',
  companyId: COMPANY_ID,
}

const MOCK_APPOINTMENT = {
  id: APPOINTMENT_ID,
  status: 'CONFIRMED',
  paid: false,
  stockDeducted: false,
  patientId: PATIENT_ID,
  procedureId: PROCEDURE_ID,
  professionalId: 'prof-001',
  price: 150,
  patient: { id: PATIENT_ID, name: 'Maria Silva' },
  professional: { id: 'prof-001', name: 'Profissional' },
  procedure: {
    id: PROCEDURE_ID,
    name: 'Limpeza',
    cost: 20,
    supplies: [], // sem insumos por padrão
  },
} as unknown as Appointment

const MOCK_UPDATED_APPOINTMENT = {
  id: APPOINTMENT_ID,
  status: 'COMPLETED',
  paid: true,
  stockDeducted: true,
  patient: { id: PATIENT_ID, name: 'Maria Silva' },
  professional: { id: 'prof-001', name: 'Profissional' },
  procedure: { id: PROCEDURE_ID, name: 'Limpeza', price: 150, cost: 20 },
} as unknown as Appointment

const MOCK_INCOME_TRANSACTION = {
  id: 'tx-income-001',
  type: 'INCOME',
  amount: 150,
} as never

const MOCK_EXPENSE_TRANSACTION = {
  id: 'tx-expense-001',
  type: 'EXPENSE',
  amount: 20,
} as never

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest(`http://localhost/api/appointments/${APPOINTMENT_ID}/pay`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

const ROUTE_PARAMS = { params: Promise.resolve({ id: APPOINTMENT_ID }) }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAuthUser).mockResolvedValue(MOCK_ADMIN_USER as never)
  vi.mocked(prisma.appointment.findFirst).mockResolvedValue(MOCK_APPOINTMENT)
  vi.mocked(prisma.appointment.update).mockResolvedValue(MOCK_UPDATED_APPOINTMENT)
  vi.mocked(prisma.patient.update).mockResolvedValue({} as never)
  vi.mocked(prisma.transaction.create).mockResolvedValue(MOCK_INCOME_TRANSACTION)
  vi.mocked(prisma.procedureSupply.findMany).mockResolvedValue([])
  vi.mocked(prisma.inventoryItem.update).mockResolvedValue({} as never)
  vi.mocked(prisma.stockMovement.create).mockResolvedValue({} as never)
  vi.mocked(prisma.activity.create).mockResolvedValue({} as Activity)
})

// ── testes ────────────────────────────────────────────────────────────────────

describe('POST /api/appointments/[id]/pay', () => {

  it('processa pagamento com sucesso, retorna 200 com appointment e transactions', async () => {
    const res = await POST(makeRequest({ paymentMethod: 'PIX' }), ROUTE_PARAMS)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.appointment).toBeDefined()
    expect(body.transactions.income).toBeDefined()
    expect(body.summary.revenue).toBe(150)
  })

  it('cria transação de RECEITA do tipo INCOME', async () => {
    await POST(makeRequest({ paymentMethod: 'PIX' }), ROUTE_PARAMS)
    expect(prisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'INCOME', category: 'Procedimentos' }),
      })
    )
  })

  it('cria transação de DESPESA para custo de insumos do procedimento', async () => {
    // Simula agendamento com custo de insumos
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({
      ...MOCK_APPOINTMENT,
      procedure: {
        id: PROCEDURE_ID,
        name: 'Limpeza',
        cost: 30,
        supplies: [],
      },
    } as never)
    vi.mocked(prisma.transaction.create)
      .mockResolvedValueOnce(MOCK_INCOME_TRANSACTION) // INCOME
      .mockResolvedValueOnce(MOCK_EXPENSE_TRANSACTION) // EXPENSE
    await POST(makeRequest({ paymentMethod: 'CARTAO' }), ROUTE_PARAMS)
    const calls = vi.mocked(prisma.transaction.create).mock.calls
    const expenseCall = calls.find(c => (c[0].data as { type: string }).type === 'EXPENSE')
    expect(expenseCall).toBeDefined()
    expect((expenseCall![0].data as { category: string }).category).toBe('Insumos')
  })

  it('não cria DESPESA quando custo do procedimento é zero', async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({
      ...MOCK_APPOINTMENT,
      procedure: { id: PROCEDURE_ID, name: 'Limpeza', cost: 0, supplies: [] },
    } as never)
    await POST(makeRequest({ paymentMethod: 'PIX' }), ROUTE_PARAMS)
    const calls = vi.mocked(prisma.transaction.create).mock.calls
    const expenseCall = calls.find(c => (c[0].data as { type: string }).type === 'EXPENSE')
    expect(expenseCall).toBeUndefined()
  })

  it('suporte a parcelas: cria N transações de INCOME', async () => {
    await POST(makeRequest({ paymentMethod: 'CARTAO', installments: 3 }), ROUTE_PARAMS)
    const calls = vi.mocked(prisma.transaction.create).mock.calls
    const incomeCalls = calls.filter(c => (c[0].data as { type: string }).type === 'INCOME')
    expect(incomeCalls).toHaveLength(3)
    // Valor dividido em 3 parcelas de 50 cada
    expect((incomeCalls[0][0].data as { amount: number }).amount).toBe(50)
  })

  it('parcelas: primeira parcela PAID, demais PENDING', async () => {
    await POST(makeRequest({ paymentMethod: 'CARTAO', installments: 2 }), ROUTE_PARAMS)
    const calls = vi.mocked(prisma.transaction.create).mock.calls
    const incomeCalls = calls.filter(c => (c[0].data as { type: string }).type === 'INCOME')
    expect((incomeCalls[0][0].data as { status: string }).status).toBe('PAID')
    expect((incomeCalls[1][0].data as { status: string }).status).toBe('PENDING')
  })

  it('marca agendamento como paid=true e status=COMPLETED', async () => {
    await POST(makeRequest({ paymentMethod: 'DINHEIRO' }), ROUTE_PARAMS)
    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paid: true, status: 'COMPLETED', stockDeducted: true }),
      })
    )
  })

  it('deduz estoque dos insumos via procedureSupply', async () => {
    vi.mocked(prisma.procedureSupply.findMany).mockResolvedValue([
      { inventoryItemId: 'item-001', quantityUsed: 3 },
    ] as never)
    await POST(makeRequest({ paymentMethod: 'PIX' }), ROUTE_PARAMS)
    expect(prisma.inventoryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ currentStock: { decrement: 3 } }) })
    )
    expect(prisma.stockMovement.create).toHaveBeenCalled()
  })

  it('atualiza lastVisit do paciente', async () => {
    await POST(makeRequest({ paymentMethod: 'PIX' }), ROUTE_PARAMS)
    expect(prisma.patient.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ lastVisit: expect.any(Date) }) })
    )
  })

  it('registra log de atividade PAYMENT_RECEIVED', async () => {
    await POST(makeRequest({ paymentMethod: 'PIX' }), ROUTE_PARAMS)
    expect(prisma.activity.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'PAYMENT_RECEIVED' }) })
    )
  })

  it('retorna summary com revenue, cost e profit corretos', async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({
      ...MOCK_APPOINTMENT,
      price: 150,
      procedure: { id: PROCEDURE_ID, name: 'Limpeza', cost: 30, supplies: [] },
    } as never)
    const res = await POST(makeRequest({ paymentMethod: 'PIX' }), ROUTE_PARAMS)
    const body = await res.json()
    expect(body.summary.revenue).toBe(150)
    expect(body.summary.cost).toBe(30)
    expect(body.summary.profit).toBe(120)
  })

  it('retorna 400 quando agendamento já está pago', async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({
      ...MOCK_APPOINTMENT,
      paid: true,
    } as never)
    const res = await POST(makeRequest({ paymentMethod: 'PIX' }), ROUTE_PARAMS)
    expect(res.status).toBe(400)
    expect(prisma.transaction.create).not.toHaveBeenCalled()
  })

  it('retorna 404 quando agendamento não encontrado', async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null)
    const res = await POST(makeRequest({ paymentMethod: 'PIX' }), ROUTE_PARAMS)
    expect(res.status).toBe(404)
  })

  it('retorna 401 sem autenticação', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null as never)
    const res = await POST(makeRequest({ paymentMethod: 'PIX' }), ROUTE_PARAMS)
    expect(res.status).toBe(401)
  })

  it('retorna 403 para role ESTHETICIAN (não tem permissão de pagamento)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ ...MOCK_ADMIN_USER, role: 'ESTHETICIAN' } as never)
    const res = await POST(makeRequest({ paymentMethod: 'PIX' }), ROUTE_PARAMS)
    expect(res.status).toBe(403)
    expect(prisma.transaction.create).not.toHaveBeenCalled()
  })

  it('retorna 403 sem empresa associada', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ ...MOCK_ADMIN_USER, companyId: null } as never)
    const res = await POST(makeRequest({ paymentMethod: 'PIX' }), ROUTE_PARAMS)
    expect(res.status).toBe(403)
  })

  it('limita parcelas ao máximo de 12', async () => {
    await POST(makeRequest({ paymentMethod: 'CARTAO', installments: 99 }), ROUTE_PARAMS)
    const calls = vi.mocked(prisma.transaction.create).mock.calls
    const incomeCalls = calls.filter(c => (c[0].data as { type: string }).type === 'INCOME')
    expect(incomeCalls).toHaveLength(12)
  })

  it('rejeita pagamento de agendamento CANCELED com 409 (não conclui nem deduz estoque)', async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({
      ...MOCK_APPOINTMENT,
      status: 'CANCELED',
    } as never)
    const res = await POST(makeRequest({ paymentMethod: 'PIX' }), ROUTE_PARAMS)
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/cancelad/i)
    expect(prisma.appointment.update).not.toHaveBeenCalled()
    expect(prisma.transaction.create).not.toHaveBeenCalled()
    expect(prisma.inventoryItem.update).not.toHaveBeenCalled()
    expect(prisma.stockMovement.create).not.toHaveBeenCalled()
  })

  it('não deduz estoque de novo quando stockDeducted=true (já concluído via PATCH /status)', async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({
      ...MOCK_APPOINTMENT,
      stockDeducted: true,
      procedure: { id: PROCEDURE_ID, name: 'Limpeza', cost: 20, supplies: [] },
    } as never)
    vi.mocked(prisma.procedureSupply.findMany).mockResolvedValue([
      { inventoryItemId: 'item-001', quantityUsed: 3 },
    ] as never)
    const res = await POST(makeRequest({ paymentMethod: 'PIX' }), ROUTE_PARAMS)
    expect(res.status).toBe(200)
    const calls = vi.mocked(prisma.transaction.create).mock.calls
    // O pagamento (RECEITA) continua sendo registrado normalmente...
    expect(calls.some(c => (c[0].data as { type: string }).type === 'INCOME')).toBe(true)
    // ...mas estoque e DESPESA de insumos NÃO são lançados uma segunda vez.
    expect(prisma.inventoryItem.update).not.toHaveBeenCalled()
    expect(prisma.stockMovement.create).not.toHaveBeenCalled()
    expect(calls.some(c => (c[0].data as { type: string }).type === 'EXPENSE')).toBe(false)
  })
})
