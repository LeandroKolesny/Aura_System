// src/__tests__/api/appointments-post.test.ts
// Testes para POST /api/appointments (criar agendamento)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { Patient, Procedure, Appointment, Activity } from '@prisma/client'

vi.mock('@/lib/prisma', () => ({
  default: {
    patient: { findFirst: vi.fn() },
    procedure: { findFirst: vi.fn() },
    company: { findUnique: vi.fn() },
    unavailabilityRule: { findMany: vi.fn() },
    appointment: { findMany: vi.fn(), create: vi.fn(), count: vi.fn() },
    patientSubscription: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    activity: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}))
vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
  generateJWT: vi.fn().mockReturnValue('mock-jwt'),
}))
vi.mock('@/lib/apiGuards', () => ({
  checkWriteAccess: vi.fn().mockResolvedValue(null), // null = acesso permitido
}))
vi.mock('@/lib/businessHours', () => ({
  validateAppointmentTime: vi.fn().mockReturnValue({ valid: true }),
}))
vi.mock('@/lib/calendarSync', () => ({
  pushAppointmentToCalendar: vi.fn().mockResolvedValue(undefined),
}))

import { POST } from '../../app/api/appointments/route'
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { checkWriteAccess } from '@/lib/apiGuards'
import { validateAppointmentTime } from '@/lib/businessHours'

// ── fixtures ──────────────────────────────────────────────────────────────────

const COMPANY_ID = 'company-001'
const PATIENT_ID = 'patient-001'
const PROCEDURE_ID = 'procedure-001'
const PROFESSIONAL_ID = 'professional-001'
const APPOINTMENT_ID = 'appointment-001'

// Data sempre 2h no futuro para passar validação Zod (mínimo 30min)
const FUTURE_DATE = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()

const MOCK_ADMIN_USER = {
  id: 'user-001',
  email: 'admin@clinica.com',
  role: 'ADMIN',
  companyId: COMPANY_ID,
}

const MOCK_PATIENT_USER = {
  id: 'user-002',
  email: 'paciente@email.com',
  role: 'PATIENT',
  companyId: COMPANY_ID,
}

const MOCK_PATIENT = { id: PATIENT_ID, name: 'Maria Silva', phone: '11999990000', companyId: COMPANY_ID } as Patient
const MOCK_PROCEDURE = { id: PROCEDURE_ID, name: 'Limpeza', durationMinutes: 60, price: 150, cost: 20, companyId: COMPANY_ID } as unknown as Procedure
const MOCK_APPOINTMENT = {
  id: APPOINTMENT_ID,
  status: 'SCHEDULED',
  patient: { id: PATIENT_ID, name: 'Maria Silva' },
  professional: { id: PROFESSIONAL_ID, name: 'Profissional' },
  procedure: { id: PROCEDURE_ID, name: 'Limpeza' },
} as unknown as Appointment

const VALID_BODY = {
  patientId: PATIENT_ID,
  professionalId: PROFESSIONAL_ID,
  procedureId: PROCEDURE_ID,
  date: FUTURE_DATE,
  durationMinutes: 60,
  price: 150,
}

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/appointments', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAuthUser).mockResolvedValue(MOCK_ADMIN_USER as never)
  vi.mocked(checkWriteAccess).mockResolvedValue(null)
  vi.mocked(validateAppointmentTime).mockReturnValue({ valid: true })
  vi.mocked(prisma.company.findUnique).mockResolvedValue({ businessHours: {} } as never)
  vi.mocked(prisma.unavailabilityRule.findMany).mockResolvedValue([])
  vi.mocked(prisma.appointment.findMany).mockResolvedValue([]) // sem conflito
  vi.mocked(prisma.patient.findFirst).mockResolvedValue(MOCK_PATIENT)
  vi.mocked(prisma.procedure.findFirst).mockResolvedValue(MOCK_PROCEDURE)
  vi.mocked(prisma.patientSubscription.findFirst).mockResolvedValue(null)
  vi.mocked(prisma.appointment.create).mockResolvedValue(MOCK_APPOINTMENT)
  vi.mocked(prisma.activity.create).mockResolvedValue({} as Activity)
  vi.mocked(prisma.$transaction).mockImplementation((cb: unknown) => (cb as (tx: unknown) => Promise<unknown>)(prisma))
})

// ── testes ────────────────────────────────────────────────────────────────────

