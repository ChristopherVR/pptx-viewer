/**
 * Platform-agnostic digest computation using the Web Crypto API.
 *
 * Works in both browser and Node.js (18+) environments via `crypto.subtle`.
 */

import { DIGEST_ALGORITHM_TO_WEB_CRYPTO } from './signature-constants';

/**
 * Compute a Base64-encoded digest of the given content using Web Crypto.
 *
 * @param content - The binary data to hash.
 * @param digestAlgorithmUri - An XML Digital Signature digest algorithm URI
 *   (e.g. `http://www.w3.org/2001/04/xmlenc#sha256`).
 * @returns The Base64-encoded digest, or `undefined` if the algorithm is unsupported
 *   or `crypto.subtle` is unavailable.
 */
export async function computeDigestBase64(
	content: Uint8Array,
	digestAlgorithmUri: string,
): Promise<string | undefined> {
	const webCryptoAlgo = DIGEST_ALGORITHM_TO_WEB_CRYPTO[digestAlgorithmUri];
	if (!webCryptoAlgo) {
		return undefined;
	}

	if (typeof globalThis.crypto?.subtle === 'undefined') {
		return undefined;
	}

	const buf = new ArrayBuffer(content.byteLength);
	new Uint8Array(buf).set(content);
	const digest = await globalThis.crypto.subtle.digest(webCryptoAlgo, buf);
	return uint8ArrayToBase64(new Uint8Array(digest));
}

/** Convert a Uint8Array to a Base64 string (platform-agnostic). */
function uint8ArrayToBase64(bytes: Uint8Array): string {
	let binary = '';
	for (let i = 0; i < bytes.byteLength; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}
