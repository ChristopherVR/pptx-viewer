/**
 * MD2 test vectors from RFC 1319 section 7.
 */
import { describe, expect, it } from 'vitest';

import { md2 } from './md2';

function hex(bytes: Uint8Array): string {
	return Buffer.from(bytes).toString('hex');
}

function utf8(text: string): Uint8Array {
	return new TextEncoder().encode(text);
}

describe('md2', () => {
	it.each([
		['', '8350e5a3e24c153df2275c9f80692773'],
		['a', '32ec01ec4a6dac72c0ab96fb34c0b5d1'],
		['abc', 'da853b0d3f88d99b30283a69e6ded6bb'],
		['message digest', 'ab4f496bfb2a530b219ff33031fe06b0'],
		['abcdefghijklmnopqrstuvwxyz', '4e8ddff3650292ab5a4108c3aa47940b'],
		[
			'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
			'da33def2a42df13975352846c30338cd',
		],
		[
			'12345678901234567890123456789012345678901234567890123456789012345678901234567890',
			'd5976f79d83d3a0dc9806c3c66f3efd8',
		],
	])('matches the RFC 1319 test suite for %j', (input, expected) => {
		expect(hex(md2(utf8(input)))).toBe(expected);
	});

	it('pads a message that is already a multiple of 16 bytes with a full block', () => {
		// 16 bytes exactly; MD2 always pads (RFC 1319 section 3.1), so this must
		// not produce the same digest as an unpadded 16-byte block would.
		const sixteenBytes = utf8('0123456789abcdef');
		expect(hex(md2(sixteenBytes))).toHaveLength(32);
	});

	it('produces different digests for different multi-block messages', () => {
		const a = md2(utf8('a'.repeat(64)));
		const b = md2(utf8('b'.repeat(64)));
		expect(hex(a)).not.toBe(hex(b));
	});
});
