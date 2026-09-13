// src/__tests__/lib/queries.test.ts
// Testes para os query builders usados pela visão global do King (Owner).
// Foco: nenhum dado sensível/LGPD deve ser selecionado a mais do que o
// necessário para a listagem agregada (cpf, anamnese, assinatura de
// consentimento de pacientes; assinatura/consentimento de agendamentos;
// IDs internos de billing e configs de negócio de empresas).

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  default: {
    patient: { findMany: vi.fn(), count: vi.fn() },
    appointment: { findMany: vi.fn(), count: vi.fn() },
    company: { findMany: vi.fn(), count: vi.fn() },
  },
}))

import prisma from '@/lib/prisma'
import { queryPatients, queryAppointments, queryCompanies } from '@/lib/queries'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.patient.findMany).mockResolvedValue([] as never)
  vi.mocked(prisma.patient.count).mockResolvedValue(0)
  vi.mocked(prisma.appointment.findMany).mockResolvedValue([] as never)
  vi.mocked(prisma.appointment.count).mockResolvedValue(0)
  vi.mocked(prisma.company.findMany).mockResolvedValue([] as never)
  vi.mocked(prisma.company.count).mockResolvedValue(0)
})

describe('queryPatients — seleção de campos (LGPD)', () => {
  it('NÃO seleciona cpf, anamnese ou dados de assinatura de consentimento', async () => {
    await queryPatients({})

    const call = vi.mocked(prisma.patient.findMany).mock.calls[0][0]
    const select = call?.select as Record<string, unknown> | undefined
    expect(select).toBeDefined()
    expect(select).not.toHaveProperty('cpf')
    expect(select).not.toHaveProperty('anamnesisSummary')
    expect(select).not.toHaveProperty('consentSignatureUrl')
    expect(select).not.toHaveProperty('consentMetadata')
    expect(select).not.toHaveProperty('consentSignedAt')
  })

  it('seleciona apenas os campos usados pela listagem global (nome, contato, status, empresa)', async () => {
    await queryPatients({})

    const call = vi.mocked(prisma.patient.findMany).mock.calls[0][0]
    const select = call?.select as Record<string, unknown> | undefined
    expect(select).toMatchObject({
      id: true,
      name: true,
      email: true,
      phone: true,
      status: true,
      birthDate: true,
      lastVisit: true,
      createdAt: true,
      companyId: true,
    })
  })
})

describe('queryAppointments — seleção de campos', () => {
  it('NÃO seleciona URL/metadados de assinatura de consentimento do agendamento', async () => {
    await queryAppointments({})

    const call = vi.mocked(prisma.appointment.findMany).mock.calls[0][0]
    const select = call?.select as Record<string, unknown> | undefined
    expect(select).toBeDefined()
    expect(select).not.toHaveProperty('signatureUrl')
    expect(select).not.toHaveProperty('signatureMetadata')
  })

  it('seleciona os campos usados pela listagem global (data, preço, status, relações)', async () => {
    await queryAppointments({})

    const call = vi.mocked(prisma.appointment.findMany).mock.calls[0][0]
    const select = call?.select as Record<string, unknown> | undefined
    expect(select).toMatchObject({
      id: true,
      date: true,
      durationMinutes: true,
      price: true,
      status: true,
    })
  })
})

describe('queryCompanies — seleção de campos', () => {
  it('NÃO seleciona IDs internos de billing (Asaas) nem configs internas de negócio', async () => {
    await queryCompanies({})

    const call = vi.mocked(prisma.company.findMany).mock.calls[0][0]
    const select = call?.select as Record<string, unknown> | undefined
    expect(select).toBeDefined()
    expect(select).not.toHaveProperty('asaasCustomerId')
    expect(select).not.toHaveProperty('asaasSubscriptionId')
    expect(select).not.toHaveProperty('businessHours')
    expect(select).not.toHaveProperty('onlineBookingConfig')
    expect(select).not.toHaveProperty('layoutConfig')
  })

  it('mantém o contato do admin/owner (adminContact) e a flag hasOwner no retorno', async () => {
    vi.mocked(prisma.company.findMany).mockResolvedValue([
      {
        id: 'c1',
        name: 'Clínica A',
        slug: 'clinica-a',
        plan: 'FREE',
        subscriptionStatus: 'TRIAL',
        subscriptionExpiresAt: null,
        createdAt: new Date(),
        isActive: true,
        _count: { patients: 0, appointments: 0, users: 1 },
        users: [{ role: 'ADMIN', email: 'admin@clinica-a.com', phone: '111', name: 'Admin A' }],
      },
    ] as never)

    const result = await queryCompanies({})
    expect(result.companies[0].hasOwner).toBe(false)
    expect(result.companies[0].adminContact).toEqual({
      name: 'Admin A',
      email: 'admin@clinica-a.com',
      phone: '111',
    })
  })
})
