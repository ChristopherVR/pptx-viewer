/**
 * Shared 32-bit bit-manipulation and block-padding helpers for the
 * MD4-family digests (MD4, MD5, RIPEMD-128, RIPEMD-160): all four share the
 * same padding scheme (append `0x80`, zero-pad to 56 mod 64, append an
 * 8-byte little-endian bit length) and the same block layout (sixteen
 * little-endian 32-bit words per 64-byte block, a little-endian 32-bit-word
 * running state). Factoring that out means each algorithm module only needs
 * to supply its own initial state and per-block transform.
 *
 * @module digests/bit-ops
 */

/** Rotate a 32-bit unsigned value left by `n` bits (1-31). */
export function rotl32(x: number, n: number): number {
	return ((x << n) | (x >>> (32 - n))) >>> 0;
}

/** Add any number of 32-bit values with unsigned wraparound. */
export function add32(...values: number[]): number {
	let sum = 0;
	for (const value of values) {
		sum = (sum + value) >>> 0;
	}
	return sum;
}

/**
 * Pad a message the way MD4, MD5, RIPEMD-128 and RIPEMD-160 all do: a
 * `0x80` byte, zero bytes until the length is 56 mod 64, then the original
 * bit length as an 8-byte little-endian integer (RFC 1320 section 3.1 /
 * RFC 1321 section 3.1).
 */
export function padMd4Style(message: Uint8Array): Uint8Array {
	const bitLength = BigInt(message.length) * 8n;
	const paddedLength = (message.length + 9 + 63) & ~63;
	const padded = new Uint8Array(paddedLength);
	padded.set(message);
	padded[message.length] = 0x80;
	new DataView(padded.buffer).setBigUint64(paddedLength - 8, bitLength, true);
	return padded;
}

/**
 * Run one MD4/MD5-style round: 16 operations that rotate which of the four
 * registers `r = [a, b, c, d]` gets updated, in the fixed a -> d -> c -> b
 * cycle both algorithms use (RFC 1320 section 3.4 / RFC 1321 section 3.4,
 * the "[ABCD k s]", "[DABC k s]", ... notation). Each operation reads the
 * OTHER three registers, in the order they occur going forward from the
 * target (so the "a" step reads b, c, d; the following "d" step reads the
 * just-updated a, then b, c; and so on), computes
 * `target = rotl(target + f(...) + x[k] + addConst, s)`, and advances the
 * target index backward by one (mod 4), which is exactly the a/d/c/b cycle.
 *
 * `ops` is `[wordIndex, shiftAmount, additiveConstant]` per operation, in
 * the algorithm's specified order; `f` is the round's nonlinear function.
 */
export function applyRotatingRound(
	r: number[],
	ops: readonly (readonly [k: number, s: number, addConst: number])[],
	f: (b: number, c: number, d: number) => number,
	x: readonly number[],
): void {
	let target = 0;
	for (const [k, s, addConst] of ops) {
		const i1 = (target + 1) & 3;
		const i2 = (target + 2) & 3;
		const i3 = (target + 3) & 3;
		r[target] = rotl32(add32(r[target]!, f(r[i1]!, r[i2]!, r[i3]!), x[k]!, addConst), s);
		target = (target + 3) & 3;
	}
}

/**
 * Run one MD5-style round. Identical a -> d -> c -> b register rotation to
 * {@link applyRotatingRound}, but MD5's update formula folds in the
 * "b" register that MD4 does not (RFC 1321 section 3.4:
 * `a = b + ((a + F(b,c,d) + X[k] + T[i]) <<< s)`).
 */
export function applyRotatingRoundWithFeedback(
	r: number[],
	ops: readonly (readonly [k: number, s: number, addConst: number])[],
	f: (b: number, c: number, d: number) => number,
	x: readonly number[],
): void {
	let target = 0;
	for (const [k, s, addConst] of ops) {
		const i1 = (target + 1) & 3;
		const i2 = (target + 2) & 3;
		const i3 = (target + 3) & 3;
		const rotated = rotl32(add32(r[target]!, f(r[i1]!, r[i2]!, r[i3]!), x[k]!, addConst), s);
		r[target] = add32(r[i1]!, rotated);
		target = (target + 3) & 3;
	}
}

/**
 * Run an MD4-family compression loop: pad `message`, then feed each 64-byte
 * block (as sixteen little-endian 32-bit words) through `transform`, which
 * mutates `state` in place. Returns the final state serialised as
 * little-endian bytes.
 */
export function mdStyleDigest(
	message: Uint8Array,
	initialState: readonly number[],
	transform: (state: number[], words: number[]) => void,
): Uint8Array {
	const padded = padMd4Style(message);
	const view = new DataView(padded.buffer);
	const state = [...initialState];
	const words = new Array<number>(16);

	for (let blockOffset = 0; blockOffset < padded.length; blockOffset += 64) {
		for (let i = 0; i < 16; i++) {
			words[i] = view.getUint32(blockOffset + i * 4, true);
		}
		transform(state, words);
	}

	const out = new Uint8Array(state.length * 4);
	const outView = new DataView(out.buffer);
	for (let i = 0; i < state.length; i++) {
		outView.setUint32(i * 4, state[i]!, true);
	}
	return out;
}
