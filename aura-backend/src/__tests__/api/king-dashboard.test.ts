// src/__tests__/api/king-dashboard.test.ts
// Testes para GET /api/king/dashboard

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/queries', () => ({
  queryGlobalStats: vi.fn(),
}))
vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
}))

import { GET } from '../../app/api/king/dashboard/route'
import { queryGlobalStats } from '@/lib/queries'
import { getAuthUser } from '@/lib/auth'

// ── fixtures ──────────────────────────────────────────────────────────────────

const MOCK_OWNER = { id: 'owner-001', role: 'OWNER', companyId: null }
const MOCK_ADMIN = { id: 'admin-001', role: 'ADMIN', companyId: 'company-001' }

const MOCK_STATS = {
  totalCompanies: 42,
  activeCompanies: 30,
  totalPatients: 1500,
  totalAppointments: 8200,
  todayAppointments: 47,
  monthlyRevenue: 58000,
  mrr: 12400,
  companiesByPlan: { FREE: 12, PROFESSIONAL: 18, PREMIUM: 12 },
}

function makeRequest() {
  return new NextRequest('http://localhost/api/king/dashboard', { method: 'GET' })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAuthUser).mockResolvedValue(MOCK_OWNER as never)
  vi.mocked(queryGlobalStats).mockResolvedValue(MOCK_STATS as never)
})

// ── GET /api/king/dashboard ───────────────────────────────────────────────────

describe('GET /api/king/dashboard', () => {

  it('retorna estatísticas globais → 200', async () => {
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.totalCompanies).toBe(42)
    expect(body.data.activeCompanies).toBe(30)
    expect(body.data.mrr).toBe(12400)
    expect(body.data.companiesByPlan).toEqual(MOCK_STATS.companiesByPlan)
  })

  it('chama queryGlobalStats sem parâmetros', async () => {
    await GET(makeRequest())
    expect(queryGlobalStats).toHaveBeenCalledOnce()
    expect(queryGlobalStats).toHaveBeenCalledWith()
  })

  it('retorna 401 sem autenticação', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null as never)
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    expect(queryGlobalStats).not.toHaveBeenCalled()
  })

  it('retorna 403 para role ADMIN', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(MOCK_ADMIN as never)
    const res = await GET(makeRequest())
    expect(res.status).toBe(403)
    expect(queryGlobalStats).not.toHaveBeenCalled()
  })

  it('retorna 500 quando query lança erro', async () => {
    vi.mocked(queryGlobalStats).mockRejectedValue(new Error('DB error'))
    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.success).toBe(false)
  })
})
