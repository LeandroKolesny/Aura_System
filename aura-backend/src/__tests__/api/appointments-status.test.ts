// src/__tests__/api/appointments-status.test.ts
// Testes para PATCH /api/appointments/[id]/status

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { Appointment, Activity } from '@prisma/client'

vi.mock('@/lib/prisma', () => ({
  default: {
    appointment: { findFirst: vi.fn(), update: vi.fn() },
    patient: { update: vi.fn() },
    procedure: { findUnique: vi.fn() },
    procedureSupply: { findMany: vi.fn() },
    inventoryItem: { update: vi.fn(), findUnique: vi.fn() },
    stockMovement: { create: vi.fn() },
    appNotification: { create: vi.fn() },
    transaction: { create: vi.fn() },
    activity: { create: vi.fn() },
    whatsappInstance: { findUnique: vi.fn() },
    company: { findUnique: vi.fn() },
    patientSubscription: { findFirst: vi.fn(), update: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
}))
vi.mock('@/lib/calendarSync', () => ({
  pushAppointmentToCalendar: vi.fn().mockResolvedValue(undefined),
  deleteCalendarEvent: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/whatsapp', () => ({
  sendTextMessage: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/whatsappMessages', () => ({
  buildConfirmationMessage: vi.fn().mockReturnValue('Mensagem de confirmação'),
  formatDate: vi.fn().mockReturnValue('01/01/2026'),
  formatTime: vi.fn().mockReturnValue('10:00'),
}))

import { PATCH } from '../../app/api/appointments/[id]/status/route'
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

// ── fixtures ──────────────────────────────────────────────────────────────────

const COMPANY_ID = 'company-001'
const APPOINTMENT_ID = 'appointment-001'
const PATIENT_ID = 'patient-001'
const PROCEDURE_ID = 'procedure-001'

const MOCK_ADMIN_USER = {
  id: 'user-001',
  role: 'ADMIN',
  companyId: COMPANY_ID,
}

const MOCK_APPOINTMENT_SCHEDULED = {
  id: APPOINTMENT_ID,
  status: 'SCHEDULED',
  stockDeducted: false,
  patientId: PATIENT_ID,
  procedureId: PROCEDURE_ID,
  date: new Date('2026-06-01T10:00:00Z'),
  price: 150,
  patient: { id: PATIENT_ID, name: 'Maria Silva', phone: '11999990000' },
  procedure: { id: PROCEDURE_ID, name: 'Limpeza', cost: 20 },
  professional: { id: 'prof-001', name: 'Profissional' },
} as unknown as Appointment

const MOCK_APPOINTMENT_CONFIRMED = {
  ...MOCK_APPOINTMENT_SCHEDULED,
  status: 'CONFIRMED',
} as unknown as Appointment

const MOCK_APPOINTMENT_COMPLETED = {
  ...MOCK_APPOINTMENT_SCHEDULED,
  status: 'COMPLETED',
  stockDeducted: true,
} as unknown as Appointment

const MOCK_UPDATED_APPOINTMENT = {
  id: APPOINTMENT_ID,
  status: 'CONFIRMED',
  patient: { id: PATIENT_ID, name: 'Maria Silva' },
  professional: { id: 'prof-001', name: 'Profissional' },
  procedure: { id: PROCEDURE_ID, name: 'Limpeza' },
} as unknown as Appointment

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest(`http://localhost/api/appointments/${APPOINTMENT_ID}/status`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

const ROUTE_PARAMS = { params: Promise.resolve({ id: APPOINTMENT_ID }) }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAuthUser).mockResolvedValue(MOCK_ADMIN_USER as never)
  vi.mocked(prisma.appointment.findFirst).mockResolvedValue(MOCK_APPOINTMENT_SCHEDULED)
  vi.mocked(prisma.appointment.update).mockResolvedValue(MOCK_UPDATED_APPOINTMENT)
  vi.mocked(prisma.patient.update).mockResolvedValue({} as never)
  vi.mocked(prisma.procedure.findUnique).mockResolvedValue({ cost: 20 } as never)
  vi.mocked(prisma.procedureSupply.findMany).mockResolvedValue([])
  vi.mocked(prisma.inventoryItem.update).mockResolvedValue({} as never)
  vi.mocked(prisma.inventoryItem.findUnique).mockResolvedValue(null)
  vi.mocked(prisma.stockMovement.create).mockResolvedValue({} as never)
  vi.mocked(prisma.transaction.create).mockResolvedValue({} as never)
  vi.mocked(prisma.activity.create).mockResolvedValue({} as Activity)
  vi.mocked(prisma.whatsappInstance.findUnique).mockResolvedValue(null)
  vi.mocked(prisma.company.findUnique).mockResolvedValue({ name: 'Clínica Test' } as never)
  vi.mocked(prisma.patientSubscription.findFirst).mockResolvedValue(null)
  vi.mocked(prisma.patientSubscription.update).mockResolvedValue({} as never)
})

