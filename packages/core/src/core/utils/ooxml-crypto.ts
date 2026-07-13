/**
 * ECMA-376 OOXML encryption and decryption.
 *
 * Implements the "Agile" encryption scheme (ECMA-376 Standard Encryption
 * and Agile Encryption) used by Office 2010+ for password-protected files.
 *
 * This module serves as the public facade, re-exporting types and errors
 * from sub-modules and providing the top-level {@link decryptPptx},
 * {@link encryptPptx}, and {@link verifyPassword} functions.
 *
 * Reference:
 * - [MS-OFFCRYPTO] Office Document Cryptography Structure
 * - ECMA-376 Part 2, Data Spaces and Rights Management
 *
 * @module ooxml-crypto
 */

import { parseOle2, buildOle2 } from './ole2-parser';
import {
	verifyAgilePassword,
	verifyStandardPassword,
	verifyAgileDataIntegrity,
	decryptAgilePackage,
	decryptStandardPackage,
} from './ooxml-crypto-decrypt';
import {
	encryptAgilePackage,
	buildAgileEncryptionInfoXml,
	buildEncryptionInfoStream,
} from './ooxml-crypto-encrypt';
import { IncorrectPasswordError } from './ooxml-crypto-errors';
import {
	parseEncryptionInfo,
	deriveAgileKey,
	generateIV,
	BLOCK_KEYS,
} from './ooxml-crypto-key-derivation';
import {
	getCrypto,
	hash,
	aesCbcEncryptNoPad,
	hmac,
	base64Decode,
	base64Encode,
	encodePasswordUtf16LE,
	concatArrays,
} from './ooxml-crypto-primitives';
// Internal imports used by the public API functions below
import type { EncryptionInfo, EncryptionOptions } from './ooxml-crypto-types';

// Sub-module re-exports — types
export type {
	EncryptionAlgorithm,
	EncryptionInfo,
	StandardEncryptionInfo,
	EncryptionOptions,
} from './ooxml-crypto-types';

// Sub-module re-exports — errors
export { IncorrectPasswordError, DataIntegrityError } from './ooxml-crypto-errors';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Decrypt a password-protected PPTX file.
 *
 * The input must be an OLE2 compound file containing EncryptionInfo
 * and EncryptedPackage streams (standard OOXML encryption).
 *
 * @param encryptedBuffer - Raw bytes of the encrypted OLE2 file.
 * @param password - The document password.
 * @returns The decrypted PPTX ZIP buffer.
 * @throws IncorrectPasswordError if the password is wrong.
 * @throws DataIntegrityError if the encrypted data has been tampered with.
 * @throws Error if the file format is invalid.
 */
export async function decryptPptx(
	encryptedBuffer: ArrayBuffer,
	password: string,
): Promise<ArrayBuffer> {
	const ole2 = parseOle2(encryptedBuffer);

	const encryptionInfoStream = ole2.getStream('EncryptionInfo');
	if (!encryptionInfoStream) {
		throw new Error(
			'EncryptionInfo stream not found. The file may not be an encrypted OOXML package.',
		);
	}

	const encryptedPackage = ole2.getStream('EncryptedPackage');
	if (!encryptedPackage) {
		throw new Error('EncryptedPackage stream not found. The file may be corrupted.');
	}

	const info = parseEncryptionInfo(encryptionInfoStream);

	if ('isStandard' in info && info.isStandard) {
		// Standard encryption (Office 2007)
		const key = await verifyStandardPassword(info, password);
		if (!key) {
			throw new IncorrectPasswordError();
		}
		return decryptStandardPackage(encryptedPackage, key);
	}

	// Agile encryption (Office 2010+)
	const agileInfo = info as EncryptionInfo;
	const key = await verifyAgilePassword(agileInfo, password);
	if (!key) {
		throw new IncorrectPasswordError();
	}

	// Verify data integrity (HMAC) before decrypting the package
	await verifyAgileDataIntegrity(agileInfo, key, encryptedPackage);

	return decryptAgilePackage(encryptedPackage, key, agileInfo);
}

