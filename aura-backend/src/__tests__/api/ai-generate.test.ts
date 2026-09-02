// aura-backend/src/__tests__/api/ai-generate.test.ts
// Testes para POST /api/ai/generate

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))

const mockGenerateContent = vi.fn()
vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(function GoogleGenAI(this: { models: { generateContent: typeof mockGenerateContent } }) {
    this.models = { generateContent: mockGenerateContent }
  }),
}))

import { POST } from '../../app/api/ai/generate/route'
import { getAuthUser } from '@/lib/auth'

const ADMIN = { id: 'u1', email: 'admin@clinica.com', role: 'ADMIN', companyId: 'c1' }

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/ai/generate', {
    method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
})

describe('POST /api/ai/generate — validações comuns', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await POST(makeRequest({ type: 'return', data: {} }))
    expect(res.status).toBe(401)
  })

  it('retorna 400 quando type ou data estão ausentes', async () => {
    const res = await POST(makeRequest({ type: 'return' }))
    expect(res.status).toBe(400)
  })
})

describe('POST /api/ai/generate — sem GEMINI_API_KEY (fallback estático)', () => {
  beforeEach(() => {
    delete process.env.GEMINI_API_KEY
  })

  it('retorna 400 para um tipo não suportado', async () => {
    const res = await POST(makeRequest({ type: 'invalido', data: {} }))
    expect(res.status).toBe(400)
  })

  it('gera mensagem de retorno usando o template estático', async () => {
    const res = await POST(makeRequest({ type: 'return', data: { patientName: 'Maria', lastProcedure: 'Limpeza', daysAgo: 90, clinicName: 'Clínica X' } }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.message).toContain('Maria')
    expect(body.message).toContain('90 dias')
  })

  it('sanitiza tags HTML e limita o tamanho do input do paciente (previne prompt injection)', async () => {
    const maliciousName = '<script>alert(1)</script>' + 'A'.repeat(300)
    const res = await POST(makeRequest({ type: 'return', data: { patientName: maliciousName, lastProcedure: 'x', daysAgo: 1, clinicName: 'x' } }))
    const body = await res.json()

    expect(body.message).not.toContain('<script>')
    expect(body.message.length).toBeLessThan(300)
  })

  it('gera mensagem de aniversário diferenciando "hoje" de "aniversário próximo"', async () => {
    const resToday = await POST(makeRequest({ type: 'birthday', data: { patientName: 'Ana', age: 30, clinicName: 'Clínica X', isToday: true } }))
    const bodyToday = await resToday.json()
    expect(bodyToday.message).toContain('dia especial')

    const resSoon = await POST(makeRequest({ type: 'birthday', data: { patientName: 'Ana', age: 30, clinicName: 'Clínica X', isToday: false } }))
    const bodySoon = await resSoon.json()
    expect(bodySoon.message).toContain('está chegando')
  })

  it('gera mensagem de follow-up pós-procedimento', async () => {
    const res = await POST(makeRequest({ type: 'followup', data: { patientName: 'Carlos', procedure: 'Botox', clinicName: 'Clínica X' } }))
    const body = await res.json()
    expect(body.message).toContain('Carlos')
    expect(body.message).toContain('Botox')
  })

  it('gera mensagem de retenção B2B (SaaS)', async () => {
    const res = await POST(makeRequest({ type: 'retention', data: { clinicName: 'Clínica X', daysCount: 5, planName: 'Pro', scenario: 'overdue' } }))
    const body = await res.json()
    expect(body.message).toContain('Clínica X')
    expect(body.message).toContain('Pro')
  })

  it('retorna mensagem informando indisponibilidade para resumo de anamnese', async () => {
    const res = await POST(makeRequest({ type: 'anamnesis', data: { notes: 'Paciente relata alergia a X' } }))
    const body = await res.json()
    expect(body.message).toContain('não disponível')
  })
})

describe('POST /api/ai/generate — com GEMINI_API_KEY configurada', () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-gemini-key'
    mockGenerateContent.mockResolvedValue({ text: '**Olá Maria,** já faz tempo! ---' })
  })

  it('usa o Gemini para gerar a mensagem e remove formatação markdown do resultado', async () => {
    const res = await POST(makeRequest({ type: 'return', data: { patientName: 'Maria', lastProcedure: 'Limpeza', daysAgo: 90, clinicName: 'Clínica X' } }))
    const body = await res.json()

    expect(mockGenerateContent).toHaveBeenCalled()
    expect(body.message).not.toContain('**')
    expect(body.message).not.toContain('---')
  })

  it('retorna mensagem de erro amigável quando o Gemini retorna texto vazio', async () => {
    mockGenerateContent.mockResolvedValue({ text: '' })
    const res = await POST(makeRequest({ type: 'followup', data: { patientName: 'Ana', procedure: 'Peeling', clinicName: 'Clínica X' } }))
    const body = await res.json()
    expect(body.message).toBe('Erro ao gerar mensagem.')
  })

  it('retorna 500 quando a chamada ao Gemini falha', async () => {
    mockGenerateContent.mockRejectedValue(new Error('Gemini API down'))
    const res = await POST(makeRequest({ type: 'return', data: { patientName: 'Maria', lastProcedure: 'x', daysAgo: 1, clinicName: 'x' } }))
    expect(res.status).toBe(500)
  })
})
