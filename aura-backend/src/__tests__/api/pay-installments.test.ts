import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    appointment: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    transaction: { create: vi.fn() },
    procedureSupply: { findMany: vi.fn() },
    inventoryItem: { update: vi.fn() },
    stockMovement: { create: vi.fn() },
    patient: { update: vi.fn() },
    activity: { create: vi.fn() },
  },
}))

vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))

import { POST } from '../../app/api/appointments/[id]/pay/route'
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

type TxData = {
  type?: string
  status?: string
  installments?: number
  installmentIndex?: number
  amount?: number
  installmentGroupId?: string
  dueDate?: Date
}
type TxCall = [{ data: TxData }]

const mockUser = { id: 'u1', companyId: 'c1', role: 'ADMIN' }
const mockAppointment = {
  id: 'appt1',
  paid: false,
  price: 300,
  patientId: 'p1',
  professionalId: 'prof1',
  procedureId: 'proc1',
  patient: { id: 'p1', name: 'João' },
  professional: { id: 'prof1', name: 'Dr. Ana' },
  procedure: { id: 'proc1', name: 'Limpeza', cost: 0, supplies: [] },
}

function makeReq(body: object) {
  return new NextRequest('http://localhost/api/appointments/appt1/pay', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', authorization: 'Bearer token' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAuthUser).mockResolvedValue(mockUser as never)
  vi.mocked(prisma.appointment.findFirst).mockResolvedValue(mockAppointment as never)
  vi.mocked(prisma.appointment.update).mockResolvedValue({ ...mockAppointment, paid: true } as never)
  vi.mocked(prisma.procedureSupply.findMany).mockResolvedValue([])
  vi.mocked(prisma.patient.update).mockResolvedValue({} as never)
  vi.mocked(prisma.activity.create).mockResolvedValue({} as never)
  vi.mocked(prisma.transaction.create).mockResolvedValue({ id: 'tx1' } as never)
})