/**
 * Encrypt a PPTX file with a password.
 *
 * Creates an OLE2 compound file with EncryptionInfo and EncryptedPackage
 * streams using the OOXML agile encryption scheme (Office 2010+).
 *
 * @param pptxBuffer - Raw bytes of the unencrypted PPTX ZIP file.
 * @param password - The password to protect the file with.
 * @param options - Optional encryption settings.
 * @returns ArrayBuffer of the encrypted OLE2 file.
 */
export async function encryptPptx(
	pptxBuffer: ArrayBuffer,
	password: string,
	options?: EncryptionOptions,
): Promise<ArrayBuffer> {
	const algorithm = options?.algorithm ?? 'AES256';
	const keyBits = algorithm === 'AES128' ? 128 : 256;
	const crypto = getCrypto();

	// Generate random salts
	const keyDataSalt = new Uint8Array(16);
	crypto.getRandomValues(keyDataSalt);

	const pkeSalt = new Uint8Array(16);
	crypto.getRandomValues(pkeSalt);

	// Generate the document encryption key
	const documentKey = new Uint8Array(keyBits / 8);
	crypto.getRandomValues(documentKey);

	const hashAlgorithm = 'SHA-512';
	const hashSize = 64;
	const blockSize = 16;
	const spinCount = options?.spinCount ?? 100000;

	// Derive password verification values
	// 1. Generate verifier hash input (random)
	const verifierHashInput = new Uint8Array(16);
	crypto.getRandomValues(verifierHashInput);

	// 2. Hash the verifier input
	const verifierHash = await hash(hashAlgorithm, verifierHashInput);

	// 3. Encrypt the verifier hash input
	const verifierInputKey = await deriveAgileKey(
		password,
		pkeSalt,
		spinCount,
		hashAlgorithm,
		BLOCK_KEYS.verifierHashInput,
		keyBits,
		hashSize,
	);

	// Pad verifierHashInput to block size
	const paddedVerifierInput = new Uint8Array(
		Math.ceil(verifierHashInput.length / blockSize) * blockSize,
	);
	paddedVerifierInput.set(verifierHashInput);
	const encryptedVerifierHashInput = await aesCbcEncryptNoPad(
		verifierInputKey,
		pkeSalt,
		paddedVerifierInput,
	);

	// 4. Encrypt the verifier hash value
	const verifierHashKey = await deriveAgileKey(
		password,
		pkeSalt,
		spinCount,
		hashAlgorithm,
		BLOCK_KEYS.verifierHashValue,
		keyBits,
		hashSize,
	);

	const paddedVerifierHash = new Uint8Array(Math.ceil(verifierHash.length / blockSize) * blockSize);
	paddedVerifierHash.set(verifierHash);
	const encryptedVerifierHashValue = await aesCbcEncryptNoPad(
		verifierHashKey,
		pkeSalt,
		paddedVerifierHash,
	);

	// 5. Encrypt the document key
	const encKeyKey = await deriveAgileKey(
		password,
		pkeSalt,
		spinCount,
		hashAlgorithm,
		BLOCK_KEYS.encryptedKeyValue,
		keyBits,
		hashSize,
	);

	const paddedDocumentKey = new Uint8Array(Math.ceil(documentKey.length / blockSize) * blockSize);
	paddedDocumentKey.set(documentKey);
	const encryptedKeyValue = await aesCbcEncryptNoPad(encKeyKey, pkeSalt, paddedDocumentKey);

	// Build encryption info
	const encInfo: EncryptionInfo = {
		version: { major: 4, minor: 4 },
		isAgile: true,
		keyData: {
			saltSize: 16,
			blockSize,
			keyBits,
			hashSize,
			cipherAlgorithm: 'AES',
			cipherChaining: 'ChainingModeCBC',
			hashAlgorithm,
			saltValue: keyDataSalt,
		},
		dataIntegrity: {
			encryptedHmacKey: new Uint8Array(0), // Will be filled after encryption
			encryptedHmacValue: new Uint8Array(0),
		},
		passwordKeyEncryptor: {
			saltSize: 16,
			blockSize,
			keyBits,
			hashSize,
			cipherAlgorithm: 'AES',
			cipherChaining: 'ChainingModeCBC',
			hashAlgorithm,
			saltValue: pkeSalt,
			spinCount,
			encryptedVerifierHashInput,
			encryptedVerifierHashValue,
			encryptedKeyValue,
		},
	};

	// Encrypt the package
	const packageData = new Uint8Array(pptxBuffer);
	const encryptedPackage = await encryptAgilePackage(packageData, documentKey, encInfo);

	// Compute data integrity (HMAC over encrypted package)
	// Generate HMAC key
	const hmacKeyRandom = new Uint8Array(hashSize);
	crypto.getRandomValues(hmacKeyRandom);

	// Compute HMAC of the complete EncryptedPackage stream, including its size prefix.
	const hmacValue = await hmac(hashAlgorithm, hmacKeyRandom, encryptedPackage);

	// Encrypt HMAC key
	const hmacKeyIV = await generateIV(
		hashAlgorithm,
		keyDataSalt,
		BLOCK_KEYS.dataIntegrityHmacKey,
		blockSize,
	);
	const paddedHmacKey = new Uint8Array(Math.ceil(hmacKeyRandom.length / blockSize) * blockSize);
	paddedHmacKey.set(hmacKeyRandom);
	const encryptedHmacKey = await aesCbcEncryptNoPad(documentKey, hmacKeyIV, paddedHmacKey);

	// Encrypt HMAC value
	const hmacValueIV = await generateIV(
		hashAlgorithm,
		keyDataSalt,
		BLOCK_KEYS.dataIntegrityHmacValue,
		blockSize,
	);
	const paddedHmacValue = new Uint8Array(Math.ceil(hmacValue.length / blockSize) * blockSize);
	paddedHmacValue.set(hmacValue);
	const encryptedHmacValue = await aesCbcEncryptNoPad(documentKey, hmacValueIV, paddedHmacValue);

	// Update encryption info with integrity values
	encInfo.dataIntegrity = {
		encryptedHmacKey,
		encryptedHmacValue,
	};

	// Build the EncryptionInfo stream
	const xmlStr = buildAgileEncryptionInfoXml(
		encInfo.keyData,
		encInfo.passwordKeyEncryptor,
		encInfo.dataIntegrity,
	);
	const encryptionInfoBytes = buildEncryptionInfoStream(xmlStr);

	// Build OLE2 container
	const ole2Streams = new Map<string, Uint8Array>();
	ole2Streams.set('EncryptionInfo', encryptionInfoBytes);
	ole2Streams.set('EncryptedPackage', encryptedPackage);

	return buildOle2(ole2Streams);
}

