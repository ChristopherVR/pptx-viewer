/**
 * OOXML encryption key derivation and EncryptionInfo stream parsing.
 *
 * Implements the agile and standard key derivation algorithms as specified
 * in [MS-OFFCRYPTO], along with the XML and binary parsers for the
 * EncryptionInfo stream format.
 *
 * @module ooxml-crypto-key-derivation
 */

import {
	encodePasswordUtf16LE,
	concatArrays,
	uint32LE,
	base64Decode,
	hash,
} from './ooxml-crypto-primitives';
import type { EncryptionInfo, StandardEncryptionInfo } from './ooxml-crypto-types';

// ---------------------------------------------------------------------------
// Well-known block keys
// ---------------------------------------------------------------------------

/** Well-known block keys for agile encryption as defined in [MS-OFFCRYPTO]. */
export const BLOCK_KEYS = {
	verifierHashInput: new Uint8Array([0xfe, 0xa7, 0xd2, 0x76, 0x3b, 0x4b, 0x9e, 0x79]),
	verifierHashValue: new Uint8Array([0xd7, 0xaa, 0x0f, 0x6d, 0x30, 0x61, 0x34, 0x4e]),
	encryptedKeyValue: new Uint8Array([0x14, 0x6e, 0x0b, 0xe7, 0xab, 0xac, 0xd0, 0xd6]),
	dataIntegrityHmacKey: new Uint8Array([0x5f, 0xb2, 0xad, 0x01, 0x0c, 0xb9, 0xe1, 0xf6]),
	dataIntegrityHmacValue: new Uint8Array([0xa0, 0x67, 0x7f, 0x02, 0xb2, 0x2c, 0x84, 0x33]),
} as const;

// ---------------------------------------------------------------------------
// Agile Encryption Key Derivation
// ---------------------------------------------------------------------------

/**
 * Derive an encryption key from a password using the OOXML agile encryption
 * key derivation algorithm.
 *
 * @param password - User's password.
 * @param salt - Salt from EncryptionInfo.
 * @param spinCount - Number of hash iterations.
 * @param hashAlgorithm - Hash algorithm name (e.g. "SHA-512").
 * @param blockKey - Block key for deriving specific sub-keys.
 * @param keyBits - Desired key length in bits.
 * @param hashSize - Hash output size in bytes.
 * @returns Derived key of keyBits/8 bytes.
 */
export async function deriveAgileKey(
	password: string,
	salt: Uint8Array,
	spinCount: number,
	hashAlgorithm: string,
	blockKey: Uint8Array,
	keyBits: number,
	hashSize: number,
): Promise<Uint8Array> {
	const passwordBytes = encodePasswordUtf16LE(password);

	// Step 1: H0 = H(salt + password)
	let h = await hash(hashAlgorithm, concatArrays(salt, passwordBytes));

	// Step 2: Iterate: Hn = H(iterator + Hn-1)
	for (let i = 0; i < spinCount; i++) {
		h = await hash(hashAlgorithm, concatArrays(uint32LE(i), h));
	}

	// Step 3: Hfinal = H(Hlast + blockKey)
	h = await hash(hashAlgorithm, concatArrays(h, blockKey));

	// Step 4: Derive key by extending with cbRequiredKeyLength/cbHashSize
	const cbRequiredKeyLength = keyBits / 8;
	const cbHash = hashSize;

	const ipad = 0x36;
	const opad = 0x5c;

	if (cbHash >= cbRequiredKeyLength) {
		return h.subarray(0, cbRequiredKeyLength);
	}

	// X1 = H(cbBuffer padded with 0x36)
	const x1Input = new Uint8Array(64);
	x1Input.fill(ipad);
	for (let i = 0; i < h.length && i < 64; i++) {
		x1Input[i] = h[i]! ^ ipad;
	}
	const x1 = await hash(hashAlgorithm, x1Input);

	// X2 = H(cbBuffer padded with 0x5C)
	const x2Input = new Uint8Array(64);
	x2Input.fill(opad);
	for (let i = 0; i < h.length && i < 64; i++) {
		x2Input[i] = h[i]! ^ opad;
	}
	const x2 = await hash(hashAlgorithm, x2Input);

	// X3 = X1 + X2
	const x3 = concatArrays(x1, x2);
	return x3.subarray(0, cbRequiredKeyLength);
}

