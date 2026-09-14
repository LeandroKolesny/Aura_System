// aura-backend/src/__tests__/api/subscriptions-patients-my.test.ts
// Testes para GET /api/subscriptions/patients/my

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    patient: { findFirst: vi.fn() },
    patientSubscription: { findMany: vi.fn() },
    appointment: { findMany: vi.fn().mockResolvedValue([]) },
  },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))

import { GET } from '../../app/api/subscriptions/patients/my/route'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

const PATIENT_USER = { id: 'u1', email: 'paciente@email.com', role: 'PATIENT', companyId: 'c1' }

function makeRequest() {
  return new NextRequest('http://localhost/api/subscriptions/patients/my')
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.appointment.findMany).mockResolvedValue([])
})

describe('GET /api/subscriptions/patients/my', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('retorna lista vazia quando usuário não tem empresa', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ ...PATIENT_USER, companyId: null } as never)
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data).toEqual([])
  })

  it('retorna lista vazia quando não há registro de paciente correspondente', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(PATIENT_USER as never)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(null)
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.data).toEqual([])
  })

  it('busca apenas assinaturas PENDING, ACTIVE ou PAUSED', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(PATIENT_USER as never)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1' } as never)
    vi.mocked(prisma.patientSubscription.findMany).mockResolvedValue([])

    await GET(makeRequest())

    expect(prisma.patientSubscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { in: ['PENDING', 'ACTIVE', 'PAUSED'] } }),
      })
    )
  })

  it('calcula sessões usadas e restantes corretamente por procedimento', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(PATIENT_USER as never)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1' } as never)
    vi.mocked(prisma.patientSubscription.findMany).mockResolvedValue([{
      id: 'sub1', status: 'ACTIVE', startDate: new Date(), nextBillingDate: new Date(), lastCycleReset: new Date(),
      sessionsUsedThisCycle: { proc1: 2 },
      plan: {
        id: 'plan1', name: 'Plano Mensal', price: 150, description: 'desc', imageUrl: null,
        items: [
          { procedureId: 'proc1', sessionsPerCycle: 4, procedure: { id: 'proc1', name: 'Limpeza', durationMinutes: 60 } },
        ],
      },
    }] as never)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.data[0].items[0]).toEqual({
      procedureId: 'proc1', procedureName: 'Limpeza', sessionsPerCycle: 4, sessionsUsed: 2, sessionsRemaining: 2,
    })
  })

  it('nunca retorna sessionsRemaining negativo mesmo se sessionsUsed exceder o limite do ciclo', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(PATIENT_USER as never)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1' } as never)
    vi.mocked(prisma.patientSubscription.findMany).mockResolvedValue([{
      id: 'sub1', status: 'ACTIVE', startDate: new Date(), nextBillingDate: new Date(), lastCycleReset: new Date(),
      sessionsUsedThisCycle: { proc1: 10 },
      plan: {
        id: 'plan1', name: 'Plano Mensal', price: 150, description: null, imageUrl: null,
        items: [
          { procedureId: 'proc1', sessionsPerCycle: 4, procedure: { id: 'proc1', name: 'Limpeza', durationMinutes: 60 } },
        ],
      },
    }] as never)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.data[0].items[0].sessionsRemaining).toBe(0)
  })

  it('trata sessionsUsedThisCycle nulo como zero para todos os procedimentos', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(PATIENT_USER as never)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1' } as never)
    vi.mocked(prisma.patientSubscription.findMany).mockResolvedValue([{
      id: 'sub1', status: 'ACTIVE', startDate: new Date(), nextBillingDate: new Date(), lastCycleReset: new Date(),
      sessionsUsedThisCycle: null,
      plan: {
        id: 'plan1', name: 'Plano Mensal', price: 150, description: null, imageUrl: null,
        items: [
          { procedureId: 'proc1', sessionsPerCycle: 4, procedure: { id: 'proc1', name: 'Limpeza', durationMinutes: 60 } },
        ],
      },
    }] as never)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.data[0].items[0].sessionsUsed).toBe(0)
    expect(body.data[0].items[0].sessionsRemaining).toBe(4)
  })

  // Bug relatado: "Meus Planos" sempre mostrava "Agende sua primeira sessão"
  // para uma assinatura PENDING, mesmo quando o paciente já tinha agendado
  // (o agendamento fica PENDING_APPROVAL até o admin aprovar — só aí a
  // assinatura vira ACTIVE). A tela não tinha como saber que já existia um
  // agendamento aguardando aprovação.
  describe('hasPendingAppointment (assinatura PENDING já tem sessão agendada aguardando aprovação)', () => {
    const PENDING_SUB = {
      id: 'sub1', status: 'PENDING', startDate: new Date(), nextBillingDate: new Date(), lastCycleReset: new Date(),
      sessionsUsedThisCycle: {},
      plan: {
        id: 'plan1', name: 'Plano Mensal', price: 150, description: null, imageUrl: null,
        items: [
          { procedureId: 'proc1', sessionsPerCycle: 4, procedure: { id: 'proc1', name: 'Limpeza', durationMinutes: 60 } },
        ],
      },
    }

    it('assinatura PENDING sem nenhum agendamento vinculado → hasPendingAppointment: false', async () => {
      vi.mocked(getAuthUser).mockResolvedValue(PATIENT_USER as never)
      vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1' } as never)
      vi.mocked(prisma.patientSubscription.findMany).mockResolvedValue([PENDING_SUB] as never)
      vi.mocked(prisma.appointment.findMany).mockResolvedValue([])

      const res = await GET(makeRequest())
      const body = await res.json()

      expect(body.data[0].hasPendingAppointment).toBe(false)
    })

    it('assinatura PENDING com agendamento PENDING_APPROVAL vinculado → hasPendingAppointment: true', async () => {
      vi.mocked(getAuthUser).mockResolvedValue(PATIENT_USER as never)
      vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1' } as never)
      vi.mocked(prisma.patientSubscription.findMany).mockResolvedValue([PENDING_SUB] as never)
      vi.mocked(prisma.appointment.findMany).mockResolvedValue([
        { subscriptionId: 'sub1' },
      ] as never)

      const res = await GET(makeRequest())
      const body = await res.json()

      expect(body.data[0].hasPendingAppointment).toBe(true)
      expect(prisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            subscriptionId: { in: ['sub1'] },
            status: 'PENDING_APPROVAL',
          }),
        })
      )
    })

    it('não consulta PENDING_APPROVAL quando não há nenhuma assinatura PENDING (evita query desnecessária)', async () => {
      // Só não há a consulta de hasPendingAppointment — a assinatura ACTIVE
      // ainda dispara sua própria consulta (nextAppointment, ver describe abaixo).
      vi.mocked(getAuthUser).mockResolvedValue(PATIENT_USER as never)
      vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1' } as never)
      vi.mocked(prisma.patientSubscription.findMany).mockResolvedValue([
        { ...PENDING_SUB, id: 'sub2', status: 'ACTIVE' },
      ] as never)

      await GET(makeRequest())

      expect(prisma.appointment.findMany).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: 'PENDING_APPROVAL' }) })
      )
    })

    it('assinatura ACTIVE nunca precisa de hasPendingAppointment (sempre false, sem consultar agendamentos)', async () => {
      vi.mocked(getAuthUser).mockResolvedValue(PATIENT_USER as never)
      vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1' } as never)
      vi.mocked(prisma.patientSubscription.findMany).mockResolvedValue([
        { ...PENDING_SUB, id: 'sub2', status: 'ACTIVE' },
      ] as never)

      const res = await GET(makeRequest())
      const body = await res.json()

      expect(body.data[0].hasPendingAppointment).toBe(false)
    })
  })

  // Pedido do usuário: no card do plano ACTIVE, o botão "Consultar agenda"
  // precisa levar direto pro dia/horário da sessão vinculada — o próximo
  // agendamento futuro (SCHEDULED/CONFIRMED) se houver, senão o mais recente
  // já realizado.
  describe('nextAppointment (assinatura ACTIVE — pra "Consultar agenda" ir direto no dia certo)', () => {
    const ACTIVE_SUB = {
      id: 'sub2', status: 'ACTIVE', startDate: new Date(), nextBillingDate: new Date(), lastCycleReset: new Date(),
      sessionsUsedThisCycle: {},
      plan: {
        id: 'plan1', name: 'Plano Mensal', price: 150, description: null, imageUrl: null,
        items: [
          { procedureId: 'proc1', sessionsPerCycle: 4, procedure: { id: 'proc1', name: 'Limpeza', durationMinutes: 60 } },
        ],
      },
    }

    it('assinatura ACTIVE sem nenhum agendamento vinculado → nextAppointment: null', async () => {
      vi.mocked(getAuthUser).mockResolvedValue(PATIENT_USER as never)
      vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1' } as never)
      vi.mocked(prisma.patientSubscription.findMany).mockResolvedValue([ACTIVE_SUB] as never)
      vi.mocked(prisma.appointment.findMany).mockResolvedValue([])

      const res = await GET(makeRequest())
      const body = await res.json()

      expect(body.data[0].nextAppointment).toBeNull()
      expect(prisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            subscriptionId: { in: ['sub2'] },
            status: { in: ['SCHEDULED', 'CONFIRMED'] },
          }),
          orderBy: { date: 'asc' },
        })
      )
    })

    it('com um agendamento futuro → nextAppointment aponta pra ele', async () => {
      vi.mocked(getAuthUser).mockResolvedValue(PATIENT_USER as never)
      vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1' } as never)
      vi.mocked(prisma.patientSubscription.findMany).mockResolvedValue([ACTIVE_SUB] as never)
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      vi.mocked(prisma.appointment.findMany).mockResolvedValue([
        { id: 'appt-future', date: futureDate, subscriptionId: 'sub2' },
      ] as never)

      const res = await GET(makeRequest())
      const body = await res.json()

      expect(body.data[0].nextAppointment).toEqual({ id: 'appt-future', date: futureDate.toISOString() })
    })

    it('com dois agendamentos futuros → escolhe o mais PRÓXIMO (menor data), não o mais distante', async () => {
      vi.mocked(getAuthUser).mockResolvedValue(PATIENT_USER as never)
      vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1' } as never)
      vi.mocked(prisma.patientSubscription.findMany).mockResolvedValue([ACTIVE_SUB] as never)
      const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
      const later = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000)
      // A rota espera a lista já ordenada asc (é o que orderBy:{date:'asc'} garante de verdade) —
      // o mock aqui já simula essa ordem.
      vi.mocked(prisma.appointment.findMany).mockResolvedValue([
        { id: 'appt-soon', date: soon, subscriptionId: 'sub2' },
        { id: 'appt-later', date: later, subscriptionId: 'sub2' },
      ] as never)

      const res = await GET(makeRequest())
      const body = await res.json()

      expect(body.data[0].nextAppointment.id).toBe('appt-soon')
    })

    it('só com agendamentos PASSADOS (todos já ocorreram) → escolhe o mais RECENTE (maior data)', async () => {
      vi.mocked(getAuthUser).mockResolvedValue(PATIENT_USER as never)
      vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1' } as never)
      vi.mocked(prisma.patientSubscription.findMany).mockResolvedValue([ACTIVE_SUB] as never)
      const olderPast = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000)
      const recentPast = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      vi.mocked(prisma.appointment.findMany).mockResolvedValue([
        { id: 'appt-older', date: olderPast, subscriptionId: 'sub2' },
        { id: 'appt-recent', date: recentPast, subscriptionId: 'sub2' },
      ] as never)

      const res = await GET(makeRequest())
      const body = await res.json()

      expect(body.data[0].nextAppointment.id).toBe('appt-recent')
    })

    it('assinatura PENDING/PAUSED nunca calcula nextAppointment (fica null, sem consultar)', async () => {
      vi.mocked(getAuthUser).mockResolvedValue(PATIENT_USER as never)
      vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1' } as never)
      vi.mocked(prisma.patientSubscription.findMany).mockResolvedValue([
        { ...ACTIVE_SUB, id: 'sub3', status: 'PAUSED' },
      ] as never)

      const res = await GET(makeRequest())
      const body = await res.json()

      expect(body.data[0].nextAppointment).toBeNull()
      expect(prisma.appointment.findMany).not.toHaveBeenCalled()
    })
  })
})