/**
 * Check if a password is correct for a given encrypted file without
 * performing the full decryption.
 *
 * @param encryptedBuffer - Raw bytes of the encrypted OLE2 file.
 * @param password - The password to verify.
 * @returns True if the password is correct.
 */
export async function verifyPassword(
	encryptedBuffer: ArrayBuffer,
	password: string,
): Promise<boolean> {
	try {
		const ole2 = parseOle2(encryptedBuffer);
		const encryptionInfoStream = ole2.getStream('EncryptionInfo');
		if (!encryptionInfoStream) {
			return false;
		}

		const info = parseEncryptionInfo(encryptionInfoStream);

		if ('isStandard' in info && info.isStandard) {
			const key = await verifyStandardPassword(info, password);
			return key !== null;
		}

		const agileInfo = info as EncryptionInfo;
		const key = await verifyAgilePassword(agileInfo, password);
		return key !== null;
	} catch {
		return false;
	}
}

// ---------------------------------------------------------------------------
// Re-exports for testing (underscore-prefixed)
// ---------------------------------------------------------------------------

export {
	parseEncryptionInfo as _parseEncryptionInfo,
	base64Decode as _base64Decode,
	base64Encode as _base64Encode,
	encodePasswordUtf16LE as _encodePasswordUtf16LE,
	concatArrays as _concatArrays,
	deriveAgileKey as _deriveAgileKey,
	hash as _hash,
};
