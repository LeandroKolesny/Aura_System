// aura-backend/src/__tests__/api/users-id.test.ts
// Testes para PUT/DELETE /api/users/[id]
//
// Regressão: editar/remover um profissional nunca funcionou de verdade —
// o frontend chamava funções que só mexiam no estado local (comentário no
// código: "API de update/delete não existe ainda"). Esta rota é a correção.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    user: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))
vi.mock('@/lib/apiGuards', () => ({ checkWriteAccess: vi.fn().mockResolvedValue(null) }))

import { PUT, DELETE } from '../../app/api/users/[id]/route'
import { getAuthUser } from '@/lib/auth'
import { checkWriteAccess } from '@/lib/apiGuards'
import prisma from '@/lib/prisma'

const ADMIN = { id: 'admin-1', email: 'admin@clinica.com', role: 'ADMIN', companyId: 'c1' }
const ESTHETICIAN = { id: 'est-1', email: 'esteticista@clinica.com', role: 'ESTHETICIAN', companyId: 'c1' }
const EXISTING_PROF = { id: 'p1', companyId: 'c1', email: 'prof@clinica.com', name: 'Profissional Teste' }

function makePutRequest(body: unknown) {
  return new NextRequest('http://localhost/api/users/p1', {
    method: 'PUT', body: JSON.stringify(body), headers: { 'content-type': 'application/json' },
  })
}
function makeDeleteRequest() {
  return new NextRequest('http://localhost/api/users/p1', { method: 'DELETE' })
}
function makeParams(id = 'p1') {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(checkWriteAccess).mockResolvedValue(null)
})

describe('PUT /api/users/[id]', () => {
  it('retorna 401 sem autenticação', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await PUT(makePutRequest({ name: 'Novo Nome' }), makeParams())
    expect(res.status).toBe(401)
  })

  it('retorna 403 sem empresa', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ ...ADMIN, companyId: null } as never)
    const res = await PUT(makePutRequest({ name: 'X' }), makeParams())
    expect(res.status).toBe(403)
  })

  it('SECURITY: retorna 403 quando o usuário não é ADMIN/OWNER (ex: ESTHETICIAN)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ESTHETICIAN as never)
    const res = await PUT(makePutRequest({ name: 'X' }), makeParams())
    expect(res.status).toBe(403)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('retorna 404 quando o profissional não existe (ou é de outra empresa)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null)
    const res = await PUT(makePutRequest({ name: 'X' }), makeParams())
    expect(res.status).toBe(404)
  })

  it('retorna 400 com dados inválidos (ex: email malformado)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.user.findFirst).mockResolvedValue(EXISTING_PROF as never)
    const res = await PUT(makePutRequest({ email: 'nao-e-email' }), makeParams())
    expect(res.status).toBe(400)
  })

  it('retorna 409 quando o novo e-mail já pertence a outro usuário', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.user.findFirst).mockResolvedValue(EXISTING_PROF as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'outro' } as never)
    const res = await PUT(makePutRequest({ email: 'outro@clinica.com' }), makeParams())
    expect(res.status).toBe(409)
  })

  it('atualiza o profissional com sucesso e normaliza role/contractType minúsculos', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.user.findFirst).mockResolvedValue(EXISTING_PROF as never)
    vi.mocked(prisma.user.update).mockResolvedValue({ ...EXISTING_PROF, name: 'Nome Atualizado' } as never)

    const res = await PUT(makePutRequest({ name: 'Nome Atualizado', contractType: 'clt' }), makeParams())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.user.name).toBe('Nome Atualizado')
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'p1' }, data: expect.objectContaining({ name: 'Nome Atualizado', contractType: 'CLT' }) })
    )
  })

  it('reativa um profissional desativado com { isActive: true }', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ ...EXISTING_PROF, isActive: false } as never)
    vi.mocked(prisma.user.update).mockResolvedValue({ ...EXISTING_PROF, isActive: true } as never)

    const res = await PUT(makePutRequest({ isActive: true }), makeParams())

    expect(res.status).toBe(200)
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'p1' }, data: expect.objectContaining({ isActive: true }) })
    )
  })

  it('retorna 500 e mensagem genérica quando o banco falha inesperadamente', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.user.findFirst).mockResolvedValue(EXISTING_PROF as never)
    vi.mocked(prisma.user.update).mockRejectedValue(new Error('conexão perdida'))

    const res = await PUT(makePutRequest({ name: 'Nome Válido' }), makeParams())
    const body = await res.json()
    expect(res.status).toBe(500)
    expect(body.error).toBe('Erro inesperado.')
  })

  // REGRESSÃO: o modal de profissional no frontend envia remunerationType em
  // português minúsculo ('fixo'/'comissao'/'misto'), não em inglês/maiúsculo.
  // Sem o alias, "comissao".toUpperCase() = "COMISSAO", que não bate com
  // nenhum valor do enum — a rota retornava 400 "Dados inválidos" pra TODA
  // edição de profissional com comissão, mesmo com todos os campos corretos.
  it.each([
    ['fixo', 'FIXED'],
    ['comissao', 'COMMISSION'],
    ['misto', 'MIXED'],
    ['FIXED', 'FIXED'],
    ['COMMISSION', 'COMMISSION'],
  ])('aceita remunerationType em português ou inglês: "%s" -> %s', async (input, expected) => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.user.findFirst).mockResolvedValue(EXISTING_PROF as never)
    vi.mocked(prisma.user.update).mockResolvedValue({ ...EXISTING_PROF, remunerationType: expected } as never)

    const res = await PUT(makePutRequest({ remunerationType: input }), makeParams())
    expect(res.status).toBe(200)
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ remunerationType: expected }) })
    )
  })
})

