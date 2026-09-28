/**
 * Small, dependency-free, synchronous zlib (RFC 1950) compressor: LZ77 with a
 * hash-chain match finder, emitted as a single fixed-Huffman DEFLATE block
 * (RFC 1951 SS3.2.6). It is not as tight as zlib's dynamic-Huffman output, but
 * it shrinks flat or repetitive data (screenshots, GIF frames) by orders of
 * magnitude versus stored blocks, with no `node:zlib` (browser-safe) and no
 * extra dependency.
 *
 * @module deflate-encode
 */

const LEN_BASE = [
	3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131,
	163, 195, 227, 258,
];
const LEN_EXTRA = [
	0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0,
];
const DIST_BASE = [
	1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049,
	3073, 4097, 6145, 8193, 12289, 16385, 24577,
];
const DIST_EXTRA = [
	0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13,
];

const WINDOW = 32768;
const MAX_MATCH = 258;
const MIN_MATCH = 3;
const HASH_BITS = 15;
const MAX_CHAIN = 48;

/** LSB-first bit sink. */
class BitSink {
	private buf = new Uint8Array(1024);
	private len = 0;
	private acc = 0;
	private nbits = 0;

	bits(value: number, count: number): void {
		this.acc |= value << this.nbits;
		this.nbits += count;
		while (this.nbits >= 8) {
			this.push(this.acc & 0xff);
			this.acc >>>= 8;
			this.nbits -= 8;
		}
	}

	/** Huffman codes are packed most-significant bit first. */
	code(value: number, count: number): void {
		let reversed = 0;
		for (let i = 0; i < count; i++) {
			reversed = (reversed << 1) | ((value >>> i) & 1);
		}
		this.bits(reversed, count);
	}

	finish(): Uint8Array {
		if (this.nbits > 0) {
			this.push(this.acc & 0xff);
			this.acc = 0;
			this.nbits = 0;
		}
		return this.buf.subarray(0, this.len);
	}

	private push(byte: number): void {
		if (this.len === this.buf.length) {
			const next = new Uint8Array(this.buf.length * 2);
			next.set(this.buf);
			this.buf = next;
		}
		this.buf[this.len++] = byte;
	}
}

function litLen(sink: BitSink, sym: number): void {
	if (sym < 144) {
		sink.code(0x30 + sym, 8);
	} else if (sym < 256) {
		sink.code(0x190 + sym - 144, 9);
	} else if (sym < 280) {
		sink.code(sym - 256, 7);
	} else {
		sink.code(0xc0 + sym - 280, 8);
	}
}

function tableIndex(base: number[], value: number): number {
	let i = base.length - 1;
	while (base[i] > value) {
		i--;
	}
	return i;
}

function adler32(bytes: Uint8Array): number {
	let a = 1;
	let b = 0;
	for (let i = 0; i < bytes.length; i++) {
		a = (a + bytes[i]) % 65521;
		b = (b + a) % 65521;
	}
	return ((b << 16) | a) >>> 0;
}

/** Compress `data` into a zlib stream (2-byte header, fixed-Huffman DEFLATE, Adler-32). */
export function zlibDeflate(data: Uint8Array): Uint8Array {
	const sink = new BitSink();
	sink.bits(1, 1); // BFINAL
	sink.bits(1, 2); // BTYPE = 01 (fixed Huffman)

	const head = new Int32Array(1 << HASH_BITS).fill(-1);
	const prev = new Int32Array(data.length);
	const hashAt = (i: number): number =>
		Math.imul((data[i] << 10) ^ (data[i + 1] << 5) ^ data[i + 2], 2654435761) >>> (32 - HASH_BITS);
	const insert = (i: number): void => {
		if (i + MIN_MATCH <= data.length) {
			const h = hashAt(i);
			prev[i] = head[h];
			head[h] = i;
		}
	};

	let i = 0;
	while (i < data.length) {
		let bestLen = 0;
		let bestDist = 0;
		if (i + MIN_MATCH <= data.length) {
			const limit = Math.min(MAX_MATCH, data.length - i);
			let cand = head[hashAt(i)];
			let chain = MAX_CHAIN;
			while (cand >= 0 && i - cand <= WINDOW && chain-- > 0) {
				let l = 0;
				while (l < limit && data[cand + l] === data[i + l]) {
					l++;
				}
				if (l > bestLen) {
					bestLen = l;
					bestDist = i - cand;
					if (l === limit) {
						break;
					}
				}
				cand = prev[cand];
			}
		}
		if (bestLen >= MIN_MATCH) {
			const li = tableIndex(LEN_BASE, bestLen);
			litLen(sink, 257 + li);
			sink.bits(bestLen - LEN_BASE[li], LEN_EXTRA[li]);
			const di = tableIndex(DIST_BASE, bestDist);
			sink.code(di, 5);
			sink.bits(bestDist - DIST_BASE[di], DIST_EXTRA[di]);
			for (let k = 0; k < bestLen; k++) {
				insert(i + k);
			}
			i += bestLen;
		} else {
			litLen(sink, data[i]);
			insert(i);
			i++;
		}
	}
	litLen(sink, 256); // end of block

	const body = sink.finish();
	const out = new Uint8Array(2 + body.length + 4);
	out[0] = 0x78;
	out[1] = 0x01;
	out.set(body, 2);
	new DataView(out.buffer).setUint32(2 + body.length, adler32(data), false);
	return out;
}
