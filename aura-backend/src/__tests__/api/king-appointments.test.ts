// src/__tests__/api/king-appointments.test.ts
// Testes para GET /api/king/appointments

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/queries', () => ({
  queryAppointments: vi.fn(),
}))
vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
}))

import { GET } from '../../app/api/king/appointments/route'
import { queryAppointments } from '@/lib/queries'
import { getAuthUser } from '@/lib/auth'

// ── fixtures ──────────────────────────────────────────────────────────────────

const MOCK_OWNER = { id: 'owner-001', role: 'OWNER', companyId: null }
const MOCK_ADMIN = { id: 'admin-001', role: 'ADMIN', companyId: 'company-001' }

const MOCK_RESULT = {
  appointments: [{ id: 'a1', status: 'SCHEDULED', companyId: 'c1' }],
  total: 1,
  page: 1,
  limit: 100,
}

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/king/appointments')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new NextRequest(url.toString(), { method: 'GET' })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAuthUser).mockResolvedValue(MOCK_OWNER as never)
  vi.mocked(queryAppointments).mockResolvedValue(MOCK_RESULT as never)
})

// ── GET /api/king/appointments ────────────────────────────────────────────────

describe('GET /api/king/appointments', () => {

  it('retorna lista de agendamentos globais → 200', async () => {
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.appointments).toHaveLength(1)
  })

  it('passa parâmetros de filtro para queryAppointments', async () => {
    await GET(makeRequest({
      page: '2',
      limit: '50',
      startDate: '2026-04-01',
      endDate: '2026-04-30',
      status: 'COMPLETED',
    }))
    expect(queryAppointments).toHaveBeenCalledWith({
      page: 2,
      limit: 50,
      startDate: '2026-04-01',
      endDate: '2026-04-30',
      status: 'COMPLETED',
    })
  })

  it('usa page=1 e limit=100 como padrão', async () => {
    await GET(makeRequest())
    expect(queryAppointments).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 100 })
    )
  })

  it('passa undefined para filtros ausentes', async () => {
    await GET(makeRequest())
    expect(queryAppointments).toHaveBeenCalledWith(
      expect.objectContaining({
        startDate: undefined,
        endDate: undefined,
        status: undefined,
      })
    )
  })

  it('retorna 401 sem autenticação', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null as never)
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    expect(queryAppointments).not.toHaveBeenCalled()
  })

  it('retorna 403 para role ADMIN', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(MOCK_ADMIN as never)
    const res = await GET(makeRequest())
    expect(res.status).toBe(403)
    expect(queryAppointments).not.toHaveBeenCalled()
  })

  it('retorna 500 quando query lança erro', async () => {
    vi.mocked(queryAppointments).mockRejectedValue(new Error('DB error'))
    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
  })
})
