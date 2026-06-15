/**
 * Tests for duotone-filter.ts
 *
 * Covers:
 *  - detection: returns undefined when no dagDuotone present
 *  - filter id: deterministic, derived from element id
 *  - primitives: correct count (2) and kind ordering
 *  - grayscale primitive: correct BT.709 matrix values, sRGB interpolation
 *  - component-transfer: correct slope/intercept mapping for shadow and highlight
 *  - channel ordering: R, G, B in that order
 *  - cssFilter: correct url(#…) reference
 *  - shadowHex / highlightHex preservation
 *  - boundary: pure black shadow (#000000) and pure white highlight (#ffffff)
 *  - boundary: same colour for both (monochrome duotone)
 *  - elements without shapeStyle return undefined
 */

import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildDuotoneFilter, buildDuotoneFilterId } from './duotone-filter';
import type { FeColorMatrixPrimitive, FeComponentTransferPrimitive } from './duotone-filter';

// ── test helpers ──────────────────────────────────────────────────────────────

function makeElement(
	id: string,
	shapeStyle?: ShapeStyle,
	typeOverride: PptxElement['type'] = 'shape',
): PptxElement {
	return {
		type: typeOverride,
		id,
		x: 0,
		y: 0,
		width: 200,
		height: 150,
		shapeStyle,
	} as PptxElement;
}

function withDuotone(id: string, color1: string, color2: string): PptxElement {
	return makeElement(id, { dagDuotone: { color1, color2 } });
}

/** Precision-safe round-trip: slope/intercept are stored as 0–1 floats. */
function round4(n: number): number {
	return Math.round(n * 10000) / 10000;
}

// ── buildDuotoneFilterId ──────────────────────────────────────────────────────

describe('buildDuotoneFilterId', () => {
	it('produces stable id from element id', () => {
		expect(buildDuotoneFilterId('shape1')).toBe('dag-duotone-shape1');
		expect(buildDuotoneFilterId('img-42')).toBe('dag-duotone-img-42');
	});

	it('matches the format expected by getEffectDagCssFilter url() reference', () => {
		const id = buildDuotoneFilterId('el99');
		expect(id).toBe('dag-duotone-el99');
		// getEffectDagCssFilter produces `url(#dag-duotone-${elementId})`
		expect(`url(#${id})`).toBe('url(#dag-duotone-el99)');
	});
});

// ── buildDuotoneFilter – absence detection ────────────────────────────────────

describe('buildDuotoneFilter – no duotone', () => {
	it('returns undefined for element with no shapeStyle', () => {
		const el: PptxElement = {
			type: 'image',
			id: 'img1',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
		} as PptxElement;
		expect(buildDuotoneFilter(el)).toBeUndefined();
	});

	it('returns undefined for element with shapeStyle but no dagDuotone', () => {
		const el = makeElement('s1', { fillColor: '#ff0000' });
		expect(buildDuotoneFilter(el)).toBeUndefined();
	});

	it('returns undefined for element with dagGrayscale but no dagDuotone', () => {
		const el = makeElement('s2', { dagGrayscale: true });
		expect(buildDuotoneFilter(el)).toBeUndefined();
	});

	it('returns undefined for picture element with no shapeStyle', () => {
		const el: PptxElement = {
			type: 'picture',
			id: 'pic1',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			imageData: 'data:image/png;base64,abc',
		} as PptxElement;
		expect(buildDuotoneFilter(el)).toBeUndefined();
	});
});

// ── buildDuotoneFilter – presence and structure ───────────────────────────────

