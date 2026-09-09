// aura-backend/src/__tests__/api/appointments-signature-history.test.ts
// Testes para GET /api/appointments/[id]/signature-history

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    appointment: { findFirst: vi.fn() },
    appointmentSignatureHistory: { findMany: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))

import { GET } from '../../app/api/appointments/[id]/signature-history/route'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

const STAFF = { id: 'u1', email: 'admin@clinica.com', role: 'ADMIN', companyId: 'c1' }
const PATIENT_USER = { id: 'u2', email: 'paciente@email.com', role: 'PATIENT', companyId: 'c1' }
const OTHER_PATIENT_USER = { id: 'u3', email: 'outro@email.com', role: 'PATIENT', companyId: 'c1' }

const MOCK_APPOINTMENT = {
  id: 'appt-1',
  companyId: 'c1',
  patient: { email: 'paciente@email.com' },
}

function makeGetRequest() {
  return new NextRequest('http://localhost/api/appointments/appt-1/signature-history')
}
function makeParams(id = 'appt-1') {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/appointments/[id]/signature-history', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await GET(makeGetRequest(), makeParams())
    expect(res.status).toBe(401)
  })

  it('retorna 404 quando o agendamento não existe (ou não pertence à empresa)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(STAFF as never)
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null)
    const res = await GET(makeGetRequest(), makeParams())
    expect(res.status).toBe(404)
  })

  it('SECURITY: bloqueia paciente tentando ver histórico de outro paciente', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(OTHER_PATIENT_USER as never)
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(MOCK_APPOINTMENT as never)
    const res = await GET(makeGetRequest(), makeParams())
    expect(res.status).toBe(403)
    expect(prisma.appointmentSignatureHistory.findMany).not.toHaveBeenCalled()
  })

  it('permite que a equipe veja o histórico completo, em ordem cronológica', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(STAFF as never)
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(MOCK_APPOINTMENT as never)
    const history = [
      { id: 'h1', signatureUrl: 'data:...v1', signedAt: new Date('2026-01-01'), documentVersion: 'v1.0-appt-consent', correctionReason: null },
      { id: 'h2', signatureUrl: 'data:...v2', signedAt: new Date('2026-01-05'), documentVersion: 'v1.0-appt-consent', correctionReason: 'Assinatura ilegível' },
    ]
    vi.mocked(prisma.appointmentSignatureHistory.findMany).mockResolvedValue(history as never)

    const res = await GET(makeGetRequest(), makeParams())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.history).toHaveLength(2)
    expect(prisma.appointmentSignatureHistory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { appointmentId: 'appt-1' }, orderBy: { signedAt: 'asc' } })
    )
  })

  it('permite que o próprio paciente veja o histórico do seu agendamento', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(PATIENT_USER as never)
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(MOCK_APPOINTMENT as never)
    vi.mocked(prisma.appointmentSignatureHistory.findMany).mockResolvedValue([] as never)

    const res = await GET(makeGetRequest(), makeParams())
    expect(res.status).toBe(200)
  })

  it('retorna 500 e não vaza detalhes internos quando o banco falha', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(STAFF as never)
    vi.mocked(prisma.appointment.findFirst).mockRejectedValue(new Error('db down'))
    const res = await GET(makeGetRequest(), makeParams())
    expect(res.status).toBe(500)
  })
})
