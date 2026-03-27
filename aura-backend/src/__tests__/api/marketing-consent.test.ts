import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: { user: { update: vi.fn(), findUnique: vi.fn() } },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))

import { PUT, GET } from '../../app/api/account/marketing-consent/route'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

const USER = { id: 'u1', role: 'ADMIN', companyId: 'c1', email: 'a@b.com', name: 'Admin' }

beforeEach(() => vi.clearAllMocks())

describe('PUT /api/account/marketing-consent', () => {
  it('retorna 401 sem autenticação', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await PUT(new NextRequest('http://localhost/api/account/marketing-consent', {
      method: 'PUT', body: JSON.stringify({ consent: true }), headers: { 'content-type': 'application/json' },
    }))
    expect(res.status).toBe(401)
  })

  it('atualiza consentimento de marketing com IP e timestamp', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(USER as never)
    vi.mocked(prisma.user.update).mockResolvedValue({} as never)
    const res = await PUT(new NextRequest('http://localhost/api/account/marketing-consent', {
      method: 'PUT',
      body: JSON.stringify({ consent: true }),
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
    }))
    expect(res.status).toBe(200)
    const updateCall = vi.mocked(prisma.user.update).mock.calls[0][0]
    expect(updateCall.data.marketingConsent).toBe(true)
    expect(updateCall.data.marketingConsentIp).toBe('1.2.3.4')
    expect(updateCall.data.marketingConsentAt).toBeInstanceOf(Date)
  })

  it('atualiza para false (opt-out)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(USER as never)
    vi.mocked(prisma.user.update).mockResolvedValue({} as never)
    const res = await PUT(new NextRequest('http://localhost/api/account/marketing-consent', {
      method: 'PUT',
      body: JSON.stringify({ consent: false }),
      headers: { 'content-type': 'application/json' },
    }))
    expect(res.status).toBe(200)
    const updateCall = vi.mocked(prisma.user.update).mock.calls[0][0]
    expect(updateCall.data.marketingConsent).toBe(false)
  })
})

describe('GET /api/account/marketing-consent', () => {
  it('retorna 401 sem autenticação', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await GET(new NextRequest('http://localhost/api/account/marketing-consent'))
    expect(res.status).toBe(401)
  })

  it('retorna status de consentimento do usuário', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(USER as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      marketingConsent: true,
      marketingConsentAt: new Date('2026-01-01'),
    } as never)
    const res = await GET(new NextRequest('http://localhost/api/account/marketing-consent'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.marketingConsent).toBe(true)
  })
})
