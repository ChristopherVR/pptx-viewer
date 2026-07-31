import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildGradientStrokeOutline, outlinePathData, suppressesCssBorder } from './stroke-outline';

const STOPS = [
	{ color: '#F0FDFE', position: 0 },
	{ color: '#BFBFBF', position: 100 },
];

function shape(shapeStyle: ShapeStyle, overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'shape',
		id: 'ppt/slides/slide4.xml-shape-3',
		x: 0,
		y: 0,
		width: 200,
		height: 100,
		shapeType: 'rect',
		shapeStyle,
		...overrides,
	} as PptxElement;
}

const gradientStroke: ShapeStyle = {
	strokeFillMode: 'gradient',
	strokeWidth: 3,
	strokeColor: '#D8DEDF',
	strokeGradientStops: STOPS,
	strokeGradientAngle: 45,
	strokeGradientType: 'linear',
};

describe('outlinePathData', () => {
	it('unwraps a path() clip-path', () => {
		expect(outlinePathData("path('M 0 0 L 10 10 Z')", 200, 100)).toBe('M 0 0 L 10 10 Z');
	});

	it('converts a percentage polygon() into pixel path data', () => {
		expect(outlinePathData('polygon(20% 0%, 100% 0%, 80% 100%, 0% 100%)', 200, 100)).toBe(
			'M 40 0 L 200 0 L 160 100 L 0 100 Z',
		);
	});

	it('falls back to the element rectangle for inset() or no clip', () => {
		const rect = 'M 0 0 L 200 0 L 200 100 L 0 100 Z';
		expect(outlinePathData(undefined, 200, 100)).toBe(rect);
		expect(outlinePathData('inset(0 round 18px)', 200, 100)).toBe(rect);
	});

	it('returns undefined for a degenerate box', () => {
		expect(outlinePathData("path('M 0 0 Z')", 0, 100)).toBeUndefined();
		expect(outlinePathData("path('M 0 0 Z')", 200, Number.NaN)).toBeUndefined();
	});
});

describe('buildGradientStrokeOutline', () => {
	it('builds a paint server and an outline path for a gradient outline', () => {
		const outline = buildGradientStrokeOutline(shape(gradientStroke));
		expect(outline).toBeDefined();
		expect(outline!.gradient.kind).toBe('linear');
		expect(outline!.gradient.id).toBe('pptx-stroke-ppt_slides_slide4_xml-shape-3');
		expect(outline!.strokeWidth).toBe(3);
		expect(outline!.d).toContain('M ');
	});

	it('namespaces the stroke paint server apart from the fill one', () => {
		// A shape can carry BOTH a gradient fill and a gradient outline; sharing
		// one id would make the second reference resolve to the first server.
		const outline = buildGradientStrokeOutline(
			shape({
				...gradientStroke,
				fillMode: 'gradient',
				fillGradientStops: STOPS,
			}),
		);
		expect(outline!.gradient.id).toContain('-stroke-');
	});

	it('follows the shape geometry rather than the bounding box', () => {
		// An ellipse is painted with `border-radius` by the bindings, but the
		// overlay has to trace the real outline or the gradient border would be a
		// rectangle around it.
		const outline = buildGradientStrokeOutline(
			shape(gradientStroke, { shapeType: 'ellipse' } as Partial<PptxElement>),
		);
		expect(outline!.d).toContain('A ');
	});

	it('carries the dash, cap and join through to SVG attributes', () => {
		const outline = buildGradientStrokeOutline(
			shape({ ...gradientStroke, strokeDash: 'dash', lineCap: 'rnd', lineJoin: 'bevel' }),
		);
		expect(outline!.dashArray).toBeTruthy();
		expect(outline!.lineCap).toBe('round');
		expect(outline!.lineJoin).toBe('bevel');
	});

	it('is undefined for a solid outline, no outline, or zero width', () => {
		expect(
			buildGradientStrokeOutline(shape({ strokeColor: '#000', strokeWidth: 2 })),
		).toBeUndefined();
		expect(
			buildGradientStrokeOutline(shape({ ...gradientStroke, strokeWidth: 0 })),
		).toBeUndefined();
		expect(
			buildGradientStrokeOutline(shape({ ...gradientStroke, strokeGradientStops: [] })),
		).toBeUndefined();
	});

	it('tells the binding when to drop its CSS border', () => {
		expect(suppressesCssBorder(shape(gradientStroke))).toBeTruthy();
		expect(suppressesCssBorder(shape({ strokeColor: '#000', strokeWidth: 2 }))).toBeFalsy();
	});
});
