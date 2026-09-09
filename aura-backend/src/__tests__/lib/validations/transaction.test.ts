// aura-backend/src/__tests__/lib/validations/transaction.test.ts
import { describe, it, expect } from 'vitest'
import {
  createTransactionSchema,
  processPaymentSchema,
  updateTransactionSchema,
  listTransactionsQuerySchema,
} from '@/lib/validations/transaction'

describe('createTransactionSchema', () => {
  const BASE = { date: '2026-09-08', description: 'Venda de produto', amount: 150, type: 'INCOME' as const, category: 'Produtos' }

  it('dados válidos → sucesso, status default PENDING', () => {
    const result = createTransactionSchema.safeParse(BASE)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.status).toBe('PENDING')
  })

  it('date inválida → falha', () => {
    const result = createTransactionSchema.safeParse({ ...BASE, date: 'não-é-uma-data' })
    expect(result.success).toBe(false)
  })

  it('description com 2 caracteres → falha (mínimo 3)', () => {
    const result = createTransactionSchema.safeParse({ ...BASE, description: 'Ab' })
    expect(result.success).toBe(false)
  })

  it('amount zero → falha (deve ser positivo)', () => {
    const result = createTransactionSchema.safeParse({ ...BASE, amount: 0 })
    expect(result.success).toBe(false)
  })

  it('amount negativo → falha', () => {
    const result = createTransactionSchema.safeParse({ ...BASE, amount: -50 })
    expect(result.success).toBe(false)
  })

  it('type inválido → falha', () => {
    const result = createTransactionSchema.safeParse({ ...BASE, type: 'TRANSFER' })
    expect(result.success).toBe(false)
  })

  it('category vazia → falha', () => {
    const result = createTransactionSchema.safeParse({ ...BASE, category: '' })
    expect(result.success).toBe(false)
  })

  it('status explícito PAID → sucesso', () => {
    const result = createTransactionSchema.safeParse({ ...BASE, status: 'PAID' })
    expect(result.success).toBe(true)
  })
})

describe('processPaymentSchema', () => {
  it('dados mínimos → sucesso, discount default 0', () => {
    const result = processPaymentSchema.safeParse({ appointmentId: 'appt-1', paymentMethod: 'pix' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.discount).toBe(0)
  })

  it('appointmentId vazio → falha', () => {
    const result = processPaymentSchema.safeParse({ appointmentId: '', paymentMethod: 'pix' })
    expect(result.success).toBe(false)
  })

  it('paymentMethod vazio → falha', () => {
    const result = processPaymentSchema.safeParse({ appointmentId: 'appt-1', paymentMethod: '' })
    expect(result.success).toBe(false)
  })

  it('amount negativo (quando informado) → falha', () => {
    const result = processPaymentSchema.safeParse({ appointmentId: 'appt-1', paymentMethod: 'pix', amount: -10 })
    expect(result.success).toBe(false)
  })

  it('discount negativo → falha', () => {
    const result = processPaymentSchema.safeParse({ appointmentId: 'appt-1', paymentMethod: 'pix', discount: -5 })
    expect(result.success).toBe(false)
  })
})

describe('updateTransactionSchema', () => {
  it('objeto vazio → sucesso (update parcial)', () => {
    expect(updateTransactionSchema.safeParse({}).success).toBe(true)
  })

  it('status REFUNDED (só permitido no update, não no create) → sucesso', () => {
    expect(updateTransactionSchema.safeParse({ status: 'REFUNDED' }).success).toBe(true)
  })

  it('amount zero → falha mesmo em update parcial', () => {
    expect(updateTransactionSchema.safeParse({ amount: 0 }).success).toBe(false)
  })
})

describe('listTransactionsQuerySchema', () => {
  it('sem parâmetros → defaults (page 1, limit 50)', () => {
    const result = listTransactionsQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(1)
      expect(result.data.limit).toBe(50)
    }
  })

  it('type="all" → sucesso', () => {
    expect(listTransactionsQuerySchema.safeParse({ type: 'all' }).success).toBe(true)
  })

  it('status="OVERDUE" → sucesso (só existe no filtro de listagem, não é status real gravável)', () => {
    expect(listTransactionsQuerySchema.safeParse({ status: 'OVERDUE' }).success).toBe(true)
  })

  it('type com valor inválido → falha', () => {
    expect(listTransactionsQuerySchema.safeParse({ type: 'TRANSFER' }).success).toBe(false)
  })

  it('limit acima de 100 → falha', () => {
    expect(listTransactionsQuerySchema.safeParse({ limit: 200 }).success).toBe(false)
  })
})
