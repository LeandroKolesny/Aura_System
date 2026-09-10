// aura-backend/src/__tests__/api/appointments-cancel-with-payment.test.ts
// Teste de CARACTERIZAÇÃO: cancelar (DELETE) um agendamento já pago NÃO mexe em
// nenhuma transação vinculada (receita PAID nem parcelas PENDING). Estorno automático
// é decisão de produto e foi deixado de fora de propósito — ver o TODO no route.ts.
// Qualquer mudança futura nesse comportamento deve quebrar este teste de propósito.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    appointment: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    activity: { create: vi.fn() },
    transaction: {
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))
vi.mock('@/lib/calendarSync', () => ({
  pushAppointmentToCalendar: vi.fn().mockResolvedValue(undefined),
  deleteCalendarEvent: vi.fn().mockResolvedValue(undefined),
}))

import { DELETE } from '../../app/api/appointments/[id]/route'
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

const mockUser = { id: 'u1', companyId: 'c1', role: 'ADMIN' }

function makeReq() {
  return new NextRequest('http://localhost/api/appointments/appt1', {
    method: 'DELETE',
    headers: { authorization: 'Bearer token' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAuthUser).mockResolvedValue(mockUser as never)
  vi.mocked(prisma.appointment.update).mockResolvedValue({ id: 'appt1', status: 'CANCELED' } as never)
  vi.mocked(prisma.activity.create).mockResolvedValue({} as never)
})

describe('DELETE /api/appointments/[id] — agendamento já pago', () => {
  it('cancela o agendamento mas NÃO estorna/altera nenhuma transação vinculada (comportamento atual)', async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({
      id: 'appt1',
      companyId: 'c1',
      status: 'COMPLETED',
      paid: true,
    } as never)

    const res = await DELETE(makeReq(), { params: Promise.resolve({ id: 'appt1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)

    // O agendamento é marcado como CANCELED...
    expect(prisma.appointment.update).toHaveBeenCalledWith({
      where: { id: 'appt1' },
      data: { status: 'CANCELED' },
    })

    // ...mas NENHUMA transação é tocada: receita PAID e parcelas PENDING seguem intactas.
    expect(prisma.transaction.update).not.toHaveBeenCalled()
    expect(prisma.transaction.updateMany).not.toHaveBeenCalled()
    expect(prisma.transaction.deleteMany).not.toHaveBeenCalled()
    expect(prisma.transaction.delete).not.toHaveBeenCalled()
    expect(prisma.transaction.create).not.toHaveBeenCalled()
  })

  it('mesmo com parcelas PENDING vinculadas, o cancelamento não consulta nem ajusta transações', async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({
      id: 'appt1',
      companyId: 'c1',
      status: 'COMPLETED',
      paid: true,
    } as never)

    await DELETE(makeReq(), { params: Promise.resolve({ id: 'appt1' }) })

    // A rota nem sequer lê as transações do agendamento para decidir algo.
    expect(prisma.transaction.findMany).not.toHaveBeenCalled()
  })
})