describe('buildDuotoneFilter – structure', () => {
	const el = withDuotone('elem1', '#000080', '#FFD700');

	it('returns a DuotoneFilterDef when dagDuotone is set', () => {
		const r = buildDuotoneFilter(el);
		expect(r).toBeDefined();
	});

	it('id is derived from element id without randomness', () => {
		const r = buildDuotoneFilter(el)!;
		expect(r.id).toBe('dag-duotone-elem1');
		// calling twice must return same id
		expect(buildDuotoneFilter(el)!.id).toBe(r.id);
	});

	it('cssFilter is url(#id)', () => {
		const r = buildDuotoneFilter(el)!;
		expect(r.cssFilter).toBe(`url(#${r.id})`);
	});

	it('primitives array has exactly 2 entries', () => {
		const r = buildDuotoneFilter(el)!;
		expect(r.primitives).toHaveLength(2);
	});

	it('first primitive is feColorMatrix', () => {
		const r = buildDuotoneFilter(el)!;
		expect(r.primitives[0].kind).toBe('feColorMatrix');
	});

	it('second primitive is feComponentTransfer', () => {
		const r = buildDuotoneFilter(el)!;
		expect(r.primitives[1].kind).toBe('feComponentTransfer');
	});

	it('preserves shadowHex and highlightHex', () => {
		const r = buildDuotoneFilter(el)!;
		expect(r.shadowHex).toBe('#000080');
		expect(r.highlightHex).toBe('#FFD700');
	});
});

// ── feColorMatrix – grayscale primitive ───────────────────────────────────────

describe('feColorMatrix primitive', () => {
	const el = withDuotone('gm1', '#123456', '#abcdef');
	const r = buildDuotoneFilter(el)!;
	const matrix = r.primitives[0] as FeColorMatrixPrimitive;

	it('colorInterpolationFilters is sRGB', () => {
		expect(matrix.colorInterpolationFilters).toBe('sRGB');
	});

	it('values string contains 20 space-separated numbers', () => {
		const parts = matrix.values.trim().split(' ');
		expect(parts).toHaveLength(20);
		for (const part of parts) {
			expect(Number.isFinite(Number(part))).toBeTruthy();
		}
	});

	it('bt.709 luminance weights appear in rows R, G, B', () => {
		// Row layout: each row has 5 values; rows 0-2 should be identical
		// 0.2126 0.7152 0.0722 0 0
		const parts = matrix.values.trim().split(' ').map(Number);
		expect(round4(parts[0])).toBe(0.2126);
		expect(round4(parts[1])).toBe(0.7152);
		expect(round4(parts[2])).toBe(0.0722);
		expect(parts[3]).toBe(0);
		expect(parts[4]).toBe(0);
		// row 1 (G output) identical
		expect(round4(parts[5])).toBe(0.2126);
		expect(round4(parts[6])).toBe(0.7152);
		expect(round4(parts[7])).toBe(0.0722);
		// row 3 (alpha passthrough): 0 0 0 1 0
		expect(parts[15]).toBe(0);
		expect(parts[16]).toBe(0);
		expect(parts[17]).toBe(0);
		expect(parts[18]).toBe(1);
		expect(parts[19]).toBe(0);
	});
});

// ── feComponentTransfer – colour mapping ─────────────────────────────────────

