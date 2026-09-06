/**
 * RIPEMD-128 test vectors published by the algorithm's authors
 * (Dobbertin, Bosselaers, Preneel; ESAT-COSIC, KU Leuven).
 */
import { describe, expect, it } from 'vitest';

import { ripemd128 } from './ripemd128';

function hex(bytes: Uint8Array): string {
	return Buffer.from(bytes).toString('hex');
}

function utf8(text: string): Uint8Array {
	return new TextEncoder().encode(text);
}

describe('ripemd128', () => {
	it.each([
		['', 'cdf26213a150dc3ecb610f18f6b38b46'],
		['a', '86be7afa339d0fc7cfc785e72f578d33'],
		['abc', 'c14a12199c66e4ba84636b0f69144c77'],
		['message digest', '9e327b3d6e523062afc1132d7df9d1b8'],
		['abcdefghijklmnopqrstuvwxyz', 'fd2aa607f71dc8f510714922b371834e'],
		['1234567890'.repeat(8), '3f45ef194732c2dbb2c4a2c769795fa3'],
	])('matches the published RIPEMD-128 test suite for %j', (input, expected) => {
		expect(hex(ripemd128(utf8(input)))).toBe(expected);
	});

	it('matches the published million-"a" test vector (multi-block)', () => {
		expect(hex(ripemd128(utf8('a'.repeat(1_000_000))))).toBe('4a7f5723f954eba1216c9d8f6320431f');
	}, 20000);
});
