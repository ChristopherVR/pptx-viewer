import type { ShapeStyle } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	buildSvgGradientDef,
	svgGradientFillRef,
	svgGradientId,
	svgGradientMarkup,
} from './svg-gradient-paint';

const twoStops = [
	{ color: '#D2F8F4', position: 0 },
	{ color: '#FFFFFF', position: 100 },
];

function style(overrides: ShapeStyle = {}): ShapeStyle {
	return { fillMode: 'gradient', fillGradientStops: twoStops, ...overrides } as ShapeStyle;
}

describe('svgGradientId', () => {
	it('sanitises an element id into a usable fragment', () => {
		// Raw element ids carry `/` and `.`, which cannot appear in `url(#…)`.
		expect(svgGradientId('ppt/slides/slide2.xml-shape-4')).toBe(
			'pptx-grad-ppt_slides_slide2_xml-shape-4',
		);
	});
});

describe('buildSvgGradientDef', () => {
	it('returns undefined for a non-gradient fill', () => {
		expect(buildSvgGradientDef({ fillMode: 'solid', fillColor: '#ff0000' }, 'e1')).toBeUndefined();
	});

	it('returns undefined when there are no structured stops', () => {
		expect(
			buildSvgGradientDef(
				{ fillMode: 'gradient', fillGradient: 'linear-gradient(red, blue)' },
				'e1',
			),
		).toBeUndefined();
	});

	it('runs a 0-degree linear gradient left to right', () => {
		// OOXML `a:lin/@ang="0"` runs along +x; SVG shares that axis convention,
		// so no CSS-style quarter turn is applied.
		const def = buildSvgGradientDef(style({ fillGradientAngle: 0 }), 'e1');
		expect(def).toMatchObject({ kind: 'linear', x1: 0, y1: 0.5, x2: 1, y2: 0.5 });
	});

	it('runs a 90-degree linear gradient top to bottom', () => {
		const def = buildSvgGradientDef(style({ fillGradientAngle: 90 }), 'e1');
		expect(def).toMatchObject({ kind: 'linear', x1: 0.5, y1: 0, x2: 0.5, y2: 1 });
	});

	it('spans corner to corner at 45 degrees', () => {
		const def = buildSvgGradientDef(style({ fillGradientAngle: 45 }), 'e1');
		expect(def).toMatchObject({ kind: 'linear', x1: 0, y1: 0, x2: 1, y2: 1 });
	});

	it('defaults to top-to-bottom when no angle is recorded', () => {
		expect(buildSvgGradientDef(style(), 'e1')).toMatchObject({ x1: 0.5, y1: 0, x2: 0.5, y2: 1 });
	});

	it('converts stop positions to 0-1 offsets and keeps alpha', () => {
		const def = buildSvgGradientDef(
			style({
				fillGradientStops: [
					{ color: '#000000', position: 0 },
					{ color: '#FFFFFF', position: 100, opacity: 0 },
				],
			}),
			'e1',
		);
		expect(def?.stops).toStrictEqual([
			{ offset: 0, color: '#000000' },
			{ offset: 1, color: '#FFFFFF', opacity: 0 },
		]);
	});

	it('centres a radial gradient on its fillToRect', () => {
		// `<a:fillToRect r="100000" b="100000"/>` collapses to the top-left corner.
		const def = buildSvgGradientDef(
			style({
				fillGradientType: 'radial',
				fillGradientPathType: 'circle',
				fillGradientFillToRect: { l: 0, t: 0, r: 1, b: 1 },
			}),
			'e1',
		);
		expect(def).toMatchObject({ kind: 'radial', cx: 0, cy: 0 });
		// Farthest corner of the unit box from (0, 0).
		expect((def as { r: number }).r).toBeCloseTo(Math.SQRT2, 4);
	});

	it('centres a radial gradient with no fillToRect on the shape', () => {
		const def = buildSvgGradientDef(style({ fillGradientType: 'radial' }), 'e1');
		expect(def).toMatchObject({ kind: 'radial', cx: 0.5, cy: 0.5 });
	});
});

describe('svgGradientFillRef / svgGradientMarkup', () => {
	it('references the definition by id', () => {
		const def = buildSvgGradientDef(style(), 'ppt/slides/slide3.xml-shape-1');
		expect(svgGradientFillRef(def!)).toBe('url(#pptx-grad-ppt_slides_slide3_xml-shape-1)');
	});

	it('serialises a linear definition to markup', () => {
		const def = buildSvgGradientDef(style({ fillGradientAngle: 0 }), 'e1');
		const markup = svgGradientMarkup(def!);
		expect(markup).toContain('<linearGradient id="pptx-grad-e1"');
		expect(markup).toContain('<stop offset="0" stop-color="#D2F8F4"/>');
		expect(markup).toContain('<stop offset="1" stop-color="#FFFFFF"/>');
	});

	it('serialises a transparent stop with stop-opacity', () => {
		const def = buildSvgGradientDef(
			style({
				fillGradientStops: [
					{ color: '#000000', position: 0 },
					{ color: '#FFFFFF', position: 100, opacity: 0 },
				],
			}),
			'e1',
		);
		expect(svgGradientMarkup(def!)).toContain('stop-opacity="0"');
	});

	it('serialises a radial definition to markup', () => {
		const def = buildSvgGradientDef(style({ fillGradientType: 'radial' }), 'e1');
		expect(svgGradientMarkup(def!)).toContain('<radialGradient id="pptx-grad-e1"');
	});
});
