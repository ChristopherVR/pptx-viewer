/**
 * OOXML encryption operations.
 *
 * Implements the agile encryption scheme for creating password-protected
 * OOXML files (Office 2010+ format).
 *
 * @module ooxml-crypto-encrypt
 */

import { generateIV } from './ooxml-crypto-key-derivation';
import { aesCbcEncryptNoPad, base64Encode, uint32LE } from './ooxml-crypto-primitives';
import type { EncryptionInfo } from './ooxml-crypto-types';

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
