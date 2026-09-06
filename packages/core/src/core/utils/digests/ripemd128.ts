/**
 * RIPEMD-128 message digest (Dobbertin, Bosselaers, Preneel). Neither
 * RIPEMD variant was ever implemented by Web Crypto; both are legal
 * `p:modifyVerifier` `algorithmName` values (they have no `cryptAlgorithmSid`
 * of their own, since CAPI never defined one, so a verifier can only name
 * them explicitly).
 *
 * Structurally this is two independent MD4-style lanes (see
 * {@link applyRotatingRound}) run over the same input with different round
 * functions and word/shift schedules, combined at the end; RIPEMD-160 below
 * adds a fifth chaining register per lane and a fixed extra rotation, which
 * is why it needs its own lane runner instead of reusing this one.
 *
 * Word-index, shift and constant tables were machine-extracted from the
 * Linux kernel's `crypto/rmd128.c` reference implementation (itself based on
 * Antoon Bosselaers' ESAT-COSIC reference code), not hand-transcribed, to
 * eliminate copy errors; cross-checked against the algorithm's own published
 * test vectors in `ripemd128.test.ts`, e.g.
 * `RIPEMD128("abc") = c14a12199c66e4ba84636b0f69144c77`.
 *
 * @module digests/ripemd128
 */
import { add32, applyRotatingRound, mdStyleDigest } from './bit-ops';
import { f1, f2, f3, f4 } from './ripemd-functions';

const INITIAL_STATE = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];

type Op = readonly [wordIndex: number, shift: number, addConst: number];

const LEFT_ROUNDS: readonly (readonly Op[])[] = [
	[
		[0, 11, 0],
		[1, 14, 0],
		[2, 15, 0],
		[3, 12, 0],
		[4, 5, 0],
		[5, 8, 0],
		[6, 7, 0],
		[7, 9, 0],
		[8, 11, 0],
		[9, 13, 0],
		[10, 14, 0],
		[11, 15, 0],
		[12, 6, 0],
		[13, 7, 0],
		[14, 9, 0],
		[15, 8, 0],
	],
	[
		[7, 7, 0x5a827999],
		[4, 6, 0x5a827999],
		[13, 8, 0x5a827999],
		[1, 13, 0x5a827999],
		[10, 11, 0x5a827999],
		[6, 9, 0x5a827999],
		[15, 7, 0x5a827999],
		[3, 15, 0x5a827999],
		[12, 7, 0x5a827999],
		[0, 12, 0x5a827999],
		[9, 15, 0x5a827999],
		[5, 9, 0x5a827999],
		[2, 11, 0x5a827999],
		[14, 7, 0x5a827999],
		[11, 13, 0x5a827999],
		[8, 12, 0x5a827999],
	],
	[
		[3, 11, 0x6ed9eba1],
		[10, 13, 0x6ed9eba1],
		[14, 6, 0x6ed9eba1],
		[4, 7, 0x6ed9eba1],
		[9, 14, 0x6ed9eba1],
		[15, 9, 0x6ed9eba1],
		[8, 13, 0x6ed9eba1],
		[1, 15, 0x6ed9eba1],
		[2, 14, 0x6ed9eba1],
		[7, 8, 0x6ed9eba1],
		[0, 13, 0x6ed9eba1],
		[6, 6, 0x6ed9eba1],
		[13, 5, 0x6ed9eba1],
		[11, 12, 0x6ed9eba1],
		[5, 7, 0x6ed9eba1],
		[12, 5, 0x6ed9eba1],
	],
	[
		[1, 11, 0x8f1bbcdc],
		[9, 12, 0x8f1bbcdc],
		[11, 14, 0x8f1bbcdc],
		[10, 15, 0x8f1bbcdc],
		[0, 14, 0x8f1bbcdc],
		[8, 15, 0x8f1bbcdc],
		[12, 9, 0x8f1bbcdc],
		[4, 8, 0x8f1bbcdc],
		[13, 9, 0x8f1bbcdc],
		[3, 14, 0x8f1bbcdc],
		[7, 5, 0x8f1bbcdc],
		[15, 6, 0x8f1bbcdc],
		[14, 8, 0x8f1bbcdc],
		[5, 6, 0x8f1bbcdc],
		[6, 5, 0x8f1bbcdc],
		[2, 12, 0x8f1bbcdc],
	],
];

