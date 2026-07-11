/**
 * Minimal GIF89a encoder (pure JS, no external dependency) plus pure
 * frame-planning helpers — shared by the React, Vue, and Angular bindings.
 *
 * The encoder uses median-cut colour quantisation (256 colours per frame) and
 * LZW compression. It carries no DOM/browser dependency — it operates on
 * pre-extracted `ImageData` objects — so each binding owns the rasterisation
 * (grabbing a canvas, calling `getImageData`) and the `Blob` wrapping, while
 * the byte encoding lives here once.
 *
 * No npm GIF library is depended on; this self-contained source replaces the
 * three previously-duplicated copies (React `export-gif-encoder.ts`, Vue
 * `gif-encoder.ts`, Angular `gif-export-helpers.ts`).
 */

/* ------------------------------------------------------------------ */
/*  Pure planning helpers                                              */
/* ------------------------------------------------------------------ */

/** A single GIF frame descriptor produced by the planning helpers. */
export interface GifFramePlan {
	/** 0-based slide index this frame corresponds to. */
	slideIndex: number;
	/** Frame delay in **centiseconds** (1 cs = 10 ms), as required by GIF89a. */
	delayCs: number;
}

/** Options controlling GIF frame planning. */
export interface GifPlanOptions {
	/** Total number of slides in the presentation. */
	totalSlides: number;
	/**
	 * Duration each slide is shown, in **milliseconds** (default: 2000).
	 * Per-slide overrides can be supplied via {@link slideTimingsMs}.
	 */
	slideDurationMs?: number;
	/**
	 * Per-slide duration overrides in milliseconds (index maps to slide index).
	 * When a slide's index is present here its value takes precedence over
	 * {@link slideDurationMs}.
	 */
	slideTimingsMs?: number[];
}

/**
 * Compute the ordered list of {@link GifFramePlan} objects for a presentation.
 * All timing is derived here; nothing browser-specific is touched.
 */
export function planGifFrames(opts: GifPlanOptions): GifFramePlan[] {
	const { totalSlides, slideDurationMs = 2000, slideTimingsMs } = opts;

	const plans: GifFramePlan[] = [];
	for (let i = 0; i < totalSlides; i++) {
		const ms = slideTimingsMs?.[i] ?? slideDurationMs;
		const delayCs = Math.max(1, Math.round(ms / 10));
		plans.push({ slideIndex: i, delayCs });
	}
	return plans;
}

/**
 * Convert a slide duration in milliseconds to a GIF89a frame delay in
 * centiseconds (1 cs = 10 ms), clamped to a minimum of 1 cs.
 */
export function msToFrameDelayCs(ms: number): number {
	return Math.max(1, Math.round(ms / 10));
}

/**
 * Clamp canvas/image dimensions so neither side exceeds `maxSide` pixels while
 * preserving the aspect ratio. When both dimensions are already within the
 * limit the original values are returned unchanged.
 */
export function clampGifDimensions(
	width: number,
	height: number,
	maxSide: number = 1920,
): { width: number; height: number } {
	if (width <= maxSide && height <= maxSide) {
		return { width, height };
	}
	const ratio = Math.min(maxSide / width, maxSide / height);
	return {
		width: Math.floor(width * ratio),
		height: Math.floor(height * ratio),
	};
}

/* ------------------------------------------------------------------ */
/*  GIF89a encoder                                                     */
/* ------------------------------------------------------------------ */

/** A single animated-GIF frame: raw RGBA pixels plus its dimensions. */
export interface GifFrame {
	imageData: ImageData;
	width: number;
	height: number;
	/**
	 * Optional per-frame delay in **centiseconds** (1 cs = 10 ms). When set it
	 * overrides the encoder-level delay for this frame only, which is how
	 * per-slide durations from {@link planGifFrames} flow into the encoder.
	 */
	delayCs?: number;
}

/** Options for {@link encodeGif}. */
export interface EncodeGifOptions {
	/**
	 * Frame delay in **centiseconds** (1 cs = 10 ms). Applies to every frame
	 * that does not carry its own {@link GifFrame.delayCs} override.
	 * Default: 200 cs (2 s).
	 */
	delayCs?: number;
	/** Number of times the animation loops (0 = loop forever, default). */
	loopCount?: number;
}

/**
 * Encode an ordered list of RGBA frames into an animated GIF89a byte sequence.
 *
 * Accepts either a bare `delayCs` number (React/Vue call style) or an
 * {@link EncodeGifOptions} object (Angular call style) as the second argument.
 *
 * @param frames Ordered frame descriptors (all must share identical dimensions).
 * @param delay  Per-frame delay in centiseconds, or an options object.
 * @returns Raw GIF89a bytes.
 */
