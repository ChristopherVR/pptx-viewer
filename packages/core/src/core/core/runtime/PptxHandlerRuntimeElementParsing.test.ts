import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Extracted logic from PptxHandlerRuntimeElementParsing
// ---------------------------------------------------------------------------

const EMU_PER_PX = 9525;

interface XmlObject {
	[key: string]: unknown;
}

interface PlaceholderInfo {
	idx?: string;
	type?: string;
	sz?: string;
}

/**
 * Extracted from extractPlaceholderInfo — parses the placeholder
 * identification from a p:nvPr node.
 */
function extractPlaceholderInfo(node: XmlObject | undefined): PlaceholderInfo | null {
	if (!node) {
		return null;
	}
	const placeholderNode = node['p:ph'] as XmlObject | undefined;
	if (!placeholderNode) {
		return null;
	}

	const idx = placeholderNode['@_idx'];
	const type = placeholderNode['@_type'];
	const sz = placeholderNode['@_sz'];

	return {
		idx: idx !== undefined ? String(idx) : undefined,
		type: type !== undefined ? String(type).toLowerCase() : undefined,
		sz: sz !== undefined ? String(sz).toLowerCase() : undefined,
	};
}

/**
 * Extracted from placeholderMatches — determines if two placeholder
 * identifications match according to OOXML spec rules.
 */
function placeholderMatches(
	source: PlaceholderInfo | null,
	target: PlaceholderInfo | null,
): boolean {
	if (!source && !target) {
		return true;
	}
	if (!target) {
		return false;
	}
	if (!source) {
		return true;
	}

	const typesMatch =
		source.type === target.type ||
		(source.type === 'ctrtitle' && target.type === 'title') ||
		(source.type === 'subtitle' && target.type === 'body');

	// Per OOXML, an absent idx defaults to 0. Normalise so a slide placeholder
	// with no idx matches a layout/master placeholder with an explicit idx="0".
	const sourceIdx = source.idx ?? '0';
	const targetIdx = target.idx ?? '0';
	if (sourceIdx !== targetIdx) {
		return false;
	}

	if (source.type && target.type && !typesMatch) {
		return false;
	}

	// When only one side has an explicit idx, keep the stricter rule that a
	// typed source must not bind to an untyped generic placeholder.
	const bothHaveExplicitIdx = source.idx !== undefined && target.idx !== undefined;
	if (!bothHaveExplicitIdx && source.type && !target.type) {
		return false;
	}

	return true;
}

/**
 * Extracted from parseContentPart — parses the transform from a
 * content part's p:xfrm node.
 */
function parseContentPartTransform(contentPart: XmlObject): {
	x: number;
	y: number;
	width: number;
	height: number;
} {
	const xfrm = contentPart['p:xfrm'] as XmlObject | undefined;
	const off = xfrm?.['a:off'] as XmlObject | undefined;
	const ext = xfrm?.['a:ext'] as XmlObject | undefined;

	const rawX = parseInt(String(off?.['@_x'] ?? '0'), 10);
	const rawY = parseInt(String(off?.['@_y'] ?? '0'), 10);
	const rawCx = parseInt(String(ext?.['@_cx'] ?? '0'), 10);
	const rawCy = parseInt(String(ext?.['@_cy'] ?? '0'), 10);

	const x = Number.isFinite(rawX) ? rawX / EMU_PER_PX : 0;
	const y = Number.isFinite(rawY) ? rawY / EMU_PER_PX : 0;
	const width = Number.isFinite(rawCx) && rawCx > 0 ? rawCx / EMU_PER_PX : 120;
	const height = Number.isFinite(rawCy) && rawCy > 0 ? rawCy / EMU_PER_PX : 80;

	return { x, y, width, height };
}

