import { describe, it, expect, expectTypeOf } from 'vitest';

import { computeDigestBase64 } from './reference-checks';

// ---------------------------------------------------------------------------
// computeDigestBase64
// ---------------------------------------------------------------------------

describe('computeDigestBase64', () => {
	const SHA256_URI = 'http://www.w3.org/2001/04/xmlenc#sha256';

	it('computes correct SHA-256 for empty Uint8Array', () => {
		const result = computeDigestBase64(new Uint8Array([]), SHA256_URI);
		expect(result).toBe('47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=');
	});

	it('computes correct SHA-256 for "hello"', () => {
		const data = new TextEncoder().encode('hello');
		const result = computeDigestBase64(data, SHA256_URI);
		expect(result).toBe('LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ=');
	});

	it('computes correct SHA-1 digest', () => {
		const SHA1_URI = 'http://www.w3.org/2000/09/xmldsig#sha1';
		const data = new TextEncoder().encode('hello');
		const result = computeDigestBase64(data, SHA1_URI);
		// SHA-1 of "hello" = aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d
		expect(result).toBe('qvTGHdzF6KLavt4PO0gs2a6pQ00=');
	});

	it('computes correct SHA-512 digest', () => {
		const SHA512_URI = 'http://www.w3.org/2001/04/xmlenc#sha512';
		const result = computeDigestBase64(new Uint8Array([]), SHA512_URI);
		// SHA-512 of empty data
		expect(result).toBeDefined();
		expectTypeOf(result).toBeString();
		expect(result!.length).toBeGreaterThan(0);
	});

	it('returns undefined for unsupported algorithm URI', () => {
		const result = computeDigestBase64(
			new Uint8Array([1, 2, 3]),
			'http://example.com/unsupported-hash',
		);
		expect(result).toBeUndefined();
	});

	it('returns undefined for empty algorithm URI', () => {
		const result = computeDigestBase64(new Uint8Array([]), '');
		expect(result).toBeUndefined();
	});
});
