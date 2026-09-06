/**
 * MD5 test vectors from RFC 1321 section A.5, cross-checked against
 * `node:crypto`'s own MD5 implementation (Node still implements MD5, just
 * not via Web Crypto's `SubtleCrypto.digest`).
 */
import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { md5 } from './md5';

function hex(bytes: Uint8Array): string {
	return Buffer.from(bytes).toString('hex');
}

function utf8(text: string): Uint8Array {
	return new TextEncoder().encode(text);
}

function nodeMd5(text: string): string {
	return createHash('md5').update(text, 'utf8').digest('hex');
}

describe('md5', () => {
	it.each([
		['', 'd41d8cd98f00b204e9800998ecf8427e'],
		['a', '0cc175b9c0f1b6a831c399e269772661'],
		['abc', '900150983cd24fb0d6963f7d28e17f72'],
		['message digest', 'f96b697d7cb7938d525a2f31aaf161d0'],
		['abcdefghijklmnopqrstuvwxyz', 'c3fcd3d76192e4007dfb496cca67e13b'],
		[
			'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
			'd174ab98d277d9f5a5611c2c9f419d9f',
		],
		[
			'12345678901234567890123456789012345678901234567890123456789012345678901234567890',
			'57edf4a22be3c955ac49da2e2107b67a',
		],
	])('matches the RFC 1321 test suite for %j', (input, expected) => {
		expect(hex(md5(utf8(input)))).toBe(expected);
	});

	it.each(['', 'a', 'abc', 'The quick brown fox jumps over the lazy dog', 'a'.repeat(1000)])(
		'matches node:crypto for %j',
		(input) => {
			expect(hex(md5(utf8(input)))).toBe(nodeMd5(input));
		},
	);

	it('matches node:crypto across every multi-block boundary length', () => {
		for (let length = 0; length <= 130; length++) {
			const input = 'x'.repeat(length);
			expect(hex(md5(utf8(input)))).toBe(nodeMd5(input));
		}
	});
});
