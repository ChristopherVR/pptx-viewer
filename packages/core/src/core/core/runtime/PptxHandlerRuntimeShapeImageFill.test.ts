import { describe, it, expect } from 'vitest';

import type { TextStyle } from '../../types';

// ---------------------------------------------------------------------------
// Extracted from PptxHandlerRuntimeShapeImageFill
// Pure re-implementations of textVerticalAlignFromDrawingValue and
// textDirectionFromDrawingValue for direct testing.
// ---------------------------------------------------------------------------

function textVerticalAlignFromDrawingValue(value: unknown): TextStyle['vAlign'] | undefined {
	const normalized = String(value ?? '')
		.trim()
		.toLowerCase();
	if (normalized.length === 0) {
		return undefined;
	}
	if (normalized === 't' || normalized === 'top') {
		return 'top';
	}
	if (normalized === 'ctr' || normalized === 'center') {
		return 'middle';
	}
	if (normalized === 'b' || normalized === 'bottom') {
		return 'bottom';
	}
	if (normalized === 'dist' || normalized === 'just') {
		return 'middle';
	}
	return undefined;
}

function textDirectionFromDrawingValue(value: unknown): TextStyle['textDirection'] | undefined {
	const normalized = String(value ?? '')
		.trim()
		.toLowerCase();
	if (normalized.length === 0 || normalized === 'horz') {
		return undefined;
	}
	if (normalized === 'vert') {
		return 'vertical';
	}
	if (normalized === 'vert270') {
		return 'vertical270';
	}
	if (normalized === 'eavert') {
		return 'eaVert';
	}
	if (normalized === 'wordartvert') {
		return 'wordArtVert';
	}
	if (normalized === 'wordartvertrtl') {
		return 'wordArtVertRtl';
	}
	if (normalized === 'mongolianvert') {
		return 'mongolianVert';
	}
	return undefined;
}

// ---------------------------------------------------------------------------
// textVerticalAlignFromDrawingValue
// ---------------------------------------------------------------------------
describe('textVerticalAlignFromDrawingValue', () => {
	it('should return undefined for undefined value', () => {
		expect(textVerticalAlignFromDrawingValue(undefined)).toBeUndefined();
	});

	it('should return undefined for null', () => {
		expect(textVerticalAlignFromDrawingValue(null)).toBeUndefined();
	});

	it('should return undefined for empty string', () => {
		expect(textVerticalAlignFromDrawingValue('')).toBeUndefined();
	});

	it("should return 'top' for 't'", () => {
		expect(textVerticalAlignFromDrawingValue('t')).toBe('top');
	});

	it("should return 'top' for 'top'", () => {
		expect(textVerticalAlignFromDrawingValue('top')).toBe('top');
	});

	it("should return 'middle' for 'ctr'", () => {
		expect(textVerticalAlignFromDrawingValue('ctr')).toBe('middle');
	});

	it("should return 'middle' for 'center'", () => {
		expect(textVerticalAlignFromDrawingValue('center')).toBe('middle');
	});

	it("should return 'bottom' for 'b'", () => {
		expect(textVerticalAlignFromDrawingValue('b')).toBe('bottom');
	});

	it("should return 'bottom' for 'bottom'", () => {
		expect(textVerticalAlignFromDrawingValue('bottom')).toBe('bottom');
	});

	it("should return 'middle' for 'dist' (distributed)", () => {
		expect(textVerticalAlignFromDrawingValue('dist')).toBe('middle');
	});

	it("should return 'middle' for 'just' (justified)", () => {
		expect(textVerticalAlignFromDrawingValue('just')).toBe('middle');
	});

	it('should return undefined for unknown value', () => {
		expect(textVerticalAlignFromDrawingValue('unknown')).toBeUndefined();
	});

	it('should be case-insensitive', () => {
		expect(textVerticalAlignFromDrawingValue('T')).toBe('top');
		expect(textVerticalAlignFromDrawingValue('CTR')).toBe('middle');
		expect(textVerticalAlignFromDrawingValue('B')).toBe('bottom');
	});

	it('should handle whitespace around values', () => {
		expect(textVerticalAlignFromDrawingValue('  t  ')).toBe('top');
		expect(textVerticalAlignFromDrawingValue(' ctr ')).toBe('middle');
	});
});

