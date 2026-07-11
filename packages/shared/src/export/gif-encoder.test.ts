/**
 * Unit tests for the shared GIF89a encoder + pure planning helpers.
 *
 * Covers the planning helpers (planGifFrames, msToFrameDelayCs,
 * clampGifDimensions) and structural validation of the encoder output (no
 * browser APIs required — ImageData is stubbed). Exercises both the numeric
 * `delayCs` call style (React/Vue) and the options-object style (Angular).
 */

import { describe, expect, it } from 'vitest';

import { clampGifDimensions, encodeGif, msToFrameDelayCs, planGifFrames } from './gif-encoder';

/** Create a minimal ImageData-like object with a uniform colour. */
function makeImageData(
	width: number,
	height: number,
	r: number,
	g: number,
	b: number,
	a: number = 255,
): ImageData {
	const data = new Uint8ClampedArray(width * height * 4);
	for (let i = 0; i < width * height; i++) {
		data[i * 4] = r;
		data[i * 4 + 1] = g;
		data[i * 4 + 2] = b;
		data[i * 4 + 3] = a;
	}
	return { data, width, height, colorSpace: 'srgb' } as ImageData;
}

/** Create an ImageData with a simple gradient (varying red + green channels). */
function makeGradientImageData(width: number, height: number): ImageData {
	const data = new Uint8ClampedArray(width * height * 4);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const i = (y * width + x) * 4;
			data[i] = Math.floor((x / width) * 255);
			data[i + 1] = Math.floor((y / height) * 255);
			data[i + 2] = 128;
			data[i + 3] = 255;
		}
	}
	return { data, width, height, colorSpace: 'srgb' } as ImageData;
}

describe('planGifFrames', () => {
	it('returns one plan per slide in order', () => {
		const plans = planGifFrames({ totalSlides: 3 });
		expect(plans).toHaveLength(3);
		expect(plans[0].slideIndex).toBe(0);
		expect(plans[1].slideIndex).toBe(1);
		expect(plans[2].slideIndex).toBe(2);
	});

	it('converts default 2000 ms to 200 cs', () => {
		const plans = planGifFrames({ totalSlides: 2 });
		expect(plans[0].delayCs).toBe(200);
		expect(plans[1].delayCs).toBe(200);
	});

	it('converts a custom slideDurationMs correctly', () => {
		const plans = planGifFrames({ totalSlides: 1, slideDurationMs: 3000 });
		expect(plans[0].delayCs).toBe(300);
	});

	it('applies per-slide timing overrides', () => {
		const plans = planGifFrames({
			totalSlides: 3,
			slideDurationMs: 2000,
			slideTimingsMs: [1000, undefined as unknown as number, 5000],
		});
		expect(plans[0].delayCs).toBe(100); // 1000 ms override
		expect(plans[1].delayCs).toBe(200); // fallback
		expect(plans[2].delayCs).toBe(500); // 5000 ms override
	});

	it('clamps tiny durations to a minimum of 1 cs', () => {
		const plans = planGifFrames({ totalSlides: 1, slideDurationMs: 1 });
		expect(plans[0].delayCs).toBeGreaterThanOrEqual(1);
	});

	it('returns an empty array for totalSlides = 0', () => {
		expect(planGifFrames({ totalSlides: 0 })).toHaveLength(0);
	});

	it('rounds fractional centiseconds', () => {
		const plans = planGifFrames({ totalSlides: 1, slideDurationMs: 2050 });
		expect(plans[0].delayCs).toBe(205);
	});
});

describe('msToFrameDelayCs', () => {
	it('converts 2000 ms to 200 cs', () => {
		expect(msToFrameDelayCs(2000)).toBe(200);
	});

	it('converts 1500 ms to 150 cs', () => {
		expect(msToFrameDelayCs(1500)).toBe(150);
	});

	it('rounds 155 ms to 16 cs', () => {
		expect(msToFrameDelayCs(155)).toBe(16);
	});

	it('clamps 0 ms to 1 cs', () => {
		expect(msToFrameDelayCs(0)).toBe(1);
	});

	it('clamps 5 ms (0.5 cs, rounds to 1) to 1 cs', () => {
		expect(msToFrameDelayCs(5)).toBe(1);
	});

	it('handles large values', () => {
		expect(msToFrameDelayCs(60000)).toBe(6000);
	});
});

