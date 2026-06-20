import { describe, it, expect } from 'vitest';

import { encodeGif } from './export-gif-encoder';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a minimal ImageData-like object with uniform colour.
 */
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

/**
 * Create an ImageData with a simple gradient (varying red channel).
 */
function makeGradientImageData(width: number, height: number): ImageData {
	const data = new Uint8ClampedArray(width * height * 4);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const i = (y * width + x) * 4;
			data[i] = Math.floor((x / width) * 255); // R gradient
			data[i + 1] = Math.floor((y / height) * 255); // G gradient
			data[i + 2] = 128; // B constant
			data[i + 3] = 255; // A
		}
	}
	return { data, width, height, colorSpace: 'srgb' } as ImageData;
}

// ---------------------------------------------------------------------------
// encodeGif: structural validation
// ---------------------------------------------------------------------------

describe('encodeGif', () => {
	it('produces a valid GIF89a header', () => {
		const frame = {
			imageData: makeImageData(2, 2, 255, 0, 0),
			width: 2,
			height: 2,
		};
		const result = encodeGif([frame], 10);

		// GIF89a magic bytes
		const header = String.fromCharCode(...result.slice(0, 6));
		expect(header).toBe('GIF89a');
	});

	it('encodes the logical screen width and height (little-endian)', () => {
		const frame = {
			imageData: makeImageData(100, 50, 0, 255, 0),
			width: 100,
			height: 50,
		};
		const result = encodeGif([frame], 10);

		// Width at bytes 6-7 (little-endian)
		const width = result[6] | (result[7] << 8);
		expect(width).toBe(100);

		// Height at bytes 8-9 (little-endian)
		const height = result[8] | (result[9] << 8);
		expect(height).toBe(50);
	});

	it('includes the Netscape looping extension', () => {
		const frame = {
			imageData: makeImageData(2, 2, 0, 0, 255),
			width: 2,
			height: 2,
		};
		const result = encodeGif([frame], 10);

		// Search for "NETSCAPE2.0" in the output
		const asString = Array.from(result)
			.map((b) => String.fromCharCode(b))
			.join('');
		expect(asString).toContain('NETSCAPE2.0');
	});

	it('ends with the GIF trailer byte 0x3B', () => {
		const frame = {
			imageData: makeImageData(2, 2, 128, 128, 128),
			width: 2,
			height: 2,
		};
		const result = encodeGif([frame], 10);

		expect(result[result.length - 1]).toBe(0x3b);
	});

	it('returns a Uint8Array', () => {
		const frame = {
			imageData: makeImageData(2, 2, 0, 0, 0),
			width: 2,
			height: 2,
		};
		const result = encodeGif([frame], 10);

		expect(result).toBeInstanceOf(Uint8Array);
		expect(result.length).toBeGreaterThan(0);
	});

	it('encodes multiple frames', () => {
		const frame1 = {
			imageData: makeImageData(4, 4, 255, 0, 0),
			width: 4,
			height: 4,
		};
		const frame2 = {
			imageData: makeImageData(4, 4, 0, 255, 0),
			width: 4,
			height: 4,
		};
		const frame3 = {
			imageData: makeImageData(4, 4, 0, 0, 255),
			width: 4,
			height: 4,
		};

		const result = encodeGif([frame1, frame2, frame3], 50);

		// The multi-frame output should be larger than single-frame
		const singleResult = encodeGif([frame1], 50);
		expect(result.length).toBeGreaterThan(singleResult.length);

		// Still a valid GIF with header and trailer
		const header = String.fromCharCode(...result.slice(0, 6));
		expect(header).toBe('GIF89a');
		expect(result[result.length - 1]).toBe(0x3b);
	});

	it('contains image descriptor markers (0x2C) for each frame', () => {
		const frames = [
			{ imageData: makeImageData(2, 2, 255, 0, 0), width: 2, height: 2 },
			{ imageData: makeImageData(2, 2, 0, 255, 0), width: 2, height: 2 },
		];
		const result = encodeGif(frames, 10);

		// Count occurrences of the image descriptor marker 0x2C
		// Each frame should have one (preceded by graphic control extension)
		let count = 0;
		for (let i = 13; i < result.length; i++) {
			// Skip header/netscape area (first ~30 bytes)
			if (result[i] === 0x2c) {
				count++;
			}
		}
		expect(count).toBe(2);
	});

	it('handles gradient images without crashing', () => {
		const frame = {
			imageData: makeGradientImageData(10, 10),
			width: 10,
			height: 10,
		};
		const result = encodeGif([frame], 20);

		expect(result.length).toBeGreaterThan(0);
		const header = String.fromCharCode(...result.slice(0, 6));
		expect(header).toBe('GIF89a');
	});

	it('encodes the delay in centiseconds in the GCE', () => {
		const frame = {
			imageData: makeImageData(2, 2, 0, 0, 0),
			width: 2,
			height: 2,
		};
		const result = encodeGif([frame], 100);

		// Find the Graphic Control Extension (0x21 0xF9 0x04)
		let gceIdx = -1;
		for (let i = 0; i < result.length - 6; i++) {
			if (result[i] === 0x21 && result[i + 1] === 0xf9 && result[i + 2] === 0x04) {
				gceIdx = i;
				break;
			}
		}
		expect(gceIdx).toBeGreaterThan(0);

		// Delay is at bytes gceIdx+4 and gceIdx+5 (little-endian)
		const delay = result[gceIdx + 4] | (result[gceIdx + 5] << 8);
		expect(delay).toBe(100);
	});

	it('produces output with local colour tables (256 entries)', () => {
		const frame = {
			imageData: makeImageData(2, 2, 200, 100, 50),
			width: 2,
			height: 2,
		};
		const result = encodeGif([frame], 10);

		// The local colour table flag is in the image descriptor packed byte.
		// Find image descriptor (0x2C) after the Netscape extension
		let imgDescIdx = -1;
		for (let i = 20; i < result.length; i++) {
			if (result[i] === 0x2c) {
				imgDescIdx = i;
				break;
			}
		}
		expect(imgDescIdx).toBeGreaterThan(0);

		// Packed byte at imgDescIdx + 9 should have local colour table flag set
		const packed = result[imgDescIdx + 9];
		expect(packed & 0x80).toBe(0x80); // local colour table present
	});

	it('handles a 1x1 image', () => {
		const frame = {
			imageData: makeImageData(1, 1, 127, 127, 127),
			width: 1,
			height: 1,
		};
		const result = encodeGif([frame], 10);

		expect(result.length).toBeGreaterThan(0);
		expect(result[result.length - 1]).toBe(0x3b);
	});
});