// ---------------------------------------------------------------------------
// Standard Encryption Key Derivation (Office 2007 / versions 2.x-4.x)
// ---------------------------------------------------------------------------

/**
 * Derive the encryption key for standard encryption (Office 2007).
 *
 * Implements [MS-OFFCRYPTO] 2.3.6.2 -- Password Key Generation.
 *
 * @param password - User's password.
 * @param salt - Salt from the verifier.
 * @param keySize - Key size in bits (e.g. 128).
 * @param algIdHash - Algorithm ID for hashing (from the encryption header).
 * @returns Derived encryption key.
 */
export async function deriveStandardKey(
	password: string,
	salt: Uint8Array,
	keySize: number,
	_algIdHash: number,
): Promise<Uint8Array> {
	const passwordBytes = encodePasswordUtf16LE(password);

	// H0 = H(salt + password)
	let h = await hash('SHA-1', concatArrays(salt, passwordBytes));

	// Iterate 50000 times: Hn = H(iterator + Hn-1)
	for (let i = 0; i < 50000; i++) {
		h = await hash('SHA-1', concatArrays(uint32LE(i), h));
	}

	// Hfinal = H(Hlast + blockKey)  blockKey = 0x00000000 for key derivation
	const blockKey = new Uint8Array(4); // all zeros
	h = await hash('SHA-1', concatArrays(h, blockKey));

	// Derive key: create cbRequiredKeyLength bytes
	const cbRequiredKeyLength = keySize / 8;

	// X1 = H(derivedKey padded with 0x36)
	const x1Input = new Uint8Array(64);
	x1Input.fill(0x36);
	for (let i = 0; i < h.length && i < 64; i++) {
		x1Input[i] = h[i]! ^ 0x36;
	}
	const x1 = await hash('SHA-1', x1Input);

	// X2 = H(derivedKey padded with 0x5C)
	const x2Input = new Uint8Array(64);
	x2Input.fill(0x5c);
	for (let i = 0; i < h.length && i < 64; i++) {
		x2Input[i] = h[i]! ^ 0x5c;
	}
	const x2 = await hash('SHA-1', x2Input);

	const x3 = concatArrays(x1, x2);
	return x3.subarray(0, cbRequiredKeyLength);
}

// ---------------------------------------------------------------------------
// IV Generation
// ---------------------------------------------------------------------------

/**
 * Generate an IV for agile encryption from salt and block key.
 *
 * The IV is derived by hashing the concatenation of salt and block key,
 * then truncating or padding to the required block size.
 *
 * @param hashAlgorithm - Hash algorithm name (e.g. "SHA-512").
 * @param salt - Salt value from EncryptionInfo.
 * @param blockKey - Block key for this specific operation.
 * @param blockSize - Required IV size in bytes.
 * @returns Generated IV of blockSize bytes.
 */
export async function generateIV(
	hashAlgorithm: string,
	salt: Uint8Array,
	blockKey: Uint8Array,
	blockSize: number,
): Promise<Uint8Array> {
	const h = await hash(hashAlgorithm, concatArrays(salt, blockKey));

	if (h.length >= blockSize) {
		return h.subarray(0, blockSize);
	}

	// Pad with 0x36
	const padded = new Uint8Array(blockSize);
	padded.fill(0x36);
	padded.set(h);
	return padded;
}

// ---------------------------------------------------------------------------
// EncryptionInfo Stream Parsing
// ---------------------------------------------------------------------------

/**
 * Parse the EncryptionInfo stream from an encrypted OOXML file.
 *
 * Detects whether the stream uses agile encryption (version 4.4) or
 * standard encryption (versions 2.x, 3.x, 4.x with minor 2) and
 * delegates to the appropriate parser.
 *
 * @param data - Raw bytes of the EncryptionInfo stream.
 * @returns Parsed encryption info (either agile or standard).
 * @throws Error if the encryption version is unsupported.
 */
