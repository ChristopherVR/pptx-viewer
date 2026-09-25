import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import type { StandardEncryptionInfo } from '../utils/ooxml-crypto-types';
import {
	rc4CryptoApiBlockKey,
	rc4CryptoApiEncryptVerifier,
	rc4CryptoApiKeyBase,
	rc4CryptoApiVerifierMatches,
} from './rc4-cryptoapi-key';

const sha1 = (...parts: Uint8Array[]) =>
	new Uint8Array(createHash('sha1').update(Buffer.concat(parts)).digest());
const salt = Uint8Array.from({ length: 16 }, (_, i) => i * 7);

function infoFor(encryptedVerifier: Uint8Array, encryptedVerifierHash: Uint8Array) {
	return {
		verifier: { salt, encryptedVerifier, encryptedVerifierHash, verifierHashSize: 20 },
	} as unknown as StandardEncryptionInfo;
}

describe('rc4 CryptoAPI key derivation ([MS-OFFCRYPTO] 2.3.5.2)', () => {
	it('derives H0 = SHA-1(salt + UTF-16LE password) with no spin rounds', async () => {
		const base = await rc4CryptoApiKeyBase('pw', salt);
		expect(base).toStrictEqual(sha1(salt, Buffer.from('pw', 'utf16le')));
	});

	it('finishes a block key as SHA-1(H0 + LE32 block) truncated to the key size', async () => {
		const base = await rc4CryptoApiKeyBase('pw', salt);
		const key = await rc4CryptoApiBlockKey(base, 128, 7);
		expect(key).toStrictEqual(sha1(base, Uint8Array.of(7, 0, 0, 0)).subarray(0, 16));
	});

	it('zero-pads a 40-bit key to 128 bits, as the CryptoAPI RC4 provider does', async () => {
		const base = await rc4CryptoApiKeyBase('pw', salt);
		const key = await rc4CryptoApiBlockKey(base, 40, 0);
		expect(key).toHaveLength(16);
		expect(key.subarray(0, 5)).toStrictEqual(sha1(base, new Uint8Array(4)).subarray(0, 5));
		expect(Array.from(key.subarray(5))).toStrictEqual(new Array(11).fill(0));
	});

	it('verifies a verifier written as one continuous RC4 stream, and rejects a wrong key', async () => {
		const key0 = await rc4CryptoApiBlockKey(await rc4CryptoApiKeyBase('pw', salt), 128, 0);
		const verifier = Uint8Array.from({ length: 16 }, (_, i) => 255 - i);
		const { encryptedVerifier, encryptedVerifierHash } = await rc4CryptoApiEncryptVerifier(
			key0,
			verifier,
		);
		const info = infoFor(encryptedVerifier, encryptedVerifierHash);
		await expect(rc4CryptoApiVerifierMatches(info, key0)).resolves.toBeTruthy();
		const wrong = await rc4CryptoApiBlockKey(await rc4CryptoApiKeyBase('nope', salt), 128, 0);
		await expect(rc4CryptoApiVerifierMatches(info, wrong)).resolves.toBeFalsy();
	});
});
