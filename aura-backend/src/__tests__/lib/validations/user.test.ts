// aura-backend/src/__tests__/lib/validations/user.test.ts
//
// Testes diretos do schema (a rota PUT /api/users/[id] já é coberta em
// api/users-id.test.ts, mas o schema em si — especialmente os aliases de
// remunerationType — não tinha teste dedicado até agora).
import { describe, it, expect } from 'vitest'
import { updateUserSchema, createUserSchema } from '@/lib/validations/user'

describe('updateUserSchema', () => {
  it('objeto vazio → sucesso (update parcial)', () => {
    expect(updateUserSchema.safeParse({}).success).toBe(true)
  })

  it('name com 2 caracteres → falha (mínimo 3)', () => {
    expect(updateUserSchema.safeParse({ name: 'Ab' }).success).toBe(false)
  })

  it('email inválido → falha', () => {
    expect(updateUserSchema.safeParse({ email: 'não-é-email' }).success).toBe(false)
  })

  describe('role — aceita minúsculo/maiúsculo (upperEnum)', () => {
    it.each(['ADMIN', 'admin', 'Admin'])('role=%s → normaliza para ADMIN', (role) => {
      const result = updateUserSchema.safeParse({ role })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.role).toBe('ADMIN')
    })

    it('role inválido → falha', () => {
      expect(updateUserSchema.safeParse({ role: 'SUPERADMIN' }).success).toBe(false)
    })
  })

  describe('contractType — aceita minúsculo/maiúsculo', () => {
    it.each(['PJ', 'pj', 'CLT', 'clt', 'FREELANCER', 'freelancer'])('contractType=%s → aceito', (contractType) => {
      expect(updateUserSchema.safeParse({ contractType }).success).toBe(true)
    })

    it('contractType inválido → falha', () => {
      expect(updateUserSchema.safeParse({ contractType: 'ESTAGIO' }).success).toBe(false)
    })
  })

  // REGRESSÃO: PUT /api/users/:id retornava 400 "Dados inválidos" pra todo
  // profissional com remuneração por comissão, porque o schema só fazia
  // .toUpperCase() ("comissao" → "COMISSAO", que não bate com "COMMISSION").
  describe('remunerationType — aliases PT-BR/EN (regressão da Comissão Média)', () => {
    it.each([
      ['fixo', 'FIXED'], ['FIXO', 'FIXED'], ['fixed', 'FIXED'], ['FIXED', 'FIXED'],
      ['comissao', 'COMMISSION'], ['COMISSAO', 'COMMISSION'], ['commission', 'COMMISSION'], ['COMMISSION', 'COMMISSION'],
      ['misto', 'MIXED'], ['MISTO', 'MIXED'], ['mixed', 'MIXED'], ['MIXED', 'MIXED'],
    ])('remunerationType=%s → normaliza para %s', (input, expected) => {
      const result = updateUserSchema.safeParse({ remunerationType: input })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.remunerationType).toBe(expected)
    })

    it('remunerationType com valor não mapeado e inválido → falha', () => {
      expect(updateUserSchema.safeParse({ remunerationType: 'hora' }).success).toBe(false)
    })
  })

  describe('commissionRate / fixedSalary', () => {
    it('commissionRate como string numérica → coage para number', () => {
      const result = updateUserSchema.safeParse({ commissionRate: '30' })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.commissionRate).toBe(30)
    })

    it('commissionRate acima de 100 → falha', () => {
      expect(updateUserSchema.safeParse({ commissionRate: 101 }).success).toBe(false)
    })

    it('commissionRate negativo → falha', () => {
      expect(updateUserSchema.safeParse({ commissionRate: -1 }).success).toBe(false)
    })

    it('fixedSalary negativo → falha', () => {
      expect(updateUserSchema.safeParse({ fixedSalary: -100 }).success).toBe(false)
    })

    it('commissionRate null → sucesso (permite limpar o campo)', () => {
      expect(updateUserSchema.safeParse({ commissionRate: null }).success).toBe(true)
    })
  })

  it('businessHours como objeto arbitrário → sucesso', () => {
    const result = updateUserSchema.safeParse({ businessHours: { monday: { start: '08:00', end: '18:00' } } })
    expect(result.success).toBe(true)
  })

  it('isActive boolean → sucesso', () => {
    expect(updateUserSchema.safeParse({ isActive: false }).success).toBe(true)
  })
})

describe('createUserSchema (POST /api/users)', () => {
  const base = { name: 'Fulano de Tal', email: 'fulano@x.com' }

  it('name e email são obrigatórios', () => {
    expect(createUserSchema.safeParse({ email: 'x@x.com' }).success).toBe(false)
    expect(createUserSchema.safeParse({ name: 'Fulano' }).success).toBe(false)
  })

  it('name com menos de 3 caracteres → falha', () => {
    expect(createUserSchema.safeParse({ ...base, name: 'Ab' }).success).toBe(false)
  })

  it('commissionRate negativo → falha', () => {
    expect(createUserSchema.safeParse({ ...base, commissionRate: -1 }).success).toBe(false)
  })

  it('commissionRate acima de 100 → falha', () => {
    expect(createUserSchema.safeParse({ ...base, commissionRate: 101 }).success).toBe(false)
  })

  it('commissionRate dentro de 0-100 → sucesso', () => {
    expect(createUserSchema.safeParse({ ...base, commissionRate: 0 }).success).toBe(true)
    expect(createUserSchema.safeParse({ ...base, commissionRate: 100 }).success).toBe(true)
  })

  it('fixedSalary negativo → falha; zero e positivo → sucesso', () => {
    expect(createUserSchema.safeParse({ ...base, fixedSalary: -100 }).success).toBe(false)
    expect(createUserSchema.safeParse({ ...base, fixedSalary: 0 }).success).toBe(true)
    expect(createUserSchema.safeParse({ ...base, fixedSalary: 3000 }).success).toBe(true)
  })

  it('commissionRate/fixedSalary null → sucesso (opcional)', () => {
    expect(createUserSchema.safeParse({ ...base, commissionRate: null, fixedSalary: null }).success).toBe(true)
  })

  it('commissionRate como string numérica é coagida ("50" → 50)', () => {
    const r = createUserSchema.safeParse({ ...base, commissionRate: '50' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.commissionRate).toBe(50)
  })
})
