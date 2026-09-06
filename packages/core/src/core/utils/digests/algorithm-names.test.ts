import { describe, expect, it } from 'vitest';

import { normalizeDigestAlgorithmName } from './algorithm-names';

describe('normalizeDigestAlgorithmName', () => {
	it.each([
		['SHA-1', 'SHA-1'],
		['SHA1', 'SHA-1'],
		['sha1', 'SHA-1'],
		['sha-1', 'SHA-1'],
		['SHA-256', 'SHA-256'],
		['SHA256', 'SHA-256'],
		['SHA-384', 'SHA-384'],
		['SHA-512', 'SHA-512'],
		['MD2', 'MD2'],
		['md2', 'MD2'],
		['MD4', 'MD4'],
		['MD5', 'MD5'],
		['md5', 'MD5'],
		['RIPEMD-128', 'RIPEMD-128'],
		['RIPEMD128', 'RIPEMD-128'],
		['ripemd128', 'RIPEMD-128'],
		['RIPEMD-160', 'RIPEMD-160'],
		['RIPEMD160', 'RIPEMD-160'],
		['ripemd-160', 'RIPEMD-160'],
		['WHIRLPOOL', 'WHIRLPOOL'],
		['whirlpool', 'WHIRLPOOL'],
	])('normalizes %j to %j', (input, expected) => {
		expect(normalizeDigestAlgorithmName(input)).toBe(expected);
	});

	it('returns undefined for an algorithm this viewer does not implement', () => {
		expect(normalizeDigestAlgorithmName('SHA-3-256')).toBeUndefined();
		expect(normalizeDigestAlgorithmName('BLAKE2B')).toBeUndefined();
		expect(normalizeDigestAlgorithmName('')).toBeUndefined();
	});
});
