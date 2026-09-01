// aura-backend/src/__tests__/lib/rateLimiter.test.ts
// Comprehensive tests for getClientIP, checkRateLimit (fail-open), resetRateLimit, cleanupRateLimitStore

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
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

    it('returns the last IP in a comma-separated chain (trusted proxy, prevents spoofing)', () => {
      // Security: using the last IP prevents an attacker from injecting a fake IP
      // as the first entry. The last IP is added by the trusted server-side proxy.
      const req = makeRequest({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8, 9.0.1.2' });
      expect(getClientIP(req)).toBe('9.0.1.2');
    });

    it('trims leading and trailing whitespace from the last IP', () => {
      const req = makeRequest({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8  ' });
      expect(getClientIP(req)).toBe('5.6.7.8');
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

    it('returns single entry as-is when chain has only one IP', () => {
      // With a single entry, first === last, so no spoofing concern.
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
  // remaining = MAX_ATTEMPTS - 1 = 5 - 1 = 4 (MAX_ATTEMPTS constant in rateLimiter.ts)
  it('returns allowed:true with remaining:4 for a plain identifier', async () => {
    const result = await checkRateLimit('test@example.com');
    expect(result).toEqual({ allowed: true, remaining: 4 });
  });

  it('returns allowed:true with remaining:4 for a custom action', async () => {
    const result = await checkRateLimit('test@example.com', 'custom-action');
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
  // No-op: Upstash slidingWindow does not expose delete/reset by key.
  // The function exists for API compatibility only — sliding window decays automatically.
  it('resolves to undefined without throwing (no-op, sliding window decays automatically)', async () => {
    await expect(resetRateLimit('user@example.com')).resolves.toBeUndefined();
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
