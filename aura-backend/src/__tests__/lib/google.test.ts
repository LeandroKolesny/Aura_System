// aura-backend/src/__tests__/lib/google.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getGoogleAuthUrl,
  exchangeCodeForTokens,
  getGoogleUserInfo,
  refreshAccessToken,
  GOOGLE_SCOPES_SIGNIN,
  GOOGLE_SCOPES_CALENDAR,
} from '@/lib/google'

beforeEach(() => {
  process.env.GOOGLE_CLIENT_ID = 'client-id-123'
  process.env.GOOGLE_CLIENT_SECRET = 'client-secret-456'
  process.env.GOOGLE_REDIRECT_URI = 'https://aura-backend-api.vercel.app/api/auth/google/callback'
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  delete process.env.GOOGLE_CLIENT_ID
  delete process.env.GOOGLE_CLIENT_SECRET
  delete process.env.GOOGLE_REDIRECT_URI
  vi.unstubAllGlobals()
})

describe('getGoogleAuthUrl', () => {
  function scopeParam(url: string): string {
    const qs = url.split('?')[1]
    return new URLSearchParams(qs).get('scope') ?? ''
  }

  it('gera URL de login com o escopo básico (sem calendar) por padrão', () => {
    const url = getGoogleAuthUrl('state-123')
    expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth?')
    expect(url).toContain('state=state-123')
    expect(url).toContain(`client_id=${process.env.GOOGLE_CLIENT_ID}`)
    expect(scopeParam(url)).toBe(GOOGLE_SCOPES_SIGNIN)
    expect(scopeParam(url)).not.toContain('calendar')
  })

  it('inclui o escopo de calendar quando includeCalendar=true', () => {
    const url = getGoogleAuthUrl('state-123', true)
    expect(scopeParam(url)).toBe(GOOGLE_SCOPES_CALENDAR)
    expect(scopeParam(url)).toContain('https://www.googleapis.com/auth/calendar')
  })

  it('sempre pede access_type=offline e prompt=consent (necessário pro refresh_token)', () => {
    const url = getGoogleAuthUrl('state-123')
    expect(url).toContain('access_type=offline')
    expect(url).toContain('prompt=consent')
  })
})

describe('exchangeCodeForTokens', () => {
  it('faz POST para o endpoint de token com o código e credenciais corretas', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ access_token: 'tok-1', expires_in: 3600, id_token: 'idtok' }),
    } as never)

    const result = await exchangeCodeForTokens('auth-code-xyz')

    const [url, options] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('https://oauth2.googleapis.com/token')
    expect(options?.method).toBe('POST')
    const body = options?.body as URLSearchParams
    expect(body.get('code')).toBe('auth-code-xyz')
    expect(body.get('client_id')).toBe('client-id-123')
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(result.access_token).toBe('tok-1')
  })

  it('REGRESSÃO: lança erro descritivo quando a troca do código falha (não retorna undefined silenciosamente)', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, text: () => Promise.resolve('invalid_grant') } as never)

    await expect(exchangeCodeForTokens('code-expirado')).rejects.toThrow('Token exchange failed: invalid_grant')
  })
})

describe('getGoogleUserInfo', () => {
  it('busca informações do usuário com o Bearer token correto', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sub: 'g-123', email: 'ana@x.com', name: 'Ana' }),
    } as never)

    const result = await getGoogleUserInfo('access-tok-1')

    const [url, options] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('https://www.googleapis.com/oauth2/v3/userinfo')
    expect((options?.headers as Record<string, string>).Authorization).toBe('Bearer access-tok-1')
    expect(result.email).toBe('ana@x.com')
  })

  it('lança erro quando o token é inválido/expirado', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as never)
    await expect(getGoogleUserInfo('token-invalido')).rejects.toThrow('Failed to get Google user info')
  })
})

describe('refreshAccessToken', () => {
  it('faz POST com grant_type=refresh_token e retorna o novo access_token', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ access_token: 'novo-tok', expires_in: 3600 }),
    } as never)

    const result = await refreshAccessToken('refresh-tok-1')

    const [, options] = vi.mocked(fetch).mock.calls[0]
    const body = options?.body as URLSearchParams
    expect(body.get('refresh_token')).toBe('refresh-tok-1')
    expect(body.get('grant_type')).toBe('refresh_token')
    expect(result.access_token).toBe('novo-tok')
  })

  it('REGRESSÃO: lança erro quando o refresh falha (ex: token revogado pelo usuário) em vez de retornar silenciosamente', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as never)
    await expect(refreshAccessToken('refresh-tok-revogado')).rejects.toThrow('Token refresh failed')
  })
})
