/**
 * Low-level cryptographic primitive operations for OOXML encryption.
 *
 * Provides thin wrappers around the Web Crypto API for hashing, AES-CBC
 * encryption/decryption, HMAC, and utility functions for binary encoding.
 *
 * @module ooxml-crypto-primitives
 */

// ---------------------------------------------------------------------------
// Environment helpers
// ---------------------------------------------------------------------------

/**
 * Get the `crypto.subtle` implementation.
 *
 * Works in browsers, Node.js 15+, Bun, Deno, and Cloudflare Workers.
 *
 * @returns The SubtleCrypto instance from the current environment.
 * @throws Error if Web Crypto API is not available.
 */
export function getSubtle(): SubtleCrypto {
	if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
		return globalThis.crypto.subtle;
	}
	throw new Error(
		'Web Crypto API (crypto.subtle) is not available in this environment. ' +
			'Password-protected PPTX files require a runtime with Web Crypto support.',
	);
}

/**
 * Get the crypto object for generating random bytes.
 *
 * @returns The Crypto instance from the current environment.
 * @throws Error if the crypto API is not available.
 */
export function getCrypto(): Crypto {
	if (typeof globalThis.crypto !== 'undefined') {
		return globalThis.crypto;
	}
	throw new Error('crypto API is not available in this environment.');
}

// ---------------------------------------------------------------------------
// Binary encoding utilities
// ---------------------------------------------------------------------------

/**
 * Convert a string to UTF-16LE bytes (as used by OOXML password hashing).
 *
 * @param password - The password string to encode.
 * @returns UTF-16LE encoded bytes.
 */
export function encodePasswordUtf16LE(password: string): Uint8Array {
	const buf = new Uint8Array(password.length * 2);
	for (let i = 0; i < password.length; i++) {
		const code = password.charCodeAt(i);
		buf[i * 2] = code & 0xff;
		buf[i * 2 + 1] = (code >> 8) & 0xff;
	}
	return buf;
}

/**
 * Concatenate multiple Uint8Arrays into a single array.
 *
 * @param arrays - The arrays to concatenate.
 * @returns A new Uint8Array containing all input bytes in order.
 */
export function concatArrays(...arrays: Uint8Array[]): Uint8Array {
	let totalLength = 0;
	for (const arr of arrays) {
		totalLength += arr.length;
	}
	const result = new Uint8Array(totalLength);
	let offset = 0;
	for (const arr of arrays) {
		result.set(arr, offset);
		offset += arr.length;
	}
	return result;
}

/**
 * Write a 32-bit little-endian unsigned integer to a 4-byte Uint8Array.
 *
 * @param value - The integer value to encode.
 * @returns A 4-byte Uint8Array in little-endian order.
 */
export function uint32LE(value: number): Uint8Array {
	const buf = new Uint8Array(4);
	const view = new DataView(buf.buffer);
	view.setUint32(0, value, true);
	return buf;
}

/**
 * Decode a base64 string to a Uint8Array.
 *
 * Works in both browser (`atob`) and Node.js/Bun (`Buffer`) environments.
 *
 * @param str - The base64-encoded string.
 * @returns Decoded bytes.
 */
export function base64Decode(str: string): Uint8Array {
	if (typeof Buffer !== 'undefined') {
		const buf = Buffer.from(str, 'base64');
		return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
	}
	const binary = atob(str);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

/**
 * Encode a Uint8Array to a base64 string.
 *
 * Works in both browser (`btoa`) and Node.js/Bun (`Buffer`) environments.
 *
 * @param bytes - The bytes to encode.
 * @returns Base64-encoded string.
 */
export function base64Encode(bytes: Uint8Array): string {
	if (typeof Buffer !== 'undefined') {
		return Buffer.from(bytes).toString('base64');
	}
	let binary = '';
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]!);
	}
	return btoa(binary);
}