describe('POST /api/appointments', () => {

  it('staff (ADMIN) cria agendamento com status SCHEDULED → 201', async () => {
    const res = await POST(makeRequest(VALID_BODY))
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body.appointment.id).toBe(APPOINTMENT_ID)
    expect(prisma.appointment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'SCHEDULED' }) })
    )
  })

  it('PATIENT cria agendamento com status PENDING_APPROVAL → 201', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(MOCK_PATIENT_USER as never)
    vi.mocked(prisma.appointment.create).mockResolvedValue({ ...MOCK_APPOINTMENT, status: 'PENDING_APPROVAL' } as unknown as Appointment)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(201)
    expect(prisma.appointment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PENDING_APPROVAL' }) })
    )
  })

  it('retorna 409 quando há conflito de horário', async () => {
    // Simula agendamento existente no mesmo horário
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([{
      id: 'existing-001',
      date: new Date(Date.now() + 2 * 60 * 60 * 1000), // mesmo horário
      durationMinutes: 60,
      patient: { name: 'Outro Paciente' },
    }] as never)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(409)
  })

  it('retorna 409 quando há conflito com agendamento PENDING_APPROVAL (não só SCHEDULED/CONFIRMED)', async () => {
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([{
      id: 'existing-pending',
      date: new Date(Date.now() + 2 * 60 * 60 * 1000),
      durationMinutes: 60,
      patient: { name: 'Paciente Pendente' },
    }] as never)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(409)
    expect(prisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { in: ['SCHEDULED', 'CONFIRMED', 'PENDING_APPROVAL'] } }),
      })
    )
  })

  it('condição de corrida: transação serializável rejeita conflito (P2034) com 409', async () => {
    const serializationError = Object.assign(new Error('could not serialize access'), { code: 'P2034' })
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(serializationError)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/conflito|indisponível/i)
  })

  it('retorna 400 quando fora do horário de funcionamento', async () => {
    vi.mocked(validateAppointmentTime).mockReturnValue({ valid: false, message: 'Fora do horário' })
    const res = await POST(makeRequest(VALID_BODY))
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.code).toBe('INVALID_TIME')
  })

  it('retorna 404 quando paciente não encontrado', async () => {
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(null)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(404)
  })

  it('retorna 404 quando procedimento não encontrado', async () => {
    vi.mocked(prisma.procedure.findFirst).mockResolvedValue(null)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(404)
  })

  it('retorna 401 sem autenticação', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null as never)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(401)
  })

  it('retorna 403 sem empresa associada', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ ...MOCK_ADMIN_USER, companyId: null } as never)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(403)
  })

  it('retorna 400 para dados de validação inválidos', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, durationMinutes: 5 })) // abaixo do mínimo 15
    expect(res.status).toBe(400)
  })

  it('zera preço quando procedimento coberto por assinatura ativa', async () => {
    vi.mocked(prisma.patientSubscription.findFirst).mockResolvedValue({
      id: 'sub-001',
      sessionsUsedThisCycle: { [PROCEDURE_ID]: 0 },
      plan: { items: [{ procedureId: PROCEDURE_ID, sessionsPerCycle: 2 }] },
    } as never)
    vi.mocked(prisma.patientSubscription.findUnique).mockResolvedValue({
      sessionsUsedThisCycle: { [PROCEDURE_ID]: 0 },
    } as never)
    vi.mocked(prisma.patientSubscription.update).mockResolvedValue({} as never)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(201)
    expect(prisma.appointment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ price: 0 }) })
    )
  })

  it('decrementa sessão da assinatura quando coberto', async () => {
    vi.mocked(prisma.patientSubscription.findFirst).mockResolvedValue({
      id: 'sub-001',
      sessionsUsedThisCycle: { [PROCEDURE_ID]: 0 },
      plan: { items: [{ procedureId: PROCEDURE_ID, sessionsPerCycle: 2 }] },
    } as never)
    vi.mocked(prisma.patientSubscription.findUnique).mockResolvedValue({
      sessionsUsedThisCycle: { [PROCEDURE_ID]: 0 },
    } as never)
    vi.mocked(prisma.patientSubscription.update).mockResolvedValue({} as never)
    await POST(makeRequest(VALID_BODY))
    expect(prisma.patientSubscription.update).toHaveBeenCalledOnce()
  })

  it('avisa mas cobra preço cheio quando sessões da assinatura esgotadas', async () => {
    vi.mocked(prisma.patientSubscription.findFirst).mockResolvedValue({
      id: 'sub-001',
      sessionsUsedThisCycle: { [PROCEDURE_ID]: 2 }, // esgotado
      plan: { items: [{ procedureId: PROCEDURE_ID, sessionsPerCycle: 2 }] },
    } as never)
    const res = await POST(makeRequest(VALID_BODY))
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body.subscriptionCoverage.covered).toBe(false)
    expect(body.subscriptionCoverage.warning).toBeDefined()
    const createCall = vi.mocked(prisma.appointment.create).mock.calls[0][0]
    expect((createCall.data as { price: number }).price).toBe(150) // preço original
  })

  it('registra log de atividade ao criar agendamento', async () => {
    await POST(makeRequest(VALID_BODY))
    expect(prisma.activity.create).toHaveBeenCalledOnce()
  })
})