const RIGHT_ROUNDS: readonly (readonly Op[])[] = [
	[
		[5, 8, 0x50a28be6],
		[14, 9, 0x50a28be6],
		[7, 9, 0x50a28be6],
		[0, 11, 0x50a28be6],
		[9, 13, 0x50a28be6],
		[2, 15, 0x50a28be6],
		[11, 15, 0x50a28be6],
		[4, 5, 0x50a28be6],
		[13, 7, 0x50a28be6],
		[6, 7, 0x50a28be6],
		[15, 8, 0x50a28be6],
		[8, 11, 0x50a28be6],
		[1, 14, 0x50a28be6],
		[10, 14, 0x50a28be6],
		[3, 12, 0x50a28be6],
		[12, 6, 0x50a28be6],
	],
	[
		[6, 9, 0x5c4dd124],
		[11, 13, 0x5c4dd124],
		[3, 15, 0x5c4dd124],
		[7, 7, 0x5c4dd124],
		[0, 12, 0x5c4dd124],
		[13, 8, 0x5c4dd124],
		[5, 9, 0x5c4dd124],
		[10, 11, 0x5c4dd124],
		[14, 7, 0x5c4dd124],
		[15, 7, 0x5c4dd124],
		[8, 12, 0x5c4dd124],
		[12, 7, 0x5c4dd124],
		[4, 6, 0x5c4dd124],
		[9, 15, 0x5c4dd124],
		[1, 13, 0x5c4dd124],
		[2, 11, 0x5c4dd124],
	],
	[
		[15, 9, 0x6d703ef3],
		[5, 7, 0x6d703ef3],
		[1, 15, 0x6d703ef3],
		[3, 11, 0x6d703ef3],
		[7, 8, 0x6d703ef3],
		[14, 6, 0x6d703ef3],
		[6, 6, 0x6d703ef3],
		[9, 14, 0x6d703ef3],
		[11, 12, 0x6d703ef3],
		[8, 13, 0x6d703ef3],
		[12, 5, 0x6d703ef3],
		[2, 14, 0x6d703ef3],
		[10, 13, 0x6d703ef3],
		[0, 13, 0x6d703ef3],
		[4, 7, 0x6d703ef3],
		[13, 5, 0x6d703ef3],
	],
	[
		[8, 15, 0],
		[6, 5, 0],
		[4, 8, 0],
		[1, 11, 0],
		[3, 14, 0],
		[11, 14, 0],
		[15, 6, 0],
		[0, 14, 0],
		[5, 6, 0],
		[12, 9, 0],
		[2, 12, 0],
		[13, 9, 0],
		[9, 12, 0],
		[7, 5, 0],
		[10, 15, 0],
		[14, 8, 0],
	],
];

const LEFT_FNS = [f1, f2, f3, f4] as const;
const RIGHT_FNS = [f4, f3, f2, f1] as const;

function transform(state: number[], x: readonly number[]): void {
	const left = [...state];
	const right = [...state];
	for (let round = 0; round < 4; round++) {
		applyRotatingRound(left, LEFT_ROUNDS[round]!, LEFT_FNS[round]!, x);
		applyRotatingRound(right, RIGHT_ROUNDS[round]!, RIGHT_FNS[round]!, x);
	}
	const orig = state;
	const newState: number[] = [
		add32(right[3]!, left[2]!, orig[1]!),
		add32(orig[2]!, left[3]!, right[0]!),
		add32(orig[3]!, left[0]!, right[1]!),
		add32(orig[0]!, left[1]!, right[2]!),
	];
	for (let i = 0; i < 4; i++) {
		state[i] = newState[i]!;
	}
}

/** Compute the RIPEMD-128 digest of `message` (16 bytes). */
export function ripemd128(message: Uint8Array): Uint8Array {
	return mdStyleDigest(message, INITIAL_STATE, transform);
}
