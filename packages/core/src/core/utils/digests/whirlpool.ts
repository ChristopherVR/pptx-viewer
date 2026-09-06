/**
 * Whirlpool message digest (Barreto & Rijmen, ISO/IEC 10118-3:2004 final
 * revision). The largest algorithm ECMA-376 19.2.1.22 allows a
 * `p:modifyVerifier` to name (512 bits) and, like the RIPEMD variants, one
 * only ever identified by `algorithmName` (CAPI never defined a
 * `cryptAlgorithmSid` for it).
 *
 * An AES-like block cipher `W` run in Miyaguchi-Preneel mode over 10
 * rounds; see `whirlpool-table.ts` for where the T-tables and round
 * constants come from. Ported from RHash's public-domain
 * `librhash/whirlpool.c` reference, with one correction: that reference's
 * `hash[i] = state[0][i]` (before the round loop) then `hash[i] ^=
 * state[0][i]` (after) is a two-step feedforward that is easy to
 * mistranslate into a single `hash[i] ^= stateInitial[i] ^ stateFinal[i]`
 * plus the ORIGINAL `hash[i]` again; the original chaining value must
 * appear in the feedforward exactly once (it is already folded into
 * `stateInitial = block ^ originalHash`), not twice, since a second XOR
 * cancels it out entirely. Multi-block inputs (where the chaining value
 * feeding into block 2+ is non-zero) are the only case that exposes the
 * mistake: single-block vectors like `Whirlpool("")` pass either way
 * because the chaining value starts at zero. Caught and fixed against
 * OpenSSL's legacy-provider `whirlpool` digest before release; see
 * `whirlpool.test.ts` for both single- and multi-block vectors.
 *
 * @module digests/whirlpool
 */
import { ROUND_CONSTANTS, TABLES, WORD_MASK } from './whirlpool-table';

const BLOCK_BYTES = 64;
const WORDS_PER_BLOCK = 8;
const ROUNDS = 10;

/**
 * The Whirlpool T-table lookup fused with the round's byte permutation:
 * combines one byte from each of the eight words of `src`, each looked up
 * in a different rotated T-table, into the new word at column `shift`.
 */
function op(src: readonly bigint[], shift: number): bigint {
	let result = 0n;
	for (let t = 0; t < WORDS_PER_BLOCK; t++) {
		const wordIndex = (shift + (WORDS_PER_BLOCK - t)) & 7;
		const byteShift = BigInt(56 - t * 8);
		const byte = Number((src[wordIndex]! >> byteShift) & 0xffn);
		result ^= TABLES[t]![byte]!;
	}
	return result & WORD_MASK;
}

/** Process one 64-byte block, mutating `hash` (the 8-word chaining value) in place. */
function processBlock(hash: bigint[], block: readonly bigint[]): void {
	const stateInitial = block.map((word, i) => (word ^ hash[i]!) & WORD_MASK);
	let key = [...hash];
	let state = stateInitial;

	for (let round = 0; round < ROUNDS; round++) {
		const nextKey = new Array<bigint>(WORDS_PER_BLOCK);
		for (let j = 0; j < WORDS_PER_BLOCK; j++) {
			nextKey[j] = op(key, j) ^ (j === 0 ? ROUND_CONSTANTS[round]! : 0n);
		}
		const nextState = new Array<bigint>(WORDS_PER_BLOCK);
		for (let j = 0; j < WORDS_PER_BLOCK; j++) {
			nextState[j] = (op(state, j) ^ nextKey[j]!) & WORD_MASK;
		}
		key = nextKey;
		state = nextState;
	}

	// Miyaguchi-Preneel feedforward: the original chaining value appears
	// exactly once, already folded into `stateInitial`.
	for (let i = 0; i < WORDS_PER_BLOCK; i++) {
		hash[i] = (stateInitial[i]! ^ state[i]!) & WORD_MASK;
	}
}

/**
 * Pad `message` per ISO/IEC 10118-1: a `0x80` byte, zero bytes up to a
 * 32-byte-aligned boundary, then the bit length as a final big-endian
 * 64-bit integer (messages need billions of exabytes before the full
 * spec's 256-bit length field would matter, so only the low 64 bits are
 * ever populated, matching the reference implementation).
 */
function pad(message: Uint8Array): Uint8Array {
	let total = message.length + 1;
	while (total % BLOCK_BYTES !== 32) {
		total++;
	}
	total += 32;

	const padded = new Uint8Array(total);
	padded.set(message);
	padded[message.length] = 0x80;
	new DataView(padded.buffer).setBigUint64(total - 8, BigInt(message.length) * 8n, false);
	return padded;
}

/** Compute the Whirlpool digest of `message` (64 bytes). */
export function whirlpool(message: Uint8Array): Uint8Array {
	const padded = pad(message);
	const view = new DataView(padded.buffer);
	const hash = new Array<bigint>(WORDS_PER_BLOCK).fill(0n);
	const block = new Array<bigint>(WORDS_PER_BLOCK);

	for (let offset = 0; offset < padded.length; offset += BLOCK_BYTES) {
		for (let i = 0; i < WORDS_PER_BLOCK; i++) {
			block[i] = view.getBigUint64(offset + i * 8, false);
		}
		processBlock(hash, block);
	}

	const out = new Uint8Array(BLOCK_BYTES);
	const outView = new DataView(out.buffer);
	for (let i = 0; i < WORDS_PER_BLOCK; i++) {
		outView.setBigUint64(i * 8, hash[i]!, false);
	}
	return out;
}
