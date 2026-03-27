import { describe, it, expect } from 'vitest'
import prisma from '@/lib/prisma'

describe('Transaction model — installment fields', () => {
  it('Transaction model has installments field', () => {
    const fields = Object.keys(prisma.transaction.fields)
    expect(fields).toContain('installments')
    expect(fields).toContain('installmentIndex')
    expect(fields).toContain('installmentGroupId')
    expect(fields).toContain('dueDate')
  })
})
