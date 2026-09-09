// aura-backend/src/__tests__/api/patients-consent-history.test.ts
// Testes para GET /api/patients/[id]/consent/history

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    patient: { findFirst: vi.fn() },
    patientConsentSignatureHistory: { findMany: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))

import { GET } from '../../app/api/patients/[id]/consent/history/route'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

const ADMIN = { id: 'u1', email: 'admin@clinica.com', role: 'ADMIN', companyId: 'c1' }
const PATIENT_USER = { id: 'u2', email: 'paciente@email.com', role: 'PATIENT', companyId: 'c1' }

function makeGetRequest() {
  return new NextRequest('http://localhost/api/patients/p1/consent/history')
}
function makeParams(id = 'p1') {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/patients/[id]/consent/history', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await GET(makeGetRequest(), makeParams())
    expect(res.status).toBe(401)
  })

  it('SECURITY: bloqueia role PATIENT de ver o histórico de assinaturas', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(PATIENT_USER as never)
    const res = await GET(makeGetRequest(), makeParams())
    expect(res.status).toBe(403)
    expect(prisma.patientConsentSignatureHistory.findMany).not.toHaveBeenCalled()
  })

  it('retorna 404 quando o paciente não existe (ou não pertence à empresa)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(null)
    const res = await GET(makeGetRequest(), makeParams())
    expect(res.status).toBe(404)
  })

  it('retorna o histórico completo em ordem cronológica', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1' } as never)
    const history = [
      { id: 'h1', signatureUrl: 'data:...v1', signedAt: new Date('2026-01-01'), documentVersion: '1.0', correctionReason: null },
      { id: 'h2', signatureUrl: 'data:...v2', signedAt: new Date('2026-01-05'), documentVersion: '1.0', correctionReason: 'Assinatura ilegível' },
    ]
    vi.mocked(prisma.patientConsentSignatureHistory.findMany).mockResolvedValue(history as never)

    const res = await GET(makeGetRequest(), makeParams())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.history).toHaveLength(2)
    expect(prisma.patientConsentSignatureHistory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { patientId: 'p1' }, orderBy: { signedAt: 'asc' } })
    )
  })

  it('retorna 500 e não vaza detalhes internos quando o banco falha', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.patient.findFirst).mockRejectedValue(new Error('db down'))
    const res = await GET(makeGetRequest(), makeParams())
    expect(res.status).toBe(500)
  })
})
