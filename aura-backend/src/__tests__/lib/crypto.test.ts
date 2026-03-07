// aura-backend/src/__tests__/lib/crypto.test.ts
// Comprehensive tests for AES-256-GCM encrypt/decrypt

import { encrypt, decrypt } from '@/lib/crypto';

const VALID_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('crypto - AES-256-GCM', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = VALID_KEY;
  });

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY;
  });

  // ---------------------------------------------------------------------------
  // Happy path — roundtrip
  // ---------------------------------------------------------------------------
  describe('encrypt + decrypt roundtrip', () => {
    it('returns the original plaintext for a simple string', () => {
      const plaintext = 'hello world';
      expect(decrypt(encrypt(plaintext))).toBe(plaintext);
    });

    it('empty string roundtrip returns empty string', () => {
      const encrypted = encrypt('')
      const decrypted = decrypt(encrypted)
      expect(decrypted).toBe('')
    });

    it('handles unicode / Portuguese characters', () => {
      const plaintext = 'Clínica Estética — São Paulo — Ação é fundamental!';
      expect(decrypt(encrypt(plaintext))).toBe(plaintext);
    });

    it('handles a long string (10 000 characters)', () => {
      const plaintext = 'A'.repeat(10_000);
      expect(decrypt(encrypt(plaintext))).toBe(plaintext);
    });

    it('handles JSON-encoded data', () => {
      const plaintext = JSON.stringify({ token: 'secret-token-123', userId: 42 });
      expect(decrypt(encrypt(plaintext))).toBe(plaintext);
    });
  });

  // ---------------------------------------------------------------------------
  // Output format
  // ---------------------------------------------------------------------------
  describe('encrypt output format', () => {
    it('produces a string with exactly 3 colon-separated parts', () => {
      const result = encrypt('test');
      const parts = result.split(':');
      expect(parts).toHaveLength(3);
    });

    it('IV part is 24 hex characters (12 bytes)', () => {
      const [ivHex] = encrypt('test').split(':');
      expect(ivHex).toHaveLength(24);
      expect(ivHex).toMatch(/^[0-9a-f]+$/);
    });

    it('authTag part is 32 hex characters (16 bytes)', () => {
      const parts = encrypt('test').split(':');
      const authTagHex = parts[1];
      expect(authTagHex).toHaveLength(32);
      expect(authTagHex).toMatch(/^[0-9a-f]+$/);
    });

    it('ciphertext part is a non-empty hex string for non-empty input', () => {
      const parts = encrypt('hello').split(':');
      const ciphertextHex = parts[2];
      expect(ciphertextHex.length).toBeGreaterThan(0);
      expect(ciphertextHex).toMatch(/^[0-9a-f]+$/);
    });

    it('ciphertext part is an empty string for empty input', () => {
      const parts = encrypt('').split(':');
      const ciphertextHex = parts[2];
      // Empty plaintext produces no ciphertext bytes
      expect(ciphertextHex).toBe('');
    });
  });

  // ---------------------------------------------------------------------------
  // Security — unique IVs
  // ---------------------------------------------------------------------------
  describe('unique IVs (semantic security)', () => {
    it('produces different ciphertext for the same plaintext on two calls', () => {
      const plaintext = 'same input';
      const first = encrypt(plaintext);
      const second = encrypt(plaintext);
      expect(first).not.toBe(second);
    });

    it('produces different IVs on two calls', () => {
      const [iv1] = encrypt('data').split(':');
      const [iv2] = encrypt('data').split(':');
      expect(iv1).not.toBe(iv2);
    });
  });

  // ---------------------------------------------------------------------------
  // Tampered data — integrity checks
  // ---------------------------------------------------------------------------
  describe('tampered ciphertext throws', () => {
    it('throws when ciphertext last hex char is flipped', () => {
      const encrypted = encrypt('sensitive data');
      const parts = encrypted.split(':');
      const ct = parts[2];
      // Flip the last hex character
      const lastChar = ct[ct.length - 1];
      const flipped = lastChar === 'f' ? '0' : 'f';
      parts[2] = ct.slice(0, -1) + flipped;
      expect(() => decrypt(parts.join(':'))).toThrow();
    });

    it('throws when ciphertext first hex char is flipped', () => {
      const encrypted = encrypt('sensitive data'); // 14 bytes — ciphertext is never empty
      const parts = encrypted.split(':');
      const ct = parts[2];
      expect(ct.length).toBeGreaterThan(0); // assert assumption rather than silently skip
      const firstChar = ct[0];
      const flipped = firstChar === 'f' ? '0' : 'f';
      parts[2] = flipped + ct.slice(1);
      expect(() => decrypt(parts.join(':'))).toThrow();
    });
  });

  describe('tampered authTag throws', () => {
    it('throws when authTag last hex char is flipped', () => {
      const encrypted = encrypt('important message');
      const parts = encrypted.split(':');
      const tag = parts[1];
      const lastChar = tag[tag.length - 1];
      const flipped = lastChar === 'f' ? '0' : 'f';
      parts[1] = tag.slice(0, -1) + flipped;
      expect(() => decrypt(parts.join(':'))).toThrow();
    });

    it('throws when authTag is replaced with all-zeros', () => {
      const encrypted = encrypt('important message');
      const parts = encrypted.split(':');
      parts[1] = '0'.repeat(32); // 32 hex chars = 16 bytes of zeros
      expect(() => decrypt(parts.join(':'))).toThrow();
    });
  });

  describe('tampered IV throws', () => {
    it('tampered IV throws during decrypt', () => {
      const plaintext = 'test tamper IV'
      const encrypted = encrypt(plaintext)
      const [ivHex, authTagHex, encryptedHex] = encrypted.split(':')
      const tamperedIV = 'deadbeef'.repeat(3) // 24 hex chars = 12 bytes, valid length but different value
      const tampered = `${tamperedIV}:${authTagHex}:${encryptedHex}`
      expect(() => decrypt(tampered)).toThrow()
    });
  });

  // ---------------------------------------------------------------------------
  // Format errors
  // ---------------------------------------------------------------------------
  describe('decrypt format validation', () => {
    it('throws "Invalid encrypted data format" for empty string', () => {
      expect(() => decrypt('')).toThrow('Invalid encrypted data format');
    });

    it('throws "Invalid encrypted data format" when only 2 parts (one colon)', () => {
      expect(() => decrypt('aabbccdd:eeff0011')).toThrow('Invalid encrypted data format');
    });

    it('throws "Invalid encrypted data format" when only 1 part (no colons)', () => {
      expect(() => decrypt('nocolonsatall')).toThrow('Invalid encrypted data format');
    });

    it('throws about IV length when IV hex decodes to wrong byte count', () => {
      // 2-char IV = 1 byte (should be 12)
      const shortIv = 'aa';
      const validTag = '0'.repeat(32); // 16 bytes
      const validCt = 'deadbeef';
      expect(() => decrypt(`${shortIv}:${validTag}:${validCt}`)).toThrow('Invalid IV length');
    });

    it('throws about auth tag length when authTag hex decodes to wrong byte count', () => {
      // Valid 24-char IV (12 bytes), but tag is only 2 hex chars (1 byte)
      const validIv = '0'.repeat(24); // 12 bytes
      const shortTag = 'aa'; // 1 byte
      const validCt = 'deadbeef';
      expect(() => decrypt(`${validIv}:${shortTag}:${validCt}`)).toThrow('Invalid auth tag length');
    });
  });

  // ---------------------------------------------------------------------------
  // Missing / invalid ENCRYPTION_KEY
  // ---------------------------------------------------------------------------
  describe('missing ENCRYPTION_KEY', () => {
    it('encrypt throws "ENCRYPTION_KEY environment variable is required" when not set', () => {
      delete process.env.ENCRYPTION_KEY;
      expect(() => encrypt('anything')).toThrow('ENCRYPTION_KEY environment variable is required');
    });

    it('decrypt throws "ENCRYPTION_KEY environment variable is required" when not set', () => {
      delete process.env.ENCRYPTION_KEY;
      // Need valid-looking format to reach key check
      const validIv = '0'.repeat(24);
      const validTag = '0'.repeat(32);
      expect(() => decrypt(`${validIv}:${validTag}:deadbeef`)).toThrow(
        'ENCRYPTION_KEY environment variable is required'
      );
    });
  });

  describe('invalid ENCRYPTION_KEY', () => {
    it('encrypt throws "ENCRYPTION_KEY must be a 64-character hex string" for a short key', () => {
      process.env.ENCRYPTION_KEY = 'tooshort';
      expect(() => encrypt('anything')).toThrow(
        'ENCRYPTION_KEY must be a 64-character hex string'
      );
    });

    it('encrypt throws "ENCRYPTION_KEY must be a 64-character hex string" for a 63-char key', () => {
      process.env.ENCRYPTION_KEY = '0'.repeat(63);
      expect(() => encrypt('anything')).toThrow(
        'ENCRYPTION_KEY must be a 64-character hex string'
      );
    });

    it('decrypt throws "ENCRYPTION_KEY must be a 64-character hex string" for a short key', () => {
      process.env.ENCRYPTION_KEY = 'tooshort';
      const validIv = '0'.repeat(24);
      const validTag = '0'.repeat(32);
      expect(() => decrypt(`${validIv}:${validTag}:deadbeef`)).toThrow(
        'ENCRYPTION_KEY must be a 64-character hex string'
      );
    });
  });
});
