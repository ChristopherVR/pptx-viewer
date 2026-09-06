/**
 * The Whirlpool T-tables (ISO/IEC 10118-3:2004 final revision) and round
 * constants. See `whirlpool-sbox.ts` for `TABLE0`, the only one of the
 * eight T-tables actually stored: each of the other seven is `TABLE0` with
 * its bytes rotated right by one more byte position (verified byte-for-byte
 * against the reference's own `C1..C7` arrays before this table was
 * trimmed down to just `C0`), a property of how the table fuses the S-box
 * with the round's diffusion matrix. Generating the rest at module load
 * avoids repeating the same 2048 constants eight times over.
 *
 * The earlier 2001 "tweaked" revision of Whirlpool used a different
 * diffusion matrix; `TABLE0[0x06] = 0x0101040108050209n` decodes as the
 * *final* revision's circulant coefficients `(1, 1, 4, 1, 8, 5, 2, 9)`
 * (Wikipedia, "Whirlpool (hash function)", Version changes) multiplied by
 * `S(0x06) = 1`, confirming this table (and this module) is the final,
 * ISO-standardised revision and not the obsolete one.
 *
 * @module digests/whirlpool-table
 */
import { TABLE0 } from './whirlpool-sbox';

const WORD_MASK = (1n << 64n) - 1n;

/** Rotate a 64-bit value right by `bytes` byte positions. */
function rotateBytesRight(value: bigint, bytes: number): bigint {
	const bits = BigInt(bytes) * 8n;
	return ((value >> bits) | (value << (64n - bits))) & WORD_MASK;
}

/**
 * All eight T-tables: `TABLES[i][x] = TABLE0[x]` rotated right by `i` bytes.
 * Built once at module load from {@link TABLE0} instead of storing all
 * 2048 constants directly (see module doc).
 */
export const TABLES: readonly (readonly bigint[])[] = Array.from({ length: 8 }, (_, i) =>
	i === 0 ? TABLE0 : TABLE0.map((value) => rotateBytesRight(value, i)),
);

/** Per-round key-schedule constants (10 rounds), RHash `whirlpool.c` `rc[]`. */
export const ROUND_CONSTANTS: readonly bigint[] = [
	0x1823c6e887b8014fn,
	0x36a6d2f5796f9152n,
	0x60bc9b8ea30c7b35n,
	0x1de0d7c22e4bfe57n,
	0x157737e59ff04adan,
	0x58c9290ab1a06b85n,
	0xbd5d10f4cb3e0567n,
	0xe427418ba77d95d8n,
	0xfbee7c66dd17479en,
	0xca2dbf07ad5a8333n,
];

export { WORD_MASK };
