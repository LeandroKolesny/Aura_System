import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { Appointment } from '@prisma/client'

vi.mock('@/lib/prisma', () => ({
  default: {
    appointment: { findMany: vi.fn() },
    whatsappInstance: { findUnique: vi.fn() },
  },
}))
vi.mock('@/lib/whatsapp', () => ({ sendTextMessage: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/whatsappMessages', () => ({
  buildReminderMessage: vi.fn().mockReturnValue('msg-lembrete'),
  formatDate: vi.fn().mockReturnValue('26/03/2026'),
  formatTime: vi.fn().mockReturnValue('14:00'),
}))

import { GET } from '../../app/api/cron/whatsapp-reminders/route'
import prisma from '@/lib/prisma'
import { sendTextMessage } from '@/lib/whatsapp'

const VALID_TOKEN = 'cron-secret-123'

function makeReq(token?: string) {
  const headers: Record<string, string> = {}
  if (token) headers['authorization'] = `Bearer ${token}`
  return new NextRequest('http://localhost/api/cron/whatsapp-reminders', { headers })
}

const MOCK_APPOINTMENT = {
  id: 'a1', companyId: 'c1', date: new Date(),
  patient: { name: 'Ana', phone: '11999990000' },
  professional: { name: 'Dra. Maria' },
  procedure: { name: 'Limpeza' },
  company: { name: 'Clínica Beleza' },
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = VALID_TOKEN
})

describe('GET /api/cron/whatsapp-reminders', () => {
  it('retorna 401 sem token', async () => {
    const res = await GET(makeReq())
    expect(res.status).toBe(401)
  })

  it('retorna 401 com token errado', async () => {
    const res = await GET(makeReq('wrong'))
    expect(res.status).toBe(401)
  })

  it('retorna 200 com token correto', async () => {
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([])
    const res = await GET(makeReq(VALID_TOKEN))
    expect(res.status).toBe(200)
  })

  it('envia lembrete para agendamentos de amanhã com WA conectado', async () => {
    vi.mocked(prisma.appointment.findMany).mockResolvedValue(
      [MOCK_APPOINTMENT] as unknown as Appointment[]
    )
    vi.mocked(prisma.whatsappInstance.findUnique).mockResolvedValue({
      status: 'CONNECTED',
    } as never)
    const res = await GET(makeReq(VALID_TOKEN))
    const body = await res.json()
    expect(sendTextMessage).toHaveBeenCalledOnce()
    expect(body.sent).toBe(1)
  })

  it('NÃO envia se WA desconectado', async () => {
    vi.mocked(prisma.appointment.findMany).mockResolvedValue(
      [MOCK_APPOINTMENT] as unknown as Appointment[]
    )
    vi.mocked(prisma.whatsappInstance.findUnique).mockResolvedValue({
      status: 'DISCONNECTED',
    } as never)
    await GET(makeReq(VALID_TOKEN))
    expect(sendTextMessage).not.toHaveBeenCalled()
  })

  it('NÃO envia se paciente sem telefone', async () => {
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([{
      ...MOCK_APPOINTMENT,
      patient: { name: 'Ana', phone: null },
    }] as unknown as Appointment[])
    vi.mocked(prisma.whatsappInstance.findUnique).mockResolvedValue({
      status: 'CONNECTED',
    } as never)
    await GET(makeReq(VALID_TOKEN))
    expect(sendTextMessage).not.toHaveBeenCalled()
  })
})
