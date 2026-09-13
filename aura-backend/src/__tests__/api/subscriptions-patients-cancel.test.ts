// aura-backend/src/__tests__/api/subscriptions-patients-cancel.test.ts
// Testes para PUT /api/subscriptions/patients/[id]/cancel

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    patientSubscription: { findFirst: vi.fn(), update: vi.fn() },
    appointment: { findMany: vi.fn(), update: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))
vi.mock('@/lib/apiGuards', () => ({ checkWriteAccess: vi.fn() }))

import { PUT } from '../../app/api/subscriptions/patients/[id]/cancel/route'
import { getAuthUser } from '@/lib/auth'
import { checkWriteAccess } from '@/lib/apiGuards'
import prisma from '@/lib/prisma'

const ADMIN = { id: 'u1', email: 'admin@clinica.com', role: 'ADMIN', companyId: 'c1' }
const PATIENT = { id: 'u3', email: 'paciente@email.com', role: 'PATIENT', companyId: 'c1' }
const ESTHETICIAN = { id: 'u4', email: 'esteticista@clinica.com', role: 'ESTHETICIAN', companyId: 'c1' }

function makeRequest() {
  return new NextRequest('http://localhost/api/subscriptions/patients/sub1/cancel', { method: 'PUT' })
}
function makeParams() {
  return { params: Promise.resolve({ id: 'sub1' }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(checkWriteAccess).mockResolvedValue(null)
  vi.mocked(prisma.patientSubscription.update).mockResolvedValue({ id: 'sub1', status: 'CANCELED' } as never)
})

describe('PUT /api/subscriptions/patients/[id]/cancel', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await PUT(makeRequest(), makeParams())
    expect(res.status).toBe(401)
  })

  it('retorna 404 quando a assinatura não existe', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.patientSubscription.findFirst).mockResolvedValue(null)
    const res = await PUT(makeRequest(), makeParams())
    expect(res.status).toBe(404)
  })

  it('retorna 409 quando a assinatura já está cancelada', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.patientSubscription.findFirst).mockResolvedValue({ id: 'sub1', status: 'CANCELED', companyId: 'c1' } as never)
    const res = await PUT(makeRequest(), makeParams())
    expect(res.status).toBe(409)
  })

  it('cancela assinatura ACTIVE sem mexer em agendamentos', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.patientSubscription.findFirst).mockResolvedValue({ id: 'sub1', status: 'ACTIVE', companyId: 'c1' } as never)

    const res = await PUT(makeRequest(), makeParams())

    expect(res.status).toBe(200)
    expect(prisma.appointment.findMany).not.toHaveBeenCalled()
    expect(prisma.patientSubscription.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'sub1' }, data: { status: 'CANCELED' } })
    )
  })

  it('ao cancelar assinatura PENDING, restaura o preço original dos agendamentos vinculados pendentes', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.patientSubscription.findFirst).mockResolvedValue({ id: 'sub1', status: 'PENDING', companyId: 'c1' } as never)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      { id: 'appt1', procedure: { price: 150 } },
      { id: 'appt2', procedure: { price: 80 } },
    ] as never)
    vi.mocked(prisma.appointment.update).mockResolvedValue({} as never)

    const res = await PUT(makeRequest(), makeParams())

    expect(res.status).toBe(200)
    expect(prisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { subscriptionId: 'sub1', companyId: 'c1', status: 'PENDING_APPROVAL' },
      })
    )
    expect(prisma.appointment.update).toHaveBeenCalledWith({ where: { id: 'appt1' }, data: { price: 150 } })
    expect(prisma.appointment.update).toHaveBeenCalledWith({ where: { id: 'appt2' }, data: { price: 80 } })
  })

  it('não quebra se um agendamento PENDING vinculado não tiver procedimento', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.patientSubscription.findFirst).mockResolvedValue({ id: 'sub1', status: 'PENDING', companyId: 'c1' } as never)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([{ id: 'appt1', procedure: null }] as never)

    const res = await PUT(makeRequest(), makeParams())

    expect(res.status).toBe(200)
    expect(prisma.appointment.update).not.toHaveBeenCalled()
  })

  // ── RBAC — auditoria "cliente-planos-assinaturas" ──
  // Antes desta correção não havia NENHUMA checagem de role nesta rota:
  // checkWriteAccess só valida modo somente-leitura do plano da empresa, e o
  // `findFirst` só restringe por companyId — nunca por dono da assinatura. Um
  // PATIENT autenticado conseguia cancelar a assinatura de QUALQUER OUTRO
  // paciente da mesma empresa (sabotagem entre pacientes), já que a rota nunca
  // verificava se `subscription.patientId` correspondia ao paciente autenticado
  // nem se o autor tinha papel de equipe.
  it('retorna 403 quando um PATIENT tenta cancelar uma assinatura (rota é só para a equipe da clínica)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(PATIENT as never)
    const res = await PUT(makeRequest(), makeParams())
    expect(res.status).toBe(403)
    expect(prisma.patientSubscription.update).not.toHaveBeenCalled()
  })

  it('retorna 403 quando um ESTHETICIAN (sem permissão de billing) tenta cancelar', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ESTHETICIAN as never)
    const res = await PUT(makeRequest(), makeParams())
    expect(res.status).toBe(403)
  })

  it('permite RECEPTIONIST cancelar (papel de equipe com permissão de billing)', async () => {
    const RECEPTIONIST = { id: 'u5', email: 'recepcao@clinica.com', role: 'RECEPTIONIST', companyId: 'c1' }
    vi.mocked(getAuthUser).mockResolvedValue(RECEPTIONIST as never)
    vi.mocked(prisma.patientSubscription.findFirst).mockResolvedValue({ id: 'sub1', status: 'ACTIVE', companyId: 'c1' } as never)
    const res = await PUT(makeRequest(), makeParams())
    expect(res.status).toBe(200)
  })
})
