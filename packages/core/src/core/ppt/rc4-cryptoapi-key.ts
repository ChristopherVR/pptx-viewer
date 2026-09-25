/**
 * Key derivation and password verification for the "RC4 CryptoAPI
 * Encryption" scheme ([MS-OFFCRYPTO] 2.3.5) that protects password-protected
 * PowerPoint 97-2003 (`.ppt`) files.
 *
 * Unlike OOXML Standard Encryption (2.3.4.7), this scheme has NO spin
 * rounds ([MS-OFFCRYPTO] 2.3.5.2):
 *
 * - `H0 = SHA-1(salt + password)` (password as UTF-16LE),
 * - `Hfinal = SHA-1(H0 + blockNumber)` (block number as a 32-bit LE int),
 * - the key is `Hfinal` truncated to `keySize` bits; a 40-bit key is
 *   zero-padded to 128 bits, as the CryptoAPI RC4 provider does.
 *
 * The password verifier and its hash are one continuous RC4 stream under
 * the block-0 key ([MS-OFFCRYPTO] 2.3.5.6). All three facts were measured
 * against a file PowerPoint wrote itself (`encrypted-powerpoint.ppt`, see
 * `scripts/make-encrypted-ppt-fixture.ps1`); the earlier Standard
 * Encryption derivation (50,000 SHA-1 rounds, verifier fields re-keyed
 * separately) rejected every PowerPoint-authored file as a wrong password.
 *
 * @module ppt/rc4-cryptoapi-key
 */

import {
	concatArrays,
	encodePasswordUtf16LE,
	hash,
	uint32LE,
} from '../utils/ooxml-crypto-primitives';
import type { StandardEncryptionInfo } from '../utils/ooxml-crypto-types';
import { rc4Cipher } from '../utils/rc4-cipher';

/** Size, in bytes, of a CryptoAPI RC4 key before truncation to a 40-bit key. */
const PADDED_40_BIT_KEY_BYTES = 16;

/**
 * Compute `H0 = SHA-1(salt + password)`, the per-file base every block key
 * is finished from.
 *
 * @param password - User password.
 * @param salt - The verifier salt from the CryptSession10Container.
 */
export async function rc4CryptoApiKeyBase(password: string, salt: Uint8Array): Promise<Uint8Array> {
	return hash('SHA-1', concatArrays(salt, encodePasswordUtf16LE(password)));
}

/**
 * Finish the RC4 key for one block: `SHA-1(base + LE32(blockNumber))`
 * truncated to `keySize` bits (a 40-bit key is zero-padded to 16 bytes).
 *
 * @param base - Result of {@link rc4CryptoApiKeyBase}.
 * @param keySize - Key size in bits (40 to 128, a multiple of 8).
 * @param blockNumber - 0 for the verifier and the Pictures stream, the
 *   persist object identifier for a "PowerPoint Document" persist object.
 */
export async function rc4CryptoApiBlockKey(
	base: Uint8Array,
	keySize: number,
	blockNumber: number,
): Promise<Uint8Array> {
	const h = await hash('SHA-1', concatArrays(base, uint32LE(blockNumber)));
	const keyBytes = Math.max(5, Math.min(h.length, keySize / 8));
	if (keyBytes === 5) {
		const padded = new Uint8Array(PADDED_40_BIT_KEY_BYTES);
		padded.set(h.subarray(0, 5));
		return padded;
	}
	return h.slice(0, keyBytes);
}

/**
 * True when the block-0 key `key0` decrypts the verifier to a value whose
 * SHA-1 matches the decrypted verifier hash (one continuous RC4 stream).
 */
export async function rc4CryptoApiVerifierMatches(
	info: StandardEncryptionInfo,
	key0: Uint8Array,
): Promise<boolean> {
	const { encryptedVerifier, encryptedVerifierHash, verifierHashSize } = info.verifier;
	const plain = rc4Cipher(key0, concatArrays(encryptedVerifier, encryptedVerifierHash));
	const verifier = plain.subarray(0, encryptedVerifier.length);
	const verifierHash = plain.subarray(encryptedVerifier.length);
	const computed = await hash('SHA-1', verifier);
	const size = Math.min(verifierHashSize, computed.length, verifierHash.length);
	if (size === 0) {
		return false;
	}
	for (let i = 0; i < size; i++) {
		if (computed[i] !== verifierHash[i]) {
			return false;
		}
	}
	return true;
}

/**
 * Encrypt a fresh verifier for the writer: `verifier` and its SHA-1 as one
 * continuous RC4 stream under `key0`.
 *
 * @returns The encrypted verifier (16 bytes) and encrypted hash (20 bytes).
 */
export async function rc4CryptoApiEncryptVerifier(
	key0: Uint8Array,
	verifier: Uint8Array,
): Promise<{ encryptedVerifier: Uint8Array; encryptedVerifierHash: Uint8Array }> {
	const verifierHash = await hash('SHA-1', verifier);
	const cipher = rc4Cipher(key0, concatArrays(verifier, verifierHash));
	return {
		encryptedVerifier: cipher.slice(0, verifier.length),
		encryptedVerifierHash: cipher.slice(verifier.length),
	};
}