// ---------------------------------------------------------------------------
// Tests: extractPlaceholderInfo
// ---------------------------------------------------------------------------
describe('extractPlaceholderInfo', () => {
	it('should return null for undefined input', () => {
		expect(extractPlaceholderInfo(undefined)).toBeNull();
	});

	it('should return null when p:ph is absent', () => {
		expect(extractPlaceholderInfo({ other: 'data' })).toBeNull();
	});

	it('should return null for empty object', () => {
		expect(extractPlaceholderInfo({})).toBeNull();
	});

	it('should extract idx, type, and sz', () => {
		const node: XmlObject = {
			'p:ph': { '@_idx': '1', '@_type': 'body', '@_sz': 'half' },
		};
		const result = extractPlaceholderInfo(node);
		expect(result).toStrictEqual({ idx: '1', type: 'body', sz: 'half' });
	});

	it('should convert type to lowercase', () => {
		const node: XmlObject = {
			'p:ph': { '@_type': 'Title' },
		};
		const result = extractPlaceholderInfo(node);
		expect(result?.type).toBe('title');
	});

	it('should convert sz to lowercase', () => {
		const node: XmlObject = {
			'p:ph': { '@_sz': 'Quarter' },
		};
		const result = extractPlaceholderInfo(node);
		expect(result?.sz).toBe('quarter');
	});

	it('should handle numeric idx', () => {
		const node: XmlObject = {
			'p:ph': { '@_idx': 5 },
		};
		const result = extractPlaceholderInfo(node);
		expect(result?.idx).toBe('5');
	});

	it('should leave idx undefined when not present', () => {
		const node: XmlObject = {
			'p:ph': { '@_type': 'title' },
		};
		const result = extractPlaceholderInfo(node);
		expect(result?.idx).toBeUndefined();
		expect(result?.type).toBe('title');
	});

	it('should leave type undefined when not present', () => {
		const node: XmlObject = {
			'p:ph': { '@_idx': '0' },
		};
		const result = extractPlaceholderInfo(node);
		expect(result?.idx).toBe('0');
		expect(result?.type).toBeUndefined();
	});

	it('should handle empty placeholder node (no attributes)', () => {
		const node: XmlObject = {
			'p:ph': {},
		};
		const result = extractPlaceholderInfo(node);
		expect(result).toStrictEqual({ idx: undefined, type: undefined, sz: undefined });
	});
});

// ---------------------------------------------------------------------------
// Tests: placeholderMatches
// ---------------------------------------------------------------------------
describe('placeholderMatches', () => {
	it('should return true when both are null', () => {
		expect(placeholderMatches(null, null)).toBeTruthy();
	});

	it('should return false when target is null', () => {
		expect(placeholderMatches({ idx: '1' }, null)).toBeFalsy();
	});

	it('should return true when source is null', () => {
		expect(placeholderMatches(null, { idx: '1' })).toBeTruthy();
	});

	it('should match when both have the same idx', () => {
		expect(placeholderMatches({ idx: '1' }, { idx: '1' })).toBeTruthy();
	});

	it('should not match when idx differs', () => {
		expect(placeholderMatches({ idx: '1' }, { idx: '2' })).toBeFalsy();
	});

	it('should match when idx matches and both types match', () => {
		expect(placeholderMatches({ idx: '1', type: 'body' }, { idx: '1', type: 'body' })).toBeTruthy();
	});

	it('should not match when idx matches but types differ', () => {
		expect(placeholderMatches({ idx: '1', type: 'body' }, { idx: '1', type: 'title' })).toBeFalsy();
	});

	it('should match when idx matches and only source has type', () => {
		expect(placeholderMatches({ idx: '1', type: 'body' }, { idx: '1' })).toBeTruthy();
	});

	it('should match when idx matches and only target has type', () => {
		expect(placeholderMatches({ idx: '1' }, { idx: '1', type: 'body' })).toBeTruthy();
	});

	// Source has idx, target does not — singleton type matching
	it("should match singleton type 'title' when source has idx but target does not", () => {
		expect(placeholderMatches({ idx: '0', type: 'title' }, { type: 'title' })).toBeTruthy();
	});

	it("should match singleton type 'ctrtitle'", () => {
		expect(placeholderMatches({ idx: '0', type: 'ctrtitle' }, { type: 'ctrtitle' })).toBeTruthy();
	});

	it("should match singleton type 'subtitle'", () => {
		expect(placeholderMatches({ idx: '0', type: 'subtitle' }, { type: 'subtitle' })).toBeTruthy();
	});

	it("should match singleton type 'dt'", () => {
		expect(placeholderMatches({ idx: '0', type: 'dt' }, { type: 'dt' })).toBeTruthy();
	});

	it("should match singleton type 'ftr'", () => {
		expect(placeholderMatches({ idx: '0', type: 'ftr' }, { type: 'ftr' })).toBeTruthy();
	});

	it("should match singleton type 'sldnum'", () => {
		expect(placeholderMatches({ idx: '0', type: 'sldnum' }, { type: 'sldnum' })).toBeTruthy();
	});

	it("should NOT match non-singleton type 'body' when idx vs no-idx", () => {
		expect(placeholderMatches({ idx: '1', type: 'body' }, { type: 'body' })).toBeFalsy();
	});

	it("should NOT match non-singleton type 'obj' when idx vs no-idx", () => {
		expect(placeholderMatches({ idx: '1', type: 'obj' }, { type: 'obj' })).toBeFalsy();
	});

	it('should not match singleton type when target type differs', () => {
		expect(placeholderMatches({ idx: '0', type: 'title' }, { type: 'subtitle' })).toBeFalsy();
	});

	// Neither has idx — type-based matching
	it('should match when both have same type and no idx', () => {
		expect(placeholderMatches({ type: 'title' }, { type: 'title' })).toBeTruthy();
	});

	it('should not match when types differ and no idx', () => {
		expect(placeholderMatches({ type: 'title' }, { type: 'body' })).toBeFalsy();
	});

	it('should not match when source has type but target does not', () => {
		expect(placeholderMatches({ type: 'title' }, {})).toBeFalsy();
	});

	it('should match when neither has type or idx', () => {
		expect(placeholderMatches({}, {})).toBeTruthy();
	});

	it('should match when target has type but source does not', () => {
		expect(placeholderMatches({}, { type: 'title' })).toBeTruthy();
	});

	// idx defaulting (absent idx === "0" per the OOXML schema default)
	it('should treat a source with no idx as idx="0" against a layout idx="0"', () => {
		expect(placeholderMatches({ type: 'body' }, { idx: '0', type: 'body' })).toBeTruthy();
	});

	it('should treat an explicit idx="0" source as matching a layout with no idx', () => {
		expect(placeholderMatches({ idx: '0', type: 'body' }, { type: 'body' })).toBeTruthy();
	});

	it('should NOT match a no-idx source against a non-zero layout idx', () => {
		// Previously this matched by type alone; the schema default (0) makes it
		// a different instance from idx="1".
		expect(placeholderMatches({ type: 'body' }, { idx: '1', type: 'body' })).toBeFalsy();
	});

	it('should match no-idx-vs-idx=0 for a plain untyped placeholder', () => {
		expect(placeholderMatches({}, { idx: '0' })).toBeTruthy();
	});
});

