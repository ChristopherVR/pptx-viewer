import { describe, expect, it } from 'vitest';

import { decodeJpegFirstPixel } from './image-first-pixel-jpeg';

/** MSB-first bit packer for hand-building entropy-coded JPEG test data. */
class BitPacker {
	private bits: number[] = [];
	push(value: number, count: number): void {
		for (let i = count - 1; i >= 0; i--) {
			this.bits.push((value >> i) & 1);
		}
	}
	toBytes(): number[] {
		const out: number[] = [];
		let byte = 0;
		let count = 0;
		for (const bit of this.bits) {
			byte = (byte << 1) | bit;
			count++;
			if (count === 8) {
				out.push(byte);
				byte = 0;
				count = 0;
			}
		}
		if (count > 0) {
			out.push(byte << (8 - count));
		}
		return out;
	}
}

function bitLength(value: number): number {
	if (value === 0) {
		return 0;
	}
	return 32 - Math.clz32(value);
}

function marker(code: number, payload: number[]): number[] {
	const length = payload.length + 2;
	return [0xff, code, (length >> 8) & 0xff, length & 0xff, ...payload];
}

/**
 * Build a minimal single-scan baseline JPEG (1 or 3 components, no chroma
 * subsampling) whose 8x8 block(s) carry ONLY a DC coefficient (all AC = 0,
 * i.e. a solid-colour block): DC (quant=1) satisfies
 * `outputSample = dcDiff / 8` (see this decoder's module doc for the corner
 * IDCT derivation), so the expected decoded byte is
 * `clamp(round(dcDiff / 8) + 128)`.
 *
 * Each component gets its OWN trivial 1-code DC/AC Huffman table sized to
 * exactly its own DC value's category, so every component can use a
 * different `dcDiff` in the multi-component test below.
 */
function buildSolidJpeg(dcDiffs: number[]): Uint8Array {
	const numComponents = dcDiffs.length;
	const bytes: number[] = [0xff, 0xd8]; // SOI

	// DQT: one identity table (id 0).
	bytes.push(...marker(0xdb, [0x00, ...new Array(64).fill(1)]));

	// SOF0.
	const sofPayload = [8, 0, 8, 0, 8, numComponents];
	for (let i = 0; i < numComponents; i++) {
		sofPayload.push(i + 1, 0x11, 0); // id, 1x1 sampling, quant table 0
	}
	bytes.push(...marker(0xc0, sofPayload));

	// DC/AC Huffman tables, one pair PER component (table id = component index).
	for (let i = 0; i < numComponents; i++) {
		const size = bitLength(Math.abs(dcDiffs[i]!));
		const dcBits = new Array(16).fill(0);
		dcBits[0] = 1; // one code of length 1
		bytes.push(...marker(0xc4, [0x00 | i, ...dcBits, size]));
		const acBits = new Array(16).fill(0);
		acBits[0] = 1;
		bytes.push(...marker(0xc4, [0x10 | i, ...acBits, 0x00])); // EOB symbol
	}

	// SOS.
	const sosPayload = [numComponents];
	for (let i = 0; i < numComponents; i++) {
		sosPayload.push(i + 1, (i << 4) | i); // component id, dcTableId=acTableId=i
	}
	sosPayload.push(0, 63, 0);
	bytes.push(...marker(0xda, sosPayload));

	const packer = new BitPacker();
	for (const dcDiff of dcDiffs) {
		const size = bitLength(Math.abs(dcDiff));
		packer.push(0, 1); // DC Huffman code (the table's only code: "0")
		if (size > 0) {
			const raw = dcDiff >= 0 ? dcDiff : dcDiff + (1 << size) - 1;
			packer.push(raw, size);
		}
		packer.push(0, 1); // AC Huffman code for EOB (the table's only code: "0")
	}
	bytes.push(...packer.toBytes());
	bytes.push(0xff, 0xd9); // EOI

	return new Uint8Array(bytes);
}

