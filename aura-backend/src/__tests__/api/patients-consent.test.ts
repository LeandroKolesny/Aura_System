// aura-backend/src/__tests__/api/patients-consent.test.ts
// Testes para POST/GET /api/patients/[id]/consent

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    patient: { findFirst: vi.fn(), update: vi.fn() },
    activity: { create: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))

import { POST, GET } from '../../app/api/patients/[id]/consent/route'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

const ADMIN = { id: 'u1', email: 'admin@clinica.com', role: 'ADMIN', companyId: 'c1' }

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

  it('retorna 404 quando o paciente não existe', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(null)
    const res = await POST(makePostRequest({ signatureUrl: 'x' }), makeParams())
    expect(res.status).toBe(404)
  })

  it('retorna 400 quando a assinatura está ausente', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1', name: 'Paciente Teste' } as never)
    const res = await POST(makePostRequest({}), makeParams())
    expect(res.status).toBe(400)
  })

  it('assina o consentimento capturando IP e user-agent para auditoria', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1', name: 'Paciente Teste' } as never)
    vi.mocked(prisma.patient.update).mockResolvedValue({ id: 'p1', consentSignedAt: new Date('2026-01-01') } as never)

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
    expect(prisma.activity.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'CONSENT_SIGNED', ipAddress: '1.2.3.4', userAgent: 'TestAgent/1.0' }) })
    )
  })

  it('usa "unknown" quando IP e user-agent não estão presentes nos headers', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1', name: 'Paciente Teste' } as never)
    vi.mocked(prisma.patient.update).mockResolvedValue({ id: 'p1', consentSignedAt: new Date() } as never)

    await POST(makePostRequest({ signatureUrl: 'x' }), makeParams())

    expect(prisma.patient.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ consentMetadata: expect.objectContaining({ ipAddress: 'unknown', userAgent: 'unknown' }) }) })
    )
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