// ── testes ────────────────────────────────────────────────────────────────────

describe('PATCH /api/appointments/[id]/status', () => {

  it('transição válida SCHEDULED → CONFIRMED retorna 200 com agendamento', async () => {
    const res = await PATCH(makeRequest({ status: 'CONFIRMED' }), ROUTE_PARAMS)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.appointment).toBeDefined()
    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'CONFIRMED' }) })
    )
  })

  it('transição inválida COMPLETED → CANCELED retorna 400', async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(MOCK_APPOINTMENT_COMPLETED)
    const res = await PATCH(makeRequest({ status: 'CANCELED' }), ROUTE_PARAMS)
    expect(res.status).toBe(400)
    expect(prisma.appointment.update).not.toHaveBeenCalled()
  })

  it('transição inválida SCHEDULED → COMPLETED retorna 400', async () => {
    const res = await PATCH(makeRequest({ status: 'COMPLETED' }), ROUTE_PARAMS)
    expect(res.status).toBe(400)
    expect(prisma.appointment.update).not.toHaveBeenCalled()
  })

  it('documenta a regra: CONFIRMED → COMPLETED é a única origem aceita para COMPLETED (200)', async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(MOCK_APPOINTMENT_CONFIRMED)
    const res = await PATCH(makeRequest({ status: 'COMPLETED' }), ROUTE_PARAMS)
    expect(res.status).toBe(200)
    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'COMPLETED', stockDeducted: true }),
      })
    )
  })

  it('COMPLETED deduz estoque quando stockDeducted=false', async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(MOCK_APPOINTMENT_CONFIRMED)
    vi.mocked(prisma.procedureSupply.findMany).mockResolvedValue([
      { inventoryItemId: 'item-001', quantityUsed: 2, inventoryItem: { name: 'Creme' } },
    ] as never)
    vi.mocked(prisma.inventoryItem.findUnique).mockResolvedValue({
      id: 'item-001',
      name: 'Creme',
      currentStock: 5,
      minStock: 3,
      unit: 'ml',
    } as never)
    await PATCH(makeRequest({ status: 'COMPLETED' }), ROUTE_PARAMS)
    expect(prisma.inventoryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ currentStock: { decrement: 2 } }) })
    )
    expect(prisma.stockMovement.create).toHaveBeenCalled()
  })

  it('COMPLETED não deduz estoque quando stockDeducted=true', async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({
      ...MOCK_APPOINTMENT_CONFIRMED,
      stockDeducted: true,
    } as never)
    await PATCH(makeRequest({ status: 'COMPLETED' }), ROUTE_PARAMS)
    expect(prisma.inventoryItem.update).not.toHaveBeenCalled()
    expect(prisma.stockMovement.create).not.toHaveBeenCalled()
  })

  it('COMPLETED cria transação de DESPESA para custo de insumos', async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(MOCK_APPOINTMENT_CONFIRMED)
    vi.mocked(prisma.procedure.findUnique).mockResolvedValue({ cost: 30, name: 'Limpeza' } as never)
    await PATCH(makeRequest({ status: 'COMPLETED' }), ROUTE_PARAMS)
    expect(prisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'EXPENSE', category: 'Insumos' }),
      })
    )
  })

  it('COMPLETED atualiza lastVisit do paciente', async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(MOCK_APPOINTMENT_CONFIRMED)
    await PATCH(makeRequest({ status: 'COMPLETED' }), ROUTE_PARAMS)
    expect(prisma.patient.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ lastVisit: expect.any(Date) }) })
    )
  })

  it('registra log de atividade ao atualizar status', async () => {
    await PATCH(makeRequest({ status: 'CONFIRMED' }), ROUTE_PARAMS)
    expect(prisma.activity.create).toHaveBeenCalledOnce()
  })

  it('retorna 404 quando agendamento não encontrado', async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null)
    const res = await PATCH(makeRequest({ status: 'CONFIRMED' }), ROUTE_PARAMS)
    expect(res.status).toBe(404)
  })

  it('retorna 401 sem autenticação', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null as never)
    const res = await PATCH(makeRequest({ status: 'CONFIRMED' }), ROUTE_PARAMS)
    expect(res.status).toBe(401)
  })

  it('retorna 403 para role PATIENT', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ ...MOCK_ADMIN_USER, role: 'PATIENT' } as never)
    const res = await PATCH(makeRequest({ status: 'CONFIRMED' }), ROUTE_PARAMS)
    expect(res.status).toBe(403)
    expect(prisma.appointment.update).not.toHaveBeenCalled()
  })

  it('retorna 403 sem empresa associada', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ ...MOCK_ADMIN_USER, companyId: null } as never)
    const res = await PATCH(makeRequest({ status: 'CONFIRMED' }), ROUTE_PARAMS)
    expect(res.status).toBe(403)
  })

  it('retorna 400 para status inválido no body', async () => {
    const res = await PATCH(makeRequest({ status: 'INVALID_STATUS' }), ROUTE_PARAMS)
    expect(res.status).toBe(400)
    expect(prisma.appointment.update).not.toHaveBeenCalled()
  })

  it('cria alerta de estoque baixo quando currentStock ≤ minStock após dedução', async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(MOCK_APPOINTMENT_CONFIRMED)
    vi.mocked(prisma.procedureSupply.findMany).mockResolvedValue([
      { inventoryItemId: 'item-001', quantityUsed: 5, inventoryItem: { name: 'Creme' } },
    ] as never)
    vi.mocked(prisma.inventoryItem.findUnique).mockResolvedValue({
      id: 'item-001',
      name: 'Creme',
      currentStock: 2, // ≤ minStock
      minStock: 5,
      unit: 'ml',
    } as never)
    await PATCH(makeRequest({ status: 'COMPLETED' }), ROUTE_PARAMS)
    expect(prisma.appNotification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'WARNING' }) })
    )
  })

  // ── Clube de Assinaturas: limite de sessões ────────────────────────────────

  it('PENDING_APPROVAL → SCHEDULED deduz sessão quando plano ACTIVE e dentro do limite', async () => {
    const apptWithSub = {
      ...MOCK_APPOINTMENT_SCHEDULED,
      status: 'PENDING_APPROVAL',
      subscriptionId: 'sub-001',
    } as unknown as Appointment
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(apptWithSub)
    vi.mocked(prisma.patientSubscription.findFirst).mockResolvedValue({
      id: 'sub-001',
      status: 'ACTIVE',
      sessionsUsedThisCycle: { [PROCEDURE_ID]: 1 },
      plan: { items: [{ procedureId: PROCEDURE_ID, sessionsPerCycle: 5 }] },
    } as never)
    const res = await PATCH(makeRequest({ status: 'SCHEDULED' }), ROUTE_PARAMS)
    expect(res.status).toBe(200)
    expect(prisma.patientSubscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sessionsUsedThisCycle: { [PROCEDURE_ID]: 2 },
        }),
      })
    )
  })

  it('PENDING_APPROVAL → SCHEDULED retorna 400 quando limite de sessões atingido', async () => {
    const apptWithSub = {
      ...MOCK_APPOINTMENT_SCHEDULED,
      status: 'PENDING_APPROVAL',
      subscriptionId: 'sub-001',
    } as unknown as Appointment
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(apptWithSub)
    vi.mocked(prisma.patientSubscription.findFirst).mockResolvedValue({
      id: 'sub-001',
      status: 'ACTIVE',
      sessionsUsedThisCycle: { [PROCEDURE_ID]: 5 }, // igual ao limite
      plan: { items: [{ procedureId: PROCEDURE_ID, sessionsPerCycle: 5 }] },
    } as never)
    const res = await PATCH(makeRequest({ status: 'SCHEDULED' }), ROUTE_PARAMS)
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error.toLowerCase()).toContain('limite')
    expect(prisma.patientSubscription.update).not.toHaveBeenCalled()
    expect(prisma.appointment.update).not.toHaveBeenCalled()
  })

  it('PENDING_APPROVAL → SCHEDULED não deduz sessão quando plano está PENDING', async () => {
    const apptWithSub = {
      ...MOCK_APPOINTMENT_SCHEDULED,
      status: 'PENDING_APPROVAL',
      subscriptionId: 'sub-001',
    } as unknown as Appointment
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(apptWithSub)
    // plano PENDING — findFirst retorna null (query filtra por status: "ACTIVE")
    vi.mocked(prisma.patientSubscription.findFirst).mockResolvedValue(null)
    const res = await PATCH(makeRequest({ status: 'SCHEDULED' }), ROUTE_PARAMS)
    expect(res.status).toBe(200)
    expect(prisma.patientSubscription.update).not.toHaveBeenCalled()
  })
})