describe('POST /api/appointments/[id]/pay — installments', () => {
  it('creates 1 PAID transaction when installments=1 (default)', async () => {
    const res = await POST(makeReq({ paymentMethod: 'pix', installments: 1 }), {
      params: Promise.resolve({ id: 'appt1' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    const incomeCalls = (vi.mocked(prisma.transaction.create).mock.calls as unknown as TxCall[])
      .filter(([data]) => data.data?.type === 'INCOME')
    expect(incomeCalls).toHaveLength(1)
    expect(incomeCalls[0][0].data.status).toBe('PAID')
    expect(incomeCalls[0][0].data.installments).toBe(1)
    expect(incomeCalls[0][0].data.installmentIndex).toBe(1)
  })

  it('creates 3 transactions for installments=3: 1 PAID + 2 PENDING', async () => {
    const res = await POST(makeReq({ paymentMethod: 'credit_card', installments: 3 }), {
      params: Promise.resolve({ id: 'appt1' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.transactions.installments).toHaveLength(3)
    const incomeCalls = (vi.mocked(prisma.transaction.create).mock.calls as unknown as TxCall[])
      .filter(([data]) => data.data?.type === 'INCOME')
    expect(incomeCalls).toHaveLength(3)
    expect(incomeCalls[0][0].data.status).toBe('PAID')
    expect(incomeCalls[0][0].data.installmentIndex).toBe(1)
    expect(incomeCalls[1][0].data.status).toBe('PENDING')
    expect(incomeCalls[1][0].data.installmentIndex).toBe(2)
    expect(incomeCalls[2][0].data.status).toBe('PENDING')
    expect(incomeCalls[2][0].data.installmentIndex).toBe(3)
  })

  it('each installment amount = total / installments', async () => {
    await POST(makeReq({ paymentMethod: 'credit_card', installments: 3 }), {
      params: Promise.resolve({ id: 'appt1' }),
    })
    const incomeCalls = (vi.mocked(prisma.transaction.create).mock.calls as unknown as TxCall[])
      .filter(([data]) => data.data?.type === 'INCOME')
    incomeCalls.forEach(([data]) => {
      expect(Number(data.data.amount)).toBeCloseTo(100, 1)
    })
  })

  it('all installments share the same installmentGroupId', async () => {
    await POST(makeReq({ paymentMethod: 'credit_card', installments: 3 }), {
      params: Promise.resolve({ id: 'appt1' }),
    })
    const incomeCalls = (vi.mocked(prisma.transaction.create).mock.calls as unknown as TxCall[])
      .filter(([data]) => data.data?.type === 'INCOME')
    const groupIds = incomeCalls.map(([data]) => data.data.installmentGroupId)
    expect(groupIds[0]).toBeTruthy()
    expect(groupIds[0]).toBe(groupIds[1])
    expect(groupIds[1]).toBe(groupIds[2])
  })

  it('dueDate for each installment increases by ~30 days', async () => {
    await POST(makeReq({ paymentMethod: 'credit_card', installments: 3 }), {
      params: Promise.resolve({ id: 'appt1' }),
    })
    const incomeCalls = (vi.mocked(prisma.transaction.create).mock.calls as unknown as TxCall[])
      .filter(([data]) => data.data?.type === 'INCOME')
    const due1 = incomeCalls[0][0].data.dueDate as Date
    const due2 = incomeCalls[1][0].data.dueDate as Date
    const due3 = incomeCalls[2][0].data.dueDate as Date
    expect(due2.getTime()).toBeGreaterThan(due1.getTime())
    expect(due3.getTime()).toBeGreaterThan(due2.getTime())
  })
})

describe('POST /api/appointments/[id]/pay — arredondamento de parcelas (resíduo na última)', () => {
  function incomeAmounts(): number[] {
    return (vi.mocked(prisma.transaction.create).mock.calls as unknown as TxCall[])
      .filter(([data]) => data.data?.type === 'INCOME')
      .map(([data]) => Number(data.data.amount))
  }
  // Soma exata em centavos inteiros — evita ruído de ponto flutuante.
  function sumCents(values: number[]): number {
    return values.reduce((acc, v) => acc + Math.round(v * 100), 0)
  }

  it('price=100 / installments=3: soma das parcelas === 100, resíduo (1 centavo) na última', async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({ ...mockAppointment, price: 100 } as never)
    await POST(makeReq({ paymentMethod: 'credit_card', installments: 3 }), {
      params: Promise.resolve({ id: 'appt1' }),
    })
    const amounts = incomeAmounts()
    expect(amounts).toHaveLength(3)
    expect(sumCents(amounts)).toBe(10000)
    expect(amounts[0]).toBeCloseTo(33.33, 10)
    expect(amounts[1]).toBeCloseTo(33.33, 10)
    expect(amounts[2]).toBeCloseTo(33.34, 10) // última carrega o centavo residual
  })

  it('price=100 / installments=7: soma das parcelas === 100, última fecha a conta', async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({ ...mockAppointment, price: 100 } as never)
    await POST(makeReq({ paymentMethod: 'credit_card', installments: 7 }), {
      params: Promise.resolve({ id: 'appt1' }),
    })
    const amounts = incomeAmounts()
    expect(amounts).toHaveLength(7)
    expect(sumCents(amounts)).toBe(10000)
    // base = floor(10000/7) = 1428 centavos = 14.28; resíduo = 10000 - 1428*7 = 4 centavos
    for (let i = 0; i < 6; i++) {
      expect(amounts[i]).toBeCloseTo(14.28, 10)
    }
    expect(amounts[6]).toBeCloseTo(14.32, 10)
  })

  it('price=300 / installments=3 (divisão exata): 100,00 em cada parcela', async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({ ...mockAppointment, price: 300 } as never)
    await POST(makeReq({ paymentMethod: 'credit_card', installments: 3 }), {
      params: Promise.resolve({ id: 'appt1' }),
    })
    const amounts = incomeAmounts()
    expect(amounts).toHaveLength(3)
    expect(sumCents(amounts)).toBe(30000)
    amounts.forEach((a) => expect(a).toBeCloseTo(100, 10))
  })
})