// ---------------------------------------------------------------------------
// textDirectionFromDrawingValue
// ---------------------------------------------------------------------------
describe('textDirectionFromDrawingValue', () => {
	it('should return undefined for undefined value', () => {
		expect(textDirectionFromDrawingValue(undefined)).toBeUndefined();
	});

	it('should return undefined for null', () => {
		expect(textDirectionFromDrawingValue(null)).toBeUndefined();
	});

	it('should return undefined for empty string', () => {
		expect(textDirectionFromDrawingValue('')).toBeUndefined();
	});

	it("should return undefined for 'horz' (horizontal, default)", () => {
		expect(textDirectionFromDrawingValue('horz')).toBeUndefined();
	});

	it("should return 'vertical270' for 'vert270'", () => {
		expect(textDirectionFromDrawingValue('vert270')).toBe('vertical270');
	});

	it("should return 'wordArtVertRtl' for 'wordArtVertRtl'", () => {
		expect(textDirectionFromDrawingValue('wordArtVertRtl')).toBe('wordArtVertRtl');
	});

	it("should return 'vertical' for 'vert'", () => {
		expect(textDirectionFromDrawingValue('vert')).toBe('vertical');
	});

	it("should return 'eaVert' for 'eaVert'", () => {
		expect(textDirectionFromDrawingValue('eaVert')).toBe('eaVert');
	});

	it("should return 'mongolianVert' for 'mongolianVert'", () => {
		expect(textDirectionFromDrawingValue('mongolianVert')).toBe('mongolianVert');
	});

	it("should return 'wordArtVert' for 'wordArtVert'", () => {
		expect(textDirectionFromDrawingValue('wordArtVert')).toBe('wordArtVert');
	});

	it('should return undefined for unknown direction', () => {
		expect(textDirectionFromDrawingValue('diagonal')).toBeUndefined();
	});

	it('should be case-insensitive', () => {
		expect(textDirectionFromDrawingValue('VERT')).toBe('vertical');
		expect(textDirectionFromDrawingValue('Vert270')).toBe('vertical270');
		expect(textDirectionFromDrawingValue('EAVERT')).toBe('eaVert');
		expect(textDirectionFromDrawingValue('WORDARTVERT')).toBe('wordArtVert');
		expect(textDirectionFromDrawingValue('WORDARTVERTRTL')).toBe('wordArtVertRtl');
		expect(textDirectionFromDrawingValue('MONGOLIANVERT')).toBe('mongolianVert');
	});

	it('should handle whitespace around direction values', () => {
		expect(textDirectionFromDrawingValue('  vert  ')).toBe('vertical');
		expect(textDirectionFromDrawingValue(' vert270 ')).toBe('vertical270');
	});
});

// ---------------------------------------------------------------------------
// Shape image fill tile parsing (extracted from parseShapeWithImageFill)
// ---------------------------------------------------------------------------

const EMU_PER_PX = 9525;

interface XmlObject {
	[key: string]: unknown;
}

/**
 * Extracted from parseShapeWithImageFill — parses tile properties
 * from a:tile node inside blipFill.
 */
function parseTileProperties(tileNode: XmlObject | undefined): Record<string, unknown> {
	const tileProps: Record<string, unknown> = {};
	if (!tileNode) {
		return tileProps;
	}

	const txRaw = Number.parseInt(String(tileNode['@_tx'] || ''), 10);
	if (Number.isFinite(txRaw)) {
		tileProps.tileOffsetX = txRaw / EMU_PER_PX;
	}
	const tyRaw = Number.parseInt(String(tileNode['@_ty'] || ''), 10);
	if (Number.isFinite(tyRaw)) {
		tileProps.tileOffsetY = tyRaw / EMU_PER_PX;
	}
	const sxRaw = Number.parseInt(String(tileNode['@_sx'] || ''), 10);
	if (Number.isFinite(sxRaw)) {
		tileProps.tileScaleX = sxRaw / 100000;
	}
	const syRaw = Number.parseInt(String(tileNode['@_sy'] || ''), 10);
	if (Number.isFinite(syRaw)) {
		tileProps.tileScaleY = syRaw / 100000;
	}
	const flipStr = String(tileNode['@_flip'] || '').trim();
	if (flipStr === 'x' || flipStr === 'y' || flipStr === 'xy' || flipStr === 'none') {
		tileProps.tileFlip = flipStr;
	}
	const algnStr = String(tileNode['@_algn'] || '').trim();
	if (algnStr.length > 0) {
		tileProps.tileAlignment = algnStr;
	}

	return tileProps;
}

