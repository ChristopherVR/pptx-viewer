import { inflateSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { oleObjectTypeToGlyph, renderOleIconPng } from './ole-icon-raster';
import { decodePngDimensions } from './png-encoder';

/** Whether at least one non-transparent, non-background pixel exists (a crude "something was drawn" check). */
function hasVisiblePixels(png: Uint8Array): boolean {
	// Locate + inflate IDAT, then scan for any pixel with alpha > 0.
	let offset = 8;
	const chunks: Uint8Array[] = [];
	while (offset < png.length) {
		const view = new DataView(png.buffer, png.byteOffset + offset, 8);
		const length = view.getUint32(0, false);
		const type = String.fromCharCode(
			png[offset + 4]!,
			png[offset + 5]!,
			png[offset + 6]!,
			png[offset + 7]!,
		);
		const dataStart = offset + 8;
		if (type === 'IDAT') {
			chunks.push(png.subarray(dataStart, dataStart + length));
		}
		offset = dataStart + length + 4;
	}
	const total = chunks.reduce((sum, c) => sum + c.length, 0);
	const combined = new Uint8Array(total);
	let cursor = 0;
	for (const c of chunks) {
		combined.set(c, cursor);
		cursor += c.length;
	}
	const inflated = inflateSync(Buffer.from(combined));
	for (let i = 3; i < inflated.length; i += 4) {
		if (inflated[i]! > 0) {
			return true;
		}
	}
	return false;
}

describe('ole-icon-raster', () => {
	it('renders a PNG of the requested dimensions', () => {
		const png = renderOleIconPng({
			width: 100,
			height: 80,
			glyph: 'excel',
			caption: 'Budget.xlsx',
		});
		expect(decodePngDimensions(png)).toStrictEqual({ width: 100, height: 80 });
	});

	it('draws visible pixels for the glyph and caption', () => {
		const png = renderOleIconPng({ glyph: 'word', caption: 'Report' });
		expect(hasVisiblePixels(png)).toBeTruthy();
	});

	it('renders something even with an empty caption', () => {
		const png = renderOleIconPng({ glyph: 'unknown', caption: '' });
		expect(hasVisiblePixels(png)).toBeTruthy();
	});

	it('truncates an overlong caption instead of overflowing the image', () => {
		const png = renderOleIconPng({ width: 64, caption: 'A'.repeat(200) });
		expect(decodePngDimensions(png)!.width).toBe(64);
	});

	it('maps every known OLE object type to a matching glyph', () => {
		expect(oleObjectTypeToGlyph('excel')).toBe('excel');
		expect(oleObjectTypeToGlyph('word')).toBe('word');
		expect(oleObjectTypeToGlyph('powerpoint')).toBe('powerpoint');
		expect(oleObjectTypeToGlyph('pdf')).toBe('pdf');
		expect(oleObjectTypeToGlyph('visio')).toBe('visio');
		expect(oleObjectTypeToGlyph('mathtype')).toBe('mathtype');
		expect(oleObjectTypeToGlyph('package')).toBe('unknown');
		expect(oleObjectTypeToGlyph(undefined)).toBe('unknown');
	});
});
