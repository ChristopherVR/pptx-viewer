import { describe, expect, it } from 'vitest';

import { digest } from './digest';

function hex(bytes: Uint8Array): string {
	return Buffer.from(bytes).toString('hex');
}

function utf8(text: string): Uint8Array {
	return new TextEncoder().encode(text);
}

describe('digest', () => {
	it('dispatches SHA-256 to Web Crypto', async () => {
		expect(hex(await digest('SHA-256', utf8('abc')))).toBe(
			'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
		);
	});

	it.each([
		['MD5', 'abc', '900150983cd24fb0d6963f7d28e17f72'],
		['MD4', 'abc', 'a448017aaf21d8525fc10ae87aa6729d'],
		['MD2', 'abc', 'da853b0d3f88d99b30283a69e6ded6bb'],
		['RIPEMD-128', 'abc', 'c14a12199c66e4ba84636b0f69144c77'],
		['RIPEMD-160', 'abc', '8eb208f7e05d987a9b044a8e98c6b087f15a0bfc'],
	] as const)('dispatches %s to the pure implementation', async (algorithm, input, expected) => {
		expect(hex(await digest(algorithm, utf8(input)))).toBe(expected);
	});

	it('dispatches WHIRLPOOL to the pure implementation', async () => {
		expect(hex(await digest('WHIRLPOOL', utf8('abc')))).toBe(
			'4e2448a4c6f486bb16b6562c73b4020bf3043e3a731bce721ae1b303d97e6d4c7181eebdb6c57e277d0e34957114cbd6c797fc9d95d8b582d225292076d4eef5',
		);
	});
});
