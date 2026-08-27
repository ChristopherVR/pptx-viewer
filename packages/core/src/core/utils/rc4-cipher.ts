/**
 * RC4 stream cipher.
 *
 * Used by the legacy "RC4 CryptoAPI Encryption" scheme ([MS-OFFCRYPTO]
 * 2.3.5.1) that protects password-encrypted PowerPoint 97-2003 (binary
 * `.ppt`) compound files. Web Crypto has no RC4 support, so this is a small
 * self-contained implementation (key scheduling + pseudo-random generation).
 *
 * RC4 is a symmetric stream cipher: encryption and decryption are the same
 * XOR-with-keystream operation, so a single function serves both directions.
 *
 * @module rc4-cipher
 */

/**
 * Apply the RC4 stream cipher to `data` using `key`.
 *
 * @param key - Key bytes (1 to 256 bytes).
 * @param data - Plaintext (to encrypt) or ciphertext (to decrypt).
 * @returns A new buffer of the same length as `data`, XORed with the RC4
 *   keystream derived from `key`.
 * @throws Error if `key` is empty.
 */
export function rc4Cipher(key: Uint8Array, data: Uint8Array): Uint8Array {
	if (key.length === 0) {
		throw new Error('RC4 key must not be empty.');
	}

	// Key-scheduling algorithm (KSA).
	const s = new Uint8Array(256);
	for (let i = 0; i < 256; i++) {
		s[i] = i;
	}
	let j = 0;
	for (let i = 0; i < 256; i++) {
		j = (j + s[i]! + key[i % key.length]!) & 0xff;
		const tmp = s[i]!;
		s[i] = s[j]!;
		s[j] = tmp;
	}

	// Pseudo-random generation algorithm (PRGA), XORed directly into the output.
	const out = new Uint8Array(data.length);
	let i = 0;
	j = 0;
	for (let n = 0; n < data.length; n++) {
		i = (i + 1) & 0xff;
		j = (j + s[i]!) & 0xff;
		const tmp = s[i]!;
		s[i] = s[j]!;
		s[j] = tmp;
		const keystreamByte = s[(s[i]! + s[j]!) & 0xff]!;
		out[n] = data[n]! ^ keystreamByte;
	}
	return out;
}
