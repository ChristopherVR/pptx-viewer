/**
 * Minimal, dependency-free RFC 1951 DEFLATE decoder (+ RFC 1950 zlib
 * wrapper), used by {@link module:image-first-pixel-png} to decompress PNG
 * `IDAT` data with no DOM/canvas and no external deflate library.
 *
 * Supports all three DEFLATE block types (stored, fixed Huffman, dynamic
 * Huffman) and the standard length/distance extra-bit tables. Not a
 * general-purpose zlib replacement: it decodes into an in-memory buffer with
 * no streaming API, which is fine for the small chart-fill pictures this
 * exists to read a single pixel from.
 *
 * @module inflate
 */

/** A canonical Huffman decode table: code length per symbol -> fast lookup. */
interface HuffmanTable {
	/** `counts[len]` = number of codes of that bit length. */
	counts: Uint16Array;
	/** Symbols sorted by (code length, symbol value). */
	symbols: Uint16Array;
}

const LENGTH_BASE = [
	3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131,
	163, 195, 227, 258,
];
const LENGTH_EXTRA_BITS = [
	0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0,
];
const DIST_BASE = [
	1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049,
	3073, 4097, 6145, 8193, 12289, 16385, 24577,
];
const DIST_EXTRA_BITS = [
	0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13,
];
const CODE_LENGTH_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

/** Bit-level reader over a byte buffer, LSB-first (DEFLATE bit order). */
class BitReader {
	private pos = 0;
	private bitBuf = 0;
	private bitCount = 0;

	constructor(private readonly data: Uint8Array) {}

	get bytePos(): number {
		return this.pos;
	}

	bits(count: number): number {
		while (this.bitCount < count) {
			if (this.pos >= this.data.length) {
				throw new Error('inflate: unexpected end of stream');
			}
			this.bitBuf |= this.data[this.pos]! << this.bitCount;
			this.pos++;
			this.bitCount += 8;
		}
		const value = this.bitBuf & ((1 << count) - 1);
		this.bitBuf >>>= count;
		this.bitCount -= count;
		return value;
	}

	alignToByte(): void {
		this.bitBuf = 0;
		this.bitCount = 0;
	}

	readByte(): number {
		if (this.pos >= this.data.length) {
			throw new Error('inflate: unexpected end of stream');
		}
		return this.data[this.pos++]!;
	}
}

function buildHuffmanTable(lengths: readonly number[]): HuffmanTable {
	const maxBits = Math.max(0, ...lengths);
	const counts = new Uint16Array(maxBits + 1);
	for (const len of lengths) {
		if (len > 0) {
			counts[len]!++;
		}
	}
	const offsets = new Uint16Array(maxBits + 2);
	for (let bits = 1; bits <= maxBits; bits++) {
		offsets[bits + 1] = offsets[bits]! + counts[bits]!;
	}
	const symbols = new Uint16Array(lengths.filter((l) => l > 0).length);
	for (let symbol = 0; symbol < lengths.length; symbol++) {
		const len = lengths[symbol]!;
		if (len > 0) {
			symbols[offsets[len]!] = symbol;
			offsets[len]!++;
		}
	}
	return { counts, symbols };
}

/** Decode one symbol from `reader` using canonical Huffman `table`. */
function decodeSymbol(reader: BitReader, table: HuffmanTable): number {
	let code = 0;
	let first = 0;
	let index = 0;
	for (let len = 1; len < table.counts.length; len++) {
		code |= reader.bits(1);
		const count = table.counts[len]!;
		if (code - first < count) {
			return table.symbols[index + (code - first)]!;
		}
		index += count;
		first += count;
		first <<= 1;
		code <<= 1;
	}
	throw new Error('inflate: invalid Huffman code');
}

const FIXED_LITERAL_LENGTHS: number[] = (() => {
	const lengths = new Array<number>(288);
	for (let i = 0; i < 144; i++) {
		lengths[i] = 8;
	}
	for (let i = 144; i < 256; i++) {
		lengths[i] = 9;
	}
	for (let i = 256; i < 280; i++) {
		lengths[i] = 7;
	}
	for (let i = 280; i < 288; i++) {
		lengths[i] = 8;
	}
	return lengths;
})();
const FIXED_DIST_LENGTHS: number[] = new Array(30).fill(5);

/** Growable output byte sink capped at `limit` bytes (early-stop optimization). */
class OutputSink {
	private buf: Uint8Array;
	private len = 0;
	constructor(private readonly limit: number) {
		this.buf = new Uint8Array(Math.min(limit, 4096) || 64);
	}
	get length(): number {
		return this.len;
	}
	get full(): boolean {
		return this.len >= this.limit;
	}
	push(byte: number): void {
		if (this.len >= this.buf.length) {
			const next = new Uint8Array(Math.min(this.limit, this.buf.length * 2));
			next.set(this.buf);
			this.buf = next;
		}
		this.buf[this.len++] = byte;
	}
	at(offsetFromEnd: number): number {
		return this.buf[this.len - offsetFromEnd]!;
	}
	toBytes(): Uint8Array {
		return this.buf.subarray(0, this.len);
	}
}