describe('decodeJpegFirstPixel', () => {
	it('reads (0,0) from a solid-colour grayscale (1-component) JPEG', () => {
		// dcDiff = 400 -> output = 400/8 = 50 -> +128 = 178.
		const jpeg = buildSolidJpeg([400]);
		expect(decodeJpegFirstPixel(jpeg)).toStrictEqual({ r: 178, g: 178, b: 178, a: 255 });
	});

	it('reads (0,0) from a negative-DC grayscale JPEG (darker than mid-grey)', () => {
		// dcDiff = -256 -> output = -32 -> +128 = 96.
		const jpeg = buildSolidJpeg([-256]);
		expect(decodeJpegFirstPixel(jpeg)).toStrictEqual({ r: 96, g: 96, b: 96, a: 255 });
	});

	it('reads (0,0) from a 3-component (YCbCr) JPEG and converts to RGB', () => {
		// Y diff=800 -> Y=228; Cb diff=0 -> Cb=128; Cr diff=400 -> Cr=178.
		// R = Y + 1.402*(Cr-128) = 228 + 1.402*50 = 298.1 -> clamp 255.
		// G = Y - 0.344136*(Cb-128) - 0.714136*(Cr-128) = 228 - 0 - 35.7 = 192.3 -> 192.
		// B = Y + 1.772*(Cb-128) = 228 + 0 = 228.
		const jpeg = buildSolidJpeg([800, 0, 400]);
		expect(decodeJpegFirstPixel(jpeg)).toStrictEqual({ r: 255, g: 192, b: 228, a: 255 });
	});

	it('uses the FIRST block of a 2x1-subsampled component, not the second', () => {
		// One component, hSampling=2/vSampling=1: two luma blocks per MCU. Block 0
		// carries dcDiff=400 (expect 178); block 1 carries a very different value
		// (-256) that must be decoded (to advance the bitstream) but NOT used for
		// pixel (0,0), which only ever reads the component's first block.
		const bytes: number[] = [0xff, 0xd8];
		bytes.push(...marker(0xdb, [0x00, ...new Array(64).fill(1)]));
		bytes.push(...marker(0xc0, [8, 0, 8, 0, 16, 1, 1, 0x21, 0])); // 2x1 sampling
		const dcBits = new Array(16).fill(0);
		dcBits[0] = 1;
		bytes.push(...marker(0xc4, [0x00, ...dcBits, 9])); // DC table: 1 code, size-9 symbol
		const acBits = new Array(16).fill(0);
		acBits[0] = 1;
		bytes.push(...marker(0xc4, [0x10, ...acBits, 0x00])); // AC table: 1 code, EOB symbol
		bytes.push(...marker(0xda, [1, 1, 0x00, 0, 63, 0]));

		const packer = new BitPacker();
		// Block 0: dcDiff = 400 (size 9, positive -> raw bits = value).
		packer.push(0, 1);
		packer.push(400, 9);
		packer.push(0, 1); // EOB
		// Block 1: dcDiff = -256 would need size 9 too (category [256,511]); reuse
		// the same 1-code table (size symbol is fixed at 9 regardless of sign).
		packer.push(0, 1);
		const size = 9;
		const raw = -256 + (1 << size) - 1;
		packer.push(raw, size);
		packer.push(0, 1); // EOB
		bytes.push(...packer.toBytes());
		bytes.push(0xff, 0xd9);

		expect(decodeJpegFirstPixel(new Uint8Array(bytes))).toStrictEqual({
			r: 178,
			g: 178,
			b: 178,
			a: 255,
		});
	});

	it('returns undefined for a progressive (SOF2) JPEG', () => {
		const bytes: number[] = [0xff, 0xd8];
		bytes.push(...marker(0xdb, [0x00, ...new Array(64).fill(1)]));
		bytes.push(...marker(0xc2, [8, 0, 8, 0, 8, 1, 1, 0x11, 0]));
		bytes.push(0xff, 0xd9);
		expect(decodeJpegFirstPixel(new Uint8Array(bytes))).toBeUndefined();
	});

	it('returns undefined for non-JPEG bytes', () => {
		expect(decodeJpegFirstPixel(new Uint8Array([1, 2, 3, 4]))).toBeUndefined();
	});

	it('returns undefined for a truncated JPEG (no SOS reached)', () => {
		const bytes = [0xff, 0xd8, 0xff, 0xd9];
		expect(decodeJpegFirstPixel(new Uint8Array(bytes))).toBeUndefined();
	});
});
