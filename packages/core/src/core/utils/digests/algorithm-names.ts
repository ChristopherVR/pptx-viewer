/**
 * Canonicalise a `p:modifyVerifier` hash algorithm name to the exact spelling
 * {@link digest} (`./digest.ts`) and `SubtleCrypto.digest` understand.
 *
 * A verifier can name its algorithm in several equivalent spellings: the
 * `algorithmName`/`algIdExt` attributes are free-form strings (ECMA-376
 * 19.2.1.22 gives examples like `"SHA-512"` and `"SHA512"`), and this
 * module has also seen hyphen-less and lower-case forms in the wild
 * (`"sha1"`, `"ripemd160"`). Normalising here, once, means every caller
 * (`resolveModifyVerifierAlgorithmName`, `digest`) agrees on one spelling
 * instead of each re-implementing its own case/hyphen handling.
 *
 * @module digests/algorithm-names
 */

/** The hash algorithm names this module can compute a digest for. */
export type DigestAlgorithmName =
	| 'SHA-1'
	| 'SHA-256'
	| 'SHA-384'
	| 'SHA-512'
	| 'MD2'
	| 'MD4'
	| 'MD5'
	| 'RIPEMD-128'
	| 'RIPEMD-160'
	| 'WHIRLPOOL';

/** Lookup key: the algorithm name upper-cased with hyphens/spaces/underscores removed. */
const CANONICAL_BY_LOOKUP_KEY: Readonly<Record<string, DigestAlgorithmName>> = {
	SHA1: 'SHA-1',
	SHA256: 'SHA-256',
	SHA384: 'SHA-384',
	SHA512: 'SHA-512',
	MD2: 'MD2',
	MD4: 'MD4',
	MD5: 'MD5',
	RIPEMD128: 'RIPEMD-128',
	RIPEMD160: 'RIPEMD-160',
	WHIRLPOOL: 'WHIRLPOOL',
};

/**
 * Normalise `name` to a {@link DigestAlgorithmName}, or `undefined` when it
 * names an algorithm this viewer does not recognise at all.
 */
export function normalizeDigestAlgorithmName(name: string): DigestAlgorithmName | undefined {
	const key = name.toUpperCase().replace(/[-_\s]/g, '');
	return CANONICAL_BY_LOOKUP_KEY[key];
}

/** Algorithm names `SubtleCrypto.digest` implements; everything else needs a pure fallback. */
export const WEB_CRYPTO_ALGORITHMS: ReadonlySet<DigestAlgorithmName> = new Set([
	'SHA-1',
	'SHA-256',
	'SHA-384',
	'SHA-512',
]);
