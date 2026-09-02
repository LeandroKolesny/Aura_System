// aura-backend/src/__tests__/api/subscriptions-patients-activate.test.ts
// Testes para PATCH /api/subscriptions/patients/[id]/activate

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    patientSubscription: { findFirst: vi.fn(), update: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))
vi.mock('@/lib/apiGuards', () => ({ checkWriteAccess: vi.fn() }))

import { PATCH } from '../../app/api/subscriptions/patients/[id]/activate/route'
import { getAuthUser } from '@/lib/auth'
import { checkWriteAccess } from '@/lib/apiGuards'
import prisma from '@/lib/prisma'

const ADMIN = { id: 'u1', email: 'admin@clinica.com', role: 'ADMIN', companyId: 'c1' }

function makeRequest() {
  return new NextRequest('http://localhost/api/subscriptions/patients/sub1/activate', { method: 'PATCH' })
}
function makeParams() {
  return { params: Promise.resolve({ id: 'sub1' }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(checkWriteAccess).mockResolvedValue(null)
})

describe('PATCH /api/subscriptions/patients/[id]/activate', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await PATCH(makeRequest(), makeParams())
    expect(res.status).toBe(401)
  })

  it('retorna o bloqueio do checkWriteAccess quando o plano não permite escrita', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    const { NextResponse } = await import('next/server')
    vi.mocked(checkWriteAccess).mockResolvedValue(NextResponse.json({ error: 'Modo leitura' }, { status: 403 }))
    const res = await PATCH(makeRequest(), makeParams())
    expect(res.status).toBe(403)
  })

  it('retorna 404 quando a assinatura não existe (ou é de outra empresa)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.patientSubscription.findFirst).mockResolvedValue(null)
    const res = await PATCH(makeRequest(), makeParams())
    expect(res.status).toBe(404)
  })

  it('retorna 400 quando a assinatura não está PENDING', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.patientSubscription.findFirst).mockResolvedValue({ id: 'sub1', status: 'ACTIVE', companyId: 'c1' } as never)
    const res = await PATCH(makeRequest(), makeParams())
    expect(res.status).toBe(400)
  })

  it('ativa a assinatura PENDING, define startDate e retorna com patient/plan', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.patientSubscription.findFirst).mockResolvedValue({ id: 'sub1', status: 'PENDING', companyId: 'c1' } as never)
    vi.mocked(prisma.patientSubscription.update).mockResolvedValue({
      id: 'sub1', status: 'ACTIVE',
      patient: { id: 'p1', name: 'Maria' }, plan: { id: 'plan1', name: 'Plano Mensal' },
    } as never)

    const res = await PATCH(makeRequest(), makeParams())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.status).toBe('ACTIVE')
    expect(prisma.patientSubscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub1' },
        data: expect.objectContaining({ status: 'ACTIVE', startDate: expect.any(Date) }),
      })
    )
  })

  it('busca a assinatura restrita à empresa do usuário autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.patientSubscription.findFirst).mockResolvedValue(null)
    await PATCH(makeRequest(), makeParams())
    expect(prisma.patientSubscription.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'sub1', companyId: 'c1' } })
    )
  })
})