export function parseEncryptionInfo(data: Uint8Array): EncryptionInfo | StandardEncryptionInfo {
	const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

	const versionMajor = view.getUint16(0, true);
	const versionMinor = view.getUint16(2, true);

	// Agile encryption: version 4.4
	if (versionMajor === 4 && versionMinor === 4) {
		return parseAgileEncryptionInfo(data);
	}

	// Standard encryption: version 2.x, 3.x, or 4.x (but not 4.4)
	if ((versionMajor === 2 || versionMajor === 3 || versionMajor === 4) && versionMinor === 2) {
		return parseStandardEncryptionInfo(data);
	}

	throw new Error(
		`Unsupported encryption version: ${versionMajor}.${versionMinor}. ` +
			'Only Standard (2.2-4.2) and Agile (4.4) encryption are supported.',
	);
}

/**
 * Parse standard encryption info (Office 2007 format).
 *
 * @param data - Raw bytes of the EncryptionInfo stream.
 * @returns Parsed standard encryption info.
 */
function parseStandardEncryptionInfo(data: Uint8Array): StandardEncryptionInfo {
	const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

	const versionMajor = view.getUint16(0, true);
	const versionMinor = view.getUint16(2, true);
	const flags = view.getUint32(4, true);

	// Header size at offset 8
	const headerSize = view.getUint32(8, true);

	// Encryption header starts at offset 12
	const headerOffset = 12;
	const hFlags = view.getUint32(headerOffset, true);
	const _sizeExtra = view.getUint32(headerOffset + 4, true);
	const algId = view.getUint32(headerOffset + 8, true);
	const algIdHash = view.getUint32(headerOffset + 12, true);
	const keySize = view.getUint32(headerOffset + 16, true);
	const providerType = view.getUint32(headerOffset + 20, true);
	// Reserved1 = headerOffset + 24
	// Reserved2 = headerOffset + 28

	// CSP name is UTF-16LE string after the fixed header fields (32 bytes)
	let cspName = '';
	const cspOffset = headerOffset + 32;
	const cspEnd = headerOffset + headerSize;
	for (let i = cspOffset; i < cspEnd - 1; i += 2) {
		const ch = view.getUint16(i, true);
		if (ch === 0) {
			break;
		}
		cspName += String.fromCharCode(ch);
	}

	// Verifier starts after the header
	const verifierOffset = 12 + headerSize;
	const saltSize = view.getUint32(verifierOffset, true);
	const salt = new Uint8Array(data.buffer, data.byteOffset + verifierOffset + 4, 16);
	const encryptedVerifier = new Uint8Array(data.buffer, data.byteOffset + verifierOffset + 20, 16);
	const verifierHashSize = view.getUint32(verifierOffset + 36, true);
	const encryptedVerifierHash = new Uint8Array(
		data.buffer,
		data.byteOffset + verifierOffset + 40,
		32,
	);

	return {
		version: { major: versionMajor, minor: versionMinor },
		isAgile: false,
		isStandard: true,
		flags,
		headerSize,
		header: {
			flags: hFlags,
			algId,
			algIdHash,
			keySize,
			providerType,
			cspName,
		},
		verifier: {
			saltSize,
			salt: new Uint8Array(salt),
			encryptedVerifier: new Uint8Array(encryptedVerifier),
			verifierHashSize,
			encryptedVerifierHash: new Uint8Array(encryptedVerifierHash),
		},
	};
}

/**
 * Parse agile encryption info (Office 2010+ XML-based format).
 *
 * @param data - Raw bytes of the EncryptionInfo stream.
 * @returns Parsed agile encryption info.
 */