// ---------------------------------------------------------------------------
// Hash algorithm mapping
// ---------------------------------------------------------------------------

/**
 * Map OOXML hash algorithm names to Web Crypto algorithm identifiers.
 *
 * @param algorithm - OOXML hash algorithm name (e.g. "SHA512", "SHA-1").
 * @returns Web Crypto compatible algorithm name (e.g. "SHA-512").
 */
export function mapHashAlgorithm(algorithm: string): string {
	const upper = algorithm.toUpperCase().replace(/-/g, '');
	switch (upper) {
		case 'SHA1':
			return 'SHA-1';
		case 'SHA256':
			return 'SHA-256';
		case 'SHA384':
			return 'SHA-384';
		case 'SHA512':
			return 'SHA-512';
		default:
			return algorithm;
	}
}

/**
 * Map a hash algorithm name to its output size in bytes.
 *
 * @param algorithm - Hash algorithm name (e.g. "SHA-512").
 * @returns Output size in bytes (e.g. 64 for SHA-512).
 */
export function hashOutputSize(algorithm: string): number {
	const upper = algorithm.toUpperCase().replace(/-/g, '');
	switch (upper) {
		case 'SHA1':
			return 20;
		case 'SHA256':
			return 32;
		case 'SHA384':
			return 48;
		case 'SHA512':
			return 64;
		default:
			return 32;
	}
}

// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------

/**
 * Hash data using the specified algorithm via Web Crypto.
 *
 * @param algorithm - Hash algorithm name (e.g. "SHA-512", "SHA-1").
 * @param data - The data to hash.
 * @returns The hash digest.
 */
export async function hash(algorithm: string, data: Uint8Array): Promise<Uint8Array> {
	const subtle = getSubtle();
	const webCryptoAlg = mapHashAlgorithm(algorithm);
	const result = await subtle.digest(webCryptoAlg, data as unknown as BufferSource);
	return new Uint8Array(result);
}

// ---------------------------------------------------------------------------
// AES-CBC operations
// ---------------------------------------------------------------------------

/**
 * AES-CBC decrypt with the given key, IV, and no padding removal.
 *
 * Web Crypto's AES-CBC always expects valid PKCS7 padding. To perform raw
 * (no-padding) decryption we encrypt a valid PKCS7 padding block using the
 * last ciphertext block as the IV, then append it to the data. When the
 * combined buffer is decrypted the padding block validates correctly and
 * Web Crypto strips it, leaving exactly the original decrypted bytes.
 *
 * @param key - The AES key bytes.
 * @param iv - The initialization vector.
 * @param data - The ciphertext to decrypt.
 * @returns Decrypted plaintext bytes.
 */
export async function aesCbcDecryptRaw(
	key: Uint8Array,
	iv: Uint8Array,
	data: Uint8Array,
): Promise<Uint8Array> {
	const subtle = getSubtle();
	const blockSize = 16;

	// Ensure data is block-aligned
	if (data.length % blockSize !== 0) {
		const padded = new Uint8Array(Math.ceil(data.length / blockSize) * blockSize);
		padded.set(data);
		data = padded;
	}

	if (data.length === 0) {
		return new Uint8Array(0);
	}

	const cryptoKey = await subtle.importKey(
		'raw',
		key as unknown as BufferSource,
		{ name: 'AES-CBC' },
		false,
		['encrypt', 'decrypt'],
	);

	// The last ciphertext block acts as the IV for the next block in CBC mode.
	// We encrypt a full PKCS7 padding block (16 bytes of 0x10) using that IV
	// so that when it's appended and the whole buffer is decrypted, the padding
	// block decrypts to valid PKCS7 padding.
	const lastCiphertextBlock = data.subarray(data.length - blockSize);
	const paddingPlaintext = new Uint8Array(blockSize);
	paddingPlaintext.fill(blockSize);

	const encryptedPadding = await subtle.encrypt(
		{ name: 'AES-CBC', iv: lastCiphertextBlock as unknown as BufferSource },
		cryptoKey,
		paddingPlaintext as unknown as BufferSource,
	);
	// subtle.encrypt adds its own PKCS7 padding (producing 32 bytes), take only
	// the first block which is the encrypted version of our padding plaintext.
	const encPadBlock = new Uint8Array(encryptedPadding).subarray(0, blockSize);

	// Concatenate original ciphertext + encrypted padding block
	const paddedData = new Uint8Array(data.length + blockSize);
	paddedData.set(data);
	paddedData.set(encPadBlock, data.length);

	const result = await subtle.decrypt(
		{ name: 'AES-CBC', iv: iv as unknown as BufferSource },
		cryptoKey,
		paddedData,
	);
	// Web Crypto removes the padding block, leaving data.length bytes of plaintext
	return new Uint8Array(result).subarray(0, data.length);
}

