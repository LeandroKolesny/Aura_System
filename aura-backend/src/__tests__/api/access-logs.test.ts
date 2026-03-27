import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    activity: {
      findMany: vi.fn(),
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))
vi.mock('@/lib/kingGuard', () => ({ requireOwner: vi.fn() }))

import { GET } from '../../app/api/king/access-logs/route'
import { requireOwner } from '@/lib/kingGuard'
import prisma from '@/lib/prisma'

const OWNER = { id: 'u1', role: 'OWNER', companyId: null, email: 'king@aura.system', name: 'King' }

function makeReq(url = 'http://localhost/api/king/access-logs') {
  return new NextRequest(url)
}

beforeEach(() => vi.clearAllMocks())

// Helper: mock requireOwner as authorized
function authorizeOwner() {
  vi.mocked(requireOwner).mockResolvedValue({
    authorized: true,
    response: null,
    user: OWNER as never,
  })
}

// Helper: mock requireOwner as unauthorized with given status
function denyWith(status: number, message: string) {
  const { NextResponse } = require('next/server')
  vi.mocked(requireOwner).mockResolvedValue({
    authorized: false,
    response: NextResponse.json({ error: message }, { status }),
    user: null,
  })
}

describe('GET /api/king/access-logs', () => {
  it('retorna 401 sem autenticação', async () => {
    denyWith(401, 'Não autenticado')
    const res = await GET(makeReq())
    expect(res.status).toBe(401)
  })

  it('retorna 403 para não-OWNER', async () => {
    denyWith(403, 'Acesso restrito ao Owner')
    const res = await GET(makeReq())
    expect(res.status).toBe(403)
  })

  it('retorna logs de USER_LOGIN para OWNER com paginação e total', async () => {
    authorizeOwner()
    const mockLog = {
      id: '1',
      type: 'USER_LOGIN',
      title: 'Login: a@b.com',
      ipAddress: '1.2.3.4',
      userAgent: 'Chrome',
      createdAt: new Date(),
      retainUntil: null,
      metadata: { email: 'a@b.com' },
      userId: 'u2',
    }
    vi.mocked(prisma.activity.findMany).mockResolvedValue([mockLog] as never)
    vi.mocked(prisma.activity.count).mockResolvedValue(1)

    const res = await GET(makeReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].ipAddress).toBe('1.2.3.4')
    expect(body.total).toBe(1)
    expect(body.page).toBe(1)
    expect(body.limit).toBe(50)
  })

  it('usa page e limit padrões quando params ausentes', async () => {
    authorizeOwner()
    vi.mocked(prisma.activity.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.activity.count).mockResolvedValue(0)

    const res = await GET(makeReq())
    const body = await res.json()
    expect(body.page).toBe(1)
    expect(body.limit).toBe(50)
    expect(body.total).toBe(0)
  })

  it('NaN guard: page e limit inválidos caem no default', async () => {
    authorizeOwner()
    vi.mocked(prisma.activity.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.activity.count).mockResolvedValue(0)

    const res = await GET(makeReq('http://localhost/api/king/access-logs?page=abc&limit=xyz'))
    const body = await res.json()
    // NaN inputs should fall back to defaults: page=1, limit=50
    expect(body.page).toBe(1)
    expect(body.limit).toBe(50)
  })

  it('NaN guard: page=0 é normalizado para 1', async () => {
    authorizeOwner()
    vi.mocked(prisma.activity.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.activity.count).mockResolvedValue(0)

    const res = await GET(makeReq('http://localhost/api/king/access-logs?page=0&limit=5'))
    const body = await res.json()
    expect(body.page).toBe(1)
    expect(body.limit).toBe(5)
  })

  it('limit máximo é 100 mesmo que se peça mais', async () => {
    authorizeOwner()
    vi.mocked(prisma.activity.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.activity.count).mockResolvedValue(0)

    const res = await GET(makeReq('http://localhost/api/king/access-logs?limit=999'))
    const body = await res.json()
    expect(body.limit).toBe(100)
  })
})
