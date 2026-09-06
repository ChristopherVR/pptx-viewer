/**
 * RIPEMD-160 test vectors published by the algorithm's authors, cross-checked
 * against `node:crypto`'s RIPEMD-160 (still available via OpenSSL's legacy
 * provider on this platform; skipped where it is not).
 */
import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { ripemd160 } from './ripemd160';

function hex(bytes: Uint8Array): string {
	return Buffer.from(bytes).toString('hex');
}

function utf8(text: string): Uint8Array {
	return new TextEncoder().encode(text);
}

function nodeRipemd160Available(): boolean {
	try {
		createHash('ripemd160').update('x').digest('hex');
		return true;
	} catch {
		return false;
	}
}

describe('ripemd160', () => {
	it.each([
		['', '9c1185a5c5e9fc54612808977ee8f548b2258d31'],
		['a', '0bdc9d2d256b3ee9daae347be6f4dc835a467ffe'],
		['abc', '8eb208f7e05d987a9b044a8e98c6b087f15a0bfc'],
		['message digest', '5d0689ef49d2fae572b881b123a85ffa21595f36'],
		['abcdefghijklmnopqrstuvwxyz', 'f71c27109c692c1b56bbdceb5b9d2865b3708dbc'],
		['1234567890'.repeat(8), '9b752e45573d4b39f4dbd3323cab82bf63326bfb'],
	])('matches the published RIPEMD-160 test suite for %j', (input, expected) => {
		expect(hex(ripemd160(utf8(input)))).toBe(expected);
	});

	it('matches the published million-"a" test vector (multi-block)', () => {
		expect(hex(ripemd160(utf8('a'.repeat(1_000_000))))).toBe(
			'52783243c1697bdbe16d37f97f68f08325dc1528',
		);
	}, 20000);

	it.runIf(nodeRipemd160Available())(
		'matches node:crypto across every multi-block boundary length',
		() => {
			for (let length = 0; length <= 130; length++) {
				const input = 'y'.repeat(length);
				const expected = createHash('ripemd160').update(input, 'utf8').digest('hex');
				expect(hex(ripemd160(utf8(input)))).toBe(expected);
			}
		},
	);
});
