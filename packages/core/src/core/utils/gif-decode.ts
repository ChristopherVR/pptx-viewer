/**
 * Synchronous, DOM-free GIF first-frame decoder: GIF bytes -> RGBA8 pixels
 * at the logical-screen size.
 *
 * Used by the legacy binary `.ppt` writer, which has no GIF BLIP type
 * ([MS-ODRAW] 2.2.23 lists EMF/WMF/PICT/JPEG/PNG/DIB/TIFF only) and so
 * re-encodes a GIF as PNG, exactly as PowerPoint's own 97-2003 SaveAs does
 * (COM-measured: a `.gif` picture is stored as an `OfficeArtBlipPNG`). Only
 * the first frame is decoded; an animated GIF keeps its first frame, the
 * same still PowerPoint 97-2003 shows.
 *
 * Pixels outside the first frame's image rectangle, and pixels whose index
 * is the Graphic Control Extension's transparent index, are fully
 * transparent.
 *
 * @module gif-decode
 */

/** A decoded GIF frame. */
export interface DecodedGif {
	width: number;
	height: number;
	/** `width * height * 4` bytes, row-major RGBA8. */
	rgba: Uint8Array;
}

/** Concatenate a run of GIF data sub-blocks starting at `pos`. */
function readSubBlocks(data: Uint8Array, pos: number): { bytes: Uint8Array; next: number } {
	const parts: Uint8Array[] = [];
	let total = 0;
	let cursor = pos;
	while (cursor < data.length) {
		const len = data[cursor]!;
		cursor += 1;
		if (len === 0) {
			break;
		}
		const part = data.subarray(cursor, cursor + len);
		parts.push(part);
		total += part.length;
		cursor += len;
	}
	const bytes = new Uint8Array(total);
	let offset = 0;
	for (const part of parts) {
		bytes.set(part, offset);
		offset += part.length;
	}
	return { bytes, next: cursor };
}

/** Decode a GIF LZW code stream into `pixelCount` colour indices. */
function lzwDecode(stream: Uint8Array, minCodeSize: number, pixelCount: number): Uint8Array {
	const out = new Uint8Array(pixelCount);
	const clearCode = 1 << minCodeSize;
	const endCode = clearCode + 1;
	const prefix = new Int32Array(4096);
	const suffix = new Uint8Array(4096);
	const firstChar = new Uint8Array(4096);
	const stack = new Uint8Array(4097);
	for (let i = 0; i < clearCode; i++) {
		prefix[i] = -1;
		suffix[i] = i;
		firstChar[i] = i;
	}
	let codeSize = minCodeSize + 1;
	let nextCode = clearCode + 2;
	let previous = -1;
	let bitBuf = 0;
	let bitCount = 0;
	let bytePos = 0;
	let written = 0;
	while (written < pixelCount) {
		while (bitCount < codeSize && bytePos < stream.length) {
			bitBuf |= stream[bytePos++]! << bitCount;
			bitCount += 8;
		}
		if (bitCount < codeSize) {
			break;
		}
		const code = bitBuf & ((1 << codeSize) - 1);
		bitBuf >>>= codeSize;
		bitCount -= codeSize;
		if (code === clearCode) {
			codeSize = minCodeSize + 1;
			nextCode = clearCode + 2;
			previous = -1;
			continue;
		}
		if (code === endCode) {
			break;
		}
		let current = code;
		let depth = 0;
		if (code >= nextCode) {
			if (previous < 0) {
				break; // malformed: a not-yet-defined code with no predecessor
			}
			stack[depth++] = firstChar[previous]!;
			current = previous;
		}
		while (current >= clearCode && depth < 4096) {
			stack[depth++] = suffix[current]!;
			current = prefix[current]!;
		}
		stack[depth++] = current;
		const first = current;
		while (depth > 0 && written < pixelCount) {
			out[written++] = stack[--depth]!;
		}
		if (previous >= 0 && nextCode < 4096) {
			prefix[nextCode] = previous;
			suffix[nextCode] = first;
			firstChar[nextCode] = firstChar[previous]!;
			nextCode++;
			if (nextCode === 1 << codeSize && codeSize < 12) {
				codeSize++;
			}
		}
		previous = code;
	}
	return out;
}

/** Map an interlaced row order (passes 0/8, 4/8, 2/4, 1/2) to display rows. */
function interlacedRows(height: number): number[] {
	const rows: number[] = [];
	for (const [start, step] of [
		[0, 8],
		[4, 8],
		[2, 4],
		[1, 2],
	] as const) {
		for (let y = start; y < height; y += step) {
			rows.push(y);
		}
	}
	return rows;
}

/**
 * Decode a GIF's first frame. Returns `undefined` for anything that is not
 * a well-formed GIF87a/GIF89a with at least one image.
 */
export function decodeGifFirstFrame(data: Uint8Array): DecodedGif | undefined {
	if (data.length < 13 || String.fromCharCode(...data.subarray(0, 3)) !== 'GIF') {
		return undefined;
	}
	const width = data[6]! | (data[7]! << 8);
	const height = data[8]! | (data[9]! << 8);
	if (width === 0 || height === 0) {
		return undefined;
	}
	const screenFlags = data[10]!;
	let pos = 13;
	let globalTable: Uint8Array | undefined;
	if (screenFlags & 0x80) {
		const size = 2 << (screenFlags & 0x07);
		globalTable = data.subarray(pos, pos + size * 3);
		pos += size * 3;
	}
	let transparentIndex = -1;
	while (pos < data.length) {
		const marker = data[pos]!;
		if (marker === 0x21) {
			const label = data[pos + 1]!;
			if (label === 0xf9 && data[pos + 2] === 4 && (data[pos + 3]! & 0x01) !== 0) {
				transparentIndex = data[pos + 6]!;
			}
			pos = readSubBlocks(data, pos + 2).next;
		} else if (marker === 0x2c) {
			if (pos + 10 > data.length) {
				return undefined;
			}
			const left = data[pos + 1]! | (data[pos + 2]! << 8);
			const top = data[pos + 3]! | (data[pos + 4]! << 8);
			const frameW = data[pos + 5]! | (data[pos + 6]! << 8);
			const frameH = data[pos + 7]! | (data[pos + 8]! << 8);
			const flags = data[pos + 9]!;
			pos += 10;
			let table = globalTable;
			if (flags & 0x80) {
				const size = 2 << (flags & 0x07);
				table = data.subarray(pos, pos + size * 3);
				pos += size * 3;
			}
			if (!table) {
				return undefined;
			}
			const minCodeSize = data[pos]!;
			if (minCodeSize < 1 || minCodeSize > 11) {
				return undefined;
			}
			const { bytes } = readSubBlocks(data, pos + 1);
			const indices = lzwDecode(bytes, minCodeSize, frameW * frameH);
			const rowOrder = flags & 0x40 ? interlacedRows(frameH) : undefined;
			const rgba = new Uint8Array(width * height * 4);
			for (let row = 0; row < frameH; row++) {
				const y = top + (rowOrder ? rowOrder[row]! : row);
				for (let col = 0; col < frameW; col++) {
					const x = left + col;
					const index = indices[row * frameW + col]!;
					if (x >= width || y >= height || index === transparentIndex) {
						continue;
					}
					const o = (y * width + x) * 4;
					rgba[o] = table[index * 3] ?? 0;
					rgba[o + 1] = table[index * 3 + 1] ?? 0;
					rgba[o + 2] = table[index * 3 + 2] ?? 0;
					rgba[o + 3] = 255;
				}
			}
			return { width, height, rgba };
		} else {
			return undefined;
		}
	}
	return undefined;
}
