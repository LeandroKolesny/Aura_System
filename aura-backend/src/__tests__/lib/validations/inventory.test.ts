// aura-backend/src/__tests__/lib/validations/inventory.test.ts
import { describe, it, expect } from 'vitest'
import {
  createInventoryItemSchema,
  updateInventoryItemSchema,
  stockAdjustmentSchema,
  listInventoryQuerySchema,
} from '@/lib/validations/inventory'

describe('createInventoryItemSchema', () => {
  it('dados válidos → sucesso, minStock default 5', () => {
    const result = createInventoryItemSchema.safeParse({
      name: 'Toxina Botulínica',
      unit: 'ml',
      currentStock: 10,
      costPerUnit: 50,
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.minStock).toBe(5)
  })

  it('name com 1 caractere → falha (mínimo 2)', () => {
    const result = createInventoryItemSchema.safeParse({ name: 'A', unit: 'ml', currentStock: 10, costPerUnit: 50 })
    expect(result.success).toBe(false)
  })

  it('unit vazio → falha', () => {
    const result = createInventoryItemSchema.safeParse({ name: 'Item', unit: '', currentStock: 10, costPerUnit: 50 })
    expect(result.success).toBe(false)
  })

  it('currentStock negativo → falha', () => {
    const result = createInventoryItemSchema.safeParse({ name: 'Item', unit: 'ml', currentStock: -1, costPerUnit: 50 })
    expect(result.success).toBe(false)
  })

  it('currentStock zero → sucesso (zero é permitido, só não pode ser negativo)', () => {
    const result = createInventoryItemSchema.safeParse({ name: 'Item', unit: 'ml', currentStock: 0, costPerUnit: 50 })
    expect(result.success).toBe(true)
  })

  it('costPerUnit negativo → falha', () => {
    const result = createInventoryItemSchema.safeParse({ name: 'Item', unit: 'ml', currentStock: 10, costPerUnit: -5 })
    expect(result.success).toBe(false)
  })

  it('minStock negativo → falha', () => {
    const result = createInventoryItemSchema.safeParse({ name: 'Item', unit: 'ml', currentStock: 10, costPerUnit: 50, minStock: -1 })
    expect(result.success).toBe(false)
  })
})

describe('updateInventoryItemSchema', () => {
  it('objeto vazio → sucesso (todos os campos são opcionais no update)', () => {
    expect(updateInventoryItemSchema.safeParse({}).success).toBe(true)
  })

  it('apenas currentStock → sucesso', () => {
    expect(updateInventoryItemSchema.safeParse({ currentStock: 20 }).success).toBe(true)
  })

  it('currentStock negativo → falha mesmo em update parcial', () => {
    expect(updateInventoryItemSchema.safeParse({ currentStock: -1 }).success).toBe(false)
  })
})

describe('stockAdjustmentSchema', () => {
  it('ajuste válido de entrada (IN) → sucesso', () => {
    const result = stockAdjustmentSchema.safeParse({ quantity: 10, type: 'IN', reason: 'Reposição de estoque' })
    expect(result.success).toBe(true)
  })

  it('quantity zero → falha (não pode ser zero)', () => {
    const result = stockAdjustmentSchema.safeParse({ quantity: 0, type: 'IN', reason: 'Reposição' })
    expect(result.success).toBe(false)
  })

  it('quantity negativa → sucesso (negativo representa saída, só zero é proibido)', () => {
    const result = stockAdjustmentSchema.safeParse({ quantity: -5, type: 'OUT', reason: 'Uso em procedimento' })
    expect(result.success).toBe(true)
  })

  it('type inválido → falha', () => {
    const result = stockAdjustmentSchema.safeParse({ quantity: 5, type: 'INVALID', reason: 'Motivo qualquer' })
    expect(result.success).toBe(false)
  })

  it.each(['IN', 'OUT', 'ADJUSTMENT', 'LOSS'])('type=%s → sucesso', (type) => {
    const result = stockAdjustmentSchema.safeParse({ quantity: 5, type, reason: 'Motivo válido' })
    expect(result.success).toBe(true)
  })

  it('reason com 2 caracteres → falha (mínimo 3)', () => {
    const result = stockAdjustmentSchema.safeParse({ quantity: 5, type: 'IN', reason: 'Ab' })
    expect(result.success).toBe(false)
  })
})

describe('listInventoryQuerySchema', () => {
  it('sem parâmetros → aplica defaults (page 1, limit 50, isActive "true")', () => {
    const result = listInventoryQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(1)
      expect(result.data.limit).toBe(50)
      expect(result.data.isActive).toBe('true')
    }
  })

  it('valores de query string (null) são tratados como ausentes', () => {
    const result = listInventoryQuerySchema.safeParse({ page: null, search: null, lowStock: null })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.page).toBe(1)
  })

  it('limit acima de 100 → falha', () => {
    const result = listInventoryQuerySchema.safeParse({ limit: 101 })
    expect(result.success).toBe(false)
  })

  it('lowStock com valor inválido → falha', () => {
    const result = listInventoryQuerySchema.safeParse({ lowStock: 'talvez' })
    expect(result.success).toBe(false)
  })
})
