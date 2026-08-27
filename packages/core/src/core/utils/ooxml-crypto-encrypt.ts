/**
 * OOXML encryption operations.
 *
 * Implements the agile encryption scheme (Office 2010+) and the ECMA-376
 * Standard encryption scheme (Office 2007) for creating password-protected
 * OOXML files.
 *
 * @module ooxml-crypto-encrypt
 */

import { buildOle2 } from './ole2-parser';
import { deriveStandardKey, generateIV } from './ooxml-crypto-key-derivation';
import {
	aesCbcEncryptNoPad,
	base64Encode,
	getCrypto,
	hash,
	uint32LE,
} from './ooxml-crypto-primitives';
import type { EncryptionInfo, EncryptionOptions } from './ooxml-crypto-types';

// ---------------------------------------------------------------------------
// Agile Package Encryption
// ---------------------------------------------------------------------------

/**
 * Encrypt a package using the agile encryption scheme.
 *
 * Each 4096-byte segment is encrypted separately with a unique IV derived
 * from the segment index, matching the agile decryption format.
 *
 * @param packageData - The plaintext package bytes.
 * @param key - The document encryption key.
 * @param info - Agile encryption info describing the cipher parameters.
 * @returns Encrypted package bytes with an 8-byte size prefix.
 */
export async function encryptAgilePackage(
	packageData: Uint8Array,
	key: Uint8Array,
	info: EncryptionInfo,
): Promise<Uint8Array> {
	const keyData = info.keyData;
	const segmentSize = 4096;

	// Pad to segment boundary
	const paddedSize = Math.ceil(packageData.length / segmentSize) * segmentSize;
	const paddedData = new Uint8Array(paddedSize);
	paddedData.set(packageData);

	const encrypted = new Uint8Array(8 + paddedSize);

	// Write original size (8 bytes LE)
	const sizeView = new DataView(encrypted.buffer, 0, 8);
	sizeView.setUint32(0, packageData.length, true);
	sizeView.setUint32(4, 0, true);

	const numSegments = Math.ceil(paddedSize / segmentSize);

	for (let segment = 0; segment < numSegments; segment++) {
		const segmentStart = segment * segmentSize;
		const segmentEnd = segmentStart + segmentSize;
		const segmentData = paddedData.subarray(segmentStart, segmentEnd);

		const blockKeyBytes = uint32LE(segment);
		const segmentIV = await generateIV(
			keyData.hashAlgorithm,
			keyData.saltValue,
			blockKeyBytes,
			keyData.blockSize,
		);

		const encryptedSegment = await aesCbcEncryptNoPad(key, segmentIV, segmentData);
		encrypted.set(encryptedSegment, 8 + segmentStart);
	}

	return encrypted;
}

// ---------------------------------------------------------------------------
// EncryptionInfo XML Builder
// ---------------------------------------------------------------------------

/**
 * Generate EncryptionInfo XML for agile encryption.
 *
 * Builds the XML document that describes the encryption parameters,
 * key data, data integrity values, and password key encryptor.
 *
 * @param keyData - Key data parameters.
 * @param pke - Password key encryptor parameters.
 * @param dataIntegrity - Data integrity HMAC values.
 * @returns Serialized XML string.
 */
export function buildAgileEncryptionInfoXml(
	keyData: EncryptionInfo['keyData'],
	pke: EncryptionInfo['passwordKeyEncryptor'],
	dataIntegrity: EncryptionInfo['dataIntegrity'],
): string {
	const xmlNs = 'http://schemas.microsoft.com/office/2006/encryption';
	const pNs = 'http://schemas.microsoft.com/office/2006/keyEncryptor/password';

	return (
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
		`\r\n<encryption xmlns="${xmlNs}" ` +
		`xmlns:p="${pNs}">` +
		`<keyData saltSize="${keyData.saltSize}" ` +
		`blockSize="${keyData.blockSize}" ` +
		`keyBits="${keyData.keyBits}" ` +
		`hashSize="${keyData.hashSize}" ` +
		`cipherAlgorithm="${keyData.cipherAlgorithm}" ` +
		`cipherChaining="${keyData.cipherChaining}" ` +
		`hashAlgorithm="${keyData.hashAlgorithm}" ` +
		`saltValue="${base64Encode(keyData.saltValue)}"/>` +
		`<dataIntegrity ` +
		`encryptedHmacKey="${base64Encode(dataIntegrity!.encryptedHmacKey)}" ` +
		`encryptedHmacValue="${base64Encode(dataIntegrity!.encryptedHmacValue)}"/>` +
		`<keyEncryptors>` +
		`<keyEncryptor uri="http://schemas.microsoft.com/office/2006/keyEncryptor/password">` +
		`<p:encryptedKey ` +
		`spinCount="${pke.spinCount}" ` +
		`saltSize="${pke.saltSize}" ` +
		`blockSize="${pke.blockSize}" ` +
		`keyBits="${pke.keyBits}" ` +
		`hashSize="${pke.hashSize}" ` +
		`cipherAlgorithm="${pke.cipherAlgorithm}" ` +
		`cipherChaining="${pke.cipherChaining}" ` +
		`hashAlgorithm="${pke.hashAlgorithm}" ` +
		`saltValue="${base64Encode(pke.saltValue)}" ` +
		`encryptedVerifierHashInput="${base64Encode(pke.encryptedVerifierHashInput)}" ` +
		`encryptedVerifierHashValue="${base64Encode(pke.encryptedVerifierHashValue)}" ` +
		`encryptedKeyValue="${base64Encode(pke.encryptedKeyValue)}"/>` +
		`</keyEncryptor></keyEncryptors></encryption>`
	);
}

