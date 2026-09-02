// aura-backend/src/__tests__/api/appointments-id.test.ts
// Testes para GET/PUT/DELETE /api/appointments/[id]

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    appointment: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    activity: { create: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))
vi.mock('@/lib/calendarSync', () => ({
  pushAppointmentToCalendar: vi.fn().mockResolvedValue(undefined),
  deleteCalendarEvent: vi.fn().mockResolvedValue(undefined),
}))

import { GET, PUT, DELETE } from '../../app/api/appointments/[id]/route'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

const ADMIN = { id: 'u1', email: 'admin@clinica.com', role: 'ADMIN', companyId: 'c1' }
const PATIENT_ROLE = { id: 'u3', email: 'paciente@email.com', role: 'PATIENT', companyId: 'c1' }

const APPOINTMENT = {
  id: 'appt1', companyId: 'c1', status: 'SCHEDULED', date: new Date('2026-02-01T10:00:00Z'),
  durationMinutes: 60, professionalId: 'prof1',
}

function makeRequest(method: string, body?: unknown) {
  return new NextRequest('http://localhost/api/appointments/appt1', {
    method, ...(body !== undefined ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } } : {}),
  })
}
function makeParams(id = 'appt1') {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.appointment.findMany).mockResolvedValue([])
})

describe('GET /api/appointments/[id]', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await GET(makeRequest('GET'), makeParams())
    expect(res.status).toBe(401)
  })

  it('retorna 404 quando o agendamento não existe', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null)
    const res = await GET(makeRequest('GET'), makeParams())
    expect(res.status).toBe(404)
  })

  it('inclui CPF e dados sensíveis do paciente para roles privilegiados', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({ id: 'appt1' } as never)

    await GET(makeRequest('GET'), makeParams())

    expect(prisma.appointment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ include: expect.objectContaining({ patient: { select: expect.objectContaining({ cpf: true }) } }) })
    )
  })

  it('restringe dados sensíveis do paciente para roles não privilegiados (ex.: PATIENT)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(PATIENT_ROLE as never)
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({ id: 'appt1' } as never)

    await GET(makeRequest('GET'), makeParams())

    expect(prisma.appointment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ include: expect.objectContaining({ patient: { select: { id: true, name: true, phone: true } } }) })
    )
  })
})

describe('PUT /api/appointments/[id]', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await PUT(makeRequest('PUT', { notes: 'x' }), makeParams())
    expect(res.status).toBe(401)
  })

  it('retorna 403 quando o role não é permitido (ex.: PATIENT)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(PATIENT_ROLE as never)
    const res = await PUT(makeRequest('PUT', { notes: 'x' }), makeParams())
    expect(res.status).toBe(403)
  })

  it('retorna 404 quando o agendamento não existe', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null)
    const res = await PUT(makeRequest('PUT', { notes: 'x' }), makeParams())
    expect(res.status).toBe(404)
  })

  it('retorna 400 quando o agendamento já está finalizado (COMPLETED/CANCELED)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({ ...APPOINTMENT, status: 'COMPLETED' } as never)

    const res = await PUT(makeRequest('PUT', { notes: 'x' }), makeParams())
    expect(res.status).toBe(400)
  })

  it('retorna 400 para dados inválidos', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(APPOINTMENT as never)

    const res = await PUT(makeRequest('PUT', { durationMinutes: -10 }), makeParams())
    expect(res.status).toBe(400)
  })

  it('retorna 409 quando a nova data/profissional gera conflito de horário', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(APPOINTMENT as never)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      { id: 'appt-other', date: new Date('2026-02-01T10:00:00Z'), durationMinutes: 60 },
    ] as never)

    const res = await PUT(makeRequest('PUT', { date: '2026-02-01T10:30:00Z' }), makeParams())
    expect(res.status).toBe(409)
  })

  it('atualiza o agendamento e sincroniza com o Google Calendar (fire-and-forget)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(APPOINTMENT as never)
    vi.mocked(prisma.appointment.update).mockResolvedValue({ id: 'appt1', notes: 'Atualizado' } as never)

    const res = await PUT(makeRequest('PUT', { notes: 'Atualizado' }), makeParams())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.appointment.notes).toBe('Atualizado')
    const { pushAppointmentToCalendar } = await import('@/lib/calendarSync')
    expect(pushAppointmentToCalendar).toHaveBeenCalledWith('appt1')
  })
})

describe('DELETE /api/appointments/[id]', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await DELETE(makeRequest('DELETE'), makeParams())
    expect(res.status).toBe(401)
  })

  it('retorna 404 quando o agendamento não existe', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null)
    const res = await DELETE(makeRequest('DELETE'), makeParams())
    expect(res.status).toBe(404)
  })

  it('cancela o agendamento (soft cancel), remove do Google Calendar e registra atividade', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(APPOINTMENT as never)

    const res = await DELETE(makeRequest('DELETE'), makeParams())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(prisma.appointment.update).toHaveBeenCalledWith({ where: { id: 'appt1' }, data: { status: 'CANCELED' } })
    const { deleteCalendarEvent } = await import('@/lib/calendarSync')
    expect(deleteCalendarEvent).toHaveBeenCalledWith('appt1')
    expect(prisma.activity.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'APPOINTMENT_CANCELED' }) })
    )
  })
})
