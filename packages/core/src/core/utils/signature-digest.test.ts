import { describe, it, expect } from 'vitest';

import { computeDigestBase64 } from './signature-digest';

describe('computeDigestBase64', () => {
	it('returns the correct SHA-256 digest for an empty string', async () => {
		const content = new TextEncoder().encode('');
		const result = await computeDigestBase64(content, 'http://www.w3.org/2001/04/xmlenc#sha256');
		expect(result).toBe('47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=');
	});

	it('returns the correct SHA-256 digest for "hello"', async () => {
		const content = new TextEncoder().encode('hello');
		const result = await computeDigestBase64(content, 'http://www.w3.org/2001/04/xmlenc#sha256');
		expect(result).toBe('LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ=');
	});

	it('returns undefined for an unsupported algorithm URI', async () => {
		const content = new TextEncoder().encode('test');
		const result = await computeDigestBase64(content, 'http://example.com/unknown-algo');
		expect(result).toBeUndefined();
	});

	it('works with the SHA-1 algorithm URI', async () => {
		const content = new TextEncoder().encode('');
		const result = await computeDigestBase64(content, 'http://www.w3.org/2000/09/xmldsig#sha1');
		// SHA-1 of empty string = 2jmj7l5rSw0yVb/vlWAYkK/YBwk=
		expect(result).toBe('2jmj7l5rSw0yVb/vlWAYkK/YBwk=');
	});

	it('produces different digests for different inputs', async () => {
		const content1 = new TextEncoder().encode('hello');
		const content2 = new TextEncoder().encode('world');
		const uri = 'http://www.w3.org/2001/04/xmlenc#sha256';

		const result1 = await computeDigestBase64(content1, uri);
		const result2 = await computeDigestBase64(content2, uri);

		expect(result1).not.toBe(result2);
		expect(result1).toBeDefined();
		expect(result2).toBeDefined();
	});

	it('returns a valid base64 string', async () => {
		const content = new TextEncoder().encode('test data');
		const result = await computeDigestBase64(content, 'http://www.w3.org/2001/04/xmlenc#sha256');
		expect(result).toBeDefined();
		// Base64 should only contain A-Za-z0-9+/=
		expect(result).toMatch(/^[A-Za-z0-9+/]+=*$/);
	});
});
