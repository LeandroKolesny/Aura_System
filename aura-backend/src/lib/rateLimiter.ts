// Aura System - Rate Limiter (Distributed via Upstash Redis)
// Proteção contra ataques de força bruta
// SEC-ALTO-4: substituído Map em memória por Redis distribuído para corrigir
// bypass via múltiplas instâncias serverless em paralelo.

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// ---------------------------------------------------------------------------
// Configurações de limite
// ---------------------------------------------------------------------------
// 5 tentativas em janela de 15 minutos (equivalente ao comportamento anterior).
const MAX_ATTEMPTS = 5;
const WINDOW = '15 m';

// ---------------------------------------------------------------------------
// Inicialização do Redis (fail-open se variáveis não estiverem configuradas)
// ---------------------------------------------------------------------------
let rateLimiter: Ratelimit | null = null;

if (
  process.env.UPSTASH_REDIS_REST_URL &&
  process.env.UPSTASH_REDIS_REST_TOKEN
) {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  rateLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(MAX_ATTEMPTS, WINDOW),
    analytics: false,
    prefix: 'aura:rl',
  });
} else {
  console.warn(
    '[RateLimit] UPSTASH_REDIS_REST_URL não configurado — rate limiting desabilitado (fail-open)'
  );
}

export { rateLimiter };

// ---------------------------------------------------------------------------
// Helpers públicos
// ---------------------------------------------------------------------------

/**
 * Extrai o IP real do request (considera proxy reverso / Vercel).
 */
export function getClientIP(request: Request): string {
  // Vercel injeta o IP real como último valor de x-forwarded-for.
  // Usar o ÚLTIMO valor impede que atacantes falsifiquem IPs via header.
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const parts = forwarded.split(',');
    return parts[parts.length - 1].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return 'unknown';
}

/**
 * Verifica e registra tentativa de acesso.
 *
 * Mantém a mesma interface de retorno da implementação anterior:
 *   { allowed: boolean; remaining: number; retryAfter?: number }
 *
 * Falls back to allow-all (fail-open) se o Redis não estiver configurado
 * ou em caso de erro de rede.
 */
export async function checkRateLimit(
  identifier: string,
  action: string = 'login'
): Promise<{ allowed: boolean; remaining: number; retryAfter?: number }> {
  if (!rateLimiter) {
    // Redis não configurado — permitir todas as requisições
    return { allowed: true, remaining: MAX_ATTEMPTS - 1 };
  }

  try {
    const key = `${action}:${identifier}`;
    const result = await rateLimiter.limit(key);

    if (!result.success) {
      // reset é um timestamp Unix em milissegundos
      const retryAfterMs = result.reset - Date.now();
      const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000));
      return { allowed: false, remaining: 0, retryAfter: retryAfterSec };
    }

    return { allowed: true, remaining: result.remaining };
  } catch (error) {
    console.error('[RateLimit] Erro no Redis — failing open:', error);
    return { allowed: true, remaining: MAX_ATTEMPTS - 1 };
  }
}

/**
 * Reseta o rate limit de um identificador (chamar após login bem-sucedido).
 *
 * Com Upstash/slidingWindow não há uma API nativa de reset por chave, então
 * simplesmente registramos o evento — o contador decai naturalmente com a
 * janela deslizante. Para uso interno, a função retorna Promise<void> mas
 * pode ser chamada sem await (fire-and-forget).
 */
export async function resetRateLimit(
  identifier: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  action: string = 'login'
): Promise<void> {
  // Upstash slidingWindow não expõe delete/reset por chave via SDK público.
  // A janela deslizante decai automaticamente — nenhuma ação necessária.
  // Mantemos a função para compatibilidade com os callers existentes.
}

/**
 * @deprecated Não necessário com Redis — TTL é gerenciado automaticamente.
 * Mantida apenas para compatibilidade de assinatura.
 */
export function cleanupRateLimitStore(): void {
  // No-op: Redis gerencia expiração via TTL de janela deslizante.
}
