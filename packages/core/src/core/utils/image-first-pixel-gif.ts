/**
 * Synchronous, DOM-free GIF first-pixel (0,0) decoder.
 *
 * GIF's LZW dictionary starts with only the "root" single-symbol codes
 * (0..2^minCodeSize-1, one per possible colour index); a multi-symbol
 * dictionary entry can only be referenced once the encoder has already
 * emitted at least one earlier code to build it from. That means the FIRST
 * non-Clear code any GIF LZW stream emits is always one of those root codes,
 * whose value equals the colour-table index of the very first output pixel
 * directly - no dictionary construction or general LZW decoding needed, just
 * enough of the sub-block bitstream to read that one code.
 *
 * For an interlaced image the same "first pixel is the encoder's first
 * emitted code" reasoning holds: pass 1 starts at row 0 column 0, i.e. image
 * pixel (0,0), so this needs no special interlace handling either.
 *
 * @module image-first-pixel-gif
 */

/** Reads GIF sub-blocks (length-prefixed byte runs, 0-length terminates) as one continuous LSB-first bit source. */
class GifSubBlockBitReader {
	private blockBytes: Uint8Array = new Uint8Array(0);
	private blockPos = 0;
	private bitBuf = 0;
	private bitCount = 0;
	private ended = false;

	constructor(
		private readonly data: Uint8Array,
		private pos: number,
	) {}

	private nextByte(): number | undefined {
		if (this.blockPos >= this.blockBytes.length) {
			if (this.ended || this.pos >= this.data.length) {
				this.ended = true;
				return undefined;
			}
			const len = this.data[this.pos]!;
			this.pos += 1;
			if (len === 0) {
				this.ended = true;
				return undefined;
			}
			this.blockBytes = this.data.subarray(this.pos, this.pos + len);
			this.blockPos = 0;
			this.pos += len;
		}
		return this.blockBytes[this.blockPos++];
	}

	/** Read `count` bits, LSB-first. Returns `undefined` at end of data. */
	bits(count: number): number | undefined {
		while (this.bitCount < count) {
			const byte = this.nextByte();
			if (byte === undefined) {
				return undefined;
			}
			this.bitBuf |= byte << this.bitCount;
			this.bitCount += 8;
		}
		const value = this.bitBuf & ((1 << count) - 1);
		this.bitBuf >>>= count;
		this.bitCount -= count;
		return value;
	}
}

/** Read the first LZW-decoded colour-table index from an image's sub-blocked data, starting right after the "LZW minimum code size" byte. */
function readFirstColorIndex(
	data: Uint8Array,
	subBlocksStart: number,
	minCodeSize: number,
): number | undefined {
	const clearCode = 1 << minCodeSize;
	const endCode = clearCode + 1;
	let codeSize = minCodeSize + 1;
	const reader = new GifSubBlockBitReader(data, subBlocksStart);
	// A conforming encoder never emits more than a handful of Clear codes in a
	// row; cap the loop defensively against a malformed stream.
	for (let guard = 0; guard < 8; guard++) {
		const code = reader.bits(codeSize);
		if (code === undefined || code === endCode) {
			return undefined;
		}
		if (code === clearCode) {
			codeSize = minCodeSize + 1; // a Clear code resets the code size too
			continue;
		}
		return code < clearCode ? code : undefined;
	}
	return undefined;
}

interface GifImageLocation {
	subBlocksStart: number;
	minCodeSize: number;
	localColorTable: Uint8Array | undefined;
}

/** Locate the first `p:Image Descriptor`'s LZW data, walking any preceding extension blocks (and reading the Graphic Control Extension's transparency flag/index, if present). */
function locateFirstImage(
	data: Uint8Array,
	start: number,
): { image: GifImageLocation; transparentIndex: number | undefined } | undefined {
	let pos = start;
	let transparentIndex: number | undefined;
	while (pos < data.length) {
		const marker = data[pos]!;
		if (marker === 0x21) {
			// Extension block: label byte, then sub-blocks.
			const label = data[pos + 1]!;
			pos += 2;
			if (label === 0xf9 && data[pos] === 4) {
				const packed = data[pos + 1]!;
				const hasTransparency = (packed & 0x01) !== 0;
				if (hasTransparency) {
					transparentIndex = data[pos + 4];
				}
			}
			// Skip sub-blocks.
			for (;;) {
				const len = data[pos]!;
				pos += 1 + len;
				if (len === 0 || pos >= data.length) {
					break;
				}
			}
		} else if (marker === 0x2c) {
			// Image Descriptor: separator, left, top, width, height, packed.
			const packed = data[pos + 9]!;
			let cursor = pos + 10;
			let localColorTable: Uint8Array | undefined;
			if (packed & 0x80) {
				const size = 2 << (packed & 0x07);
				localColorTable = data.subarray(cursor, cursor + size * 3);
				cursor += size * 3;
			}
			const minCodeSize = data[cursor]!;
			cursor += 1;
			return { image: { subBlocksStart: cursor, minCodeSize, localColorTable }, transparentIndex };
		} else {
			return undefined;
		}
	}
	return undefined;
}

/**
 * Decode a GIF's pixel (0,0) synchronously with no DOM. Returns `undefined`
 * for an unrecognised/unsupported GIF or a fully transparent first pixel.
 */
export function decodeGifFirstPixel(
	bytes: Uint8Array,
): { r: number; g: number; b: number; a: number } | undefined {
	if (bytes.length < 13) {
		return undefined;
	}
	const sig = String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!, bytes[4]!, bytes[5]!);
	if (sig !== 'GIF87a' && sig !== 'GIF89a') {
		return undefined;
	}
	const packed = bytes[10]!;
	let pos = 13;
	let globalColorTable: Uint8Array | undefined;
	if (packed & 0x80) {
		const size = 2 << (packed & 0x07);
		globalColorTable = bytes.subarray(pos, pos + size * 3);
		pos += size * 3;
	}

	const located = locateFirstImage(bytes, pos);
	if (!located) {
		return undefined;
	}
	const { image, transparentIndex } = located;
	const index = readFirstColorIndex(bytes, image.subBlocksStart, image.minCodeSize);
	if (index === undefined) {
		return undefined;
	}
	const table = image.localColorTable ?? globalColorTable;
	if (!table || table.length < (index + 1) * 3) {
		return undefined;
	}
	if (transparentIndex === index) {
		return undefined;
	}
	return { r: table[index * 3]!, g: table[index * 3 + 1]!, b: table[index * 3 + 2]!, a: 255 };
}