export function encodeGif(frames: GifFrame[], delay: number | EncodeGifOptions = {}): Uint8Array {
	if (frames.length === 0) {
		throw new Error('[gif-encoder] encodeGif: frames array must not be empty');
	}

	const opts: EncodeGifOptions = typeof delay === 'number' ? { delayCs: delay } : delay;
	const { delayCs = 200, loopCount = 0 } = opts;

	const width = frames[0].width;
	const height = frames[0].height;
	const out: number[] = [];

	// GIF89a Header
	writeStr(out, 'GIF89a');

	// Logical Screen Descriptor
	writeU16(out, width);
	writeU16(out, height);
	out.push(0x70); // GCT flag=0, colour res=7, sorted=0, size=0
	out.push(0); // background colour index
	out.push(0); // pixel aspect ratio

	// Netscape extension for looping
	out.push(0x21, 0xff, 0x0b);
	writeStr(out, 'NETSCAPE2.0');
	out.push(0x03, 0x01);
	writeU16(out, loopCount);
	out.push(0x00);

	for (const frame of frames) {
		const { palette, indexed } = quantizeFrame(frame.imageData);

		// Graphic Control Extension
		out.push(0x21, 0xf9, 0x04);
		out.push(0x00); // disposal=none, no transparency
		writeU16(out, frame.delayCs ?? delayCs);
		out.push(0x00); // transparent colour index (unused)
		out.push(0x00); // block terminator

		// Image Descriptor
		out.push(0x2c);
		writeU16(out, 0); // left
		writeU16(out, 0); // top
		writeU16(out, width);
		writeU16(out, height);
		out.push(0x87); // local colour table, size=256 (2^(7+1))

		// Local Colour Table (256 entries * 3 bytes)
		for (let i = 0; i < 256; i++) {
			out.push(palette[i * 3] ?? 0);
			out.push(palette[i * 3 + 1] ?? 0);
			out.push(palette[i * 3 + 2] ?? 0);
		}

		// LZW compressed data
		const minCodeSize = 8;
		out.push(minCodeSize);
		const lzwData = lzwEncode(indexed, minCodeSize);
		// Write sub-blocks (max 255 bytes each)
		let offset = 0;
		while (offset < lzwData.length) {
			const chunkSize = Math.min(255, lzwData.length - offset);
			out.push(chunkSize);
			for (let j = 0; j < chunkSize; j++) {
				out.push(lzwData[offset + j]);
			}
			offset += chunkSize;
		}
		out.push(0x00); // block terminator
	}

	out.push(0x3b); // GIF trailer
	return new Uint8Array(out);
}

/* ------------------------------------------------------------------ */
/*  Low-level helpers                                                  */
/* ------------------------------------------------------------------ */

/** Write a 2-byte little-endian unsigned integer. */
function writeU16(out: number[], value: number): void {
	out.push(value & 0xff);
	out.push((value >> 8) & 0xff);
}

/** Write an ASCII string byte-by-byte. */
function writeStr(out: number[], str: string): void {
	for (let i = 0; i < str.length; i++) {
		out.push(str.charCodeAt(i));
	}
}

/* ------------------------------------------------------------------ */
/*  Median-cut colour quantization                                    */
/* ------------------------------------------------------------------ */

/** Quantize an RGBA ImageData to 256 colours using median-cut. */
function quantizeFrame(imageData: ImageData): { palette: Uint8Array; indexed: Uint8Array } {
	const pixels = imageData.data;
	const numPixels = imageData.width * imageData.height;

	// Sample pixels (every Nth for large images)
	const sampleStep = Math.max(1, Math.floor(numPixels / 10000));
	const samples: Array<[number, number, number]> = [];
	for (let i = 0; i < numPixels; i += sampleStep) {
		const off = i * 4;
		samples.push([pixels[off], pixels[off + 1], pixels[off + 2]]);
	}

	const buckets = medianCut(samples, 8);
	const palette = new Uint8Array(768);
	const centroids: Array<[number, number, number]> = [];

	for (let b = 0; b < 256; b++) {
		if (b < buckets.length && buckets[b].length > 0) {
			let rSum = 0,
				gSum = 0,
				bSum = 0;
			for (const [r, g, bl] of buckets[b]) {
				rSum += r;
				gSum += g;
				bSum += bl;
			}
			const len = buckets[b].length;
			const cr = Math.round(rSum / len);
			const cg = Math.round(gSum / len);
			const cb = Math.round(bSum / len);
			palette[b * 3] = cr;
			palette[b * 3 + 1] = cg;
			palette[b * 3 + 2] = cb;
			centroids.push([cr, cg, cb]);
		} else {
			centroids.push([0, 0, 0]);
		}
	}

	// Map every pixel to the nearest palette entry
	const indexed = new Uint8Array(numPixels);
	for (let i = 0; i < numPixels; i++) {
		const off = i * 4;
		indexed[i] = findNearest(centroids, pixels[off], pixels[off + 1], pixels[off + 2]);
	}

	return { palette, indexed };
}

