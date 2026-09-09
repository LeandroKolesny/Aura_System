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

  // REGRESSÃO CRÍTICA (produção): o NewPhotoModal do frontend sempre envia
  // type minúsculo ('before'/'after') — o enum aqui só aceitava maiúsculo,
  // então TODA foto enviada pelo app real falhava com 400, sem exceção
  // (só os testes acima, que usam 'BEFORE'/'AFTER' direto, passavam).
  it.each(['before', 'after', 'Before', 'AFTER'])('aceita type=%s (minúsculo/misto, como o frontend envia de verdade)', async (type) => {
    vi.mocked(prisma.photoRecord.create).mockResolvedValue(MOCK_PHOTO as unknown as PhotoRecord)
    const res = await POST(makePOSTRequest({ ...VALID_BODY, type }))
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

  // Regressão: o modal de upload do frontend ainda não envia a foto pra um
  // storage externo — ele converte o arquivo em base64 no navegador e manda
  // essa string como "url". Antes desse fix, toda tentativa de foto era
  // rejeitada com 400 porque o schema só aceitava http(s).
  it('aceita data URL de imagem base64 válida (foto enviada direto do upload)', async () => {
    vi.mocked(prisma.photoRecord.create).mockResolvedValue(MOCK_PHOTO as unknown as PhotoRecord)
    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
    const res = await POST(makePOSTRequest({ ...VALID_BODY, url: dataUrl }))
    expect(res.status).toBe(201)
  })

  it('aceita data URL de imagem jpeg/gif/webp', async () => {
    vi.mocked(prisma.photoRecord.create).mockResolvedValue(MOCK_PHOTO as unknown as PhotoRecord)
    for (const mime of ['image/jpeg', 'image/gif', 'image/webp']) {
      const res = await POST(makePOSTRequest({ ...VALID_BODY, url: `data:${mime};base64,QUJD` }))
      expect(res.status).toBe(201)
    }
  })

  it('SECURITY: rejeita data URL com mime type não-imagem (ex: text/html)', async () => {
    const res = await POST(makePOSTRequest({ ...VALID_BODY, url: 'data:text/html;base64,PHNjcmlwdD4=' }))
    expect(res.status).toBe(400)
  })

  it('SECURITY: rejeita data URL com payload não-base64', async () => {
    const res = await POST(makePOSTRequest({ ...VALID_BODY, url: 'data:image/png,<script>alert(1)</script>' }))
    expect(res.status).toBe(400)
  })

  // REGRESSÃO CRÍTICA (produção): o campo de data do NewPhotoModal é um
  // <input type="date">, que só envia "YYYY-MM-DD" — z.string().datetime()
  // exige o formato ISO completo (com hora/timezone) e rejeitava isso,
  // quebrando toda foto que tivesse uma data preenchida (ou seja, sempre,
  // já que o campo tem um valor default e é obrigatório no formulário).
  it('aceita date no formato YYYY-MM-DD do <input type="date"> (como o frontend envia de verdade)', async () => {
    vi.mocked(prisma.photoRecord.create).mockResolvedValue(MOCK_PHOTO as unknown as PhotoRecord)
    const res = await POST(makePOSTRequest({ ...VALID_BODY, date: '2026-09-09' }))
    expect(res.status).toBe(201)
    expect(prisma.photoRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ date: new Date('2026-09-09') }) })
    )
  })

  it('aceita date em ISO datetime completo também', async () => {
    vi.mocked(prisma.photoRecord.create).mockResolvedValue(MOCK_PHOTO as unknown as PhotoRecord)
    const res = await POST(makePOSTRequest({ ...VALID_BODY, date: '2026-09-09T14:30:00.000Z' }))
    expect(res.status).toBe(201)
  })

  it('retorna 400 quando date não é uma data válida', async () => {
    const res = await POST(makePOSTRequest({ ...VALID_BODY, date: 'não-é-uma-data' }))
    expect(res.status).toBe(400)
  })

  it('usa a data atual quando date não é informado', async () => {
    vi.mocked(prisma.photoRecord.create).mockResolvedValue(MOCK_PHOTO as unknown as PhotoRecord)
    const { date: _date, ...withoutDate } = VALID_BODY as Record<string, unknown>
    const res = await POST(makePOSTRequest(withoutDate))
    expect(res.status).toBe(201)
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
