import type { CustomGeometryPath, PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildSubpathFillOverlay, suppressesCssFill } from './subpath-fill-overlay';

function shape(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'shape',
		id: 'sp1',
		x: 0,
		y: 0,
		width: 200,
		height: 200,
		shapeStyle: { fillColor: '#336699' },
		...overrides,
	} as PptxElement;
}

describe('suppressesCssFill / buildSubpathFillOverlay - preset geometry (bug 2)', () => {
	it('fires for smileyFace: the eyes are open (fill="none") strokes, not filled', () => {
		const el = shape({ shapeType: 'smileyFace' });
		expect(suppressesCssFill(el)).toBeTruthy();
		const overlay = buildSubpathFillOverlay(el)!;
		expect(overlay).toBeDefined();
		// Face (first sub-path) is filled with the shape colour...
		expect(overlay.paints[0].fill).not.toBe('none');
		// ...and at least one sub-path (an eye) opts out of fill entirely.
		expect(overlay.paints.some((p) => p.fill === 'none')).toBeTruthy();
	});

	it('fires for actionButtonBlank: the inset bevel well is darkened, not flat', () => {
		const el = shape({ shapeType: 'actionButtonBlank' });
		expect(suppressesCssFill(el)).toBeTruthy();
		const overlay = buildSubpathFillOverlay(el)!;
		const fills = new Set(overlay.paints.map((p) => p.fill));
		// The darkened bevel well must resolve to a DIFFERENT colour than the
		// plain face fill, or the shading is invisible (the bug as filed).
		expect(fills.size).toBeGreaterThan(1);
	});

	it('declines an ordinary single-fill preset (rect): the CSS box stays correct and cheaper', () => {
		const el = shape({ shapeType: 'rect' });
		expect(suppressesCssFill(el)).toBeFalsy();
		expect(buildSubpathFillOverlay(el)).toBeUndefined();
	});

	it("declines a stroke-only preset (arc): that is `stroke-only-preset`'s job, not this overlay's", () => {
		const el = shape({ shapeType: 'arc', shapeAdjustments: { adj1: 0, adj2: 10_800_000 } });
		expect(suppressesCssFill(el)).toBeFalsy();
	});

	it('declines when the fill is a gradient: no paint server exists for a sub-path', () => {
		const el = shape({
			shapeType: 'smileyFace',
			shapeStyle: { fillMode: 'gradient', fillGradientStops: [{ color: '#fff', position: 0 }] },
		} as Partial<PptxElement>);
		expect(suppressesCssFill(el)).toBeFalsy();
		expect(buildSubpathFillOverlay(el)).toBeUndefined();
	});

	it('emits no fill for every sub-path when the shape itself has no fill', () => {
		const el = shape({ shapeType: 'smileyFace', shapeStyle: { fillMode: 'none' } });
		const overlay = buildSubpathFillOverlay(el)!;
		expect(overlay.paints.every((p) => p.fill === 'none')).toBeTruthy();
	});
});

describe('suppressesCssFill / buildSubpathFillOverlay - custom geometry (bug 3)', () => {
	function custGeomPaths(): CustomGeometryPath[] {
		return [
			{
				width: 100,
				height: 100,
				segments: [
					{ type: 'moveTo', pt: { x: 0, y: 0 } },
					{ type: 'lineTo', pt: { x: 100, y: 0 } },
					{ type: 'lineTo', pt: { x: 100, y: 100 } },
					{ type: 'close' },
				],
			},
			{
				width: 100,
				height: 100,
				fillMode: 'lighten',
				segments: [
					{ type: 'moveTo', pt: { x: 10, y: 10 } },
					{ type: 'lineTo', pt: { x: 40, y: 10 } },
					{ type: 'lineTo', pt: { x: 40, y: 40 } },
					{ type: 'close' },
				],
			},
		];
	}

	function custGeomShape(): PptxElement {
		return shape({
			pathData: 'M 0 0 L 100 0 L 100 100 Z M 10 10 L 40 10 L 40 40 Z',
			pathWidth: 100,
			pathHeight: 100,
			customGeometryPaths: custGeomPaths(),
		} as Partial<PptxElement>);
	}

	it('fires when a structured sub-path carries a non-norm fill mode', () => {
		const el = custGeomShape();
		expect(suppressesCssFill(el)).toBeTruthy();
		const overlay = buildSubpathFillOverlay(el)!;
		expect(overlay.paints).toHaveLength(2);
		expect(overlay.paints[0].fill).not.toBe(overlay.paints[1].fill);
		expect(overlay.viewBoxWidth).toBe(100);
		expect(overlay.viewBoxHeight).toBe(100);
	});

	it('declines custom geometry with no structured sub-paths (aggregate pathData only)', () => {
		const el = shape({
			pathData: 'M 0 0 L 100 0 L 100 100 Z',
			pathWidth: 100,
			pathHeight: 100,
		} as Partial<PptxElement>);
		expect(suppressesCssFill(el)).toBeFalsy();
	});

	it('declines custom geometry whose sub-paths are all plain (norm, stroked)', () => {
		const el = shape({
			pathData: 'M 0 0 L 100 0 L 100 100 Z',
			pathWidth: 100,
			pathHeight: 100,
			customGeometryPaths: [
				{
					width: 100,
					height: 100,
					segments: [
						{ type: 'moveTo', pt: { x: 0, y: 0 } },
						{ type: 'lineTo', pt: { x: 100, y: 0 } },
						{ type: 'close' },
					],
				},
			],
		} as Partial<PptxElement>);
		expect(suppressesCssFill(el)).toBeFalsy();
	});

	it('is unaffected by element type: only shape/image/picture carry custom geometry', () => {
		const el = { ...custGeomShape(), type: 'table' } as unknown as PptxElement;
		expect(suppressesCssFill(el)).toBeFalsy();
	});
});
