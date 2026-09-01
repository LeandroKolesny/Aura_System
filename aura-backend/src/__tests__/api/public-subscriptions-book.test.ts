// src/__tests__/api/public-subscriptions-book.test.ts
// Testes para POST /api/public/subscriptions/book

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { Patient, User, Company, Procedure, SubscriptionPlan, SubscriptionPlanItem, PatientSubscription, Appointment } from '@prisma/client'

vi.mock('@/lib/prisma', () => ({
  default: {
    company: { findUnique: vi.fn() },
    subscriptionPlan: { findFirst: vi.fn() },
    procedure: { findFirst: vi.fn() },
    user: { findFirst: vi.fn(), create: vi.fn() },
    patient: { findFirst: vi.fn(), create: vi.fn() },
    appointment: { create: vi.fn() },
    patientSubscription: { findFirst: vi.fn(), create: vi.fn() },
  },
}))
vi.mock('@/lib/rateLimiter', () => ({
  checkRateLimit: vi.fn(),
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
}))
vi.mock('@/lib/auth', () => ({
  generateJWT: vi.fn().mockReturnValue('mock-jwt-token'),
}))
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2b$12$hashed'),
    compare: vi.fn().mockResolvedValue(true),
  },
}))

import { POST } from '../../app/api/public/subscriptions/book/route'
import prisma from '@/lib/prisma'
import { checkRateLimit } from '@/lib/rateLimiter'

// ── fixtures ──────────────────────────────────────────────────────────────────

const COMPANY_ID = 'ckvfpqjxb0000qojpbm7q2e4a'
const PLAN_ID = 'ckvfpqjxb0001qojpbm7q2e4b'
const PROCEDURE_ID = 'ckvfpqjxb0002qojpbm7q2e4c'
const PROFESSIONAL_ID = 'ckvfpqjxb0003qojpbm7q2e4d'
const PATIENT_ID = 'ckvfpqjxb0004qojpbm7q2e4e'
const USER_ID = 'ckvfpqjxb0005qojpbm7q2e4f'

const VALID_BODY = {
  companyId: COMPANY_ID,
  planId: PLAN_ID,
  procedureId: PROCEDURE_ID,
  professionalId: PROFESSIONAL_ID,
  date: new Date(Date.now() + 86400000).toISOString(),
  patientInfo: {
    name: 'Maria Silva',
    email: 'maria@exemplo.com',
    phone: '11999990000',
    password: 'minhasenha123',
  },
}

const MOCK_COMPANY = { id: COMPANY_ID } as Company
const MOCK_PLAN_ITEM = { procedureId: PROCEDURE_ID, sessionsPerCycle: 2 } as SubscriptionPlanItem
const MOCK_PLAN = {
  id: PLAN_ID,
  name: 'Plano Premium',
  companyId: COMPANY_ID,
  isActive: true,
  price: 150,
  items: [MOCK_PLAN_ITEM],
} as unknown as SubscriptionPlan & { items: SubscriptionPlanItem[] }
const MOCK_PROCEDURE = {
  id: PROCEDURE_ID,
  companyId: COMPANY_ID,
  durationMinutes: 60,
} as Procedure
const MOCK_PATIENT = {
  id: PATIENT_ID,
  name: 'Maria Silva',
  email: 'maria@exemplo.com',
  phone: '11999990000',
  companyId: COMPANY_ID,
} as Patient
const MOCK_USER = {
  id: USER_ID,
  email: 'maria@exemplo.com',
  role: 'PATIENT',
  companyId: COMPANY_ID,
} as User
const MOCK_PROFESSIONAL = {
  id: PROFESSIONAL_ID,
  email: 'pro@clinica.com',
  role: 'ESTHETICIAN',
  companyId: COMPANY_ID,
} as User
const MOCK_APPOINTMENT = { id: 'appt-cuid-000001' } as Appointment
const MOCK_SUBSCRIPTION = { id: 'sub-cuid-0000001' } as PatientSubscription

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/public/subscriptions/book', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 9 })
  vi.mocked(prisma.company.findUnique).mockResolvedValue(MOCK_COMPANY)
  vi.mocked(prisma.subscriptionPlan.findFirst).mockResolvedValue(MOCK_PLAN as unknown as SubscriptionPlan)
  vi.mocked(prisma.procedure.findFirst).mockResolvedValue(MOCK_PROCEDURE)
  // 1ª chamada: verifica profissional → encontrado
  // 2ª chamada: verifica portal user existente → null (novo usuário)
  vi.mocked(prisma.user.findFirst)
    .mockResolvedValueOnce(MOCK_PROFESSIONAL)
    .mockResolvedValueOnce(null)
  vi.mocked(prisma.user.create).mockResolvedValue(MOCK_USER)
  vi.mocked(prisma.patient.findFirst).mockResolvedValue(null)
  vi.mocked(prisma.patient.create).mockResolvedValue(MOCK_PATIENT)
  vi.mocked(prisma.appointment.create).mockResolvedValue(MOCK_APPOINTMENT)
  vi.mocked(prisma.patientSubscription.findFirst).mockResolvedValue(null)
  vi.mocked(prisma.patientSubscription.create).mockResolvedValue(MOCK_SUBSCRIPTION)
})

