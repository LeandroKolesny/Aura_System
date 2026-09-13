// aura-backend/src/__tests__/api/auth-me.test.ts
// Testes para GET /api/auth/me

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: { user: { findUnique: vi.fn() }, patient: { findFirst: vi.fn() } },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))

import { GET } from '../../app/api/auth/me/route'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

const AUTH_USER = { id: 'u1', email: 'user@email.com', role: 'ADMIN', companyId: 'c1' }
const AUTH_PATIENT_USER = { id: 'u3', email: 'paciente@email.com', role: 'PATIENT', companyId: 'c1' }

const DB_USER = {
  id: 'u1', email: 'user@email.com', name: 'User Test', avatar: null, role: 'ADMIN', isActive: true,
  phone: null, createdAt: new Date('2026-01-01'),
  company: { id: 'c1', name: 'Clínica Teste', slug: 'clinica-teste', logo: null, plan: 'FREE', state: 'SP', subscriptionStatus: 'TRIAL', subscriptionExpiresAt: null, onboardingCompleted: true, businessHours: {} },
}

const DB_PATIENT_USER = {
  ...DB_USER, id: 'u3', email: 'paciente@email.com', role: 'PATIENT',
}

function makeRequest(cookieValue?: string) {
  const req = new NextRequest('http://localhost/api/auth/me')
  if (cookieValue !== undefined) {
    req.cookies.set('aura_session', cookieValue)
  }
  return req
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/auth/me', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('retorna 404 quando o usuário autenticado não existe mais no banco', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(AUTH_USER as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    const res = await GET(makeRequest())
    expect(res.status).toBe(404)
  })

  it('retorna os dados do usuário e da empresa em caso de sucesso', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(AUTH_USER as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(DB_USER as never)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.user.id).toBe('u1')
    expect(body.user.company.slug).toBe('clinica-teste')
  })

  it('busca o usuário filtrando apenas os campos necessários (sem senha)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(AUTH_USER as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(DB_USER as never)

    await GET(makeRequest())

    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        select: expect.not.objectContaining({ password: true }),
      })
    )
  })

  it('retorna o token lido do cookie httpOnly aura_session', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(AUTH_USER as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(DB_USER as never)

    const res = await GET(makeRequest('cookie-jwt-value'))
    const body = await res.json()

    expect(body.token).toBe('cookie-jwt-value')
  })

  it('retorna token null quando não há cookie de sessão', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(AUTH_USER as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(DB_USER as never)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.token).toBeNull()
  })

  it('retorna 500 em caso de erro inesperado', async () => {
    vi.mocked(getAuthUser).mockRejectedValue(new Error('db down'))
    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
  })
})

// BUG CONFIRMADO (pages/Schedule.tsx e PatientPortalApp.tsx dependem de
// user.patientId para saber quais agendamentos são do próprio paciente — ver
// currentPatientId em Schedule.tsx e getNextAppointment em PatientPortalApp.tsx).
// POST /api/auth/login já resolve e retorna patientId (ver login/route.ts), mas
// GET /api/auth/me (usado para restaurar a sessão via cookie a cada reload da
// página) nunca buscava nem retornava esse campo — a cada F5 o paciente perdia
// user.patientId e a UI passava a tratar agendamentos de OUTROS pacientes como
// se fossem dele (ou o inverso), pois currentPatientId virava null/undefined.
describe('GET /api/auth/me — patientId para role PATIENT', () => {
  it('retorna o patientId resolvido quando o usuário logado é PATIENT', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(AUTH_PATIENT_USER as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(DB_PATIENT_USER as never)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'patient-001' } as never)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.user.patientId).toBe('patient-001')
    expect(prisma.patient.findFirst).toHaveBeenCalledWith({
      where: { email: 'paciente@email.com', companyId: 'c1' },
      select: { id: true },
    })
  })

  it('retorna patientId null quando não há registro Patient correspondente', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(AUTH_PATIENT_USER as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(DB_PATIENT_USER as never)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(null)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.user.patientId).toBeNull()
  })

  it('NÃO busca patientId (nem o inclui) para roles que não são PATIENT', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(AUTH_USER as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(DB_USER as never)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(prisma.patient.findFirst).not.toHaveBeenCalled()
    expect(body.user.patientId).toBeUndefined()
  })
})
