import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { Appointment, Company, WhatsappInstance } from '@prisma/client'

vi.mock('@/lib/prisma', () => ({
  default: {
    appointment: { findFirst: vi.fn(), update: vi.fn() },
    patient: { update: vi.fn() },
    procedure: { findUnique: vi.fn() },
    transaction: { create: vi.fn() },
    activity: { create: vi.fn() },
    inventoryItem: { update: vi.fn() },
    procedureSupply: { findMany: vi.fn().mockResolvedValue([]) },
    appNotification: { create: vi.fn() },
    stockMovement: { create: vi.fn() },
    company: { findUnique: vi.fn() },
    whatsappInstance: { findUnique: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))
vi.mock('@/lib/calendarSync', () => ({
  deleteCalendarEvent: vi.fn().mockResolvedValue(undefined),
  pushAppointmentToCalendar: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/whatsapp', () => ({ sendTextMessage: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/whatsappMessages', () => ({
  buildConfirmationMessage: vi.fn().mockReturnValue('msg-confirmacao'),
  formatDate: vi.fn().mockReturnValue('25/03/2026'),
  formatTime: vi.fn().mockReturnValue('14:00'),
}))

import { PATCH } from '../../app/api/appointments/[id]/status/route'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { sendTextMessage } from '@/lib/whatsapp'

const MOCK_USER = { id: 'u1', companyId: 'c1', role: 'ADMIN' }
const MOCK_APPOINTMENT = {
  id: 'a1', companyId: 'c1', patientId: 'p1', procedureId: 'proc1',
  status: 'SCHEDULED', stockDeducted: false,
  patient: { id: 'p1', name: 'Ana Silva', phone: '11999990000' },
  professional: { id: 'pr1', name: 'Dra. Maria' },
  procedure: { id: 'proc1', name: 'Limpeza de Pele', cost: 0 },
  date: new Date('2026-03-26T14:00:00'),
}
const MOCK_WA_CONNECTED = { status: 'CONNECTED', termsAccepted: true }

function makePATCH(body: object) {
  return new NextRequest('http://localhost/api/appointments/a1/status', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAuthUser).mockResolvedValue(MOCK_USER as never)
  vi.mocked(prisma.appointment.findFirst).mockResolvedValue(MOCK_APPOINTMENT as unknown as Appointment)
  vi.mocked(prisma.appointment.update).mockResolvedValue(MOCK_APPOINTMENT as unknown as Appointment)
  vi.mocked(prisma.activity.create).mockResolvedValue({} as never)
  vi.mocked(prisma.company.findUnique).mockResolvedValue({ name: 'Clínica Beleza' } as unknown as Company)
  vi.mocked(prisma.whatsappInstance.findUnique).mockResolvedValue(MOCK_WA_CONNECTED as unknown as WhatsappInstance)
})

describe('WhatsApp hook no PATCH status → CONFIRMED', () => {
  it('dispara sendTextMessage quando status muda para CONFIRMED e WA está conectado', async () => {
    const res = await PATCH(
      makePATCH({ status: 'CONFIRMED' }),
      { params: Promise.resolve({ id: 'a1' }) }
    )
    expect(res.status).toBe(200)
    // fire-and-forget: aguarda microtask queue
    await new Promise(r => setTimeout(r, 50))
    expect(sendTextMessage).toHaveBeenCalledOnce()
    expect(sendTextMessage).toHaveBeenCalledWith('c1', '11999990000', 'msg-confirmacao')
  })

  it('NÃO dispara WhatsApp quando status muda para COMPLETED', async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({
      ...MOCK_APPOINTMENT, status: 'CONFIRMED',
    } as unknown as Appointment)
    await PATCH(
      makePATCH({ status: 'COMPLETED' }),
      { params: Promise.resolve({ id: 'a1' }) }
    )
    await new Promise(r => setTimeout(r, 50))
    expect(sendTextMessage).not.toHaveBeenCalled()
  })

  it('NÃO dispara WhatsApp se instância não está conectada', async () => {
    vi.mocked(prisma.whatsappInstance.findUnique).mockResolvedValue({
      status: 'DISCONNECTED', termsAccepted: true,
    } as unknown as WhatsappInstance)
    await PATCH(
      makePATCH({ status: 'CONFIRMED' }),
      { params: Promise.resolve({ id: 'a1' }) }
    )
    await new Promise(r => setTimeout(r, 50))
    expect(sendTextMessage).not.toHaveBeenCalled()
  })

  it('NÃO dispara WhatsApp se paciente não tem telefone', async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({
      ...MOCK_APPOINTMENT,
      patient: { id: 'p1', name: 'Ana', phone: null },
    } as unknown as Appointment)
    await PATCH(
      makePATCH({ status: 'CONFIRMED' }),
      { params: Promise.resolve({ id: 'a1' }) }
    )
    await new Promise(r => setTimeout(r, 50))
    expect(sendTextMessage).not.toHaveBeenCalled()
  })

  it('continua e retorna 200 mesmo se WhatsApp falhar (fire-and-forget)', async () => {
    vi.mocked(sendTextMessage).mockRejectedValueOnce(new Error('rede'))
    const res = await PATCH(
      makePATCH({ status: 'CONFIRMED' }),
      { params: Promise.resolve({ id: 'a1' }) }
    )
    expect(res.status).toBe(200)
  })
})