function parseAgileEncryptionInfo(data: Uint8Array): EncryptionInfo {
	// Skip version (4 bytes) and reserved (4 bytes)
	const xmlBytes = data.subarray(8);
	const xmlStr = new TextDecoder('utf-8').decode(xmlBytes);

	// Parse the XML manually (it's a simple structure)
	const getAttr = (xml: string, tag: string, attr: string): string => {
		// Find the tag
		const tagRegex = new RegExp(`<[^>]*${tag}[^>]*>`, 'i');
		const tagMatch = xml.match(tagRegex);
		if (!tagMatch) {
			return '';
		}

		const attrRegex = new RegExp(`${attr}="([^"]*)"`, 'i');
		const attrMatch = tagMatch[0].match(attrRegex);
		return attrMatch ? attrMatch[1]! : '';
	};

	// Find keyData element
	const keyDataSaltSize = parseInt(getAttr(xmlStr, 'keyData', 'saltSize'), 10);
	const keyDataBlockSize = parseInt(getAttr(xmlStr, 'keyData', 'blockSize'), 10);
	const keyDataKeyBits = parseInt(getAttr(xmlStr, 'keyData', 'keyBits'), 10);
	const keyDataHashSize = parseInt(getAttr(xmlStr, 'keyData', 'hashSize'), 10);
	const keyDataCipherAlgorithm = getAttr(xmlStr, 'keyData', 'cipherAlgorithm');
	const keyDataCipherChaining = getAttr(xmlStr, 'keyData', 'cipherChaining');
	const keyDataHashAlgorithm = getAttr(xmlStr, 'keyData', 'hashAlgorithm');
	const keyDataSaltValue = getAttr(xmlStr, 'keyData', 'saltValue');

	// Find dataIntegrity element
	const encryptedHmacKey = getAttr(xmlStr, 'dataIntegrity', 'encryptedHmacKey');
	const encryptedHmacValue = getAttr(xmlStr, 'dataIntegrity', 'encryptedHmacValue');

	// Find p:encryptedKey element (password key encryptor)
	// The encryptedKey tag might be namespace-prefixed
	const encKeyTag = xmlStr.match(/<[^>]*encryptedKey[^>]*>/i);
	const encKeyStr = encKeyTag ? encKeyTag[0] : '';

	const getEncKeyAttr = (attr: string): string => {
		const regex = new RegExp(`${attr}="([^"]*)"`, 'i');
		const match = encKeyStr.match(regex);
		return match ? match[1]! : '';
	};

	const pkeSaltSize = parseInt(getEncKeyAttr('saltSize'), 10);
	const pkeBlockSize = parseInt(getEncKeyAttr('blockSize'), 10);
	const pkeKeyBits = parseInt(getEncKeyAttr('keyBits'), 10);
	const pkeHashSize = parseInt(getEncKeyAttr('hashSize'), 10);
	const pkeCipherAlgorithm = getEncKeyAttr('cipherAlgorithm');
	const pkeCipherChaining = getEncKeyAttr('cipherChaining');
	const pkeHashAlgorithm = getEncKeyAttr('hashAlgorithm');
	const pkeSaltValue = getEncKeyAttr('saltValue');
	const pkeSpinCount = parseInt(getEncKeyAttr('spinCount'), 10);
	const pkeEncryptedVerifierHashInput = getEncKeyAttr('encryptedVerifierHashInput');
	const pkeEncryptedVerifierHashValue = getEncKeyAttr('encryptedVerifierHashValue');
	const pkeEncryptedKeyValue = getEncKeyAttr('encryptedKeyValue');

	return {
		version: { major: 4, minor: 4 },
		isAgile: true,
		keyData: {
			saltSize: keyDataSaltSize,
			blockSize: keyDataBlockSize,
			keyBits: keyDataKeyBits,
			hashSize: keyDataHashSize,
			cipherAlgorithm: keyDataCipherAlgorithm,
			cipherChaining: keyDataCipherChaining,
			hashAlgorithm: keyDataHashAlgorithm,
			saltValue: base64Decode(keyDataSaltValue),
		},
		dataIntegrity: encryptedHmacKey
			? {
					encryptedHmacKey: base64Decode(encryptedHmacKey),
					encryptedHmacValue: base64Decode(encryptedHmacValue),
				}
			: undefined,
		passwordKeyEncryptor: {
			saltSize: pkeSaltSize,
			blockSize: pkeBlockSize,
			keyBits: pkeKeyBits,
			hashSize: pkeHashSize,
			cipherAlgorithm: pkeCipherAlgorithm,
			cipherChaining: pkeCipherChaining,
			hashAlgorithm: pkeHashAlgorithm,
			saltValue: base64Decode(pkeSaltValue),
			spinCount: pkeSpinCount,
			encryptedVerifierHashInput: base64Decode(pkeEncryptedVerifierHashInput),
			encryptedVerifierHashValue: base64Decode(pkeEncryptedVerifierHashValue),
			encryptedKeyValue: base64Decode(pkeEncryptedKeyValue),
		},
	};
}