describe('feComponentTransfer – channel mapping', () => {
	// shadow = pure black (#000000) → all channels 0
	// highlight = pure white (#ffffff) → all channels 1
	it('black→white: slope=1, intercept=0 for all channels', () => {
		const el = withDuotone('bw', '#000000', '#ffffff');
		const r = buildDuotoneFilter(el)!;
		const ct = r.primitives[1] as FeComponentTransferPrimitive;

		expect(ct.channels).toHaveLength(3);
		for (const ch of ct.channels) {
			expect(round4(ch.slope)).toBe(1);
			expect(round4(ch.intercept)).toBe(0);
		}
	});

	it('white→black: slope=-1, intercept=1 for all channels', () => {
		const el = withDuotone('wb', '#ffffff', '#000000');
		const r = buildDuotoneFilter(el)!;
		const ct = r.primitives[1] as FeComponentTransferPrimitive;

		for (const ch of ct.channels) {
			expect(round4(ch.slope)).toBe(-1);
			expect(round4(ch.intercept)).toBe(1);
		}
	});

	it('channels are in R, G, B order', () => {
		const el = withDuotone('rgb', '#000000', '#ffffff');
		const r = buildDuotoneFilter(el)!;
		const ct = r.primitives[1] as FeComponentTransferPrimitive;

		expect(ct.channels[0].channel).toBe('R');
		expect(ct.channels[1].channel).toBe('G');
		expect(ct.channels[2].channel).toBe('B');
	});

	it('navy→gold: correct per-channel slopes and intercepts', () => {
		// shadow  = #000080 → r=0,    g=0,    b=128/255≈0.502
		// highlight = #FFD700 → r=1,    g=215/255≈0.843, b=0
		const el = withDuotone('ng', '#000080', '#FFD700');
		const r = buildDuotoneFilter(el)!;
		const ct = r.primitives[1] as FeComponentTransferPrimitive;

		const shadowR = 0 / 255;
		const shadowG = 0 / 255;
		const shadowB = 128 / 255;
		const hiR = 255 / 255;
		const hiG = 215 / 255;
		const hiB = 0 / 255;

		const chR = ct.channels[0];
		const chG = ct.channels[1];
		const chB = ct.channels[2];

		// intercepts are the shadow colours
		expect(round4(chR.intercept)).toBe(round4(shadowR));
		expect(round4(chG.intercept)).toBe(round4(shadowG));
		expect(round4(chB.intercept)).toBe(round4(shadowB));

		// slopes are highlight − shadow
		expect(round4(chR.slope)).toBe(round4(hiR - shadowR));
		expect(round4(chG.slope)).toBe(round4(hiG - shadowG));
		expect(round4(chB.slope)).toBe(round4(hiB - shadowB));
	});

	it('monochrome duotone (same colour): slope=0, intercept=shadow', () => {
		// Both shadow and highlight are the same colour
		const el = withDuotone('mono', '#4080C0', '#4080C0');
		const r = buildDuotoneFilter(el)!;
		const ct = r.primitives[1] as FeComponentTransferPrimitive;

		const expected = { r: 0x40 / 255, g: 0x80 / 255, b: 0xc0 / 255 };

		expect(round4(ct.channels[0].slope)).toBe(0);
		expect(round4(ct.channels[1].slope)).toBe(0);
		expect(round4(ct.channels[2].slope)).toBe(0);

		expect(round4(ct.channels[0].intercept)).toBe(round4(expected.r));
		expect(round4(ct.channels[1].intercept)).toBe(round4(expected.g));
		expect(round4(ct.channels[2].intercept)).toBe(round4(expected.b));
	});
});

// ── Stability / determinism ───────────────────────────────────────────────────

describe('buildDuotoneFilter – determinism', () => {
	it('returns identical results on repeated calls with same input', () => {
		const el = withDuotone('det1', '#112233', '#aabbcc');
		const a = buildDuotoneFilter(el)!;
		const b = buildDuotoneFilter(el)!;

		expect(a.id).toBe(b.id);
		expect(a.cssFilter).toBe(b.cssFilter);
		expect(a.primitives[0].values).toBe(b.primitives[0].values);
		expect(a.primitives[1].channels[0].slope).toBe(b.primitives[1].channels[0].slope);
	});

	it('different element ids produce different filter ids', () => {
		const e1 = withDuotone('alpha', '#000000', '#ffffff');
		const e2 = withDuotone('beta', '#000000', '#ffffff');

		expect(buildDuotoneFilter(e1)!.id).not.toBe(buildDuotoneFilter(e2)!.id);
	});
});

// ── CSS filter integration ────────────────────────────────────────────────────

describe('cssFilter integration', () => {
	it('cssFilter matches the url() reference emitted by getEffectDagCssFilter', () => {
		// getEffectDagCssFilter produces: url(#dag-duotone-${elementId})
		const elementId = 'shape42';
		const el = withDuotone(elementId, '#000000', '#ffffff');
		const r = buildDuotoneFilter(el)!;

		// The url reference the Angular template applies to [style.filter]
		expect(r.cssFilter).toBe(`url(#dag-duotone-${elementId})`);
	});
});