// ---------------------------------------------------------------------------
// Tests: parseContentPartTransform
// ---------------------------------------------------------------------------
describe('parseContentPartTransform', () => {
	it('should return default values for empty content part', () => {
		const result = parseContentPartTransform({});
		expect(result.x).toBe(0);
		expect(result.y).toBe(0);
		expect(result.width).toBe(120); // default width
		expect(result.height).toBe(80); // default height
	});

	it('should parse position from a:off', () => {
		const contentPart: XmlObject = {
			'p:xfrm': {
				'a:off': {
					'@_x': String(100 * EMU_PER_PX),
					'@_y': String(200 * EMU_PER_PX),
				},
			},
		};
		const result = parseContentPartTransform(contentPart);
		expect(result.x).toBeCloseTo(100);
		expect(result.y).toBeCloseTo(200);
	});

	it('should parse size from a:ext', () => {
		const contentPart: XmlObject = {
			'p:xfrm': {
				'a:ext': {
					'@_cx': String(300 * EMU_PER_PX),
					'@_cy': String(150 * EMU_PER_PX),
				},
			},
		};
		const result = parseContentPartTransform(contentPart);
		expect(result.width).toBeCloseTo(300);
		expect(result.height).toBeCloseTo(150);
	});

	it('should default width to 120 when cx is 0', () => {
		const contentPart: XmlObject = {
			'p:xfrm': {
				'a:ext': { '@_cx': '0', '@_cy': String(50 * EMU_PER_PX) },
			},
		};
		const result = parseContentPartTransform(contentPart);
		expect(result.width).toBe(120);
		expect(result.height).toBeCloseTo(50);
	});

	it('should default height to 80 when cy is 0', () => {
		const contentPart: XmlObject = {
			'p:xfrm': {
				'a:ext': { '@_cx': String(50 * EMU_PER_PX), '@_cy': '0' },
			},
		};
		const result = parseContentPartTransform(contentPart);
		expect(result.width).toBeCloseTo(50);
		expect(result.height).toBe(80);
	});

	it('should handle missing xfrm gracefully', () => {
		const result = parseContentPartTransform({ other: 'data' });
		expect(result.x).toBe(0);
		expect(result.y).toBe(0);
		expect(result.width).toBe(120);
		expect(result.height).toBe(80);
	});

	it('should handle negative position values', () => {
		const contentPart: XmlObject = {
			'p:xfrm': {
				'a:off': {
					'@_x': String(-50 * EMU_PER_PX),
					'@_y': String(-25 * EMU_PER_PX),
				},
			},
		};
		const result = parseContentPartTransform(contentPart);
		expect(result.x).toBeCloseTo(-50);
		expect(result.y).toBeCloseTo(-25);
	});
});
