/**
 * MD5 message digest (RFC 1321). Web Crypto's `SubtleCrypto.digest` never
 * implemented MD5 (only SHA-1/256/384/512), yet MD5 is a legal
 * `p:modifyVerifier` `algorithmName` and the CAPI `cryptAlgorithmSid="3"`
 * PowerPoint itself can write, so it needs a pure-JS fallback like the other
 * algorithms Web Crypto lacks.
 *
 * Cross-checked against `node:crypto`'s `createHash('md5')` in
 * `md5.test.ts` (Node still implements MD5, just not via Web Crypto).
 *
 * @module digests/md5
 */
import { add32, applyRotatingRoundWithFeedback, mdStyleDigest } from './bit-ops';

const INITIAL_STATE = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];

function f(x: number, y: number, z: number): number {
	return (x & y) | (~x & z);
}

function g(x: number, y: number, z: number): number {
	return (x & z) | (y & ~z);
}

function h(x: number, y: number, z: number): number {
	return x ^ y ^ z;
}

function i(x: number, y: number, z: number): number {
	return y ^ (x | ~z);
}

/**
 * The 64 per-operation additive constants `T[i] = floor(abs(sin(i+1)) * 2^32)`
 * (RFC 1321 section 3.4), computed rather than hand-transcribed: this is the
 * standard construction (the table's own defining formula), and any
 * floating-point drift would immediately fail the RFC/node:crypto test
 * vectors this module is checked against.
 */
const T: readonly number[] = Array.from({ length: 64 }, (_, index) =>
	Math.floor(Math.abs(Math.sin(index + 1)) * 2 ** 32),
);

const SHIFTS = [
	[7, 12, 17, 22],
	[5, 9, 14, 20],
	[4, 11, 16, 23],
	[6, 10, 15, 21],
] as const;

/** Word-index selectors per round: round r, operation i selects `X[k(r,i)]`. */
const WORD_INDEX: readonly ((i: number) => number)[] = [
	(idx) => idx,
	(idx) => (5 * idx + 1) % 16,
	(idx) => (3 * idx + 5) % 16,
	(idx) => (7 * idx) % 16,
];

const ROUND_FNS = [f, g, h, i] as const;

function buildOps(round: number): readonly (readonly [number, number, number])[] {
	const shifts = SHIFTS[round]!;
	const wordIndex = WORD_INDEX[round]!;
	return Array.from({ length: 16 }, (_, idx) => {
		const opNumber = round * 16 + idx;
		return [wordIndex(idx), shifts[idx % 4]!, T[opNumber]!] as const;
	});
}

const ROUNDS = [0, 1, 2, 3].map(buildOps);

function transform(state: number[], x: readonly number[]): void {
	const r = [...state];
	for (let round = 0; round < 4; round++) {
		applyRotatingRoundWithFeedback(r, ROUNDS[round]!, ROUND_FNS[round]!, x);
	}
	for (let idx = 0; idx < 4; idx++) {
		state[idx] = add32(state[idx]!, r[idx]!);
	}
}

/** Compute the MD5 digest of `message` (16 bytes). */
export function md5(message: Uint8Array): Uint8Array {
	return mdStyleDigest(message, INITIAL_STATE, transform);
}
