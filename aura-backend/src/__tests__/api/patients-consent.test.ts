// aura-backend/src/__tests__/api/patients-consent.test.ts
// Testes para POST/GET /api/patients/[id]/consent

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    patient: { findFirst: vi.fn(), update: vi.fn() },
    patientConsentSignatureHistory: { create: vi.fn() },
    activity: { create: vi.fn() },
    $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)) as unknown,
  },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))

import { POST, GET } from '../../app/api/patients/[id]/consent/route'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

const ADMIN = { id: 'u1', email: 'admin@clinica.com', role: 'ADMIN', companyId: 'c1' }
const RECEPTIONIST = { id: 'u2', email: 'recep@clinica.com', role: 'RECEPTIONIST', companyId: 'c1' }
const PATIENT_USER = { id: 'u3', email: 'paciente@email.com', role: 'PATIENT', companyId: 'c1' }

const MOCK_PATIENT = { id: 'p1', name: 'Paciente Teste', consentSignatureUrl: null }
const MOCK_ALREADY_SIGNED_PATIENT = { ...MOCK_PATIENT, consentSignatureUrl: 'data:image/png;base64,assinatura-antiga' }

function makePostRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/patients/p1/consent', {
    method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', ...headers },
  })
}
function makeGetRequest() {
  return new NextRequest('http://localhost/api/patients/p1/consent')
}
function makeParams(id = 'p1') {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.$transaction).mockImplementation(((ops: Promise<unknown>[]) => Promise.all(ops)) as never)
})