describe('clampGifDimensions', () => {
	it('leaves dimensions unchanged when both are within the limit', () => {
		expect(clampGifDimensions(800, 600)).toStrictEqual({ width: 800, height: 600 });
	});

	it('leaves dimensions unchanged at exactly the limit', () => {
		expect(clampGifDimensions(1920, 1080)).toStrictEqual({ width: 1920, height: 1080 });
	});

	it('scales down when width exceeds the default 1920 limit', () => {
		const result = clampGifDimensions(3840, 2160);
		expect(result.width).toBe(1920);
		expect(result.height).toBe(1080);
	});

	it('scales down when height exceeds the limit', () => {
		const result = clampGifDimensions(1080, 2160, 1920);
		expect(result.height).toBe(1920);
		expect(result.width).toBe(960);
	});

	it('preserves the aspect ratio when clamping', () => {
		const result = clampGifDimensions(4000, 3000, 1000);
		const ratio = result.width / result.height;
		expect(ratio).toBeCloseTo(4 / 3, 5);
	});

	it('respects a custom maxSide', () => {
		const result = clampGifDimensions(1000, 500, 200);
		expect(result.width).toBeLessThanOrEqual(200);
		expect(result.height).toBeLessThanOrEqual(200);
	});

	it('returns whole-pixel (floor) values', () => {
		const result = clampGifDimensions(3000, 2000, 1024);
		expect(Number.isInteger(result.width)).toBeTruthy();
		expect(Number.isInteger(result.height)).toBeTruthy();
	});
});

