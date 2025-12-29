// Aura System - Rate Limiter
// Proteção contra ataques de força bruta

interface RateLimitEntry {
  count: number;
  firstAttempt: number;
  blockedUntil?: number;
}

// Em produção, usar Redis. Para MVP, Map em memória funciona.
const rateLimitStore = new Map<string, RateLimitEntry>();

// Configurações
const RATE_LIMIT_CONFIG = {
  maxAttempts: 5,           // Máximo de tentativas
  windowMs: 15 * 60 * 1000, // Janela de 15 minutos
  blockDurationMs: 30 * 60 * 1000, // Bloqueio de 30 minutos após exceder
};

/**
 * Extrai o IP real do request (considera proxy reverso)
 */
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }
  return "unknown";
}

/**
 * Verifica e registra tentativa de acesso
 * @returns { allowed: boolean, remaining: number, retryAfter?: number }
 */
export function checkRateLimit(
  identifier: string,
  action: string = "login"
): { allowed: boolean; remaining: number; retryAfter?: number } {
  const key = `${action}:${identifier}`;
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  // Se bloqueado, verificar se já pode tentar novamente
  if (entry?.blockedUntil && entry.blockedUntil > now) {
    const retryAfter = Math.ceil((entry.blockedUntil - now) / 1000);
    return { allowed: false, remaining: 0, retryAfter };
  }

  // Se não existe ou a janela expirou, criar nova entrada
  if (!entry || now - entry.firstAttempt > RATE_LIMIT_CONFIG.windowMs) {
    rateLimitStore.set(key, { count: 1, firstAttempt: now });
    return { allowed: true, remaining: RATE_LIMIT_CONFIG.maxAttempts - 1 };
  }

  // Incrementar contador
  entry.count++;

  // Se excedeu o limite, bloquear
  if (entry.count > RATE_LIMIT_CONFIG.maxAttempts) {
    entry.blockedUntil = now + RATE_LIMIT_CONFIG.blockDurationMs;
    rateLimitStore.set(key, entry);
    const retryAfter = Math.ceil(RATE_LIMIT_CONFIG.blockDurationMs / 1000);
    return { allowed: false, remaining: 0, retryAfter };
  }

  rateLimitStore.set(key, entry);
  return {
    allowed: true,
    remaining: RATE_LIMIT_CONFIG.maxAttempts - entry.count,
  };
}

/**
 * Reseta o rate limit (chamar após login bem-sucedido)
 */
export function resetRateLimit(identifier: string, action: string = "login"): void {
  const key = `${action}:${identifier}`;
  rateLimitStore.delete(key);
}

/**
 * Limpa entradas expiradas (chamar periodicamente)
 */
export function cleanupRateLimitStore(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    const isExpired = now - entry.firstAttempt > RATE_LIMIT_CONFIG.windowMs;
    const isUnblocked = entry.blockedUntil && entry.blockedUntil < now;
    if (isExpired || isUnblocked) {
      rateLimitStore.delete(key);
    }
  }
}

// Limpeza automática a cada 10 minutos
if (typeof setInterval !== "undefined") {
  setInterval(cleanupRateLimitStore, 10 * 60 * 1000);
}