describe('POST /api/patients/[id]/consent', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await POST(makePostRequest({ signatureUrl: 'data:image/png;base64,xxx' }), makeParams())
    expect(res.status).toBe(401)
  })

  it('retorna 403 quando o usuário não tem empresa', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ ...ADMIN, companyId: null } as never)
    const res = await POST(makePostRequest({ signatureUrl: 'x' }), makeParams())
    expect(res.status).toBe(403)
  })

  it('SECURITY: bloqueia role PATIENT de assinar/corrigir o consentimento (só a equipe faz isso na ficha)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(PATIENT_USER as never)
    const res = await POST(makePostRequest({ signatureUrl: 'data:image/png;base64,xxx' }), makeParams())
    expect(res.status).toBe(403)
    expect(prisma.patient.findFirst).not.toHaveBeenCalled()
  })

  it('permite RECEPTIONIST assinar em nome do paciente', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(RECEPTIONIST as never)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(MOCK_PATIENT as never)
    vi.mocked(prisma.patient.update).mockResolvedValue({ id: 'p1', consentSignedAt: new Date() } as never)
    const res = await POST(makePostRequest({ signatureUrl: 'data:image/png;base64,xxx' }), makeParams())
    expect(res.status).toBe(200)
  })

  it('retorna 404 quando o paciente não existe', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(null)
    const res = await POST(makePostRequest({ signatureUrl: 'x' }), makeParams())
    expect(res.status).toBe(404)
  })

  it('retorna 400 quando a assinatura está ausente', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(MOCK_PATIENT as never)
    const res = await POST(makePostRequest({}), makeParams())
    expect(res.status).toBe(400)
  })

  it('assina o consentimento capturando IP e user-agent para auditoria, e registra no histórico', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(MOCK_PATIENT as never)
    vi.mocked(prisma.patient.update).mockResolvedValue({
      id: 'p1',
      consentSignedAt: new Date('2026-01-01'),
      consentSignatureUrl: 'data:image/png;base64,xxx',
      consentCorrectionCount: 0,
      lastConsentCorrectionAt: null,
      lastConsentCorrectionReason: null,
    } as never)
    vi.mocked(prisma.patientConsentSignatureHistory.create).mockResolvedValue({ id: 'hist-1' } as never)

    const res = await POST(
      makePostRequest({ signatureUrl: 'data:image/png;base64,xxx' }, { 'x-forwarded-for': '1.2.3.4', 'user-agent': 'TestAgent/1.0' }),
      makeParams()
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(prisma.patient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'p1' },
        data: expect.objectContaining({
          consentSignatureUrl: 'data:image/png;base64,xxx',
          consentMetadata: expect.objectContaining({ ipAddress: '1.2.3.4', userAgent: 'TestAgent/1.0', signedBy: 'u1' }),
        }),
      })
    )
    expect(prisma.patientConsentSignatureHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ patientId: 'p1', signatureUrl: 'data:image/png;base64,xxx', correctionReason: null }),
      })
    )
    expect(prisma.activity.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'CONSENT_SIGNED', ipAddress: '1.2.3.4', userAgent: 'TestAgent/1.0' }) })
    )
  })

  it('usa "unknown" quando IP e user-agent não estão presentes nos headers', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(MOCK_PATIENT as never)
    vi.mocked(prisma.patient.update).mockResolvedValue({ id: 'p1', consentSignedAt: new Date() } as never)
    vi.mocked(prisma.patientConsentSignatureHistory.create).mockResolvedValue({ id: 'hist-1' } as never)

    await POST(makePostRequest({ signatureUrl: 'x' }), makeParams())

    expect(prisma.patient.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ consentMetadata: expect.objectContaining({ ipAddress: 'unknown', userAgent: 'unknown' }) }) })
    )
  })

  it('REGRESSÃO: corrigir uma assinatura já existente sem motivo é rejeitado (400) e nada é alterado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(MOCK_ALREADY_SIGNED_PATIENT as never)

    const res = await POST(makePostRequest({ signatureUrl: 'data:image/png;base64,nova' }), makeParams())

    expect(res.status).toBe(400)
    expect(prisma.patient.update).not.toHaveBeenCalled()
    expect(prisma.patientConsentSignatureHistory.create).not.toHaveBeenCalled()
  })

  it('permite corrigir uma assinatura existente informando o motivo, preservando a versão antiga no histórico', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(MOCK_ALREADY_SIGNED_PATIENT as never)
    vi.mocked(prisma.patient.update).mockResolvedValue({
      id: 'p1',
      consentSignedAt: new Date(),
      consentSignatureUrl: 'data:image/png;base64,nova',
      consentCorrectionCount: 1,
      lastConsentCorrectionAt: new Date(),
      lastConsentCorrectionReason: 'Assinatura ilegível',
    } as never)
    vi.mocked(prisma.patientConsentSignatureHistory.create).mockResolvedValue({ id: 'hist-2' } as never)

    const res = await POST(
      makePostRequest({ signatureUrl: 'data:image/png;base64,nova', correctionReason: 'Assinatura ilegível' }),
      makeParams()
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.consentCorrectionCount).toBe(1)
    expect(prisma.patientConsentSignatureHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ signatureUrl: 'data:image/png;base64,nova', correctionReason: 'Assinatura ilegível' }) })
    )
    expect(prisma.patient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ consentCorrectionCount: { increment: 1 }, lastConsentCorrectionReason: 'Assinatura ilegível' }),
      })
    )
    expect(prisma.activity.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'CONSENT_CORRECTED' }) })
    )
  })

  it('retorna 500 e não vaza detalhes internos quando o banco falha', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(MOCK_PATIENT as never)
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error('db down'))
    const res = await POST(makePostRequest({ signatureUrl: 'data:image/png;base64,xxx' }), makeParams())
    expect(res.status).toBe(500)
  })
})

describe('GET /api/patients/[id]/consent', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await GET(makeGetRequest(), makeParams())
    expect(res.status).toBe(401)
  })

  it('retorna 404 quando o paciente não existe', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(null)
    const res = await GET(makeGetRequest(), makeParams())
    expect(res.status).toBe(404)
  })

  it('retorna hasConsent=false quando o paciente nunca assinou', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1', consentSignedAt: null, consentMetadata: null } as never)

    const res = await GET(makeGetRequest(), makeParams())
    const body = await res.json()

    expect(body.hasConsent).toBe(false)
  })

  it('retorna hasConsent=true com data e metadados quando já assinado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    const signedAt = new Date('2026-01-01')
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1', consentSignedAt: signedAt, consentMetadata: { documentVersion: '1.0' } } as never)

    const res = await GET(makeGetRequest(), makeParams())
    const body = await res.json()

    expect(body.hasConsent).toBe(true)
    expect(body.metadata).toEqual({ documentVersion: '1.0' })
  })
})
