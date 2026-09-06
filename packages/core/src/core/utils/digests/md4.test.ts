/**
 * MD4 test vectors from RFC 1320 section 3.5.
 */
import { describe, expect, it } from 'vitest';

import { md4 } from './md4';

function hex(bytes: Uint8Array): string {
	return Buffer.from(bytes).toString('hex');
}

function utf8(text: string): Uint8Array {
	return new TextEncoder().encode(text);
}

describe('md4', () => {
	it.each([
		['', '31d6cfe0d16ae931b73c59d7e0c089c0'],
		['a', 'bde52cb31de33e46245e05fbdbd6fb24'],
		['abc', 'a448017aaf21d8525fc10ae87aa6729d'],
		['message digest', 'd9130a8164549fe818874806e1c7014b'],
		['abcdefghijklmnopqrstuvwxyz', 'd79e1c308aa5bbcdeea8ed63df412da9'],
		[
			'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
			'043f8582f241db351ce627e153e7f0e4',
		],
		[
			'12345678901234567890123456789012345678901234567890123456789012345678901234567890',
			'e33b4ddc9c38f2199c3e7b164fcc0536',
		],
	])('matches the RFC 1320 test suite for %j', (input, expected) => {
		expect(hex(md4(utf8(input)))).toBe(expected);
	});
});
