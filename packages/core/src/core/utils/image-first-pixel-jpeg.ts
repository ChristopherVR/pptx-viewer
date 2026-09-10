/**
 * Synchronous, DOM-free baseline JPEG first-pixel (0,0) decoder.
 *
 * Only decodes the FIRST 8x8 block of each scan component (the top-left
 * block of MCU 0), which is sufficient because:
 *
 *  - the DC coefficient of a block is coded as a DIFFERENCE from the
 *    previous block of the same component; the first block in a scan has no
 *    predecessor, so its predictor is 0 and its DC is exactly the decoded
 *    difference - no need to walk every earlier block to accumulate a
 *    running DC;
 *  - image pixel (0,0), in ANY chroma subsampling layout (4:4:4/4:2:2/4:2:0),
 *    always falls on the top-left SAMPLE of each component's first block:
 *    upsampling never needs to blend in a neighbour to produce a corner
 *    sample, so no chroma upsampling logic is needed either;
 *  - the inverse DCT's output sample at (0,0) is a single weighted sum over
 *    the block's 64 dequantized coefficients (the general 2-D IDCT formula
 *    evaluated at x=y=0), so no full 8x8 IDCT butterfly is needed.
 *
 * Blocks of a component beyond the first (when a component's sampling
 * factor is >1) are still Huffman-decoded, just discarded, since the
 * entropy-coded bitstream is inherently sequential and cannot be skipped
 * without decoding.
 *
 * SOF2 (progressive) is NOT supported: a progressive scan's first pass
 * carries only partial spectral/successive-approximation data, so a single
 * scan's first block is not enough to reconstruct even one pixel; the
 * caller's existing async `Image`/canvas decode remains the fallback for
 * progressive JPEGs.
 *
 * @module image-first-pixel-jpeg
 */
import {
	buildJpegHuffmanTable,
	decodeJpegHuffmanSymbol,
	extendSigned,
	JpegBitReader,
} from './image-first-pixel-jpeg-bitstream';
import type { JpegHuffmanTable } from './image-first-pixel-jpeg-bitstream';

/** Maps a zigzag scan index (0-63) to its natural (row-major) 8x8 index. */
const ZIGZAG = [
	0, 1, 8, 16, 9, 2, 3, 10, 17, 24, 32, 25, 18, 11, 4, 5, 12, 19, 26, 33, 40, 48, 41, 34, 27, 20,
	13, 6, 7, 14, 21, 28, 35, 42, 49, 56, 57, 50, 43, 36, 29, 22, 15, 23, 30, 37, 44, 51, 58, 59, 52,
	45, 38, 31, 39, 46, 53, 60, 61, 54, 47, 55, 62, 63,
];

interface JpegComponent {
	id: number;
	hSampling: number;
	vSampling: number;
	quantTableId: number;
}

/** Per-component IDCT-at-(0,0) precomputed cosine weights, indexed [u][v]. */
function cornerIdctWeight(u: number, v: number): number {
	const cu = u === 0 ? 1 / Math.SQRT2 : 1;
	const cv = v === 0 ? 1 / Math.SQRT2 : 1;
	return 0.25 * cu * cv * Math.cos((u * Math.PI) / 16) * Math.cos((v * Math.PI) / 16);
}
const CORNER_WEIGHTS: number[] = (() => {
	const weights: number[] = [];
	for (let naturalIndex = 0; naturalIndex < 64; naturalIndex++) {
		const row = Math.floor(naturalIndex / 8); // "u" (horizontal freq) per JPEG's row=vertical convention below
		const col = naturalIndex % 8;
		// JPEG's natural block order is row = vertical frequency, col = horizontal
		// frequency; the corner IDCT sample only needs the product of both
		// 1-D basis weights, which is symmetric in (row, col) naming.
		weights.push(cornerIdctWeight(row, col));
	}
	return weights;
})();

/** Decode one 8x8 block's DC+AC coefficients, dequantize, and return only the IDCT(0,0) sample (before level shift). Advances `reader` past the whole block regardless. */
function decodeBlockCornerSample(
	reader: JpegBitReader,
	dcTable: JpegHuffmanTable,
	acTable: JpegHuffmanTable,
	quantTable: Uint16Array,
): number {
	const coeffs = new Float64Array(64); // natural order, dequantized

	const dcSize = decodeJpegHuffmanSymbol(reader, dcTable);
	const dcBits = reader.bits(dcSize);
	const dc = extendSigned(dcBits, dcSize); // predictor is always 0 for a scan's first block
	coeffs[0] = dc * quantTable[0]!;

	let k = 1;
	while (k < 64) {
		const rs = decodeJpegHuffmanSymbol(reader, acTable);
		const run = rs >> 4;
		const size = rs & 0x0f;
		if (size === 0) {
			if (run === 15) {
				k += 16; // ZRL: 16 zero coefficients
				continue;
			}
			break; // EOB
		}
		k += run;
		if (k >= 64) {
			break;
		}
		const bits = reader.bits(size);
		const value = extendSigned(bits, size);
		const naturalIndex = ZIGZAG[k]!;
		coeffs[naturalIndex] = value * quantTable[k]!;
		k += 1;
	}

	let sum = 0;
	for (let i = 0; i < 64; i++) {
		sum += coeffs[i]! * CORNER_WEIGHTS[i]!;
	}
	return sum;
}

