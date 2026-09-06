/**
 * `digest(name, bytes)`: compute a hash by whichever means is available.
 * `SubtleCrypto.digest` (Web Crypto) is used for the algorithms it
 * implements (SHA-1/256/384/512); every other algorithm ECMA-376 19.2.1.22
 * allows a `p:modifyVerifier` to name (MD2, MD4, MD5, RIPEMD-128,
 * RIPEMD-160, WHIRLPOOL) is Web Crypto's never implemented them, so this
 * routes to the pure-TypeScript implementations in this directory instead.
 *
 * @module digests/digest
 */
import type { DigestAlgorithmName } from './algorithm-names';
import { WEB_CRYPTO_ALGORITHMS } from './algorithm-names';
import { md2 } from './md2';
import { md4 } from './md4';
import { md5 } from './md5';
import { ripemd128 } from './ripemd128';
import { ripemd160 } from './ripemd160';
import { whirlpool } from './whirlpool';

const PURE_DIGESTS: Readonly<Record<string, (message: Uint8Array) => Uint8Array>> = {
	MD2: md2,
	MD4: md4,
	MD5: md5,
	'RIPEMD-128': ripemd128,
	'RIPEMD-160': ripemd160,
	WHIRLPOOL: whirlpool,
};

function getSubtle(): SubtleCrypto {
	if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
		return globalThis.crypto.subtle;
	}
	throw new Error('Web Crypto API is required for SHA-1/256/384/512 digest computation.');
}

/**
 * Compute the digest of `data` under `algorithm` (already normalised via
 * {@link import('./algorithm-names').normalizeDigestAlgorithmName}).
 */
export async function digest(
	algorithm: DigestAlgorithmName,
	data: Uint8Array,
): Promise<Uint8Array> {
	const pure = PURE_DIGESTS[algorithm];
	if (pure) {
		return pure(data);
	}
	if (WEB_CRYPTO_ALGORITHMS.has(algorithm)) {
		const subtle = getSubtle();
		const result = await subtle.digest(algorithm, data as unknown as BufferSource);
		return new Uint8Array(result);
	}
	throw new Error(`Unsupported digest algorithm: ${algorithm as string}`);
}