// ── testes ────────────────────────────────────────────────────────────────────

describe('POST /api/public/subscriptions/book', () => {

  it('retorna 201 com appointmentId e patientToken em caso de sucesso', async () => {
    const res = await POST(makeRequest(VALID_BODY))
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body.success).toBe(true)
    expect(body.appointmentId).toBe(MOCK_APPOINTMENT.id)
    expect(body.patientToken).toBe('mock-jwt-token')
  })

  // ── REGRESSÃO: bug crítico onde prisma.user era usado no lugar de prisma.patient ──
  it('REGRESSÃO: cria Patient (não User) para o agendamento e assinatura', async () => {
    await POST(makeRequest(VALID_BODY))
    // Patient deve ser criado na tabela patients
    expect(prisma.patient.create).toHaveBeenCalledOnce()
    expect(prisma.patient.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ email: VALID_BODY.patientInfo.email }) })
    )
  })

  it('REGRESSÃO: appointment usa patientId do Patient, não do User', async () => {
    await POST(makeRequest(VALID_BODY))
    expect(prisma.appointment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ patientId: PATIENT_ID }) })
    )
    // Garante que NÃO está usando o USER_ID como patientId
    const call = vi.mocked(prisma.appointment.create).mock.calls[0][0]
    expect((call.data as { patientId: string }).patientId).not.toBe(USER_ID)
  })

  it('REGRESSÃO: patientSubscription usa patientId do Patient, não do User', async () => {
    await POST(makeRequest(VALID_BODY))
    expect(prisma.patientSubscription.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ patientId: PATIENT_ID }) })
    )
    const call = vi.mocked(prisma.patientSubscription.create).mock.calls[0][0]
    expect((call.data as { patientId: string }).patientId).not.toBe(USER_ID)
  })

  it('cria User separado para autenticação no portal', async () => {
    await POST(makeRequest(VALID_BODY))
    expect(prisma.user.create).toHaveBeenCalledOnce()
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: 'PATIENT' }) })
    )
  })

  it('não cria User duplicado quando email já existe e senha bate', async () => {
    // Senha correta para o MOCK_USER (hash mockado retorna true via bcrypt.compare mock)
    vi.mocked(prisma.user.findFirst).mockReset()
    vi.mocked(prisma.user.findFirst)
      .mockResolvedValueOnce(MOCK_PROFESSIONAL)
      .mockResolvedValueOnce(MOCK_USER)
    // bcrypt.compare retorna true (senha correta)
    const bcrypt = await import('bcryptjs')
    vi.mocked(bcrypt.default.compare as unknown as (...args: unknown[]) => unknown)
      .mockResolvedValueOnce(true as never)
    await POST(makeRequest(VALID_BODY))
    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  it('retorna 409 quando email já existe e senha informada não confere', async () => {
    vi.mocked(prisma.user.findFirst).mockReset()
    vi.mocked(prisma.user.findFirst)
      .mockResolvedValueOnce(MOCK_PROFESSIONAL)
      .mockResolvedValueOnce(MOCK_USER) // portal user encontrado
    // bcrypt.compare retorna false (senha errada)
    const bcrypt = await import('bcryptjs')
    vi.mocked(bcrypt.default.compare as unknown as (...args: unknown[]) => unknown)
      .mockResolvedValueOnce(false as never)
    const res = await POST(makeRequest(VALID_BODY))
    const body = await res.json()
    expect(res.status).toBe(409)
    expect(body.error).toContain('já possui uma conta')
    expect(body.code).toBe('EMAIL_ALREADY_EXISTS')
    expect(prisma.user.create).not.toHaveBeenCalled()
    expect(prisma.appointment.create).not.toHaveBeenCalled()
  })

  it('não cria Patient duplicado se já existe paciente com mesmo email/empresa', async () => {
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(MOCK_PATIENT)
    await POST(makeRequest(VALID_BODY))
    expect(prisma.patient.create).not.toHaveBeenCalled()
  })

  it('reutiliza PatientSubscription ativa existente', async () => {
    vi.mocked(prisma.patientSubscription.findFirst).mockResolvedValue(MOCK_SUBSCRIPTION)
    await POST(makeRequest(VALID_BODY))
    expect(prisma.patientSubscription.create).not.toHaveBeenCalled()
  })

  // ── validação ──────────────────────────────────────────────────────────────

  it('retorna 400 com mensagem em português para senha curta', async () => {
    const body = { ...VALID_BODY, patientInfo: { ...VALID_BODY.patientInfo, password: '123' } }
    const res = await POST(makeRequest(body))
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.error).toContain('Senha')
    expect(json.error).not.toBe('Dados inválidos')
  })

  it('retorna 400 com mensagem em português para e-mail inválido', async () => {
    const body = { ...VALID_BODY, patientInfo: { ...VALID_BODY.patientInfo, email: 'nao-e-email' } }
    const res = await POST(makeRequest(body))
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.error).toContain('E-mail')
  })

  it('retorna 400 com mensagem em português para nome curto', async () => {
    const body = { ...VALID_BODY, patientInfo: { ...VALID_BODY.patientInfo, name: 'A' } }
    const res = await POST(makeRequest(body))
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.error).toContain('Nome')
  })

  it('retorna 429 quando rate limit excedido', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, remaining: 0, retryAfter: 900 })
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(429)
  })

  it('retorna 404 quando empresa não existe', async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValue(null)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(404)
  })

  it('retorna 404 quando plano não existe ou está inativo', async () => {
    vi.mocked(prisma.subscriptionPlan.findFirst).mockResolvedValue(null)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(404)
  })

  it('retorna 400 quando procedimento não pertence ao plano', async () => {
    const planSemProcedimento = { ...MOCK_PLAN, items: [] }
    vi.mocked(prisma.subscriptionPlan.findFirst).mockResolvedValue(planSemProcedimento as unknown as SubscriptionPlan)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(400)
  })

  // ── preço do agendamento ────────────────────────────────────────────────────

  it('primeira assinatura: appointment criado com price = plan.price', async () => {
    // patientSubscription.findFirst retorna null → nova assinatura → preço = plan.price (150)
    vi.mocked(prisma.patientSubscription.findFirst).mockResolvedValue(null)
    await POST(makeRequest(VALID_BODY))
    const call = vi.mocked(prisma.appointment.create).mock.calls[0][0]
    expect((call.data as { price: number }).price).toBe(150)
  })

  it('assinatura existente: appointment criado com price = 0 (sessão já paga no plano)', async () => {
    const existingSubscription = {
      ...MOCK_SUBSCRIPTION,
      status: 'PENDING',
      sessionsUsedThisCycle: {},
    } as unknown as PatientSubscription
    vi.mocked(prisma.patientSubscription.findFirst).mockResolvedValue(existingSubscription)
    await POST(makeRequest(VALID_BODY))
    const call = vi.mocked(prisma.appointment.create).mock.calls[0][0]
    expect((call.data as { price: number }).price).toBe(0)
  })

  // ── limite de sessões ───────────────────────────────────────────────────────

  it('retorna 400 com SESSION_LIMIT_REACHED quando assinatura ACTIVE atingiu o limite', async () => {
    const subscriptionAtLimit = {
      ...MOCK_SUBSCRIPTION,
      status: 'ACTIVE',
      sessionsUsedThisCycle: { [PROCEDURE_ID]: 2 }, // igual a sessionsPerCycle (2)
    } as unknown as PatientSubscription
    vi.mocked(prisma.patientSubscription.findFirst).mockResolvedValue(subscriptionAtLimit)
    const res = await POST(makeRequest(VALID_BODY))
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.code).toBe('SESSION_LIMIT_REACHED')
    expect(body.error).toContain('limite')
    expect(prisma.appointment.create).not.toHaveBeenCalled()
  })

  it('permite agendar quando sessões usadas estão abaixo do limite', async () => {
    const subscriptionBelowLimit = {
      ...MOCK_SUBSCRIPTION,
      status: 'ACTIVE',
      sessionsUsedThisCycle: { [PROCEDURE_ID]: 1 }, // abaixo de sessionsPerCycle (2)
    } as unknown as PatientSubscription
    vi.mocked(prisma.patientSubscription.findFirst).mockResolvedValue(subscriptionBelowLimit)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(201)
    expect(prisma.appointment.create).toHaveBeenCalledOnce()
  })

  it('não aplica limite de sessões quando assinatura está PENDING (admin ainda não ativou)', async () => {
    const subscriptionPending = {
      ...MOCK_SUBSCRIPTION,
      status: 'PENDING',
      sessionsUsedThisCycle: { [PROCEDURE_ID]: 99 }, // qualquer valor — PENDING não bloqueia
    } as unknown as PatientSubscription
    vi.mocked(prisma.patientSubscription.findFirst).mockResolvedValue(subscriptionPending)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(201)
  })
})