/** Recursive median-cut colour quantisation. */
function medianCut(
	samples: Array<[number, number, number]>,
	depth: number,
): Array<Array<[number, number, number]>> {
	if (depth === 0 || samples.length <= 1) {
		return [samples];
	}

	let rMin = 255,
		rMax = 0,
		gMin = 255,
		gMax = 0,
		bMin = 255,
		bMax = 0;
	for (const [r, g, b] of samples) {
		if (r < rMin) {
			rMin = r;
		}
		if (r > rMax) {
			rMax = r;
		}
		if (g < gMin) {
			gMin = g;
		}
		if (g > gMax) {
			gMax = g;
		}
		if (b < bMin) {
			bMin = b;
		}
		if (b > bMax) {
			bMax = b;
		}
	}

	const rRange = rMax - rMin;
	const gRange = gMax - gMin;
	const bRange = bMax - bMin;

	let channel: 0 | 1 | 2 = 0;
	if (gRange >= rRange && gRange >= bRange) {
		channel = 1;
	} else if (bRange >= rRange && bRange >= gRange) {
		channel = 2;
	}

	samples.sort((a, b) => a[channel] - b[channel]);
	const mid = Math.floor(samples.length / 2);

	return [
		...medianCut(samples.slice(0, mid), depth - 1),
		...medianCut(samples.slice(mid), depth - 1),
	];
}

/** Find the nearest palette colour index by squared Euclidean distance. */
function findNearest(
	centroids: Array<[number, number, number]>,
	r: number,
	g: number,
	b: number,
): number {
	let bestIdx = 0;
	let bestDist = Infinity;
	for (let i = 0; i < centroids.length; i++) {
		const [cr, cg, cb] = centroids[i];
		const dist = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
		if (dist < bestDist) {
			bestDist = dist;
			bestIdx = i;
		}
	}
	return bestIdx;
}

/* ------------------------------------------------------------------ */
/*  LZW compression                                                   */
/* ------------------------------------------------------------------ */

/** LZW encode indexed pixel data for GIF (without sub-block framing). */
function lzwEncode(indexed: Uint8Array, minCodeSize: number): Uint8Array {
	const clearCode = 1 << minCodeSize;
	const eoiCode = clearCode + 1;
	const out: number[] = [];

	let codeSize = minCodeSize + 1;
	let nextCode = eoiCode + 1;
	const maxTableSize = 4096;

	const table = new Map<string, number>();
	const initTable = (): void => {
		table.clear();
		for (let i = 0; i < clearCode; i++) {
			table.set(String(i), i);
		}
		codeSize = minCodeSize + 1;
		nextCode = eoiCode + 1;
	};

	let bitBuf = 0;
	let bitCount = 0;
	const writeBits = (code: number, bits: number): void => {
		bitBuf |= code << bitCount;
		bitCount += bits;
		while (bitCount >= 8) {
			out.push(bitBuf & 0xff);
			bitBuf >>= 8;
			bitCount -= 8;
		}
	};

	initTable();
	writeBits(clearCode, codeSize);

	let current = String(indexed[0]);

	for (let i = 1; i < indexed.length; i++) {
		const next = `${current},${String(indexed[i])}`;
		if (table.has(next)) {
			current = next;
		} else {
			const currentCode = table.get(current);
			if (currentCode !== undefined) {
				writeBits(currentCode, codeSize);
			}
			if (nextCode < maxTableSize) {
				table.set(next, nextCode++);
				if (nextCode > 1 << codeSize && codeSize < 12) {
					codeSize++;
				}
			} else {
				writeBits(clearCode, codeSize);
				initTable();
			}
			current = String(indexed[i]);
		}
	}

	const finalCode = table.get(current);
	if (finalCode !== undefined) {
		writeBits(finalCode, codeSize);
	}
	writeBits(eoiCode, codeSize);

	if (bitCount > 0) {
		out.push(bitBuf & 0xff);
	}

	return new Uint8Array(out);
}