describe('parseTileProperties', () => {
	it('should return empty object for undefined tile node', () => {
		expect(parseTileProperties(undefined)).toStrictEqual({});
	});

	it('should return empty object for empty tile node', () => {
		expect(parseTileProperties({})).toStrictEqual({});
	});

	it('should parse tile offset X', () => {
		const result = parseTileProperties({ '@_tx': String(95250) });
		expect(result.tileOffsetX).toBeCloseTo(10); // 95250 / 9525 = 10
	});

	it('should parse tile offset Y', () => {
		const result = parseTileProperties({ '@_ty': String(47625) });
		expect(result.tileOffsetY).toBeCloseTo(5); // 47625 / 9525 = 5
	});

	it('should parse tile scale X', () => {
		const result = parseTileProperties({ '@_sx': '50000' });
		expect(result.tileScaleX).toBeCloseTo(0.5); // 50000 / 100000
	});

	it('should parse tile scale Y', () => {
		const result = parseTileProperties({ '@_sy': '200000' });
		expect(result.tileScaleY).toBeCloseTo(2); // 200000 / 100000
	});

	it("should parse tile flip 'x'", () => {
		const result = parseTileProperties({ '@_flip': 'x' });
		expect(result.tileFlip).toBe('x');
	});

	it("should parse tile flip 'y'", () => {
		const result = parseTileProperties({ '@_flip': 'y' });
		expect(result.tileFlip).toBe('y');
	});

	it("should parse tile flip 'xy'", () => {
		const result = parseTileProperties({ '@_flip': 'xy' });
		expect(result.tileFlip).toBe('xy');
	});

	it("should parse tile flip 'none'", () => {
		const result = parseTileProperties({ '@_flip': 'none' });
		expect(result.tileFlip).toBe('none');
	});

	it('should ignore invalid flip values', () => {
		const result = parseTileProperties({ '@_flip': 'z' });
		expect(result.tileFlip).toBeUndefined();
	});

	it('should parse tile alignment', () => {
		const result = parseTileProperties({ '@_algn': 'ctr' });
		expect(result.tileAlignment).toBe('ctr');
	});

	it('should ignore empty alignment', () => {
		const result = parseTileProperties({ '@_algn': '' });
		expect(result.tileAlignment).toBeUndefined();
	});

	it('should parse all properties at once', () => {
		const result = parseTileProperties({
			'@_tx': '19050',
			'@_ty': '38100',
			'@_sx': '100000',
			'@_sy': '100000',
			'@_flip': 'xy',
			'@_algn': 'tl',
		});
		expect(result.tileOffsetX).toBeCloseTo(2);
		expect(result.tileOffsetY).toBeCloseTo(4);
		expect(result.tileScaleX).toBeCloseTo(1);
		expect(result.tileScaleY).toBeCloseTo(1);
		expect(result.tileFlip).toBe('xy');
		expect(result.tileAlignment).toBe('tl');
	});

	it('should skip non-numeric offset values', () => {
		const result = parseTileProperties({ '@_tx': 'abc', '@_ty': '' });
		expect(result.tileOffsetX).toBeUndefined();
		expect(result.tileOffsetY).toBeUndefined();
	});

	it('should handle zero values', () => {
		const result = parseTileProperties({
			'@_tx': '0',
			'@_ty': '0',
			'@_sx': '0',
			'@_sy': '0',
		});
		expect(result.tileOffsetX).toBe(0);
		expect(result.tileOffsetY).toBe(0);
		expect(result.tileScaleX).toBe(0);
		expect(result.tileScaleY).toBe(0);
	});
});
