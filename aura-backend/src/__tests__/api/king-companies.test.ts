// src/__tests__/api/king-companies.test.ts
// Testes para GET /api/king/companies

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/queries', () => ({
  queryCompanies: vi.fn(),
}))
vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
}))

import { GET } from '../../app/api/king/companies/route'
import { queryCompanies } from '@/lib/queries'
import { getAuthUser } from '@/lib/auth'

// ── fixtures ──────────────────────────────────────────────────────────────────

const MOCK_OWNER = { id: 'owner-001', role: 'OWNER', companyId: null }
const MOCK_ADMIN = { id: 'admin-001', role: 'ADMIN', companyId: 'company-001' }

const MOCK_RESULT = {
  companies: [{ id: 'c1', name: 'Clínica A', plan: 'FREE' }],
  total: 1,
  page: 1,
  limit: 100,
}

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/king/companies')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new NextRequest(url.toString(), { method: 'GET' })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAuthUser).mockResolvedValue(MOCK_OWNER as never)
  vi.mocked(queryCompanies).mockResolvedValue(MOCK_RESULT as never)
})

// ── GET /api/king/companies ───────────────────────────────────────────────────

describe('GET /api/king/companies', () => {

  it('retorna lista de empresas → 200', async () => {
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.companies).toHaveLength(1)
    expect(body.data.total).toBe(1)
  })

  it('passa parâmetros de paginação e busca para queryCompanies', async () => {
    await GET(makeRequest({ page: '2', limit: '50', search: 'beleza', status: 'ACTIVE' }))
    expect(queryCompanies).toHaveBeenCalledWith({
      page: 2,
      limit: 50,
      search: 'beleza',
      status: 'ACTIVE',
    })
  })

  it('usa page=1 e limit=100 como padrão', async () => {
    await GET(makeRequest())
    expect(queryCompanies).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 100 })
    )
  })

  it('retorna 401 sem autenticação', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null as never)
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    expect(queryCompanies).not.toHaveBeenCalled()
  })

  it('retorna 403 para role ADMIN', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(MOCK_ADMIN as never)
    const res = await GET(makeRequest())
    expect(res.status).toBe(403)
    expect(queryCompanies).not.toHaveBeenCalled()
  })

  it('retorna 500 quando query lança erro', async () => {
    vi.mocked(queryCompanies).mockRejectedValue(new Error('DB error'))
    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
  })
})
