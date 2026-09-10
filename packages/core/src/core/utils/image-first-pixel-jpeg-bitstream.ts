/**
 * MSB-first bit reader (JPEG's entropy-coded-segment bit order, with 0xFF00
 * byte-stuffing removal) and canonical Huffman table builder/decoder, shared
 * by {@link module:image-first-pixel-jpeg}'s block decode.
 *
 * A separate, MSB-first implementation from {@link module:inflate}'s
 * LSB-first DEFLATE bit reader: the two bitstream formats are unrelated, and
 * folding them into one shared reader would need a runtime bit-order flag
 * threaded through every call for no real reuse benefit.
 *
 * @module image-first-pixel-jpeg-bitstream
 */

/** Reads JPEG entropy-coded-segment bits MSB-first, transparently undoing 0xFF00 byte-stuffing. */
export class JpegBitReader {
	private pos: number;
	private currentByte = 0;
	private bitsLeftInByte = 0;
	/** Set once a raw (non-stuffed) 0xFF marker byte is encountered: end of this scan's data. */
	hitMarker = false;

	constructor(
		private readonly data: Uint8Array,
		startOffset: number,
	) {
		this.pos = startOffset;
	}

	private nextBit(): number {
		if (this.bitsLeftInByte === 0) {
			if (this.hitMarker || this.pos >= this.data.length) {
				return 0; // ran off the end of the scan: pad with zero bits
			}
			const byte = this.data[this.pos]!;
			if (byte === 0xff) {
				const next = this.data[this.pos + 1];
				if (next === 0x00) {
					this.pos += 2;
				} else {
					// A real marker (restart, EOI, ...): stop consuming, pad with zero bits.
					this.hitMarker = true;
					return 0;
				}
			} else {
				this.pos += 1;
			}
			this.currentByte = byte;
			this.bitsLeftInByte = 8;
		}
		this.bitsLeftInByte -= 1;
		return (this.currentByte >> this.bitsLeftInByte) & 1;
	}

	/** Read `count` (0-16) bits MSB-first as an unsigned integer. */
	bits(count: number): number {
		let value = 0;
		for (let i = 0; i < count; i++) {
			value = (value << 1) | this.nextBit();
		}
		return value >>> 0;
	}
}

/** A canonical Huffman decode table (same shape/algorithm as DEFLATE's, independent implementation - see module doc). */
export interface JpegHuffmanTable {
	counts: Uint16Array; // counts[len] = number of codes of that length
	symbols: Uint8Array; // symbols sorted by (length, value)
}

/** Build a canonical Huffman table from JPEG DHT's BITS (16 counts) + HUFFVAL (symbol values). */
export function buildJpegHuffmanTable(bits: Uint8Array, huffval: Uint8Array): JpegHuffmanTable {
	const counts = new Uint16Array(17);
	for (let len = 1; len <= 16; len++) {
		counts[len] = bits[len - 1]!;
	}
	return { counts, symbols: huffval };
}

/** Decode one Huffman symbol from `reader` using canonical `table`, MSB-first. */
export function decodeJpegHuffmanSymbol(reader: JpegBitReader, table: JpegHuffmanTable): number {
	let code = 0;
	let first = 0;
	let index = 0;
	for (let len = 1; len <= 16; len++) {
		code = (code << 1) | reader.bits(1);
		const count = table.counts[len]!;
		if (count > 0 && code - first < count) {
			return table.symbols[index + (code - first)]!;
		}
		index += count;
		first += count;
		first <<= 1;
	}
	throw new Error('jpeg: invalid Huffman code');
}

/**
 * JPEG's "receive and extend" (ITU T.81 F.2.2.1): interpret an `s`-bit raw
 * value as the signed DC/AC coefficient it encodes.
 */
export function extendSigned(value: number, size: number): number {
	if (size === 0) {
		return 0;
	}
	const half = 1 << (size - 1);
	return value < half ? value - (1 << size) + 1 : value;
}