describe('PUT /api/users/[id] — validação de businessHours do profissional', () => {
  const DAY = { isOpen: true, start: '08:00', end: '18:00' }
  const VALID_HOURS = {
    monday: DAY, tuesday: DAY, wednesday: DAY, thursday: DAY, friday: DAY,
    saturday: { isOpen: true, start: '09:00', end: '13:00' },
    sunday: { isOpen: false, start: '00:00', end: '00:00' },
  }

  beforeEach(() => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.user.findFirst).mockResolvedValue(EXISTING_PROF as never)
    vi.mocked(prisma.user.update).mockResolvedValue({ ...EXISTING_PROF, businessHours: VALID_HOURS } as never)
  })

  it('rejeita (400) businessHours com dia aberto e abertura >= fechamento', async () => {
    const res = await PUT(
      makePutRequest({ businessHours: { ...VALID_HOURS, monday: { isOpen: true, start: '18:00', end: '08:00' } } }),
      makeParams()
    )
    expect(res.status).toBe(400)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('rejeita (400) businessHours com tipo inválido (start numérico)', async () => {
    const res = await PUT(
      makePutRequest({ businessHours: { ...VALID_HOURS, tuesday: { isOpen: true, start: 123, end: '18:00' } } }),
      makeParams()
    )
    expect(res.status).toBe(400)
  })

  it('rejeita (400) businessHours parcial (faltando dias)', async () => {
    const res = await PUT(makePutRequest({ businessHours: { monday: DAY } }), makeParams())
    expect(res.status).toBe(400)
  })

  it('aceita e persiste um businessHours válido do profissional (7 dias)', async () => {
    const res = await PUT(makePutRequest({ businessHours: VALID_HOURS }), makeParams())
    expect(res.status).toBe(200)
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ businessHours: VALID_HOURS }) })
    )
  })

  it('aceita businessHours: null (limpar o horário individual)', async () => {
    const res = await PUT(makePutRequest({ businessHours: null }), makeParams())
    expect(res.status).toBe(200)
  })

  it('aceita businessHours: {} (profissional herda o horário da empresa)', async () => {
    const res = await PUT(makePutRequest({ businessHours: {} }), makeParams())
    expect(res.status).toBe(200)
  })
})

describe('DELETE /api/users/[id]', () => {
  it('retorna 401 sem autenticação', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await DELETE(makeDeleteRequest(), makeParams())
    expect(res.status).toBe(401)
  })

  it('SECURITY: bloqueia quem não é ADMIN/OWNER', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ESTHETICIAN as never)
    const res = await DELETE(makeDeleteRequest(), makeParams())
    expect(res.status).toBe(403)
  })

  it('SECURITY: bloqueia o usuário tentando remover a si mesmo', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    const res = await DELETE(makeDeleteRequest(), makeParams('admin-1'))
    expect(res.status).toBe(409)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('retorna 404 quando o profissional não existe (ou é de outra empresa)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null)
    const res = await DELETE(makeDeleteRequest(), makeParams())
    expect(res.status).toBe(404)
  })

  it('desativa o profissional (soft delete, isActive:false) em vez de apagar de verdade', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.user.findFirst).mockResolvedValue(EXISTING_PROF as never)
    vi.mocked(prisma.user.update).mockResolvedValue({ ...EXISTING_PROF, isActive: false } as never)

    const res = await DELETE(makeDeleteRequest(), makeParams())
    expect(res.status).toBe(200)
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { isActive: false } })
  })
})
