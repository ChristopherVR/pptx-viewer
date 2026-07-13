/**
 * OOXML decryption operations.
 *
 * Implements password verification and package decryption for both agile
 * (Office 2010+) and standard (Office 2007) encryption schemes.
 *
 * @module ooxml-crypto-decrypt
 */

import { DataIntegrityError } from './ooxml-crypto-errors';
import {
	BLOCK_KEYS,
	deriveAgileKey,
	deriveStandardKey,
	generateIV,
} from './ooxml-crypto-key-derivation';
import { aesCbcDecryptRaw, hash, hmac, uint32LE } from './ooxml-crypto-primitives';
import type { EncryptionInfo, StandardEncryptionInfo } from './ooxml-crypto-types';

// ---------------------------------------------------------------------------
// Agile Password Verification
// ---------------------------------------------------------------------------

/**
 * Verify the password against agile encryption info and return the
 * decryption key if valid.
 *
 * @param info - Parsed agile encryption info.
 * @param password - The password to verify.
 * @returns The document encryption key, or null if the password is wrong.
 */
export async function verifyAgilePassword(
	info: EncryptionInfo,
	password: string,
): Promise<Uint8Array | null> {
	const pke = info.passwordKeyEncryptor;

	// Derive key for verifier hash input
	const verifierInputKey = await deriveAgileKey(
		password,
		pke.saltValue,
		pke.spinCount,
		pke.hashAlgorithm,
		BLOCK_KEYS.verifierHashInput,
		pke.keyBits,
		pke.hashSize,
	);

	// Decrypt the verifier hash input
	const verifierHashInput = await aesCbcDecryptRaw(
		verifierInputKey,
		pke.saltValue,
		pke.encryptedVerifierHashInput,
	);

	// Derive key for verifier hash value
	const verifierHashKey = await deriveAgileKey(
		password,
		pke.saltValue,
		pke.spinCount,
		pke.hashAlgorithm,
		BLOCK_KEYS.verifierHashValue,
		pke.keyBits,
		pke.hashSize,
	);

	// Decrypt the verifier hash value
	const verifierHashValue = await aesCbcDecryptRaw(
		verifierHashKey,
		pke.saltValue,
		pke.encryptedVerifierHashValue,
	);

	// Hash the decrypted verifier input and compare
	const computedHash = await hash(pke.hashAlgorithm, verifierHashInput.subarray(0, pke.saltSize));

	// Compare hashes (only compare up to hash size)
	const expectedHash = verifierHashValue.subarray(0, pke.hashSize);
	const actualHash = computedHash.subarray(0, pke.hashSize);

	let match = true;
	for (let i = 0; i < pke.hashSize; i++) {
		if (expectedHash[i] !== actualHash[i]) {
			match = false;
			break;
		}
	}

	if (!match) {
		return null;
	}

	// Password verified. Now decrypt the document encryption key.
	const encKeyKey = await deriveAgileKey(
		password,
		pke.saltValue,
		pke.spinCount,
		pke.hashAlgorithm,
		BLOCK_KEYS.encryptedKeyValue,
		pke.keyBits,
		pke.hashSize,
	);

	const decryptedKey = await aesCbcDecryptRaw(encKeyKey, pke.saltValue, pke.encryptedKeyValue);

	return decryptedKey.subarray(0, info.keyData.keyBits / 8);
}

// ---------------------------------------------------------------------------
// Standard Password Verification
// ---------------------------------------------------------------------------

/**
 * Verify the password against standard encryption info and return the
 * decryption key if valid.
 *
 * @param info - Parsed standard encryption info.
 * @param password - The password to verify.
 * @returns The encryption key, or null if the password is wrong.
 */
export async function verifyStandardPassword(
	info: StandardEncryptionInfo,
	password: string,
): Promise<Uint8Array | null> {
	const key = await deriveStandardKey(
		password,
		info.verifier.salt,
		info.header.keySize,
		info.header.algIdHash,
	);

	// Decrypt the encrypted verifier
	const iv = new Uint8Array(16); // All zeros for standard encryption
	const decryptedVerifier = await aesCbcDecryptRaw(key, iv, info.verifier.encryptedVerifier);

	// Decrypt the encrypted verifier hash
	const decryptedHash = await aesCbcDecryptRaw(key, iv, info.verifier.encryptedVerifierHash);

	// Hash the decrypted verifier
	const computedHash = await hash('SHA-1', decryptedVerifier);

	// Compare (only first 20 bytes = SHA-1 hash size)
	const hashSize = info.verifier.verifierHashSize;
	let match = true;
	for (let i = 0; i < Math.min(hashSize, 20); i++) {
		if (computedHash[i] !== decryptedHash[i]) {
			match = false;
			break;
		}
	}

	return match ? key : null;
}

// ---------------------------------------------------------------------------
// Data Integrity Verification
// ---------------------------------------------------------------------------

/**
 * Verify the data integrity HMAC of an agile-encrypted package.
 *
 * [MS-OFFCRYPTO] 2.3.7.1 -- The data integrity is verified by:
 * 1. Decrypting the HMAC key from dataIntegrity.encryptedHmacKey
 * 2. Decrypting the HMAC value from dataIntegrity.encryptedHmacValue
 * 3. Computing HMAC of the encrypted package data (after the 8-byte size prefix)
 * 4. Comparing the computed HMAC with the decrypted HMAC value
 *
 * @param info - Parsed agile encryption info.
 * @param key - The document encryption key.
 * @param encryptedPackage - Raw bytes of the EncryptedPackage stream.
 * @throws DataIntegrityError if the data integrity check fails.
 */
