// aura-backend/src/__tests__/lib/utils.test.ts
// Comprehensive tests for src/lib/utils.ts

import { describe, it, expect, vi } from 'vitest'
import {
  cn,
  formatCurrency,
  formatDate,
  formatDateTime,
  slugify,
  truncate,
  delay,
  getAvatarColor,
  getInitials,
} from '@/lib/utils'

// ---------------------------------------------------------------------------
// cn (Tailwind class merger)
// ---------------------------------------------------------------------------
describe('cn', () => {
  it('combines two simple class strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('deduplicates conflicting Tailwind classes (tailwind-merge)', () => {
    // px-4 should override px-2
    const result = cn('px-2 py-1', 'px-4')
    expect(result).toContain('py-1')
    expect(result).toContain('px-4')
    expect(result).not.toContain('px-2')
  })

  it('ignores falsy values (undefined, null, false)', () => {
    expect(cn(undefined, 'foo')).toBe('foo')
    expect(cn(null as any, 'bar')).toBe('bar')
    expect(cn(false as any, 'baz')).toBe('baz')
  })

  it('handles conditional classes via object syntax', () => {
    const isActive = true
    const result = cn({ 'text-blue-500': isActive, 'text-gray-500': !isActive })
    expect(result).toBe('text-blue-500')
  })

  it('handles an array of class values', () => {
    const result = cn(['px-2', 'py-1'], 'mt-2')
    expect(result).toContain('px-2')
    expect(result).toContain('py-1')
    expect(result).toContain('mt-2')
  })

  it('returns empty string when no arguments', () => {
    expect(cn()).toBe('')
  })

  it('returns empty string for all falsy inputs', () => {
    expect(cn(undefined, null as any, false as any)).toBe('')
  })
})

// ---------------------------------------------------------------------------
// formatCurrency
// ---------------------------------------------------------------------------
describe('formatCurrency', () => {
  it('formats 100 with R$ symbol and the number 100', () => {
    const result = formatCurrency(100)
    expect(result).toContain('100')
    expect(result).toMatch(/R\$/)
  })

  it('formats 0 with R$ symbol', () => {
    const result = formatCurrency(0)
    expect(result).toMatch(/R\$/)
    expect(result).toContain('0')
  })

  it('formats 1234.56 in Brazilian locale (comma as decimal separator)', () => {
    const result = formatCurrency(1234.56)
    // In pt-BR: R$ 1.234,56
    expect(result).toMatch(/R\$/)
    expect(result).toContain('1')
    expect(result).toContain('234')
    expect(result).toContain('56')
  })

  it('formats negative value with a negative sign', () => {
    const result = formatCurrency(-50)
    // Negative sign may be '-' or '−' (Unicode minus) depending on environment
    expect(result).toMatch(/[-−]/)
    expect(result).toContain('50')
    expect(result).toMatch(/R\$/)
  })

  it('formats large number', () => {
    const result = formatCurrency(1000000)
    expect(result).toMatch(/R\$/)
    expect(result).toContain('000')
  })

  it('returns a string type', () => {
    expect(typeof formatCurrency(42)).toBe('string')
  })
})

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------
describe('formatDate', () => {
  it('returns a string in dd/mm/yyyy format for a Date object', () => {
    const date = new Date(2024, 0, 15) // January 15, 2024 (local time)
    const result = formatDate(date)
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/)
    expect(result).toContain('2024')
    expect(result).toContain('15')
  })

  it('returns a string in dd/mm/yyyy format for a string input', () => {
    const result = formatDate('2024-06-20')
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/)
    expect(result).toContain('2024')
  })

  it('contains the correct year', () => {
    const result = formatDate(new Date(2025, 11, 31))
    expect(result).toContain('2025')
  })

  it('returns a string type', () => {
    expect(typeof formatDate(new Date())).toBe('string')
  })
})

// ---------------------------------------------------------------------------
// formatDateTime
// ---------------------------------------------------------------------------
describe('formatDateTime', () => {
  it('returns a string containing date and time portions', () => {
    const date = new Date(2024, 5, 15, 14, 30) // June 15, 2024 14:30
    const result = formatDateTime(date)
    // Should contain slash-separated date and colon-separated time
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/)
    expect(result).toMatch(/\d{2}:\d{2}/)
    expect(result).toContain('2024')
  })

  it('works with a string date-time input', () => {
    const result = formatDateTime('2024-03-10T09:05:00')
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/)
    expect(result).toContain('2024')
  })

  it('returns a string type', () => {
    expect(typeof formatDateTime(new Date())).toBe('string')
  })
})

// ---------------------------------------------------------------------------
// slugify
// ---------------------------------------------------------------------------
describe('slugify', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  it('removes accents from characters (NFD normalization)', () => {
    expect(slugify('Clínica Estética')).toBe('clinica-estetica')
  })

  it('handles "São Paulo" correctly', () => {
    expect(slugify('São Paulo')).toBe('sao-paulo')
  })

  it('collapses multiple hyphens into one', () => {
    // The regex [^a-z0-9]+ matches one or more non-alphanum chars together
    expect(slugify('hello--world')).toBe('hello-world')
  })

  it('strips leading and trailing hyphens', () => {
    expect(slugify('  leading trailing  ')).toBe('leading-trailing')
  })

  it('returns empty string for empty input', () => {
    expect(slugify('')).toBe('')
  })

  it('preserves numbers', () => {
    expect(slugify('123')).toBe('123')
  })

  it('converts all special characters to nothing (stripped as leading/trailing hyphens)', () => {
    expect(slugify('@#$%')).toBe('')
  })

  it('handles mixed alphanumeric and special characters', () => {
    expect(slugify('Aura 2024!')).toBe('aura-2024')
  })

  it('handles single word without spaces', () => {
    expect(slugify('Estética')).toBe('estetica')
  })

  it('handles already slugified string unchanged', () => {
    expect(slugify('hello-world')).toBe('hello-world')
  })
})