/**
 * AES-CBC encrypt with PKCS7 padding.
 *
 * @param key - The AES key bytes.
 * @param iv - The initialization vector.
 * @param data - The plaintext to encrypt.
 * @returns Encrypted ciphertext with PKCS7 padding.
 */
export async function aesCbcEncrypt(
	key: Uint8Array,
	iv: Uint8Array,
	data: Uint8Array,
): Promise<Uint8Array> {
	const subtle = getSubtle();
	const cryptoKey = await subtle.importKey(
		'raw',
		key as unknown as BufferSource,
		{ name: 'AES-CBC' },
		false,
		['encrypt'],
	);
	const result = await subtle.encrypt(
		{ name: 'AES-CBC', iv: iv as unknown as BufferSource },
		cryptoKey,
		data as unknown as BufferSource,
	);
	return new Uint8Array(result);
}

/**
 * AES-CBC encrypt without padding (data must be block-aligned).
 *
 * @param key - The AES key bytes.
 * @param iv - The initialization vector.
 * @param data - The plaintext to encrypt (must be a multiple of 16 bytes).
 * @returns Encrypted ciphertext without additional padding.
 * @throws Error if data is not block-aligned.
 */
export async function aesCbcEncryptNoPad(
	key: Uint8Array,
	iv: Uint8Array,
	data: Uint8Array,
): Promise<Uint8Array> {
	const blockSize = 16;
	if (data.length % blockSize !== 0) {
		throw new Error('Data must be block-aligned for no-padding encryption');
	}

	const subtle = getSubtle();
	const cryptoKey = await subtle.importKey(
		'raw',
		key as unknown as BufferSource,
		{ name: 'AES-CBC' },
		false,
		['encrypt'],
	);

	// Encrypt using raw — Web Crypto adds PKCS7 padding, so output is data.length + 16
	const result = await subtle.encrypt(
		{ name: 'AES-CBC', iv: iv as unknown as BufferSource },
		cryptoKey,
		data as unknown as BufferSource,
	);
	// Trim off the extra padding block
	return new Uint8Array(result).subarray(0, data.length);
}

// ---------------------------------------------------------------------------
// HMAC
// ---------------------------------------------------------------------------

/**
 * Compute an HMAC using the specified hash algorithm.
 *
 * @param algorithm - Hash algorithm name (e.g. "SHA-512").
 * @param key - The HMAC key bytes.
 * @param data - The data to authenticate.
 * @returns The HMAC digest.
 */
export async function hmac(
	algorithm: string,
	key: Uint8Array,
	data: Uint8Array,
): Promise<Uint8Array> {
	const subtle = getSubtle();
	const webCryptoAlg = mapHashAlgorithm(algorithm);
	const cryptoKey = await subtle.importKey(
		'raw',
		key as unknown as BufferSource,
		{ name: 'HMAC', hash: webCryptoAlg },
		false,
		['sign'],
	);
	const result = await subtle.sign('HMAC', cryptoKey, data as unknown as BufferSource);
	return new Uint8Array(result);
}
