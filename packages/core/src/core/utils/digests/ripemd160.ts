/**
 * RIPEMD-160 message digest (Dobbertin, Bosselaers, Preneel), the RIPEMD
 * variant most commonly seen in the wild. See `ripemd128.ts` for the shared
 * background (why RIPEMD needs a pure implementation here at all, and the
 * two-lane design); this variant carries a fifth chaining register per lane
 * and a fixed extra 10-bit rotation the 128-bit variant does not.
 *
 * Word-index, shift and constant tables were machine-extracted from the
 * Linux kernel's `crypto/rmd160.c` reference implementation, not
 * hand-transcribed; cross-checked against the algorithm's own published
 * test vectors in `ripemd160.test.ts` and, since Node's `node:crypto` still
 * implements RIPEMD-160 via OpenSSL's legacy provider, against
 * `createHash('ripemd160')` directly.
 *
 * @module digests/ripemd160
 */
import { add32, mdStyleDigest, rotl32 } from './bit-ops';
import { f1, f2, f3, f4, f5 } from './ripemd-functions';

const INITIAL_STATE = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];

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
	[
		[4, 9, 0xa953fd4e],
		[0, 15, 0xa953fd4e],
		[5, 5, 0xa953fd4e],
		[9, 11, 0xa953fd4e],
		[7, 6, 0xa953fd4e],
		[12, 8, 0xa953fd4e],
		[2, 13, 0xa953fd4e],
		[10, 12, 0xa953fd4e],
		[14, 5, 0xa953fd4e],
		[1, 12, 0xa953fd4e],
		[3, 13, 0xa953fd4e],
		[8, 14, 0xa953fd4e],
		[11, 11, 0xa953fd4e],
		[6, 8, 0xa953fd4e],
		[15, 5, 0xa953fd4e],
		[13, 6, 0xa953fd4e],
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
		[8, 15, 0x7a6d76e9],
		[6, 5, 0x7a6d76e9],
		[4, 8, 0x7a6d76e9],
		[1, 11, 0x7a6d76e9],
		[3, 14, 0x7a6d76e9],
		[11, 14, 0x7a6d76e9],
		[15, 6, 0x7a6d76e9],
		[0, 14, 0x7a6d76e9],
		[5, 6, 0x7a6d76e9],
		[12, 9, 0x7a6d76e9],
		[2, 12, 0x7a6d76e9],
		[13, 9, 0x7a6d76e9],
		[9, 12, 0x7a6d76e9],
		[7, 5, 0x7a6d76e9],
		[10, 15, 0x7a6d76e9],
		[14, 8, 0x7a6d76e9],
	],
	[
		[12, 8, 0],
		[15, 5, 0],
		[10, 12, 0],
		[4, 9, 0],
		[1, 12, 0],
		[5, 5, 0],
		[8, 14, 0],
		[7, 6, 0],
		[6, 8, 0],
		[2, 13, 0],
		[13, 6, 0],
		[14, 5, 0],
		[0, 15, 0],
		[3, 13, 0],
		[9, 11, 0],
		[11, 11, 0],
	],
];

const LEFT_FNS = [f1, f2, f3, f4, f5] as const;
const RIGHT_FNS = [f5, f4, f3, f2, f1] as const;

/**
 * Run one 16-operation RIPEMD-160 lane round over the 5-register array `r`,
 * starting from register-role offset `startTarget` and returning the offset
 * the NEXT round must start from. Unlike MD4/MD5's 4-register cycle (whose
 * 16 ops-per-round is a whole number of 4-step cycles, so resetting to 0
 * every round is harmless), RIPEMD-160's cycle is 5 registers long: 16 ops
 * is not a multiple of 5, so the a -> e -> d -> c -> b rotation is mid-cycle
 * at a round boundary (round 2 of the reference C code literally begins
 * `ROUND(ee, aa, bb, cc, dd, ...)`, not `ROUND(aa, ...)`). Each operation
 * also force-rotates the register playing the "c" role by 10 bits
 * regardless of whether it is otherwise touched this step (reference
 * `(c) = rol32((c), 10)`).
 */
function applyLane(
	r: number[],
	ops: readonly Op[],
	f: (x: number, y: number, z: number) => number,
	x: readonly number[],
	startTarget: number,
): number {
	let target = startTarget;
	for (const [k, s, addConst] of ops) {
		const i1 = (target + 1) % 5;
		const i2 = (target + 2) % 5;
		const i3 = (target + 3) % 5;
		const i4 = (target + 4) % 5;
		const newTarget = add32(
			rotl32(add32(r[target]!, f(r[i1]!, r[i2]!, r[i3]!), x[k]!, addConst), s),
			r[i4]!,
		);
		r[i2] = rotl32(r[i2]!, 10);
		r[target] = newTarget;
		target = (target + 4) % 5;
	}
	return target;
}

function transform(state: number[], x: readonly number[]): void {
	const left = [...state];
	const right = [...state];
	let leftTarget = 0;
	let rightTarget = 0;
	for (let round = 0; round < 5; round++) {
		leftTarget = applyLane(left, LEFT_ROUNDS[round]!, LEFT_FNS[round]!, x, leftTarget);
		rightTarget = applyLane(right, RIGHT_ROUNDS[round]!, RIGHT_FNS[round]!, x, rightTarget);
	}
	const orig = state;
	const newState: number[] = [
		add32(right[3]!, left[2]!, orig[1]!),
		add32(orig[2]!, left[3]!, right[4]!),
		add32(orig[3]!, left[4]!, right[0]!),
		add32(orig[4]!, left[0]!, right[1]!),
		add32(orig[0]!, left[1]!, right[2]!),
	];
	for (let i = 0; i < 5; i++) {
		state[i] = newState[i]!;
	}
}

/** Compute the RIPEMD-160 digest of `message` (20 bytes). */
export function ripemd160(message: Uint8Array): Uint8Array {
	return mdStyleDigest(message, INITIAL_STATE, transform);
}
