// aura-backend/src/__tests__/api/appointments-consent.test.ts
// Testes para POST /api/appointments/[id]/consent

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    appointment: { findFirst: vi.fn(), update: vi.fn() },
    appointmentSignatureHistory: { create: vi.fn() },
    activity: { create: vi.fn() },
    // Simula uma transação real: executa as operações (já invocadas, portanto
    // promises) em paralelo e retorna os resultados na mesma ordem.
    $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)) as unknown,
  },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))

import { POST } from '../../app/api/appointments/[id]/consent/route'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

const STAFF = { id: 'u1', email: 'admin@clinica.com', role: 'ADMIN', companyId: 'c1' }
const PATIENT_USER = { id: 'u2', email: 'paciente@email.com', role: 'PATIENT', companyId: 'c1' }
const OTHER_PATIENT_USER = { id: 'u3', email: 'outro@email.com', role: 'PATIENT', companyId: 'c1' }

const MOCK_APPOINTMENT = {
  id: 'appt-1',
  companyId: 'c1',
  signatureUrl: null,
  patient: { id: 'p1', name: 'Paciente Teste', email: 'paciente@email.com' },
}

const MOCK_ALREADY_SIGNED_APPOINTMENT = {
  ...MOCK_APPOINTMENT,
  signatureUrl: 'data:image/png;base64,assinatura-antiga',
}

function makePostRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/appointments/appt-1/consent', {
    method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', ...headers },
  })
}
function makeParams(id = 'appt-1') {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.$transaction).mockImplementation(((ops: Promise<unknown>[]) => Promise.all(ops)) as never)
})

describe('POST /api/appointments/[id]/consent', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await POST(makePostRequest({ signatureUrl: 'data:image/png;base64,xxx' }), makeParams())
    expect(res.status).toBe(401)
  })

  it('retorna 403 quando o usuário não tem empresa', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ ...STAFF, companyId: null } as never)
    const res = await POST(makePostRequest({ signatureUrl: 'x' }), makeParams())
    expect(res.status).toBe(403)
  })

  it('retorna 404 quando o agendamento não existe (ou não pertence à empresa)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(STAFF as never)
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null)
    const res = await POST(makePostRequest({ signatureUrl: 'x' }), makeParams())
    expect(res.status).toBe(404)
  })

  it('permite que a equipe (ADMIN/RECEPTIONIST/ESTHETICIAN/OWNER) assine em nome do paciente', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(STAFF as never)
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(MOCK_APPOINTMENT as never)
    vi.mocked(prisma.appointment.update).mockResolvedValue({ signatureUrl: 'x', signatureMetadata: {} } as never)

    const res = await POST(makePostRequest({ signatureUrl: 'data:image/png;base64,xxx' }), makeParams())
    expect(res.status).toBe(200)
  })

  it('permite que o próprio paciente (email correspondente) assine seu agendamento', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(PATIENT_USER as never)
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(MOCK_APPOINTMENT as never)
    vi.mocked(prisma.appointment.update).mockResolvedValue({ signatureUrl: 'x', signatureMetadata: {} } as never)

    const res = await POST(makePostRequest({ signatureUrl: 'data:image/png;base64,xxx' }), makeParams())
    expect(res.status).toBe(200)
  })

  it('SECURITY: bloqueia paciente tentando assinar agendamento de outro paciente', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(OTHER_PATIENT_USER as never)
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(MOCK_APPOINTMENT as never)

    const res = await POST(makePostRequest({ signatureUrl: 'data:image/png;base64,xxx' }), makeParams())
    expect(res.status).toBe(403)
    expect(prisma.appointment.update).not.toHaveBeenCalled()
  })

  it('retorna 400 quando a assinatura está ausente', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(STAFF as never)
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(MOCK_APPOINTMENT as never)
    const res = await POST(makePostRequest({}), makeParams())
    expect(res.status).toBe(400)
  })

  it('assina o consentimento capturando IP e user-agent para auditoria, e registra a assinatura no histórico', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(STAFF as never)
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(MOCK_APPOINTMENT as never)
    vi.mocked(prisma.appointment.update).mockResolvedValue({
      signatureUrl: 'data:image/png;base64,xxx',
      signatureMetadata: { ipAddress: '1.2.3.4', userAgent: 'TestAgent/1.0' },
      signatureCorrectionCount: 0,
      lastSignatureCorrectionAt: null,
      lastSignatureCorrectionReason: null,
    } as never)
    vi.mocked(prisma.appointmentSignatureHistory.create).mockResolvedValue({ id: 'hist-1' } as never)

    const res = await POST(
      makePostRequest({ signatureUrl: 'data:image/png;base64,xxx' }, { 'x-forwarded-for': '1.2.3.4', 'user-agent': 'TestAgent/1.0' }),
      makeParams()
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'appt-1' },
        data: expect.objectContaining({
          signatureUrl: 'data:image/png;base64,xxx',
          signatureMetadata: expect.objectContaining({ ipAddress: '1.2.3.4', userAgent: 'TestAgent/1.0', signedBy: 'u1' }),
        }),
      })
    )
    // Primeira assinatura: entra no histórico sem motivo de correção.
    expect(prisma.appointmentSignatureHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          appointmentId: 'appt-1',
          signatureUrl: 'data:image/png;base64,xxx',
          correctionReason: null,
        }),
      })
    )
    expect(prisma.activity.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'CONSENT_SIGNED' }) })
    )
  })

  it('REGRESSÃO: corrigir uma assinatura já existente sem motivo é rejeitado (400) e nada é alterado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(STAFF as never)
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(MOCK_ALREADY_SIGNED_APPOINTMENT as never)

    const res = await POST(makePostRequest({ signatureUrl: 'data:image/png;base64,nova' }), makeParams())

    expect(res.status).toBe(400)
    expect(prisma.appointment.update).not.toHaveBeenCalled()
    expect(prisma.appointmentSignatureHistory.create).not.toHaveBeenCalled()
  })

  it('permite corrigir uma assinatura existente informando o motivo, preservando a versão antiga no histórico', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(STAFF as never)
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(MOCK_ALREADY_SIGNED_APPOINTMENT as never)
    vi.mocked(prisma.appointment.update).mockResolvedValue({
      signatureUrl: 'data:image/png;base64,nova',
      signatureMetadata: {},
      signatureCorrectionCount: 1,
      lastSignatureCorrectionAt: new Date(),
      lastSignatureCorrectionReason: 'Assinatura ilegível',
    } as never)
    vi.mocked(prisma.appointmentSignatureHistory.create).mockResolvedValue({ id: 'hist-2' } as never)

    const res = await POST(
      makePostRequest({ signatureUrl: 'data:image/png;base64,nova', correctionReason: 'Assinatura ilegível' }),
      makeParams()
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.signatureCorrectionCount).toBe(1)
    // A assinatura antiga não é apagada — vira uma entrada no histórico com o motivo.
    expect(prisma.appointmentSignatureHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          signatureUrl: 'data:image/png;base64,nova',
          correctionReason: 'Assinatura ilegível',
        }),
      })
    )
    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          signatureCorrectionCount: { increment: 1 },
          lastSignatureCorrectionReason: 'Assinatura ilegível',
        }),
      })
    )
    expect(prisma.activity.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'CONSENT_CORRECTED' }) })
    )
  })

  it('retorna 500 e não vaza detalhes internos quando o banco falha', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(STAFF as never)
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(MOCK_APPOINTMENT as never)
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error('db down'))

    const res = await POST(makePostRequest({ signatureUrl: 'data:image/png;base64,xxx' }), makeParams())
    expect(res.status).toBe(500)
  })
})
