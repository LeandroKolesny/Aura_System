// aura-backend/src/__tests__/api/transactions-checkout.test.ts
// Testes para POST /api/transactions/checkout

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    appointment: { findFirst: vi.fn(), update: vi.fn() },
    transaction: { create: vi.fn() },
    activity: { create: vi.fn() },
    user: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))

import { POST } from '../../app/api/transactions/checkout/route'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

const RECEPTIONIST = { id: 'u1', email: 'recep@clinica.com', role: 'RECEPTIONIST', companyId: 'c1' }
const ESTHETICIAN = { id: 'u2', email: 'esth@clinica.com', role: 'ESTHETICIAN', companyId: 'c1' }

const APPOINTMENT = {
  id: 'appt1', companyId: 'c1', paid: false, status: 'CONFIRMED', price: 150, professionalId: 'prof1',
  patient: { id: 'p1', name: 'Paciente Teste' },
  procedure: { id: 'proc1', name: 'Limpeza de Pele' },
  professional: { id: 'prof1', name: 'Profissional Teste' },
  transactions: [],
}

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/transactions/checkout', {
    method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' },
  })
}

const VALID_BODY = { appointmentId: 'appt1', paymentMethod: 'pix' }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.$transaction).mockImplementation((cb: unknown) => (cb as (tx: unknown) => Promise<unknown>)(prisma))
  vi.mocked(prisma.transaction.create).mockResolvedValue({ id: 'tx1' } as never)
  vi.mocked(prisma.appointment.update).mockResolvedValue({ id: 'appt1', paid: true } as never)
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'prof1', name: 'Profissional Teste', commissionRate: null } as never)
})

describe('POST /api/transactions/checkout', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(401)
  })

  it('retorna 403 quando o role não pode processar pagamentos (ex.: ESTHETICIAN)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ESTHETICIAN as never)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(403)
  })

  it('retorna 400 para dados inválidos', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(RECEPTIONIST as never)
    const res = await POST(makeRequest({ appointmentId: 'appt1' }))
    expect(res.status).toBe(400)
  })

  it('retorna 404 quando o agendamento não existe', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(RECEPTIONIST as never)
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(404)
  })

  it('retorna 400 quando o agendamento já foi pago', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(RECEPTIONIST as never)
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({ ...APPOINTMENT, paid: true } as never)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(400)
  })

  it('retorna 400 quando o agendamento não está confirmado nem concluído', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(RECEPTIONIST as never)
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({ ...APPOINTMENT, status: 'SCHEDULED' } as never)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(400)
  })

  it('retorna 400 quando o valor final (após desconto) fica zero ou negativo', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(RECEPTIONIST as never)
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(APPOINTMENT as never)
    const res = await POST(makeRequest({ ...VALID_BODY, discount: 150 }))
    expect(res.status).toBe(400)
  })

  it('processa o pagamento, marca o agendamento como pago e completo', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(RECEPTIONIST as never)
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(APPOINTMENT as never)

    const res = await POST(makeRequest(VALID_BODY))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(prisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amount: 150, type: 'INCOME', status: 'PAID' }) })
    )
    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'appt1' }, data: { paid: true } })
    )
    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'appt1' }, data: { status: 'COMPLETED' } })
    )
  })

  it('aplica o desconto informado sobre o preço do agendamento', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(RECEPTIONIST as never)
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(APPOINTMENT as never)

    await POST(makeRequest({ ...VALID_BODY, discount: 20 }))

    expect(prisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amount: 130 }) })
    )
  })

  it('não duplica a atualização de status quando o agendamento já está COMPLETED', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(RECEPTIONIST as never)
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({ ...APPOINTMENT, status: 'COMPLETED' } as never)

    await POST(makeRequest(VALID_BODY))

    expect(prisma.appointment.update).toHaveBeenCalledTimes(1)
  })

  it('calcula a comissão do profissional quando commissionRate está configurado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(RECEPTIONIST as never)
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(APPOINTMENT as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'prof1', name: 'Profissional Teste', commissionRate: 20 } as never)

    const res = await POST(makeRequest(VALID_BODY))
    const body = await res.json()

    expect(body.commission).toEqual(expect.objectContaining({ rate: 20, amount: 30 }))
  })

  it('retorna commission=null quando o profissional não tem taxa de comissão', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(RECEPTIONIST as never)
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(APPOINTMENT as never)

    const res = await POST(makeRequest(VALID_BODY))
    const body = await res.json()

    expect(body.commission).toBeNull()
  })
})
