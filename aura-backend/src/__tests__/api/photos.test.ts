// src/__tests__/api/photos.test.ts
// Testes para GET/POST/DELETE /api/photos — validação Zod + autorização

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { PhotoRecord } from '@prisma/client'

vi.mock('@/lib/prisma', () => ({
  default: {
    photoRecord: {
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}))
vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
}))
vi.mock('@/lib/apiGuards', () => ({
  checkWriteAccess: vi.fn().mockResolvedValue(null),
}))

import { GET, POST, DELETE } from '../../app/api/photos/route'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

const MOCK_USER = { id: 'u1', email: 'a@b.com', role: 'ADMIN', companyId: 'c1', name: 'Admin' }

const MOCK_PHOTO = {
  id: 'photo-1',
  url: 'https://example.com/photo.jpg',
  type: 'BEFORE',
  procedure: 'Limpeza de pele',
  groupId: 'group_1',
  date: new Date(),
  companyId: 'c1',
  patientId: 'p1',
  createdAt: new Date(),
  patient: { id: 'p1', name: 'Paciente' },
}

function makeGETRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/photos')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new NextRequest(url.toString())
}

function makePOSTRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/photos', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

function makeDELETERequest(id?: string) {
  const url = id ? `http://localhost/api/photos?id=${id}` : 'http://localhost/api/photos'
  return new NextRequest(url, { method: 'DELETE' })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAuthUser).mockResolvedValue(MOCK_USER as never)
})

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------
describe('GET /api/photos', () => {
  it('retorna 401 sem autenticação', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await GET(makeGETRequest())
    expect(res.status).toBe(401)
  })

  it('retorna lista de fotos', async () => {
    vi.mocked(prisma.photoRecord.findMany).mockResolvedValue([MOCK_PHOTO] as unknown as PhotoRecord[])
    const res = await GET(makeGETRequest())
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.photos).toHaveLength(1)
  })

  it('aplica filtro por patientId', async () => {
    vi.mocked(prisma.photoRecord.findMany).mockResolvedValue([])
    await GET(makeGETRequest({ patientId: 'p1' }))
    expect(prisma.photoRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ patientId: 'p1' }) })
    )
  })

  it('limita máximo de 100 registros mesmo que limit=9999 seja enviado', async () => {
    vi.mocked(prisma.photoRecord.findMany).mockResolvedValue([])
    await GET(makeGETRequest({ limit: '9999' }))
    expect(prisma.photoRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 })
    )
  })

  it('restringe fotos pela companyId do usuário autenticado', async () => {
    vi.mocked(prisma.photoRecord.findMany).mockResolvedValue([])
    await GET(makeGETRequest())
    expect(prisma.photoRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ companyId: 'c1' }) })
    )
  })
})

// ---------------------------------------------------------------------------
// POST — validação Zod (VULN-05)
// ---------------------------------------------------------------------------
describe('POST /api/photos — validação Zod', () => {
  const VALID_BODY = {
    patientId: 'clxxxxxxxxxxxxxxxxxxxxxxxx',
    url: 'https://storage.example.com/photo.jpg',
    type: 'BEFORE',
    procedure: 'Limpeza de pele',
  }

  it('retorna 201 com dados válidos', async () => {
    vi.mocked(prisma.photoRecord.create).mockResolvedValue(MOCK_PHOTO as unknown as PhotoRecord)
    const res = await POST(makePOSTRequest(VALID_BODY))
    expect(res.status).toBe(201)
  })

  it('SECURITY: rejeita URL com javascript: scheme (XSS)', async () => {
    const res = await POST(makePOSTRequest({ ...VALID_BODY, url: 'javascript:alert(1)' }))
    expect(res.status).toBe(400)
  })

  it('SECURITY: rejeita URL com ftp: scheme', async () => {
    const res = await POST(makePOSTRequest({ ...VALID_BODY, url: 'ftp://malicious.com/file' }))
    expect(res.status).toBe(400)
  })

  it('SECURITY: rejeita type fora do enum (BEFORE | AFTER)', async () => {
    const res = await POST(makePOSTRequest({ ...VALID_BODY, type: 'UNKNOWN' }))
    expect(res.status).toBe(400)
  })

  it('aceita type BEFORE', async () => {
    vi.mocked(prisma.photoRecord.create).mockResolvedValue(MOCK_PHOTO as unknown as PhotoRecord)
    const res = await POST(makePOSTRequest({ ...VALID_BODY, type: 'BEFORE' }))
    expect(res.status).toBe(201)
  })

  it('aceita type AFTER', async () => {
    vi.mocked(prisma.photoRecord.create).mockResolvedValue(
      { ...MOCK_PHOTO, type: 'AFTER' } as unknown as PhotoRecord
    )
    const res = await POST(makePOSTRequest({ ...VALID_BODY, type: 'AFTER' }))
    expect(res.status).toBe(201)
  })

  it('retorna 400 quando url está ausente', async () => {
    const { url: _, ...withoutUrl } = VALID_BODY
    const res = await POST(makePOSTRequest(withoutUrl))
    expect(res.status).toBe(400)
  })

  it('retorna 400 quando procedure está ausente', async () => {
    const { procedure: _, ...withoutProcedure } = VALID_BODY
    const res = await POST(makePOSTRequest(withoutProcedure))
    expect(res.status).toBe(400)
  })

  it('retorna 401 sem autenticação', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await POST(makePOSTRequest(VALID_BODY))
    expect(res.status).toBe(401)
  })
})

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------
describe('DELETE /api/photos', () => {
  it('retorna 400 sem id', async () => {
    const res = await DELETE(makeDELETERequest())
    expect(res.status).toBe(400)
  })

  it('deleta somente fotos da própria empresa (tenant isolation)', async () => {
    vi.mocked(prisma.photoRecord.delete).mockResolvedValue(MOCK_PHOTO as unknown as PhotoRecord)
    await DELETE(makeDELETERequest('photo-1'))
    expect(prisma.photoRecord.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'photo-1', companyId: 'c1' } })
    )
  })

  it('retorna 401 sem autenticação', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await DELETE(makeDELETERequest('photo-1'))
    expect(res.status).toBe(401)
  })
})
