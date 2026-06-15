/**
 * GIF export helpers for the Angular viewer.
 *
 * Source: ported from packages/react/src/viewer/utils/export-gif-encoder.ts
 * and packages/react/src/viewer/utils/export-gif.ts.
 *
 * Split into two concerns:
 *   1. Pure, browser-free planning helpers (frame ordering, per-frame delay
 *      computation, dimension clamping) — fully unit-testable.
 *   2. A thin browser-facing `encodeGif()` function that assembles an animated
 *      GIF89a Uint8Array from per-slide ImageData objects and a pre-computed
 *      frame delay.  The caller (ExportService) is responsible for rasterising
 *      slides to canvases and extracting ImageData via `ctx.getImageData()`.
 *
 * No external encoder dependency is required — the encoder is a self-contained
 * pure-JS GIF89a implementation (median-cut quantisation + LZW) that mirrors
 * the React package exactly.
 */

/* ================================================================== */
/*  1. Pure planning helpers                                           */
/* ================================================================== */

/**
 * A single GIF frame descriptor produced by the planning helpers.
 * The `imageData` field is filled in by the caller (ExportService) after
 * rasterising the corresponding slide.
 */
export interface GifFramePlan {
	/** 0-based slide index this frame corresponds to. */
	slideIndex: number;
	/** Frame delay in **centiseconds** (1 cs = 10 ms), as required by GIF89a. */
	delayCs: number;
}

/**
 * Options controlling GIF frame planning.
 */
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
 *
 * All timing is derived here; nothing browser-specific is touched.
 *
 * @param opts - Planning options.
 * @returns One {@link GifFramePlan} per slide, in slide order (0-based).
 *
 * @example
 * const plans = planGifFrames({ totalSlides: 5, slideDurationMs: 3000 });
 * // plans[0].slideIndex === 0, plans[0].delayCs === 300, …
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
 *
 * @param ms - Duration in milliseconds (must be > 0).
 * @returns Frame delay in centiseconds (integer ≥ 1).
 */
export function msToFrameDelayCs(ms: number): number {
	return Math.max(1, Math.round(ms / 10));
}

/**
 * Clamp canvas/image dimensions so neither side exceeds `maxSide` pixels
 * while preserving the aspect ratio.  When both dimensions are already within
 * the limit the original values are returned unchanged.
 *
 * GIF is limited to 65535 × 65535 but practical encoders perform best at
 * much smaller sizes (the React package defaults to 0.5× scale).  This
 * helper lets callers enforce a reasonable cap without coupling the logic to
 * a specific scale factor.
 *
 * @param width   - Original width in pixels.
 * @param height  - Original height in pixels.
 * @param maxSide - Maximum permitted dimension on either axis (default 1920).
 * @returns `{ width, height }` clamped to `maxSide`, floored to whole pixels.
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

/* ================================================================== */
/*  2. GIF89a Encoder (pure JS, no dependencies)                      */
/*                                                                    */
/*  Mirrors packages/react/src/viewer/utils/export-gif-encoder.ts    */
/*  exactly — median-cut colour quantisation + LZW compression.       */
/* ================================================================== */

/**
 * A single animated GIF frame: raw RGBA pixel data plus its dimensions.
 */
export interface GifFrame {
	imageData: ImageData;
	width: number;
	height: number;
}

/**
 * Options for {@link encodeGif}.
 */
export interface EncodeGifOptions {
	/**
	 * Frame delay in **centiseconds** (1 cs = 10 ms).  All frames share the
	 * same delay; for per-frame delays compute them with {@link planGifFrames}
	 * and encode each frame separately.
	 *
	 * Default: 200 cs (2 s).
	 */
	delayCs?: number;
	/**
	 * Number of times the animation loops (0 = loop forever, default).
	 */
	loopCount?: number;
}

/**
 * Encode an ordered list of RGBA image frames into an animated GIF89a byte
 * sequence.
 *
 * Uses median-cut colour quantisation (256 colours per frame) and LZW
 * compression.  All frames must have identical dimensions.
 *
 * This function is browser-safe but does NOT require any browser API — it
 * operates on pre-extracted `ImageData` objects.  Callers must rasterise
 * slides to canvases themselves (see `ExportService.renderElement`).
 *
 * @param frames  - Ordered array of frame descriptors.
 * @param opts    - Encoding options.
 * @returns Raw GIF89a bytes.
 *
 * @example
 * // In ExportService:
 * const canvas = await this.renderElement(el, 0.5);
 * const ctx    = canvas.getContext('2d')!;
 * const id     = ctx.getImageData(0, 0, canvas.width, canvas.height);
 * const bytes  = encodeGif([{ imageData: id, width: canvas.width, height: canvas.height }]);
 * const blob   = new Blob([bytes.buffer], { type: 'image/gif' });
 */