describe('encodeGif', () => {
	it('produces a valid GIF89a header', () => {
		const frame = { imageData: makeImageData(2, 2, 255, 0, 0), width: 2, height: 2 };
		const result = encodeGif([frame], 200);
		const header = String.fromCharCode(...result.slice(0, 6));
		expect(header).toBe('GIF89a');
	});

	it('encodes logical screen width and height (little-endian)', () => {
		const frame = { imageData: makeImageData(100, 50, 0, 255, 0), width: 100, height: 50 };
		const result = encodeGif([frame], 200);
		const w = result[6] | (result[7] << 8);
		const h = result[8] | (result[9] << 8);
		expect(w).toBe(100);
		expect(h).toBe(50);
	});

	it('includes the Netscape looping extension', () => {
		const frame = { imageData: makeImageData(2, 2, 0, 0, 255), width: 2, height: 2 };
		const result = encodeGif([frame], 200);
		const asString = Array.from(result)
			.map((b) => String.fromCharCode(b))
			.join('');
		expect(asString).toContain('NETSCAPE2.0');
	});

	it('ends with the GIF trailer byte 0x3B', () => {
		const frame = { imageData: makeImageData(2, 2, 128, 128, 128), width: 2, height: 2 };
		const result = encodeGif([frame], 200);
		expect(result[result.length - 1]).toBe(0x3b);
	});

	it('returns a Uint8Array with non-zero length', () => {
		const frame = { imageData: makeImageData(2, 2, 0, 0, 0), width: 2, height: 2 };
		const result = encodeGif([frame], 200);
		expect(result).toBeInstanceOf(Uint8Array);
		expect(result.length).toBeGreaterThan(0);
	});

	it('encodes multiple frames and produces larger output than a single frame', () => {
		const f1 = { imageData: makeImageData(4, 4, 255, 0, 0), width: 4, height: 4 };
		const f2 = { imageData: makeImageData(4, 4, 0, 255, 0), width: 4, height: 4 };
		const f3 = { imageData: makeImageData(4, 4, 0, 0, 255), width: 4, height: 4 };
		const multi = encodeGif([f1, f2, f3], 200);
		const single = encodeGif([f1], 200);
		expect(multi.length).toBeGreaterThan(single.length);
		expect(multi[multi.length - 1]).toBe(0x3b);
	});

	it('contains one image descriptor marker (0x2C) per frame', () => {
		const frames = [
			{ imageData: makeImageData(2, 2, 255, 0, 0), width: 2, height: 2 },
			{ imageData: makeImageData(2, 2, 0, 255, 0), width: 2, height: 2 },
		];
		const result = encodeGif(frames, 200);
		let count = 0;
		for (let i = 13; i < result.length; i++) {
			if (result[i] === 0x2c) {
				count++;
			}
		}
		expect(count).toBe(2);
	});

	it('encodes the delay centiseconds via the numeric call style', () => {
		const frame = { imageData: makeImageData(2, 2, 0, 0, 0), width: 2, height: 2 };
		const result = encodeGif([frame], 100);
		const gceIdx = findGce(result);
		expect(gceIdx).toBeGreaterThan(0);
		const delay = result[gceIdx + 4] | (result[gceIdx + 5] << 8);
		expect(delay).toBe(100);
	});

	it('encodes the delay centiseconds via the options call style', () => {
		const frame = { imageData: makeImageData(2, 2, 0, 0, 0), width: 2, height: 2 };
		const result = encodeGif([frame], { delayCs: 100 });
		const gceIdx = findGce(result);
		expect(gceIdx).toBeGreaterThan(0);
		const delay = result[gceIdx + 4] | (result[gceIdx + 5] << 8);
		expect(delay).toBe(100);
	});

	it('honours per-frame delayCs overrides over the encoder-level delay', () => {
		const frames = [
			{ imageData: makeImageData(2, 2, 0, 0, 0), width: 2, height: 2, delayCs: 50 },
			{ imageData: makeImageData(2, 2, 255, 255, 255), width: 2, height: 2 },
			{ imageData: makeImageData(2, 2, 0, 0, 255), width: 2, height: 2, delayCs: 300 },
		];
		const result = encodeGif(frames, { delayCs: 200 });
		const delays: number[] = [];
		for (let i = 0; i < result.length - 6; i++) {
			if (result[i] === 0x21 && result[i + 1] === 0xf9 && result[i + 2] === 0x04) {
				delays.push(result[i + 4] | (result[i + 5] << 8));
			}
		}
		expect(delays).toStrictEqual([50, 200, 300]);
	});

	it('sets the local colour table flag in each image descriptor', () => {
		const frame = { imageData: makeImageData(2, 2, 200, 100, 50), width: 2, height: 2 };
		const result = encodeGif([frame], 200);
		let imgDescIdx = -1;
		for (let i = 20; i < result.length; i++) {
			if (result[i] === 0x2c) {
				imgDescIdx = i;
				break;
			}
		}
		expect(imgDescIdx).toBeGreaterThan(0);
		expect(result[imgDescIdx + 9] & 0x80).toBe(0x80);
	});

	it('handles a 1×1 image without crashing', () => {
		const frame = { imageData: makeImageData(1, 1, 127, 127, 127), width: 1, height: 1 };
		const result = encodeGif([frame], 200);
		expect(result.length).toBeGreaterThan(0);
		expect(result[result.length - 1]).toBe(0x3b);
	});

	it('handles gradient images without crashing', () => {
		const frame = { imageData: makeGradientImageData(10, 10), width: 10, height: 10 };
		const result = encodeGif([frame], 200);
		expect(result.length).toBeGreaterThan(0);
		const header = String.fromCharCode(...result.slice(0, 6));
		expect(header).toBe('GIF89a');
	});

	it('throws when frames array is empty', () => {
		expect(() => encodeGif([], 200)).toThrow();
	});

	it('uses loopCount = 0 (loop forever) by default', () => {
		const frame = { imageData: makeImageData(2, 2, 0, 0, 0), width: 2, height: 2 };
		const result = encodeGif([frame], 200);
		const asString = Array.from(result)
			.map((b) => String.fromCharCode(b))
			.join('');
		const nsIdx = asString.indexOf('NETSCAPE2.0');
		expect(nsIdx).toBeGreaterThan(0);
		const loopLo = result[nsIdx + 11 + 2];
		const loopHi = result[nsIdx + 11 + 3];
		const loopCount = loopLo | (loopHi << 8);
		expect(loopCount).toBe(0);
	});
});

/** Locate the Graphic Control Extension marker (0x21 0xF9 0x04). */
function findGce(bytes: Uint8Array): number {
	for (let i = 0; i < bytes.length - 6; i++) {
		if (bytes[i] === 0x21 && bytes[i + 1] === 0xf9 && bytes[i + 2] === 0x04) {
			return i;
		}
	}
	return -1;
}