function inflateBlock(
	reader: BitReader,
	out: OutputSink,
	litTable: HuffmanTable,
	distTable: HuffmanTable,
): void {
	for (;;) {
		if (out.full) {
			return;
		}
		const symbol = decodeSymbol(reader, litTable);
		if (symbol === 256) {
			return;
		}
		if (symbol < 256) {
			out.push(symbol);
			continue;
		}
		const lengthIndex = symbol - 257;
		if (lengthIndex >= LENGTH_BASE.length) {
			throw new Error('inflate: invalid length symbol');
		}
		const length = LENGTH_BASE[lengthIndex]! + reader.bits(LENGTH_EXTRA_BITS[lengthIndex]!);
		const distSymbol = decodeSymbol(reader, distTable);
		if (distSymbol >= DIST_BASE.length) {
			throw new Error('inflate: invalid distance symbol');
		}
		const distance = DIST_BASE[distSymbol]! + reader.bits(DIST_EXTRA_BITS[distSymbol]!);
		for (let i = 0; i < length; i++) {
			if (out.full) {
				return;
			}
			out.push(out.at(distance));
		}
	}
}

function readDynamicTables(reader: BitReader): { lit: HuffmanTable; dist: HuffmanTable } {
	const hlit = reader.bits(5) + 257;
	const hdist = reader.bits(5) + 1;
	const hclen = reader.bits(4) + 4;
	const codeLengthLengths = new Array<number>(19).fill(0);
	for (let i = 0; i < hclen; i++) {
		codeLengthLengths[CODE_LENGTH_ORDER[i]!] = reader.bits(3);
	}
	const codeLengthTable = buildHuffmanTable(codeLengthLengths);

	const allLengths: number[] = [];
	while (allLengths.length < hlit + hdist) {
		const symbol = decodeSymbol(reader, codeLengthTable);
		if (symbol < 16) {
			allLengths.push(symbol);
		} else if (symbol === 16) {
			const prev = allLengths[allLengths.length - 1] ?? 0;
			const repeat = reader.bits(2) + 3;
			for (let i = 0; i < repeat; i++) {
				allLengths.push(prev);
			}
		} else if (symbol === 17) {
			const repeat = reader.bits(3) + 3;
			for (let i = 0; i < repeat; i++) {
				allLengths.push(0);
			}
		} else {
			const repeat = reader.bits(7) + 11;
			for (let i = 0; i < repeat; i++) {
				allLengths.push(0);
			}
		}
	}
	const litLengths = allLengths.slice(0, hlit);
	const distLengths = allLengths.slice(hlit, hlit + hdist);
	return { lit: buildHuffmanTable(litLengths), dist: buildHuffmanTable(distLengths) };
}

/**
 * Inflate a raw DEFLATE (RFC 1951) stream, stopping once `maxOutputBytes`
 * bytes have been produced (default: unlimited). Early-stopping mid-block is
 * safe for the caller's purposes here (a truncated final byte's value is
 * still whatever was decoded up to the cap); it exists so a single-pixel read
 * from a large image does not require decompressing the whole thing.
 */
export function inflateRaw(data: Uint8Array, maxOutputBytes = Infinity): Uint8Array {
	const reader = new BitReader(data);
	const out = new OutputSink(maxOutputBytes === Infinity ? 1 << 20 : maxOutputBytes);
	let final = 0;
	do {
		final = reader.bits(1);
		const type = reader.bits(2);
		if (out.full) {
			break;
		}
		if (type === 0) {
			reader.alignToByte();
			const len = reader.readByte() | (reader.readByte() << 8);
			reader.readByte();
			reader.readByte(); // NLEN (one's complement), unused
			for (let i = 0; i < len; i++) {
				if (out.full) {
					break;
				}
				out.push(reader.readByte());
			}
		} else if (type === 1) {
			const lit = buildHuffmanTable(FIXED_LITERAL_LENGTHS);
			const dist = buildHuffmanTable(FIXED_DIST_LENGTHS);
			inflateBlock(reader, out, lit, dist);
		} else if (type === 2) {
			const { lit, dist } = readDynamicTables(reader);
			inflateBlock(reader, out, lit, dist);
		} else {
			throw new Error('inflate: invalid block type');
		}
	} while (!final && !out.full);
	return out.toBytes();
}

/**
 * Inflate a zlib-wrapped (RFC 1950) stream: 2-byte header, DEFLATE payload,
 * 4-byte Adler-32 trailer (trailer not verified: the caller only wants the
 * first few decoded bytes, and rejecting a truncated read here would defeat
 * the point of {@link inflateRaw}'s early stop).
 */
export function zlibInflate(data: Uint8Array, maxOutputBytes = Infinity): Uint8Array {
	if (data.length < 2) {
		throw new Error('inflate: truncated zlib stream');
	}
	return inflateRaw(data.subarray(2), maxOutputBytes);
}