/**
 * Build the EncryptionInfo stream bytes for agile encryption.
 *
 * Prepends the 8-byte header (version 4.4 + reserved flag) to the
 * XML content.
 *
 * @param xmlString - The agile encryption info XML string.
 * @returns Raw bytes of the EncryptionInfo stream.
 */
export function buildEncryptionInfoStream(xmlString: string): Uint8Array {
	const xmlBytes = new TextEncoder().encode(xmlString);
	const result = new Uint8Array(8 + xmlBytes.length);
	const view = new DataView(result.buffer);

	// Version: 4.4 (agile)
	view.setUint16(0, 4, true);
	view.setUint16(2, 4, true);
	// Reserved (must be 0x00000040 for agile)
	view.setUint32(4, 0x00000040, true);

	result.set(xmlBytes, 8);
	return result;
}

// ---------------------------------------------------------------------------
// Standard (ECMA-376, Office 2007) Package Encryption
// ---------------------------------------------------------------------------

/** AlgID values for the ECMA-376 Standard EncryptionHeader, by key size in bits. */
const STANDARD_ALG_IDS: Readonly<Record<number, number>> = {
	128: 0x0000660e, // CALG_AES_128
	192: 0x0000660f, // CALG_AES_192
	256: 0x00006610, // CALG_AES_256
};

/** AlgIDHash value for SHA-1, the only hash the Standard scheme uses. */
const STANDARD_ALG_ID_HASH_SHA1 = 0x00008004;

/** ProviderType for the RSA/AES cryptographic provider. */
const STANDARD_PROVIDER_TYPE_RSA_AES = 0x00000018;

/** CSP name written into the EncryptionHeader, matching what Office writes for AES. */
const STANDARD_CSP_NAME = 'Microsoft Enhanced RSA and AES Cryptographic Provider';

/** EncryptionHeader flags: fCryptoAPI (0x04) | fAES (0x20). */
const STANDARD_FLAGS = 0x00000024;

/**
 * Encrypt a package using the ECMA-376 Standard encryption scheme.
 *
 * The whole package is encrypted as a single AES-CBC stream with an
 * all-zero IV, using the password-derived key directly (there is no
 * separate random document key, unlike the agile scheme).
 *
 * @param packageData - The plaintext package bytes.
 * @param key - The password-derived encryption key.
 * @returns Encrypted package bytes with an 8-byte size prefix.
 */
export async function encryptStandardPackage(
	packageData: Uint8Array,
	key: Uint8Array,
): Promise<Uint8Array> {
	const blockSize = 16;
	const paddedSize = Math.ceil(packageData.length / blockSize) * blockSize;
	const paddedData = new Uint8Array(paddedSize);
	paddedData.set(packageData);

	const iv = new Uint8Array(blockSize); // all zeros for standard encryption
	const encryptedData = await aesCbcEncryptNoPad(key, iv, paddedData);

	const encrypted = new Uint8Array(8 + encryptedData.length);
	const sizeView = new DataView(encrypted.buffer, 0, 8);
	sizeView.setUint32(0, packageData.length, true);
	sizeView.setUint32(4, 0, true);
	encrypted.set(encryptedData, 8);

	return encrypted;
}

/**
 * Build the binary EncryptionInfo stream for the ECMA-376 Standard scheme.
 *
 * Layout per [MS-OFFCRYPTO] 2.3.4.5-2.3.4.7: version + flags + header size,
 * followed by the EncryptionHeader (algorithm/provider) and the
 * EncryptionVerifier (salt + encrypted verifier + encrypted verifier hash).
 *
 * @param keyBits - Key size in bits (128, 192, or 256).
 * @param salt - 16-byte verifier salt.
 * @param encryptedVerifier - 16-byte AES-CBC encrypted random verifier.
 * @param encryptedVerifierHash - 32-byte AES-CBC encrypted (padded) SHA-1 hash of the verifier.
 * @returns Raw bytes of the EncryptionInfo stream.
 */
