// src/__tests__/api/appointments-get.test.ts
//
// Testes para GET /api/appointments (listagem, usada por loadAppointments no
// frontend). Esse endpoint ficou sem nenhum teste até agora — o arquivo
// appointments-post.test.ts, apesar do nome genérico "appointments", só
// cobre o POST. Cobertura aqui inclui o caso sensível de privacidade: quando
// um PATIENT lista os agendamentos (para ver horários ocupados), os dados de
// OUTROS pacientes devem vir anonimizados (nome "Ocupado", sem telefone/e-mail/
// notas/assinatura) — só o próprio agendamento do paciente mantém os dados reais.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    appointment: { findMany: vi.fn(), count: vi.fn() },
    patient: { findFirst: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
}))

import { GET } from '../../app/api/appointments/route'
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

const COMPANY_ID = 'company-001'
const PATIENT_ID = 'patient-001'
const OTHER_PATIENT_ID = 'patient-002'

const MOCK_ADMIN_USER = { id: 'user-001', email: 'admin@clinica.com', role: 'ADMIN', companyId: COMPANY_ID }
const MOCK_PATIENT_USER = { id: 'user-002', email: 'paciente@email.com', role: 'PATIENT', companyId: COMPANY_ID }

const OWN_APPOINTMENT = {
  id: 'appt-own', date: new Date().toISOString(), durationMinutes: 60, price: 150,
  status: 'SCHEDULED', notes: 'Nota privada', paid: false, roomId: null,
  signatureUrl: 'https://x/assinatura.png', signatureMetadata: { ip: '1.2.3.4' },
  companyId: COMPANY_ID, patientId: PATIENT_ID, professionalId: 'prof-1', procedureId: 'proc-1',
  patient: { id: PATIENT_ID, name: 'Maria Silva', phone: '11999990000', email: 'maria@x.com' },
  professional: { id: 'prof-1', name: 'Dr. João' },
  procedure: { id: 'proc-1', name: 'Limpeza', durationMinutes: 60 },
}

const OTHER_APPOINTMENT = {
  ...OWN_APPOINTMENT,
  id: 'appt-other', patientId: OTHER_PATIENT_ID,
  notes: 'Nota privada de outro paciente',
  patient: { id: OTHER_PATIENT_ID, name: 'Carlos Souza', phone: '11888880000', email: 'carlos@x.com' },
}

function makeRequest(query: string = '') {
  return new NextRequest(`http://localhost/api/appointments${query}`)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAuthUser).mockResolvedValue(MOCK_ADMIN_USER as never)
  vi.mocked(prisma.appointment.findMany).mockResolvedValue([OWN_APPOINTMENT] as never)
  vi.mocked(prisma.appointment.count).mockResolvedValue(1)
  vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: PATIENT_ID } as never)
})

describe('GET /api/appointments', () => {
  it('retorna 401 sem autenticação', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('retorna 403 quando o usuário não tem empresa associada', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ ...MOCK_ADMIN_USER, companyId: null } as never)
    const res = await GET(makeRequest())
    expect(res.status).toBe(403)
  })

  it('retorna 400 quando os parâmetros de query são inválidos', async () => {
    const res = await GET(makeRequest('?status=INVALIDO'))
    expect(res.status).toBe(400)
  })

  it('staff (ADMIN) lista os agendamentos da própria empresa com paginação', async () => {
    const res = await GET(makeRequest('?page=1&limit=50'))
    const body = await res.json()

    expect(prisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ companyId: COMPANY_ID }) })
    )
    expect(res.status).toBe(200)
    expect(body.appointments).toHaveLength(1)
    expect(body.pagination).toEqual({ page: 1, limit: 50, total: 1, totalPages: 1 })
  })

  it('staff: dados do paciente NÃO são anonimizados', async () => {
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.appointments[0].patient.name).toBe('Maria Silva')
    expect(body.appointments[0].notes).toBe('Nota privada')
  })

  it('aplica filtros de professionalId, patientId e status na query do Prisma', async () => {
    await GET(makeRequest('?professionalId=prof-1&patientId=patient-001&status=SCHEDULED'))
    expect(prisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ professionalId: 'prof-1', patientId: 'patient-001', status: 'SCHEDULED' }),
      })
    )
  })

  it('status=all não filtra por status', async () => {
    await GET(makeRequest('?status=all'))
    expect(prisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.not.objectContaining({ status: expect.anything() }) })
    )
  })

  it('REGRESSÃO CRÍTICA DE PRIVACIDADE: PATIENT vê o próprio agendamento com dados completos', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(MOCK_PATIENT_USER as never)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([OWN_APPOINTMENT, OTHER_APPOINTMENT] as never)
    vi.mocked(prisma.appointment.count).mockResolvedValue(2)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: PATIENT_ID } as never)

    const res = await GET(makeRequest())
    const body = await res.json()

    const own = body.appointments.find((a: { id: string }) => a.id === 'appt-own')
    expect(own.patient.name).toBe('Maria Silva')
    expect(own.patient.phone).toBe('11999990000')
    expect(own.notes).toBe('Nota privada')
  })

  it('REGRESSÃO CRÍTICA DE PRIVACIDADE: PATIENT vê agendamento de OUTRO paciente anonimizado (não vaza nome/telefone/e-mail/notas/assinatura)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(MOCK_PATIENT_USER as never)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([OWN_APPOINTMENT, OTHER_APPOINTMENT] as never)
    vi.mocked(prisma.appointment.count).mockResolvedValue(2)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: PATIENT_ID } as never)

    const res = await GET(makeRequest())
    const body = await res.json()

    const other = body.appointments.find((a: { id: string }) => a.id === 'appt-other')
    expect(other.patient.name).toBe('Ocupado')
    expect(other.patient.phone).toBe('')
    expect(other.patient.email).toBe('')
    expect(other.notes).toBe('')
    expect(other.signatureUrl).toBe('')
    expect(other.signatureMetadata).toEqual({})
    // ID do paciente é mantido (necessário pro frontend saber que o slot está ocupado)
    expect(other.patient.id).toBe(OTHER_PATIENT_ID)
  })

  it('retorna 500 quando o Prisma lança erro', async () => {
    vi.mocked(prisma.appointment.findMany).mockRejectedValue(new Error('DB down'))
    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
  })
})
