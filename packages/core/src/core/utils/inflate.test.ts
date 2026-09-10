import { deflateSync, deflateRawSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { inflateRaw, zlibInflate } from './inflate';

function bytes(str: string): Uint8Array {
	return new Uint8Array(Buffer.from(str, 'binary'));
}

describe('inflateRaw', () => {
	it('round-trips a short repetitive string (dynamic Huffman + back-references)', () => {
		const input = 'the quick brown fox jumps over the lazy dog. the quick brown fox!!';
		const compressed = deflateRawSync(Buffer.from(input, 'utf8'));
		const out = inflateRaw(new Uint8Array(compressed));
		expect(Buffer.from(out).toString('utf8')).toBe(input);
	});

	it('round-trips random-ish binary data (stored/fixed blocks)', () => {
		const input = new Uint8Array(300);
		for (let i = 0; i < input.length; i++) {
			input[i] = (i * 37 + 11) % 256;
		}
		const compressed = deflateRawSync(Buffer.from(input));
		const out = inflateRaw(new Uint8Array(compressed));
		expect(Buffer.from(out)).toStrictEqual(Buffer.from(input));
	});

	it('round-trips an empty input', () => {
		const compressed = deflateRawSync(Buffer.alloc(0));
		const out = inflateRaw(new Uint8Array(compressed));
		expect(out).toHaveLength(0);
	});

	it('stops early once maxOutputBytes is reached', () => {
		const input = 'A'.repeat(5000);
		const compressed = deflateRawSync(Buffer.from(input, 'utf8'));
		const out = inflateRaw(new Uint8Array(compressed), 10);
		expect(out).toHaveLength(10);
		expect(Buffer.from(out).toString('utf8')).toBe('AAAAAAAAAA');
	});
});

describe('zlibInflate', () => {
	it('decodes a zlib-wrapped stream (ignores the trailer)', () => {
		const input = bytes('hello zlib world, hello zlib world, hello zlib world');
		const compressed = deflateSync(Buffer.from(input));
		const out = zlibInflate(new Uint8Array(compressed));
		expect(Buffer.from(out)).toStrictEqual(Buffer.from(input));
	});

	it('supports early stop through the zlib header', () => {
		const input = new Uint8Array(2000).fill(7);
		const compressed = deflateSync(Buffer.from(input));
		const out = zlibInflate(new Uint8Array(compressed), 4);
		expect(out).toHaveLength(4);
		expect(Array.from(out)).toStrictEqual([7, 7, 7, 7]);
	});
});
