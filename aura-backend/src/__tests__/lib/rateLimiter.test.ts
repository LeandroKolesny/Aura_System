// aura-backend/src/__tests__/lib/rateLimiter.test.ts
// Comprehensive tests for getClientIP, checkRateLimit (fail-open), resetRateLimit, cleanupRateLimitStore

import {
  getClientIP,
  checkRateLimit,
  resetRateLimit,
  cleanupRateLimitStore,
  rateLimiter,
} from '@/lib/rateLimiter';

// ---------------------------------------------------------------------------
// Helper — creates a minimal Request with the given headers
// ---------------------------------------------------------------------------
function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('https://example.com', { headers });
}

// ---------------------------------------------------------------------------
// getClientIP — pure function
// ---------------------------------------------------------------------------
describe('getClientIP', () => {
  describe('x-forwarded-for header', () => {
    it('returns the IP when x-forwarded-for contains a single IP', () => {
      const req = makeRequest({ 'x-forwarded-for': '1.2.3.4' });
      expect(getClientIP(req)).toBe('1.2.3.4');
    });

    it('returns the first IP in a comma-separated chain', () => {
      const req = makeRequest({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8, 9.0.1.2' });
      expect(getClientIP(req)).toBe('1.2.3.4');
    });

    it('trims leading and trailing whitespace from the first IP', () => {
      const req = makeRequest({ 'x-forwarded-for': '  1.2.3.4  , 5.6.7.8' });
      expect(getClientIP(req)).toBe('1.2.3.4');
    });

    it('returns the IP even when the chain contains only one entry with extra spaces', () => {
      const req = makeRequest({ 'x-forwarded-for': '   192.168.0.1   ' });
      expect(getClientIP(req)).toBe('192.168.0.1');
    });

    it('takes priority over x-real-ip when both headers are present', () => {
      const req = makeRequest({
        'x-forwarded-for': '1.1.1.1',
        'x-real-ip': '2.2.2.2',
      });
      expect(getClientIP(req)).toBe('1.1.1.1');
    });

    it('documents that x-forwarded-for is accepted as-is (spoofable by client)', () => {
      // Security note: x-forwarded-for can be forged by an end user.
      // The function trusts it unconditionally — callers should be aware.
      const req = makeRequest({ 'x-forwarded-for': 'spoofed-ip' });
      expect(getClientIP(req)).toBe('spoofed-ip');
    });

    it('returns "unknown" when x-forwarded-for is set to an empty string', () => {
      // Edge case: the Node 18+ Request constructor drops headers with empty values,
      // so headers.get('x-forwarded-for') returns null and the function falls through
      // to the 'unknown' default rather than returning an empty string.
      const req = makeRequest({ 'x-forwarded-for': '' });
      expect(getClientIP(req)).toBe('unknown');
    });
  });

  describe('x-real-ip header (fallback)', () => {
    it('returns x-real-ip when x-forwarded-for is absent', () => {
      const req = makeRequest({ 'x-real-ip': '10.0.0.1' });
      expect(getClientIP(req)).toBe('10.0.0.1');
    });

    it('returns x-real-ip for an IPv6 address', () => {
      const req = makeRequest({ 'x-real-ip': '::1' });
      expect(getClientIP(req)).toBe('::1');
    });
  });

  describe('no headers', () => {
    it('returns "unknown" when no IP headers are present', () => {
      const req = makeRequest();
      expect(getClientIP(req)).toBe('unknown');
    });

    it('returns "unknown" when only unrelated headers are present', () => {
      const req = makeRequest({ 'content-type': 'application/json' });
      expect(getClientIP(req)).toBe('unknown');
    });
  });
});

// ---------------------------------------------------------------------------
// rateLimiter export
// ---------------------------------------------------------------------------
describe('rateLimiter export', () => {
  it('is null in test environment (no UPSTASH_REDIS_REST_URL / TOKEN configured)', () => {
    // setup.ts does not set UPSTASH_REDIS_REST_URL, so module initialises with null
    expect(rateLimiter).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// checkRateLimit — fail-open behaviour (rateLimiter === null in test env)
// ---------------------------------------------------------------------------
describe('checkRateLimit (fail-open, rateLimiter is null)', () => {
  it('returns allowed:true with remaining:4 for a plain identifier', async () => {
    const result = await checkRateLimit('test@example.com');
    expect(result).toEqual({ allowed: true, remaining: 4 });
  });

  it('returns allowed:true with remaining:4 when action is "login"', async () => {
    const result = await checkRateLimit('test@example.com', 'login');
    expect(result).toEqual({ allowed: true, remaining: 4 });
  });

  it('returns allowed:true with remaining:4 for a custom action', async () => {
    const result = await checkRateLimit('test@example.com', 'custom-action');
    expect(result).toEqual({ allowed: true, remaining: 4 });
  });

  it('returns allowed:true with remaining:4 for an IP identifier', async () => {
    const result = await checkRateLimit('192.168.1.100');
    expect(result).toEqual({ allowed: true, remaining: 4 });
  });

  it('does not include retryAfter in the fail-open response', async () => {
    const result = await checkRateLimit('any-user');
    expect(result.retryAfter).toBeUndefined();
  });

  it('returns the same result for multiple consecutive calls (stateless in test env)', async () => {
    const first = await checkRateLimit('repeated@example.com');
    const second = await checkRateLimit('repeated@example.com');
    const third = await checkRateLimit('repeated@example.com');
    expect(first).toEqual({ allowed: true, remaining: 4 });
    expect(second).toEqual({ allowed: true, remaining: 4 });
    expect(third).toEqual({ allowed: true, remaining: 4 });
  });
});

// ---------------------------------------------------------------------------
// resetRateLimit — no-op
// ---------------------------------------------------------------------------
describe('resetRateLimit', () => {
  it('resolves without throwing when called with only identifier', async () => {
    await expect(resetRateLimit('user@example.com')).resolves.toBeUndefined();
  });

  it('resolves without throwing when called with identifier and action', async () => {
    await expect(resetRateLimit('user@example.com', 'login')).resolves.toBeUndefined();
  });

  it('resolves without throwing when called with a custom action', async () => {
    await expect(resetRateLimit('192.168.0.1', 'register')).resolves.toBeUndefined();
  });

  it('returns a Promise that resolves to undefined', async () => {
    const result = await resetRateLimit('any');
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// cleanupRateLimitStore — no-op
// ---------------------------------------------------------------------------
describe('cleanupRateLimitStore', () => {
  it('returns undefined (no-op)', () => {
    expect(cleanupRateLimitStore()).toBeUndefined();
  });

  it('does not throw when called multiple times', () => {
    expect(() => {
      cleanupRateLimitStore();
      cleanupRateLimitStore();
      cleanupRateLimitStore();
    }).not.toThrow();
  });
});