export function encodeGif(frames: GifFrame[], opts: EncodeGifOptions = {}): Uint8Array {
	const { delayCs = 200, loopCount = 0 } = opts;

	if (frames.length === 0) {
		throw new Error('[gif-export-helpers] encodeGif: frames array must not be empty');
	}

	const width = frames[0].width;
	const height = frames[0].height;
	const out: number[] = [];

	// GIF89a Header
	_writeStr(out, 'GIF89a');

	// Logical Screen Descriptor
	_writeU16(out, width);
	_writeU16(out, height);
	out.push(0x70); // GCT flag=0, colour res=7, sorted=0, size=0
	out.push(0); // background colour index
	out.push(0); // pixel aspect ratio

	// Netscape extension for looping
	out.push(0x21, 0xff, 0x0b);
	_writeStr(out, 'NETSCAPE2.0');
	out.push(0x03, 0x01);
	_writeU16(out, loopCount);
	out.push(0x00);

	for (const frame of frames) {
		const { palette, indexed } = _quantizeFrame(frame.imageData);

		// Graphic Control Extension
		out.push(0x21, 0xf9, 0x04);
		out.push(0x00); // disposal=none, no transparency
		_writeU16(out, delayCs);
		out.push(0x00); // transparent colour index (unused)
		out.push(0x00); // block terminator

		// Image Descriptor
		out.push(0x2c);
		_writeU16(out, 0); // left
		_writeU16(out, 0); // top
		_writeU16(out, width);
		_writeU16(out, height);
		out.push(0x87); // local colour table, size=256 (2^(7+1))

		// Local Colour Table (256 entries × 3 bytes)
		for (let i = 0; i < 256; i++) {
			out.push(palette[i * 3] ?? 0);
			out.push(palette[i * 3 + 1] ?? 0);
			out.push(palette[i * 3 + 2] ?? 0);
		}

		// LZW compressed data
		const minCodeSize = 8;
		out.push(minCodeSize);
		const lzwData = _lzwEncode(indexed, minCodeSize);
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

/* ================================================================== */
/*  Internal encoder helpers (not exported)                           */
/* ================================================================== */

/** Write a 2-byte little-endian unsigned integer. */
function _writeU16(out: number[], value: number): void {
	out.push(value & 0xff);
	out.push((value >> 8) & 0xff);
}

/** Write an ASCII string byte-by-byte. */
function _writeStr(out: number[], str: string): void {
	for (let i = 0; i < str.length; i++) {
		out.push(str.charCodeAt(i));
	}
}

/** Quantize an RGBA ImageData to 256 colours using median-cut. */
function _quantizeFrame(imageData: ImageData): { palette: Uint8Array; indexed: Uint8Array } {
	const pixels = imageData.data;
	const numPixels = imageData.width * imageData.height;

	// Sample pixels (every Nth for large images)
	const sampleStep = Math.max(1, Math.floor(numPixels / 10000));
	const samples: Array<[number, number, number]> = [];
	for (let i = 0; i < numPixels; i += sampleStep) {
		const off = i * 4;
		samples.push([pixels[off], pixels[off + 1], pixels[off + 2]]);
	}

	const buckets = _medianCut(samples, 8);
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
		indexed[i] = _findNearest(centroids, pixels[off], pixels[off + 1], pixels[off + 2]);
	}

	return { palette, indexed };
}

/** Recursive median-cut colour quantisation. */
function _medianCut(
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
		..._medianCut(samples.slice(0, mid), depth - 1),
		..._medianCut(samples.slice(mid), depth - 1),
	];
}

/** Find the nearest palette colour index by squared Euclidean distance. */
function _findNearest(
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

/** LZW encode indexed pixel data for GIF. */
function _lzwEncode(indexed: Uint8Array, minCodeSize: number): Uint8Array {
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