export function buildStandardEncryptionInfoStream(
	keyBits: number,
	salt: Uint8Array,
	encryptedVerifier: Uint8Array,
	encryptedVerifierHash: Uint8Array,
): Uint8Array {
	const algId = STANDARD_ALG_IDS[keyBits];
	if (!algId) {
		throw new Error(
			`Unsupported standard encryption key size: ${keyBits} bits. Use 128, 192, or 256.`,
		);
	}

	const cspNameBytes = new Uint8Array((STANDARD_CSP_NAME.length + 1) * 2); // + null terminator
	for (let i = 0; i < STANDARD_CSP_NAME.length; i++) {
		const code = STANDARD_CSP_NAME.charCodeAt(i);
		cspNameBytes[i * 2] = code & 0xff;
		cspNameBytes[i * 2 + 1] = (code >> 8) & 0xff;
	}

	const headerFixedSize = 32;
	const headerSize = headerFixedSize + cspNameBytes.length;
	const verifierSize = 4 + 16 + 16 + 4 + 32; // saltSize + salt + encVerifier + hashSize + encHash
	const totalSize = 12 + headerSize + verifierSize;

	const data = new Uint8Array(totalSize);
	const view = new DataView(data.buffer);

	// Version 4.2: ECMA-376 Standard encryption using AES + SHA-1.
	view.setUint16(0, 4, true);
	view.setUint16(2, 2, true);
	view.setUint32(4, STANDARD_FLAGS, true);
	view.setUint32(8, headerSize, true);

	const h = 12;
	view.setUint32(h, STANDARD_FLAGS, true);
	view.setUint32(h + 4, 0, true); // sizeExtra
	view.setUint32(h + 8, algId, true);
	view.setUint32(h + 12, STANDARD_ALG_ID_HASH_SHA1, true);
	view.setUint32(h + 16, keyBits, true);
	view.setUint32(h + 20, STANDARD_PROVIDER_TYPE_RSA_AES, true);
	view.setUint32(h + 24, 0, true); // reserved1
	view.setUint32(h + 28, 0, true); // reserved2
	data.set(cspNameBytes, h + 32);

	const v = 12 + headerSize;
	view.setUint32(v, 16, true); // saltSize
	data.set(salt.subarray(0, 16), v + 4);
	data.set(encryptedVerifier.subarray(0, 16), v + 20);
	view.setUint32(v + 36, 20, true); // verifierHashSize (SHA-1 output)
	data.set(encryptedVerifierHash.subarray(0, 32), v + 40);

	return data;
}

/**
 * Encrypt a PPTX file with the ECMA-376 Standard encryption scheme
 * (Office 2007-compatible).
 *
 * Unlike the agile scheme, there is no separate random document key: the
 * password-derived key is used directly to encrypt the whole package as one
 * AES-CBC stream with a zero IV, matching {@link decryptStandardPackage}.
 *
 * @param pptxBuffer - Raw bytes of the unencrypted PPTX ZIP file.
 * @param password - The password to protect the file with.
 * @param options - Optional encryption settings (`algorithm` selects the key size).
 * @returns ArrayBuffer of the encrypted OLE2 file.
 */
export async function encryptPptxStandard(
	pptxBuffer: ArrayBuffer,
	password: string,
	options?: EncryptionOptions,
): Promise<ArrayBuffer> {
	const algorithm = options?.algorithm ?? 'AES256';
	const keyBits = algorithm === 'AES128' ? 128 : 256;
	const crypto = getCrypto();

	const salt = new Uint8Array(16);
	crypto.getRandomValues(salt);

	const key = await deriveStandardKey(password, salt, keyBits, STANDARD_ALG_ID_HASH_SHA1);

	// Random 16-byte verifier plus the SHA-1 hash of it, padded to 32 bytes.
	const verifier = new Uint8Array(16);
	crypto.getRandomValues(verifier);
	const verifierHash = await hash('SHA-1', verifier);
	const paddedVerifierHash = new Uint8Array(32);
	paddedVerifierHash.set(verifierHash.subarray(0, 20));

	const zeroIv = new Uint8Array(16);
	const encryptedVerifier = await aesCbcEncryptNoPad(key, zeroIv, verifier);
	const encryptedVerifierHash = await aesCbcEncryptNoPad(key, zeroIv, paddedVerifierHash);

	const encryptionInfoBytes = buildStandardEncryptionInfoStream(
		keyBits,
		salt,
		encryptedVerifier,
		encryptedVerifierHash,
	);

	const packageData = new Uint8Array(pptxBuffer);
	const encryptedPackage = await encryptStandardPackage(packageData, key);

	const ole2Streams = new Map<string, Uint8Array>();
	ole2Streams.set('EncryptionInfo', encryptionInfoBytes);
	ole2Streams.set('EncryptedPackage', encryptedPackage);

	return buildOle2(ole2Streams);
}