function clamp8(value: number): number {
	return Math.max(0, Math.min(255, Math.round(value)));
}

/**
 * Decode a baseline JPEG's pixel (0,0) synchronously with no DOM. Returns
 * `undefined` for a non-JPEG, a progressive (SOF2) JPEG, or a malformed
 * marker sequence.
 */
export function decodeJpegFirstPixel(
	bytes: Uint8Array,
): { r: number; g: number; b: number; a: number } | undefined {
	if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
		return undefined;
	}
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const quantTables = new Map<number, Uint16Array>();
	const dcTables = new Map<number, JpegHuffmanTable>();
	const acTables = new Map<number, JpegHuffmanTable>();
	let components: JpegComponent[] | undefined;
	let pos = 2;

	try {
		while (pos + 4 <= bytes.length) {
			if (bytes[pos] !== 0xff) {
				pos += 1;
				continue;
			}
			const marker = bytes[pos + 1]!;
			if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
				pos += 2;
				continue;
			}
			if (marker === 0xd9) {
				return undefined; // EOI with no scan found
			}
			const length = view.getUint16(pos + 2, false);
			const segStart = pos + 4;

			if (marker === 0xdb) {
				// DQT: one or more tables.
				let off = segStart;
				const segEnd = pos + 2 + length;
				while (off < segEnd) {
					const pq = bytes[off]! >> 4;
					const tq = bytes[off]! & 0x0f;
					off += 1;
					const table = new Uint16Array(64);
					for (let i = 0; i < 64; i++) {
						table[i] = pq === 0 ? bytes[off + i]! : view.getUint16(off + i * 2, false);
					}
					off += pq === 0 ? 64 : 128;
					quantTables.set(tq, table);
				}
			} else if (marker === 0xc0 || marker === 0xc1) {
				// SOF0/SOF1 (baseline / extended sequential, both Huffman-coded).
				const numComponents = bytes[segStart + 5]!;
				components = [];
				for (let i = 0; i < numComponents; i++) {
					const base = segStart + 6 + i * 3;
					components.push({
						id: bytes[base]!,
						hSampling: bytes[base + 1]! >> 4,
						vSampling: bytes[base + 1]! & 0x0f,
						quantTableId: bytes[base + 2]!,
					});
				}
			} else if (marker === 0xc2) {
				return undefined; // progressive: not supported (see module doc)
			} else if (marker === 0xc4) {
				// DHT: one or more tables.
				let off = segStart;
				const segEnd = pos + 2 + length;
				while (off < segEnd) {
					const tc = bytes[off]! >> 4;
					const th = bytes[off]! & 0x0f;
					off += 1;
					const bits = bytes.subarray(off, off + 16);
					off += 16;
					const total = bits.reduce((s, b) => s + b, 0);
					const huffval = bytes.subarray(off, off + total);
					off += total;
					const table = buildJpegHuffmanTable(bits, huffval);
					(tc === 0 ? dcTables : acTables).set(th, table);
				}
			} else if (marker === 0xda) {
				// SOS: decode MCU 0 only.
				if (!components) {
					return undefined;
				}
				const scanCount = bytes[segStart]!;
				const scanComponents: { comp: JpegComponent; dcId: number; acId: number }[] = [];
				for (let i = 0; i < scanCount; i++) {
					const base = segStart + 1 + i * 2;
					const compId = bytes[base]!;
					const comp = components.find((c) => c.id === compId);
					if (!comp) {
						return undefined;
					}
					scanComponents.push({ comp, dcId: bytes[base + 1]! >> 4, acId: bytes[base + 1]! & 0x0f });
				}
				const reader = new JpegBitReader(bytes, segStart + 1 + scanCount * 2 + 3);
				const cornerSamples: number[] = [];
				for (const sc of scanComponents) {
					const dcTable = dcTables.get(sc.dcId);
					const acTable = acTables.get(sc.acId);
					const quantTable = quantTables.get(sc.comp.quantTableId);
					if (!dcTable || !acTable || !quantTable) {
						return undefined;
					}
					const blockCount = sc.comp.hSampling * sc.comp.vSampling;
					let first: number | undefined;
					for (let b = 0; b < blockCount; b++) {
						const sample = decodeBlockCornerSample(reader, dcTable, acTable, quantTable);
						if (b === 0) {
							first = sample;
						}
					}
					cornerSamples.push(clamp8(first! + 128));
				}
				return combineComponentsToRgb(cornerSamples);
			}
			pos += 2 + length;
		}
	} catch {
		return undefined;
	}
	return undefined;
}

/** YCbCr (or grayscale, or CMYK-ish 4-component) corner samples -> RGB. */
function combineComponentsToRgb(samples: number[]): { r: number; g: number; b: number; a: number } {
	if (samples.length === 1) {
		const y = samples[0]!;
		return { r: y, g: y, b: y, a: 255 };
	}
	const [y, cb, cr] = samples;
	const r = clamp8(y! + 1.402 * (cr! - 128));
	const g = clamp8(y! - 0.344136 * (cb! - 128) - 0.714136 * (cr! - 128));
	const b = clamp8(y! + 1.772 * (cb! - 128));
	return { r, g, b, a: 255 };
}
