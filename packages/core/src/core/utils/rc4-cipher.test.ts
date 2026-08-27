import { describe, expect, it } from 'vitest';

import { rc4Cipher } from './rc4-cipher';

function textBytes(text: string): Uint8Array {
	return new TextEncoder().encode(text);
}

function hexBytes(hex: string): Uint8Array {
	const clean = hex.replace(/\s+/gu, '');
	const bytes = new Uint8Array(clean.length / 2);
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
	}
	return bytes;
}

function toHex(bytes: Uint8Array): string {
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

describe('rc4Cipher', () => {
	// Well-known RC4 test vectors (Wikipedia "RC4" / widely reproduced).
	it('matches the "Key"/"Plaintext" test vector', () => {
		const key = textBytes('Key');
		const plaintext = textBytes('Plaintext');
		const ciphertext = rc4Cipher(key, plaintext);
		expect(toHex(ciphertext)).toBe('bbf316e8d940af0ad3');
	});

	it('matches the "Wiki"/"pedia" test vector', () => {
		const key = textBytes('Wiki');
		const plaintext = textBytes('pedia');
		const ciphertext = rc4Cipher(key, plaintext);
		expect(toHex(ciphertext)).toBe('1021bf0420');
	});

	it('matches the "Secret"/"Attack at dawn" test vector', () => {
		const key = textBytes('Secret');
		const plaintext = textBytes('Attack at dawn');
		const ciphertext = rc4Cipher(key, plaintext);
		expect(toHex(ciphertext)).toBe('45a01f645fc35b383552544b9bf5');
	});

	it('is self-inverse: decrypting the ciphertext with the same key recovers the plaintext', () => {
		const key = hexBytes('a61c304b111d165698b68e1d4d46c540');
		const plaintext = textBytes('round trip me please, thank you!');
		const ciphertext = rc4Cipher(key, plaintext);
		const decrypted = rc4Cipher(key, ciphertext);
		expect(decrypted).toStrictEqual(plaintext);
	});

	it('produces different ciphertext for different keys', () => {
		const plaintext = textBytes('same plaintext');
		const a = rc4Cipher(textBytes('key-one'), plaintext);
		const b = rc4Cipher(textBytes('key-two'), plaintext);
		expect(a).not.toStrictEqual(b);
	});

	it('handles empty data', () => {
		expect(rc4Cipher(textBytes('key'), new Uint8Array(0))).toStrictEqual(new Uint8Array(0));
	});

	it('throws for an empty key', () => {
		expect(() => rc4Cipher(new Uint8Array(0), textBytes('data'))).toThrow();
	});
});
