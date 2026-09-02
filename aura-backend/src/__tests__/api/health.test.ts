// aura-backend/src/__tests__/api/health.test.ts
// Testes para GET /api/health

import { describe, it, expect } from 'vitest'
import { GET } from '../../app/api/health/route'

describe('GET /api/health', () => {
  it('retorna status ok com timestamp ISO válido', async () => {
    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.status).toBe('ok')
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp)
  })
})
