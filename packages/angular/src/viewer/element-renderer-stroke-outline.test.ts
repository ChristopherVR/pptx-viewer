/**
 * Unit tests for the gradient / pattern OUTLINE wiring in
 * `ElementRendererComponent`.
 *
 * The Angular compiler / TestBed needs `@analogjs/vite-plugin-angular` (a
 * follow-up), so like the other `element-renderer-*.test.ts` files this
 * exercises the accessor the template binds to (`getStrokeOutline`) plus the
 * style module's border suppression, rather than instantiating the component.
 * The template's job on top of these is a plain `@if` over `paint.kind`.
 *
 * A CSS `border` takes one flat colour, so a gradient outline was painted with
 * the parser's averaged `strokeColor` and a patterned one with the pattern's
 * bare foreground - the hatching vanished. Both are now stroked as an SVG path
 * over the element.
 */
import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { getStrokeOutline } from './element-effect-defs';
import { getShapeFillStrokeStyle } from './element-style';

function shape(shapeStyle: ShapeStyle, overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'shape',
		id: 'ppt/slides/slide1.xml-shape-0',
		x: 0,
		y: 0,
		width: 180,
		height: 140,
		shapeType: 'rect',
		shapeStyle,
		...overrides,
	} as PptxElement;
}

const PATTERN: ShapeStyle = {
	strokeFillMode: 'pattern',
	strokeWidth: 6,
	strokeColor: '#1F4E79',
	strokePatternPreset: 'dkDnDiag',
	strokePatternBackgroundColor: '#FFF2CC',
};

const GRADIENT: ShapeStyle = {
	strokeFillMode: 'gradient',
	strokeWidth: 6,
	strokeColor: '#7F007F',
	strokeGradientStops: [
		{ color: '#FF0000', position: 0 },
		{ color: '#0000FF', position: 100 },
	],
	strokeGradientAngle: 0,
	strokeGradientType: 'linear',
};

describe('elementRenderer stroke outline (pattern)', () => {
	it('exposes a <pattern> paint server with a tile the template can bind', () => {
		const outline = getStrokeOutline(shape(PATTERN));
		expect(outline).toBeDefined();
		expect(outline!.paint!.kind).toBe('pattern');
		if (outline!.paint!.kind !== 'pattern') {
			throw new Error('expected a pattern paint');
		}
		// Every field the Angular template binds with `[attr.…]`.
		expect(outline!.paint!.id).toBeTruthy();
		expect(outline!.paint!.width).toBeGreaterThan(0);
		expect(outline!.paint!.height).toBeGreaterThan(0);
		expect(outline!.paint!.href.startsWith('data:image/svg+xml,')).toBeTruthy();
		const tile = decodeURIComponent(outline!.paint!.href);
		expect(tile).toContain('#1F4E79');
		expect(tile).toContain('#FFF2CC');
	});

	it('follows a round shape rather than its bounding box', () => {
		const outline = getStrokeOutline(
			shape(PATTERN, { shapeType: 'ellipse' } as Partial<PptxElement>),
		);
		expect(outline!.d).toContain('A ');
	});

	it('drops the CSS border for a pattern outline', () => {
		const style = getShapeFillStrokeStyle(shape(PATTERN));
		expect(style['border']).toBeUndefined();
	});
});

describe('elementRenderer stroke outline (gradient)', () => {
	it('exposes a linear paint server with both stops', () => {
		const outline = getStrokeOutline(shape(GRADIENT));
		expect(outline!.paint!.kind).toBe('linear');
		if (outline!.paint!.kind === 'pattern') {
			throw new Error('expected a gradient paint');
		}
		expect(outline!.paint!.stops.map((stop) => stop.color)).toStrictEqual(['#FF0000', '#0000FF']);
	});

	it('drops the CSS border for a gradient outline', () => {
		expect(getShapeFillStrokeStyle(shape(GRADIENT))['border']).toBeUndefined();
	});
});

describe('elementRenderer stroke outline (solid control)', () => {
	it('leaves a solid outline on the cheaper CSS border', () => {
		const solid = shape({ strokeFillMode: 'solid', strokeColor: '#00B050', strokeWidth: 6 });
		expect(getStrokeOutline(solid)).toBeUndefined();
		expect(String(getShapeFillStrokeStyle(solid)['border'])).toContain('#00B050');
	});
});

/**
 * Stroke-only ("open") preset geometry (`<a:prstGeom prst="line"/>`, `arc`, the
 * connector family). Angular drew a CSS border on ALL FOUR edges for these, so a
 * `line` rendered as a rectangle outline; they are stroked from the shared
 * `buildStrokeOutline` now, like every other binding.
 */
describe('elementRenderer stroke outline (stroke-only preset)', () => {
	/** The media deck's horizontal rule: `prst="line"`, 1 EMU tall, 1.5pt black. */
	const rule = (overrides: Partial<PptxElement> = {}): PptxElement =>
		shape({ strokeColor: '#000000', strokeWidth: 2 }, {
			shapeType: 'line',
			width: 400,
			height: 0,
			...overrides,
		} as Partial<PptxElement>);

	it('strokes the evaluated geometry with a flat colour, no paint server', () => {
		const outline = getStrokeOutline(rule());
		expect(outline!.paint).toBeUndefined();
		expect(outline!.stroke).toBe('#000000');
		expect(outline!.d).toBe('M 0 0 L 400 1');
		expect(outline!.strands).toStrictEqual([{ strokeWidth: 2, offset: 0 }]);
	});

	it('leaves the container with no border, no fill and no clip-path', () => {
		const style = getShapeFillStrokeStyle(rule());
		expect(style['border']).toBe('none');
		expect(style['background-color']).toBe('transparent');
		expect(style['clip-path']).toBeUndefined();
	});

	it('leaves a closed preset boxed by its CSS border, as before', () => {
		const box = rule({ shapeType: 'rect', height: 140 } as Partial<PptxElement>);
		expect(getStrokeOutline(box)).toBeUndefined();
		expect(String(getShapeFillStrokeStyle(box)['border'])).toContain('#000000');
	});
});