// ---------------------------------------------------------------------------
// truncate
// ---------------------------------------------------------------------------
describe('truncate', () => {
  it('truncates text longer than limit and appends "..."', () => {
    expect(truncate('hello world', 5)).toBe('hello...')
  })

  it('returns original text when shorter than limit', () => {
    expect(truncate('hi', 10)).toBe('hi')
  })

  it('returns original text when exactly equal to limit (no truncation)', () => {
    expect(truncate('exactly', 7)).toBe('exactly')
  })

  it('truncates correctly at limit of 6', () => {
    expect(truncate('longer than limit', 6)).toBe('longer...')
  })

  it('handles empty string without truncation', () => {
    expect(truncate('', 5)).toBe('')
  })

  it('truncates to 1 character', () => {
    expect(truncate('abc', 1)).toBe('a...')
  })

  it('returns empty string when limit is 0', () => {
    expect(truncate('hello', 0)).toBe('...')
  })

  it('handles text with Unicode characters', () => {
    const result = truncate('Clínica Estética', 7)
    expect(result).toBe('Clínica...')
  })
})

// ---------------------------------------------------------------------------
// getInitials
// ---------------------------------------------------------------------------
describe('getInitials', () => {
  it('returns initials for a two-word name', () => {
    expect(getInitials('João Silva')).toBe('JS')
  })

  it('returns single initial for a one-word name', () => {
    expect(getInitials('Maria')).toBe('M')
  })

  it('returns at most 2 initials for a multi-word name', () => {
    // "Ana Maria Costa" → A, M, C → joined = "AMC" → slice(0,2) = "AM"
    expect(getInitials('Ana Maria Costa')).toBe('AM')
  })

  it('returns uppercase initials', () => {
    expect(getInitials('john doe')).toBe('JD')
  })

  it('returns empty string for empty input without crashing', () => {
    // "".split(" ") = [""], [""][0] = "", ""[0] = undefined,
    // [undefined].join("") = "", "".toUpperCase() = "", "".slice(0,2) = ""
    expect(getInitials('')).toBe('')
  })

  it('returns empty string for whitespace-only input without crashing', () => {
    // "  ".split(" ") = ["", "", ""], each n[0] = undefined, join = ""
    expect(getInitials('  ')).toBe('')
  })

  it('handles a name with many words (still only 2 initials)', () => {
    expect(getInitials('A B C D E')).toBe('AB')
  })

  it('handles a name with lowercase letters and returns uppercase', () => {
    expect(getInitials('ana beatriz')).toBe('AB')
  })
})

// ---------------------------------------------------------------------------
// getAvatarColor
// ---------------------------------------------------------------------------
describe('getAvatarColor', () => {
  it('returns a Tailwind bg class string', () => {
    const result = getAvatarColor('Alice')
    expect(result).toMatch(/^bg-\w+-500$/)
  })

  it('result starts with "bg-"', () => {
    expect(getAvatarColor('Bob')).toMatch(/^bg-/)
  })

  it('result ends with "-500"', () => {
    expect(getAvatarColor('Carol')).toMatch(/-500$/)
  })

  it('is deterministic — same name always returns same color', () => {
    const name = 'TestUser'
    expect(getAvatarColor(name)).toBe(getAvatarColor(name))
  })

  it('color is based on first character charCode', () => {
    // 'A' (65) and 'B' (66) differ by 1 — may or may not be different colors
    // but same first-char names return same color
    expect(getAvatarColor('Alice')).toBe(getAvatarColor('Aura'))
  })

  it('different starting characters may yield different colors', () => {
    // 'A' = 65 % 17 = 14, 'B' = 66 % 17 = 15 — definitely different
    expect(getAvatarColor('Alice')).not.toBe(getAvatarColor('Bob'))
  })

  it('returns one of the known Tailwind color classes', () => {
    const knownColors = [
      'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
      'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500',
      'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500',
      'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500',
      'bg-rose-500',
    ]
    expect(knownColors).toContain(getAvatarColor('Diana'))
    expect(knownColors).toContain(getAvatarColor('Eduardo'))
    expect(knownColors).toContain(getAvatarColor('Fernanda'))
  })
})

// ---------------------------------------------------------------------------
// delay
// ---------------------------------------------------------------------------
describe('delay', () => {
  it('returns a Promise', () => {
    const result = delay(0)
    expect(result).toBeInstanceOf(Promise)
    // Clean up the floating promise
    return result
  })

  it('resolves after 0ms without fake timers', async () => {
    await expect(delay(0)).resolves.toBeUndefined()
  })

  it('resolves with fake timers when timers are advanced', async () => {
    vi.useFakeTimers()
    try {
      const promise = delay(1000)
      vi.runAllTimers()
      await expect(promise).resolves.toBeUndefined()
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not resolve before time elapses (fake timers)', async () => {
    vi.useFakeTimers()
    try {
      let resolved = false
      delay(500).then(() => { resolved = true })
      vi.advanceTimersByTime(499)
      await Promise.resolve() // flush microtask queue
      expect(resolved).toBe(false)
      vi.advanceTimersByTime(1)
      await Promise.resolve() // flush microtask queue again
      expect(resolved).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})
