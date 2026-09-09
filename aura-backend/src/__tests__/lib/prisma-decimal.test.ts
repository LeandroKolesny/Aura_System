// aura-backend/src/__tests__/lib/prisma-decimal.test.ts
//
// REGRESSÃO: o card "Comissão Média" (Profissionais) chegou a mostrar 151180%
// em produção. Causa raiz: campos Decimal do Prisma (commissionRate, price,
// amount, currentStock...) serializam em JSON como STRING, não number. Sem
// conversão, `soma + item.campo` num reduce vira concatenação de string em
// vez de soma numérica. A extensão em @/lib/prisma converte isso globalmente,
// pra não depender de lembrar Number(...) em cada rota/consumidor.

import { describe, it, expect } from 'vitest'
import { Prisma } from '@prisma/client'
import { convertDecimalsToNumbers } from '@/lib/prisma'

describe('convertDecimalsToNumbers', () => {
  it('converte um Decimal solto em number', () => {
    const result = convertDecimalsToNumbers(new Prisma.Decimal('45.00'))
    expect(result).toBe(45)
    expect(typeof result).toBe('number')
  })

  it('converte campos Decimal dentro de um objeto plano', () => {
    const input = { id: 'u1', name: 'Bruna', commissionRate: new Prisma.Decimal('30.00') }
    const result = convertDecimalsToNumbers(input)
    expect(result.commissionRate).toBe(30)
    expect(typeof result.commissionRate).toBe('number')
    expect(result.name).toBe('Bruna') // campos não-Decimal ficam intactos
  })

  it('converte Decimal dentro de arrays (ex: findMany)', () => {
    const input = [
      { id: 'u1', commissionRate: new Prisma.Decimal('30') },
      { id: 'u2', commissionRate: new Prisma.Decimal('45') },
    ]
    const result = convertDecimalsToNumbers(input)
    expect(result.map(r => r.commissionRate)).toEqual([30, 45])

    // Prova a regressão: soma numérica correta, não concatenação de string.
    // (o tipo estático de commissionRate continua Decimal pois convertDecimalsToNumbers
    // preserva o tipo genérico de entrada; em runtime já é number - daí o Number() aqui.)
    const soma = result.reduce((s, r) => s + (Number(r.commissionRate) || 0), 0)
    expect(soma).toBe(75)
  })

  it('converte Decimal aninhado em objetos relacionados (include)', () => {
    const input = {
      id: 'appt-1',
      price: new Prisma.Decimal('1200.00'),
      procedure: { id: 'p1', cost: new Prisma.Decimal('460.00') },
    }
    const result = convertDecimalsToNumbers(input)
    expect(result.price).toBe(1200)
    expect(result.procedure.cost).toBe(460)
  })

  it('preserva null e undefined sem quebrar', () => {
    const input = { commissionRate: null, fixedSalary: undefined }
    const result = convertDecimalsToNumbers(input)
    expect(result.commissionRate).toBeNull()
    expect(result.fixedSalary).toBeUndefined()
  })

  it('preserva objetos Date intactos (não tenta iterar campos internos)', () => {
    const date = new Date('2026-01-01T00:00:00.000Z')
    const result = convertDecimalsToNumbers({ createdAt: date })
    expect(result.createdAt).toBe(date)
    expect(result.createdAt instanceof Date).toBe(true)
  })

  it('não quebra com valores primitivos (string, number, boolean)', () => {
    expect(convertDecimalsToNumbers('texto')).toBe('texto')
    expect(convertDecimalsToNumbers(42)).toBe(42)
    expect(convertDecimalsToNumbers(true)).toBe(true)
    expect(convertDecimalsToNumbers(null)).toBeNull()
  })
})
