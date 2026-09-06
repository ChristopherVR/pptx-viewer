/**
 * Barrel for the pure-TypeScript digest algorithms this viewer supports for
 * `p:modifyVerifier` password checking beyond what Web Crypto implements.
 *
 * @module digests
 */
export type { DigestAlgorithmName } from './algorithm-names';
export { normalizeDigestAlgorithmName, WEB_CRYPTO_ALGORITHMS } from './algorithm-names';
export { digest } from './digest';
export { md2 } from './md2';
export { md4 } from './md4';
export { md5 } from './md5';
export { ripemd128 } from './ripemd128';
export { ripemd160 } from './ripemd160';
export { whirlpool } from './whirlpool';
