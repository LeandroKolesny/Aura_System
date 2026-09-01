// src/__tests__/api/public-booking.test.ts
// Testes para POST /api/public/booking (agendamento público sem autenticação)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    company: { findUnique: vi.fn() },
    procedure: { findFirst: vi.fn() },
    user: { findFirst: vi.fn(), create: vi.fn() },
    appointment: { findMany: vi.fn(), create: vi.fn() },
    patient: { findFirst: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  },
}))
vi.mock('@/lib/rateLimiter', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
}))
vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn().mockResolvedValue('hashed-password') },
}))

import { POST } from '../../app/api/public/booking/route'
import prisma from '@/lib/prisma'
import { checkRateLimit } from '@/lib/rateLimiter'

const COMPANY_ID = 'ckcompany0000000000000001'
const PROCEDURE_ID = 'ckprocedure000000000000001'
const PROFESSIONAL_ID = 'ckprofessional00000000001'
const FUTURE_DATE = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()

const MOCK_COMPANY = { id: COMPANY_ID, name: 'Clínica Teste', onlineBookingConfig: {} }
const MOCK_PROCEDURE = { id: PROCEDURE_ID, name: 'Limpeza', durationMinutes: 60, price: 150, companyId: COMPANY_ID }
const MOCK_PROFESSIONAL = { id: PROFESSIONAL_ID, name: 'Dra. Ana', companyId: COMPANY_ID }
const MOCK_PATIENT = { id: 'patient-001', name: 'Maria', email: 'maria@email.com', companyId: COMPANY_ID }
const MOCK_APPOINTMENT = { id: 'appt-001', status: 'PENDING_APPROVAL' }

const VALID_BODY = {
  companyId: COMPANY_ID,
  procedureId: PROCEDURE_ID,
  professionalId: PROFESSIONAL_ID,
  date: FUTURE_DATE,
  patientInfo: { name: 'Maria Silva', email: 'maria@email.com', phone: '11999990000' },
}

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/public/booking', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 9 })
  vi.mocked(prisma.company.findUnique).mockResolvedValue(MOCK_COMPANY as never)
  vi.mocked(prisma.procedure.findFirst).mockResolvedValue(MOCK_PROCEDURE as never)
  vi.mocked(prisma.user.findFirst).mockResolvedValue(MOCK_PROFESSIONAL as never)
  vi.mocked(prisma.appointment.findMany).mockResolvedValue([])
  vi.mocked(prisma.patient.findFirst).mockResolvedValue(null)
  vi.mocked(prisma.patient.create).mockResolvedValue(MOCK_PATIENT as never)
  vi.mocked(prisma.appointment.create).mockResolvedValue(MOCK_APPOINTMENT as never)
  vi.mocked(prisma.$transaction).mockImplementation((cb: unknown) => (cb as (tx: unknown) => Promise<unknown>)(prisma))
})

describe('POST /api/public/booking', () => {
  it('retorna 429 quando limite de requisições excedido', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, remaining: 0, retryAfter: 900 })
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(429)
  })

  it('retorna 400 para dados inválidos', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, patientInfo: { ...VALID_BODY.patientInfo, email: 'invalido' } }))
    expect(res.status).toBe(400)
  })

  it('retorna 404 quando empresa não encontrada', async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValue(null)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(404)
  })

  it('retorna 404 quando procedimento não encontrado', async () => {
    vi.mocked(prisma.procedure.findFirst).mockResolvedValue(null)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(404)
  })

  it('retorna 404 quando profissional não encontrado', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(404)
  })

  it('retorna 409 quando já existe agendamento no mesmo horário', async () => {
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      { id: 'existing', date: new Date(FUTURE_DATE), durationMinutes: 60 },
    ] as never)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(409)
  })

  it('cria paciente e agendamento com sucesso → 201', async () => {
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(prisma.appointment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PENDING_APPROVAL', companyId: COMPANY_ID }) })
    )
  })

  it('reaproveita paciente existente pelo email em vez de criar duplicado', async () => {
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(MOCK_PATIENT as never)
    await POST(makeRequest(VALID_BODY))
    expect(prisma.patient.create).not.toHaveBeenCalled()
  })

  it('condição de corrida: transação serializável rejeita conflito (P2034) com 409', async () => {
    const serializationError = Object.assign(new Error('could not serialize access'), { code: 'P2034' })
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(serializationError)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(409)
  })
})
