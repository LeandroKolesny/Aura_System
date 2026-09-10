// aura-backend/src/__tests__/lib/validations/procedure.test.ts
import { describe, it, expect } from 'vitest'
import {
  createProcedureSchema,
  updateProcedureSchema,
  listProceduresQuerySchema,
} from '@/lib/validations/procedure'

describe('createProcedureSchema', () => {
  it('dados mínimos válidos → sucesso, com defaults (cost 0, isActive true, supplies [])', () => {
    const result = createProcedureSchema.safeParse({ name: 'Botox', price: 800, durationMinutes: 30 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.cost).toBe(0)
      expect(result.data.isActive).toBe(true)
      expect(result.data.maintenanceRequired).toBe(false)
      expect(result.data.supplies).toEqual([])
    }
  })

  it('name com 2 caracteres → falha (mínimo 3)', () => {
    const result = createProcedureSchema.safeParse({ name: 'Bo', price: 800, durationMinutes: 30 })
    expect(result.success).toBe(false)
  })

  it('price negativo → falha', () => {
    const result = createProcedureSchema.safeParse({ name: 'Botox', price: -10, durationMinutes: 30 })
    expect(result.success).toBe(false)
  })

  it('price zero → sucesso (procedimento cortesia é permitido)', () => {
    const result = createProcedureSchema.safeParse({ name: 'Avaliação', price: 0, durationMinutes: 30 })
    expect(result.success).toBe(true)
  })

  it('durationMinutes abaixo de 15 → falha', () => {
    const result = createProcedureSchema.safeParse({ name: 'Botox', price: 800, durationMinutes: 10 })
    expect(result.success).toBe(false)
  })

  it('durationMinutes acima de 480 (8h) → falha', () => {
    const result = createProcedureSchema.safeParse({ name: 'Botox', price: 800, durationMinutes: 481 })
    expect(result.success).toBe(false)
  })

  it('imageUrl inválida → falha', () => {
    const result = createProcedureSchema.safeParse({ name: 'Botox', price: 800, durationMinutes: 30, imageUrl: 'not-a-url' })
    expect(result.success).toBe(false)
  })

  it('imageUrl nula → sucesso', () => {
    const result = createProcedureSchema.safeParse({ name: 'Botox', price: 800, durationMinutes: 30, imageUrl: null })
    expect(result.success).toBe(true)
  })

  it('supplies com quantityUsed zero → falha (deve ser positivo)', () => {
    const result = createProcedureSchema.safeParse({
      name: 'Botox', price: 800, durationMinutes: 30,
      supplies: [{ inventoryItemId: 'item-1', quantityUsed: 0 }],
    })
    expect(result.success).toBe(false)
  })

  it('supplies com inventoryItemId vazio → falha', () => {
    const result = createProcedureSchema.safeParse({
      name: 'Botox', price: 800, durationMinutes: 30,
      supplies: [{ inventoryItemId: '', quantityUsed: 1 }],
    })
    expect(result.success).toBe(false)
  })

  it('CARACTERIZAÇÃO (Bug 3 / Opção B): supply manual sem inventoryItemId → falha (schema exige vínculo de estoque; insumos manuais não são persistidos)', () => {
    const result = createProcedureSchema.safeParse({
      name: 'Botox', price: 800, durationMinutes: 30,
      supplies: [{ name: 'Luva descartável', quantityUsed: 1, cost: 2 }],
    })
    expect(result.success).toBe(false)
  })

  it('supplies válido → sucesso', () => {
    const result = createProcedureSchema.safeParse({
      name: 'Botox', price: 800, durationMinutes: 30,
      supplies: [{ inventoryItemId: 'item-1', quantityUsed: 2 }],
    })
    expect(result.success).toBe(true)
  })

  it('description acima de 500 caracteres → falha', () => {
    const result = createProcedureSchema.safeParse({ name: 'Botox', price: 800, durationMinutes: 30, description: 'x'.repeat(501) })
    expect(result.success).toBe(false)
  })
})

describe('updateProcedureSchema', () => {
  it('objeto vazio → sucesso (update parcial)', () => {
    expect(updateProcedureSchema.safeParse({}).success).toBe(true)
  })

  it('apenas price → sucesso', () => {
    expect(updateProcedureSchema.safeParse({ price: 900 }).success).toBe(true)
  })

  it('durationMinutes inválido → falha mesmo em update parcial', () => {
    expect(updateProcedureSchema.safeParse({ durationMinutes: 5 }).success).toBe(false)
  })
})

describe('listProceduresQuerySchema', () => {
  it('sem parâmetros → defaults (page 1, limit 50, isActive "true")', () => {
    const result = listProceduresQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(1)
      expect(result.data.isActive).toBe('true')
    }
  })

  it('isActive="all" → sucesso', () => {
    const result = listProceduresQuerySchema.safeParse({ isActive: 'all' })
    expect(result.success).toBe(true)
  })

  it('isActive com valor inválido → falha', () => {
    const result = listProceduresQuerySchema.safeParse({ isActive: 'talvez' })
    expect(result.success).toBe(false)
  })
})