export async function verifyAgileDataIntegrity(
	info: EncryptionInfo,
	key: Uint8Array,
	encryptedPackage: Uint8Array,
): Promise<void> {
	const keyData = info.keyData;

	// If no data integrity block is present, skip verification
	if (!info.dataIntegrity) {
		return;
	}

	// Decrypt the HMAC key
	const hmacKeyIV = await generateIV(
		keyData.hashAlgorithm,
		keyData.saltValue,
		BLOCK_KEYS.dataIntegrityHmacKey,
		keyData.blockSize,
	);
	const decryptedHmacKey = await aesCbcDecryptRaw(
		key,
		hmacKeyIV,
		info.dataIntegrity.encryptedHmacKey,
	);
	// Truncate to hash size
	const hmacKey = decryptedHmacKey.subarray(0, keyData.hashSize);

	// Decrypt the HMAC value
	const hmacValueIV = await generateIV(
		keyData.hashAlgorithm,
		keyData.saltValue,
		BLOCK_KEYS.dataIntegrityHmacValue,
		keyData.blockSize,
	);
	const decryptedHmacValue = await aesCbcDecryptRaw(
		key,
		hmacValueIV,
		info.dataIntegrity.encryptedHmacValue,
	);
	const expectedHmac = decryptedHmacValue.subarray(0, keyData.hashSize);

	// The HMAC covers the complete EncryptedPackage stream, including its size prefix.
	const computedHmac = await hmac(keyData.hashAlgorithm, hmacKey, encryptedPackage);

	// Compare HMACs
	let match = true;
	if (computedHmac.length < keyData.hashSize) {
		match = false;
	} else {
		for (let i = 0; i < keyData.hashSize; i++) {
			if (computedHmac[i] !== expectedHmac[i]) {
				match = false;
				break;
			}
		}
	}

	if (!match) {
		throw new DataIntegrityError(
			'Data integrity check failed. The encrypted file may be corrupted or tampered with.',
		);
	}
}

// ---------------------------------------------------------------------------
// Package Decryption
// ---------------------------------------------------------------------------

/**
 * Decrypt the EncryptedPackage stream using the agile encryption key.
 *
 * The encrypted package uses segment-based encryption:
 * each 4096-byte segment is encrypted separately with a unique IV.
 *
 * @param encryptedPackage - Raw bytes of the EncryptedPackage stream.
 * @param key - The document encryption key.
 * @param info - Parsed agile encryption info.
 * @returns The decrypted package as an ArrayBuffer.
 */
export async function decryptAgilePackage(
	encryptedPackage: Uint8Array,
	key: Uint8Array,
	info: EncryptionInfo,
): Promise<ArrayBuffer> {
	const keyData = info.keyData;

	// First 8 bytes are the actual (unencrypted) size of the original package
	const sizeView = new DataView(encryptedPackage.buffer, encryptedPackage.byteOffset, 8);
	const originalSize = sizeView.getUint32(0, true) + sizeView.getUint32(4, true) * 0x100000000;

	const encryptedData = encryptedPackage.subarray(8);
	const segmentSize = 4096;
	const result = new Uint8Array(originalSize);
	let resultOffset = 0;

	const numSegments = Math.ceil(encryptedData.length / segmentSize);

	for (let segment = 0; segment < numSegments; segment++) {
		const segmentStart = segment * segmentSize;
		const segmentEnd = Math.min(segmentStart + segmentSize, encryptedData.length);
		const segmentData = encryptedData.subarray(segmentStart, segmentEnd);

		// Generate IV for this segment: H(salt + blockKey)
		const blockKeyBytes = uint32LE(segment);
		const segmentIV = await generateIV(
			keyData.hashAlgorithm,
			keyData.saltValue,
			blockKeyBytes,
			keyData.blockSize,
		);

		const decrypted = await aesCbcDecryptRaw(key, segmentIV, segmentData);

		// Copy only what's needed (last segment might be smaller)
		const bytesToCopy = Math.min(decrypted.length, originalSize - resultOffset);
		result.set(decrypted.subarray(0, bytesToCopy), resultOffset);
		resultOffset += bytesToCopy;
	}

	return result.buffer;
}

/**
 * Decrypt the EncryptedPackage stream using standard encryption key.
 *
 * Standard encryption uses a single AES-CBC pass with an all-zero IV.
 *
 * @param encryptedPackage - Raw bytes of the EncryptedPackage stream.
 * @param key - The encryption key.
 * @returns The decrypted package as an ArrayBuffer.
 */
export async function decryptStandardPackage(
	encryptedPackage: Uint8Array,
	key: Uint8Array,
): Promise<ArrayBuffer> {
	// First 8 bytes are the actual size
	const sizeView = new DataView(encryptedPackage.buffer, encryptedPackage.byteOffset, 8);
	const originalSize = sizeView.getUint32(0, true);

	const encryptedData = encryptedPackage.subarray(8);
	const iv = new Uint8Array(16); // All zeros for standard encryption
	const decrypted = await aesCbcDecryptRaw(key, iv, encryptedData);

	return decrypted.subarray(0, originalSize).buffer as ArrayBuffer;
}
