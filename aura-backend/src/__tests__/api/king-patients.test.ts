// src/__tests__/api/king-patients.test.ts
// Testes para GET /api/king/patients

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/queries', () => ({
  queryPatients: vi.fn(),
}))
vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
}))

import { GET } from '../../app/api/king/patients/route'
import { queryPatients } from '@/lib/queries'
import { getAuthUser } from '@/lib/auth'

// ── fixtures ──────────────────────────────────────────────────────────────────

const MOCK_OWNER = { id: 'owner-001', role: 'OWNER', companyId: null }
const MOCK_ADMIN = { id: 'admin-001', role: 'ADMIN', companyId: 'company-001' }

const MOCK_RESULT = {
  patients: [{ id: 'p1', name: 'Ana Lima', companyId: 'c1' }],
  total: 1,
  page: 1,
  limit: 100,
}

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/king/patients')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new NextRequest(url.toString(), { method: 'GET' })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAuthUser).mockResolvedValue(MOCK_OWNER as never)
  vi.mocked(queryPatients).mockResolvedValue(MOCK_RESULT as never)
})

// ── GET /api/king/patients ────────────────────────────────────────────────────

describe('GET /api/king/patients', () => {

  it('retorna lista de pacientes globais → 200', async () => {
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.patients).toHaveLength(1)
    expect(body.data.total).toBe(1)
  })

  it('passa parâmetros para queryPatients sem companyId (visão global)', async () => {
    await GET(makeRequest({ page: '3', limit: '25', search: 'ana', status: 'ACTIVE' }))
    expect(queryPatients).toHaveBeenCalledWith({
      page: 3,
      limit: 25,
      search: 'ana',
      status: 'ACTIVE',
    })
  })

  it('não filtra por companyId (retorna todos os pacientes do sistema)', async () => {
    await GET(makeRequest())
    expect(queryPatients).toHaveBeenCalledWith(
      expect.not.objectContaining({ companyId: expect.anything() })
    )
  })

  it('usa page=1 e limit=100 como padrão', async () => {
    await GET(makeRequest())
    expect(queryPatients).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 100 })
    )
  })

  it('retorna 401 sem autenticação', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null as never)
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    expect(queryPatients).not.toHaveBeenCalled()
  })

  it('retorna 403 para role ADMIN', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(MOCK_ADMIN as never)
    const res = await GET(makeRequest())
    expect(res.status).toBe(403)
    expect(queryPatients).not.toHaveBeenCalled()
  })

  it('retorna 500 quando query lança erro', async () => {
    vi.mocked(queryPatients).mockRejectedValue(new Error('DB error'))
    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
  })
})
