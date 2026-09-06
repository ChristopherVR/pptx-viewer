/**
 * MD4 message digest (RFC 1320). Web Crypto never implemented MD4; it is
 * kept here purely so a `p:modifyVerifier` naming `algorithmName="MD4"` (or
 * the legacy `cryptAlgorithmSid="2"`) can still be checked, matching every
 * other algorithm ECMA-376 19.2.1.22 allows a verifier to name.
 *
 * Cross-checked against the RFC 1320 test suite (section 3.5), e.g.
 * `MD4("abc") = a448017aaf21d8525fc10ae87aa6729d`.
 *
 * @module digests/md4
 */
import { add32, applyRotatingRound, mdStyleDigest } from './bit-ops';

const INITIAL_STATE = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];

/** Round 1: `(x & y) | (~x & z)`, the bitwise "if x then y else z". */
function f1(x: number, y: number, z: number): number {
	return (x & y) | (~x & z);
}

/** Round 2: majority-of-three. */
function f2(x: number, y: number, z: number): number {
	return (x & y) | (x & z) | (y & z);
}

/** Round 3: parity. */
function f3(x: number, y: number, z: number): number {
	return x ^ y ^ z;
}

/** floor(2^30 * sqrt(2)), added throughout round 2. */
const K2 = 0x5a827999;
/** floor(2^30 * sqrt(3)), added throughout round 3. */
const K3 = 0x6ed9eba1;

// [wordIndex, shiftAmount, additiveConstant] per operation, RFC 1320 section 3.4.
const ROUND1 = [
	[0, 3, 0],
	[1, 7, 0],
	[2, 11, 0],
	[3, 19, 0],
	[4, 3, 0],
	[5, 7, 0],
	[6, 11, 0],
	[7, 19, 0],
	[8, 3, 0],
	[9, 7, 0],
	[10, 11, 0],
	[11, 19, 0],
	[12, 3, 0],
	[13, 7, 0],
	[14, 11, 0],
	[15, 19, 0],
] as const;

const ROUND2 = [
	[0, 3, K2],
	[4, 5, K2],
	[8, 9, K2],
	[12, 13, K2],
	[1, 3, K2],
	[5, 5, K2],
	[9, 9, K2],
	[13, 13, K2],
	[2, 3, K2],
	[6, 5, K2],
	[10, 9, K2],
	[14, 13, K2],
	[3, 3, K2],
	[7, 5, K2],
	[11, 9, K2],
	[15, 13, K2],
] as const;

const ROUND3 = [
	[0, 3, K3],
	[8, 9, K3],
	[4, 11, K3],
	[12, 15, K3],
	[2, 3, K3],
	[10, 9, K3],
	[6, 11, K3],
	[14, 15, K3],
	[1, 3, K3],
	[9, 9, K3],
	[5, 11, K3],
	[13, 15, K3],
	[3, 3, K3],
	[11, 9, K3],
	[7, 11, K3],
	[15, 15, K3],
] as const;

function transform(state: number[], x: readonly number[]): void {
	const r = [...state];
	applyRotatingRound(r, ROUND1, f1, x);
	applyRotatingRound(r, ROUND2, f2, x);
	applyRotatingRound(r, ROUND3, f3, x);
	for (let i = 0; i < 4; i++) {
		state[i] = add32(state[i]!, r[i]!);
	}
}

/** Compute the MD4 digest of `message` (16 bytes). */
export function md4(message: Uint8Array): Uint8Array {
	return mdStyleDigest(message, INITIAL_STATE, transform);
}
