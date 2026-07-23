import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Extracted logic from PptxHandlerRuntimeGroupParsing
// ---------------------------------------------------------------------------

const EMU_PER_PX = 9525;

interface XmlObject {
	[key: string]: unknown;
}

interface MockElement {
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * Extracted from parseGroupShape — computes the group transform parameters
 * from `p:grpSpPr > a:xfrm`.
 */
function extractGroupTransform(xfrm: XmlObject | undefined): {
	parentX: number;
	parentY: number;
	parentW: number;
	parentH: number;
	chX: number;
	chY: number;
	chW: number;
	chH: number;
	scaleX: number;
	scaleY: number;
} {
	let parentX = 0,
		parentY = 0,
		parentW = 0,
		parentH = 0;
	let chX = 0,
		chY = 0,
		chW = 0,
		chH = 0;

	if (xfrm) {
		if (xfrm['a:off']) {
			parentX = Math.round(
				parseInt(String((xfrm['a:off'] as XmlObject)['@_x'] || '0')) / EMU_PER_PX,
			);
			parentY = Math.round(
				parseInt(String((xfrm['a:off'] as XmlObject)['@_y'] || '0')) / EMU_PER_PX,
			);
		}
		if (xfrm['a:ext']) {
			parentW = Math.round(
				parseInt(String((xfrm['a:ext'] as XmlObject)['@_cx'] || '0')) / EMU_PER_PX,
			);
			parentH = Math.round(
				parseInt(String((xfrm['a:ext'] as XmlObject)['@_cy'] || '0')) / EMU_PER_PX,
			);
		}
		if (xfrm['a:chOff']) {
			chX = Math.round(parseInt(String((xfrm['a:chOff'] as XmlObject)['@_x'] || '0')) / EMU_PER_PX);
			chY = Math.round(parseInt(String((xfrm['a:chOff'] as XmlObject)['@_y'] || '0')) / EMU_PER_PX);
		}
		if (xfrm['a:chExt']) {
			chW = Math.round(
				parseInt(String((xfrm['a:chExt'] as XmlObject)['@_cx'] || '0')) / EMU_PER_PX,
			);
			chH = Math.round(
				parseInt(String((xfrm['a:chExt'] as XmlObject)['@_cy'] || '0')) / EMU_PER_PX,
			);
		}
	}

	const scaleX = chW > 0 ? parentW / chW : 1;
	const scaleY = chH > 0 ? parentH / chH : 1;

	return { parentX, parentY, parentW, parentH, chX, chY, chW, chH, scaleX, scaleY };
}

/**
 * Extracted from parseGroupShape — transforms a child element's coordinates
 * relative to the group.
 */
function transformElement(
	el: MockElement,
	parentX: number,
	parentY: number,
	chX: number,
	chY: number,
	scaleX: number,
	scaleY: number,
): MockElement {
	const relativeX = el.x - chX;
	const relativeY = el.y - chY;
	return {
		x: parentX + relativeX * scaleX,
		y: parentY + relativeY * scaleY,
		width: el.width * scaleX,
		height: el.height * scaleY,
	};
}

/**
 * Extracted from parseGroupShapeAsGroup (issue #70) — reads group-level
 * rotation/flip from `p:grpSpPr > a:xfrm`. Mirrors the exact guards used in
 * the runtime: `@_rot` is in 60000ths of a degree and collapses a 0/NaN
 * value to `undefined`; flips accept the "1"/"true" boolean forms.
 */
function parseBooleanAttr(value: unknown): boolean {
	const normalized = String(value ?? '')
		.trim()
		.toLowerCase();
	return normalized === '1' || normalized === 'true';
}

function extractGroupRotationFlip(xfrm: XmlObject | undefined): {
	rotation: number | undefined;
	flipHorizontal: boolean;
	flipVertical: boolean;
} {
	let rotation: number | undefined;
	let flipHorizontal = false;
	let flipVertical = false;
	if (xfrm) {
		if (xfrm['@_rot'] !== undefined && xfrm['@_rot'] !== null) {
			const rot = parseInt(String(xfrm['@_rot']), 10) / 60000;
			rotation = Number.isFinite(rot) && rot !== 0 ? rot : undefined;
		}
		flipHorizontal = parseBooleanAttr(xfrm['@_flipH']);
		flipVertical = parseBooleanAttr(xfrm['@_flipV']);
	}
	return { rotation, flipHorizontal, flipVertical };
}

// ---------------------------------------------------------------------------
// Tests: extractGroupRotationFlip (issue #70 group rotation/flip)
// ---------------------------------------------------------------------------
describe('extractGroupRotationFlip', () => {
	it('defaults to no rotation/flip for undefined xfrm', () => {
		expect(extractGroupRotationFlip(undefined)).toStrictEqual({
			rotation: undefined,
			flipHorizontal: false,
			flipVertical: false,
		});
	});

	it('parses @_rot (60000ths of a degree) into degrees', () => {
		// 45 degrees == 45 * 60000 == 2700000
		const result = extractGroupRotationFlip({ '@_rot': '2700000' });
		expect(result.rotation).toBeCloseTo(45);
	});

	it('parses @_flipH into flipHorizontal', () => {
		const result = extractGroupRotationFlip({ '@_flipH': '1' });
		expect(result.flipHorizontal).toBeTruthy();
		expect(result.flipVertical).toBeFalsy();
	});

	it('parses @_flipV into flipVertical', () => {
		const result = extractGroupRotationFlip({ '@_flipV': '1' });
		expect(result.flipVertical).toBeTruthy();
		expect(result.flipHorizontal).toBeFalsy();
	});

	it('parses combined rotation + horizontal flip', () => {
		const result = extractGroupRotationFlip({ '@_rot': '5400000', '@_flipH': '1' });
		expect(result.rotation).toBeCloseTo(90);
		expect(result.flipHorizontal).toBeTruthy();
	});

	it('collapses a zero rotation to undefined', () => {
		expect(extractGroupRotationFlip({ '@_rot': '0' }).rotation).toBeUndefined();
	});

	it('accepts the "true" boolean form for flips', () => {
		const result = extractGroupRotationFlip({ '@_flipH': 'true', '@_flipV': 'true' });
		expect(result.flipHorizontal).toBeTruthy();
		expect(result.flipVertical).toBeTruthy();
	});
});

// ---------------------------------------------------------------------------
// Tests: extractGroupTransform
// ---------------------------------------------------------------------------
describe('extractGroupTransform', () => {
	it('should return zeros for undefined xfrm', () => {
		const result = extractGroupTransform(undefined);
		expect(result.parentX).toBe(0);
		expect(result.parentY).toBe(0);
		expect(result.parentW).toBe(0);
		expect(result.parentH).toBe(0);
		expect(result.chX).toBe(0);
		expect(result.chY).toBe(0);
		expect(result.chW).toBe(0);
		expect(result.chH).toBe(0);
		expect(result.scaleX).toBe(1);
		expect(result.scaleY).toBe(1);
	});

	it('should parse parent offset', () => {
		const xfrm: XmlObject = {
			'a:off': { '@_x': String(100 * EMU_PER_PX), '@_y': String(200 * EMU_PER_PX) },
		};
		const result = extractGroupTransform(xfrm);
		expect(result.parentX).toBe(100);
		expect(result.parentY).toBe(200);
	});

	it('should parse parent extent', () => {
		const xfrm: XmlObject = {
			'a:ext': { '@_cx': String(500 * EMU_PER_PX), '@_cy': String(300 * EMU_PER_PX) },
		};
		const result = extractGroupTransform(xfrm);
		expect(result.parentW).toBe(500);
		expect(result.parentH).toBe(300);
	});

	it('should parse child offset', () => {
		const xfrm: XmlObject = {
			'a:chOff': { '@_x': String(10 * EMU_PER_PX), '@_y': String(20 * EMU_PER_PX) },
		};
		const result = extractGroupTransform(xfrm);
		expect(result.chX).toBe(10);
		expect(result.chY).toBe(20);
	});

	it('should parse child extent', () => {
		const xfrm: XmlObject = {
			'a:chExt': { '@_cx': String(250 * EMU_PER_PX), '@_cy': String(150 * EMU_PER_PX) },
		};
		const result = extractGroupTransform(xfrm);
		expect(result.chW).toBe(250);
		expect(result.chH).toBe(150);
	});

	it('should compute correct scale factors', () => {
		const xfrm: XmlObject = {
			'a:ext': { '@_cx': String(1000 * EMU_PER_PX), '@_cy': String(500 * EMU_PER_PX) },
			'a:chExt': { '@_cx': String(500 * EMU_PER_PX), '@_cy': String(250 * EMU_PER_PX) },
		};
		const result = extractGroupTransform(xfrm);
		expect(result.scaleX).toBeCloseTo(2);
		expect(result.scaleY).toBeCloseTo(2);
	});

	it('should default scale to 1 when child extent is 0', () => {
		const xfrm: XmlObject = {
			'a:ext': { '@_cx': String(100 * EMU_PER_PX), '@_cy': String(100 * EMU_PER_PX) },
			'a:chExt': { '@_cx': '0', '@_cy': '0' },
		};
		const result = extractGroupTransform(xfrm);
		expect(result.scaleX).toBe(1);
		expect(result.scaleY).toBe(1);
	});

	it('should handle fractional scaling', () => {
		const xfrm: XmlObject = {
			'a:ext': { '@_cx': String(300 * EMU_PER_PX), '@_cy': String(200 * EMU_PER_PX) },
			'a:chExt': { '@_cx': String(600 * EMU_PER_PX), '@_cy': String(400 * EMU_PER_PX) },
		};
		const result = extractGroupTransform(xfrm);
		expect(result.scaleX).toBeCloseTo(0.5);
		expect(result.scaleY).toBeCloseTo(0.5);
	});
});

// ---------------------------------------------------------------------------
// Tests: transformElement
// ---------------------------------------------------------------------------
describe('transformElement', () => {
	it('should transform element with identity scale', () => {
		const el: MockElement = { x: 50, y: 50, width: 100, height: 100 };
		const result = transformElement(el, 0, 0, 0, 0, 1, 1);
		expect(result).toStrictEqual({ x: 50, y: 50, width: 100, height: 100 });
	});

	it('should apply parent offset', () => {
		const el: MockElement = { x: 0, y: 0, width: 100, height: 100 };
		const result = transformElement(el, 200, 150, 0, 0, 1, 1);
		expect(result.x).toBe(200);
		expect(result.y).toBe(150);
	});

	it('should subtract child offset before scaling', () => {
		const el: MockElement = { x: 100, y: 100, width: 50, height: 50 };
		const result = transformElement(el, 0, 0, 100, 100, 1, 1);
		expect(result.x).toBe(0);
		expect(result.y).toBe(0);
	});

	it('should scale element size', () => {
		const el: MockElement = { x: 0, y: 0, width: 100, height: 50 };
		const result = transformElement(el, 0, 0, 0, 0, 2, 3);
		expect(result.width).toBe(200);
		expect(result.height).toBe(150);
	});

	it('should apply full transform (offset + scale + parent position)', () => {
		const el: MockElement = { x: 50, y: 30, width: 100, height: 80 };
		// Group at (200, 100), child space starts at (10, 10), scale 2x
		const result = transformElement(el, 200, 100, 10, 10, 2, 2);
		// relativeX = 50 - 10 = 40, relativeY = 30 - 10 = 20
		// x = 200 + 40*2 = 280, y = 100 + 20*2 = 140
		expect(result.x).toBe(280);
		expect(result.y).toBe(140);
		expect(result.width).toBe(200);
		expect(result.height).toBe(160);
	});

	it('should handle scale down (scale < 1)', () => {
		const el: MockElement = { x: 100, y: 100, width: 200, height: 200 };
		const result = transformElement(el, 0, 0, 0, 0, 0.5, 0.5);
		expect(result.x).toBe(50);
		expect(result.y).toBe(50);
		expect(result.width).toBe(100);
		expect(result.height).toBe(100);
	});

	it('should handle non-uniform scaling', () => {
		const el: MockElement = { x: 0, y: 0, width: 100, height: 100 };
		const result = transformElement(el, 0, 0, 0, 0, 2, 0.5);
		expect(result.width).toBe(200);
		expect(result.height).toBe(50);
	});
});
