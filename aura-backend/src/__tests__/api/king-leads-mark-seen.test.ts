// src/__tests__/api/king-leads-mark-seen.test.ts
// Testes para PATCH /api/king/leads/mark-seen

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    company: {
      updateMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
}))

import { PATCH } from '../../app/api/king/leads/mark-seen/route'
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

// ── fixtures ──────────────────────────────────────────────────────────────────

const MOCK_OWNER = { id: 'owner-001', role: 'OWNER', companyId: null }
const MOCK_ADMIN = { id: 'admin-001', role: 'ADMIN', companyId: 'company-001' }

function makeRequest() {
  return new NextRequest('http://localhost/api/king/leads/mark-seen', { method: 'PATCH' })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAuthUser).mockResolvedValue(MOCK_OWNER as never)
  vi.mocked(prisma.company.updateMany).mockResolvedValue({ count: 3 })
})

// ── PATCH /api/king/leads/mark-seen ──────────────────────────────────────────

describe('PATCH /api/king/leads/mark-seen', () => {

  it('marca todos os leads não vistos como vistos → 200', async () => {
    const res = await PATCH(makeRequest())
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(prisma.company.updateMany).toHaveBeenCalledWith({
      where: { seenByOwner: false },
      data: { seenByOwner: true },
    })
  })

  it('chama updateMany mesmo quando não há leads não vistos (count 0)', async () => {
    vi.mocked(prisma.company.updateMany).mockResolvedValue({ count: 0 })
    const res = await PATCH(makeRequest())
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(prisma.company.updateMany).toHaveBeenCalledOnce()
  })

  it('retorna 401 sem autenticação', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null as never)
    const res = await PATCH(makeRequest())
    expect(res.status).toBe(401)
    expect(prisma.company.updateMany).not.toHaveBeenCalled()
  })

  it('retorna 403 para role ADMIN (não é OWNER)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(MOCK_ADMIN as never)
    const res = await PATCH(makeRequest())
    expect(res.status).toBe(403)
    expect(prisma.company.updateMany).not.toHaveBeenCalled()
  })

  it('retorna 500 quando Prisma lança erro', async () => {
    vi.mocked(prisma.company.updateMany).mockRejectedValue(new Error('DB error'))
    const res = await PATCH(makeRequest())
    expect(res.status).toBe(500)
  })
})
