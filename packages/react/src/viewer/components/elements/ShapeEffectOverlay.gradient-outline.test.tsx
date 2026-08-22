import type { PptxElement } from 'pptx-viewer-core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { getShapeVisualStyle } from '../../utils/shape-visual-style';
import { shapeParams } from './element-shape-params';
import { ShapeEffectOverlay } from './ShapeEffectOverlay';

/**
 * Gradient OUTLINES (`a:ln/a:gradFill`).
 *
 * A CSS `border` takes a single colour, so a gradient outline was painted with
 * the parser's averaged `strokeColor`: a two-tone outline came out flat and one
 * that fades to transparent came out fully opaque along its whole length. The
 * outline is now stroked as a real SVG path over the element, following the
 * shape's own geometry, and the CSS border is dropped so the averaged solid
 * cannot show underneath it.
 */
function shape(overrides: Record<string, unknown> = {}): PptxElement {
	return {
		id: 'ppt/slides/slide4.xml-shape-3',
		type: 'shape',
		x: 0,
		y: 0,
		width: 200,
		height: 100,
		shapeType: 'ellipse',
		shapeStyle: {
			strokeFillMode: 'gradient',
			strokeWidth: 3,
			strokeColor: '#D8DEDF',
			strokeGradientStops: [
				{ color: '#F0FDFE', position: 0 },
				{ color: '#BFBFBF', position: 100 },
			],
			strokeGradientAngle: 45,
			strokeGradientType: 'linear',
			...overrides,
		},
	} as unknown as PptxElement;
}

const markup = (element: PptxElement) =>
	renderToStaticMarkup(<ShapeEffectOverlay element={element} />);

describe('shapeEffectOverlay gradient outline', () => {
	it('strokes the outline with a paint server instead of one flat colour', () => {
		const html = markup(shape());
		expect(html).toContain('<linearGradient');
		expect(html).toContain('id="pptx-stroke-ppt_slides_slide4_xml-shape-3"');
		expect(html).toContain('stroke="url(#pptx-stroke-ppt_slides_slide4_xml-shape-3)"');
		expect(html).toContain('stop-color="#F0FDFE"');
		expect(html).toContain('stop-color="#BFBFBF"');
		// The averaged stand-in must not be painted.
		expect(html).not.toContain('#D8DEDF');
	});

	it('traces the shape outline, not its bounding box', () => {
		// An ellipse is otherwise drawn with `border-radius`; a rectangular
		// gradient border around it would be plainly wrong.
		expect(markup(shape())).toContain('A ');
	});

	it('keeps a transparent stop transparent', () => {
		const html = markup(
			shape({
				strokeGradientStops: [
					{ color: '#000000', position: 0 },
					{ color: '#FFFFFF', position: 100, opacity: 0 },
				],
			}),
		);
		expect(html).toContain('stop-opacity="0"');
	});

	it('drops the CSS border so the averaged solid cannot show through', () => {
		const element = shape();
		const { hf, fc, sw, sc } = shapeParams(element);
		const style = getShapeVisualStyle(element, hf, fc, sw, sc);
		expect(style.borderWidth).toBe(0);
		expect(style.borderColor).toBeUndefined();
	});

	it('leaves an explicitly INSET solid outline on the CSS border (cheaper, and correct)', () => {
		// Only `algn="in"` is a `border-box` CSS border already correct for: the
		// default `ctr` alignment centres the line on the path (half outside the
		// box), which the SVG overlay paints instead (see `stroke-outline.ts`).
		const element = shape({
			strokeFillMode: 'solid',
			strokeColor: '#123456',
			strokeGradientStops: undefined,
			lineAlignment: 'in',
		});
		expect(markup(element)).not.toContain('linearGradient');
		const { hf, fc, sw, sc } = shapeParams(element);
		expect(getShapeVisualStyle(element, hf, fc, sw, sc).borderWidth).toBe(3);
	});

	it('centres a solid outline at the default (omitted) alignment instead', () => {
		const element = shape({
			strokeFillMode: 'solid',
			strokeColor: '#123456',
			strokeGradientStops: undefined,
		});
		expect(markup(element)).not.toContain('linearGradient');
		expect(markup(element)).toContain('stroke="#123456"');
		const { hf, fc, sw, sc } = shapeParams(element);
		expect(getShapeVisualStyle(element, hf, fc, sw, sc).borderWidth).toBe(0);
	});
});

/**
 * Pattern OUTLINES (`a:ln/a:pattFill`). A CSS border cannot be hatched, so the
 * pattern used to vanish entirely and the outline painted as the pattern's flat
 * foreground. The tile rides in as a data-URI `<image>` inside a `<pattern>`, so
 * the same descriptor renders from plain attributes in every binding.
 */
describe('shapeEffectOverlay pattern outline', () => {
	const patternShape = () =>
		shape({
			strokeFillMode: 'pattern',
			strokeColor: '#1F4E79',
			strokePatternPreset: 'dkDnDiag',
			strokePatternBackgroundColor: '#FFF2CC',
			strokeGradientStops: undefined,
		});

	it('strokes with a tiled <pattern> paint server', () => {
		const html = markup(patternShape());
		expect(html).toContain('<pattern');
		expect(html).toContain('patternUnits="userSpaceOnUse"');
		expect(html).toContain('id="pptx-strokepat-ppt_slides_slide4_xml-shape-3"');
		expect(html).toContain('stroke="url(#pptx-strokepat-ppt_slides_slide4_xml-shape-3)"');
	});

	it('carries both pattern colours in the tile', () => {
		// Decode only the data URI: the surrounding markup has bare `%` (e.g. the
		// `100%` sizing) that is not a valid escape sequence.
		const href = /href="(data:image\/svg\+xml,[^"]*)"/u.exec(markup(patternShape()))?.[1];
		expect(href, 'the tile rides in as a data URI').toBeTruthy();
		const tile = decodeURIComponent(String(href));
		expect(tile).toContain('#1F4E79');
		expect(tile).toContain('#FFF2CC');
	});

	it('drops the CSS border for a pattern outline too', () => {
		const element = patternShape();
		const { hf, fc, sw, sc } = shapeParams(element);
		expect(getShapeVisualStyle(element, hf, fc, sw, sc).borderWidth).toBe(0);
	});

	it('falls back to a flat centred stroke for a preset it cannot draw', () => {
		// The pattern fails to resolve, but the shape is still at the default
		// `ctr` alignment, so the SVG overlay still fires, now with the flat
		// `strokeColor` rather than the (unresolvable) pattern.
		const element = shape({
			strokeFillMode: 'pattern',
			strokePatternPreset: 'notARealPreset',
			strokeGradientStops: undefined,
		});
		const html = markup(element);
		expect(html).not.toContain('<pattern');
		expect(html).toContain('stroke="#D8DEDF"');
		const { hf, fc, sw, sc } = shapeParams(element);
		expect(getShapeVisualStyle(element, hf, fc, sw, sc).borderWidth).toBe(0);
	});

	it('leaves an explicitly INSET pattern-preset fallback on the CSS border', () => {
		const element = shape({
			strokeFillMode: 'pattern',
			strokePatternPreset: 'notARealPreset',
			strokeGradientStops: undefined,
			lineAlignment: 'in',
		});
		expect(markup(element)).not.toContain('<pattern');
		const { hf, fc, sw, sc } = shapeParams(element);
		expect(getShapeVisualStyle(element, hf, fc, sw, sc).borderWidth).toBe(3);
	});
});

/**
 * Stroke-only ("open") PRESET geometry (`<a:prstGeom prst="line"/>`, `arc`, the
 * connector family).
 *
 * These presets have no region to fill and no box to outline, so a CSS border
 * drew a RECTANGLE where PowerPoint draws a line or an arc. They are stroked
 * from the shared `buildStrokeOutline` here, which is the single implementation
 * all five bindings paint them with.
 */
describe('shapeEffectOverlay stroke-only preset', () => {
	/** The media deck's horizontal rule: `prst="line"`, 1 EMU tall, 1.5pt black. */
	const rule = (overrides: Record<string, unknown> = {}): PptxElement =>
		({
			id: 'rule-1',
			type: 'shape',
			x: 0,
			y: 0,
			width: 400,
			height: 0,
			shapeType: 'line',
			shapeStyle: { strokeColor: '#000000', strokeWidth: 2 },
			...overrides,
		}) as unknown as PptxElement;

	it('strokes the geometry with a flat colour and no paint server', () => {
		const html = markup(rule());
		expect(html).toContain('d="M 0 0 L 400 1"');
		expect(html).toContain('stroke="#000000"');
		expect(html).not.toContain('<linearGradient');
	});

	it('sizes the viewBox to the padded box so the rule stays horizontal', () => {
		// The authored extent (400x0) stretched over the 12px-tall padded box
		// would tilt the rule into a diagonal.
		expect(markup(rule())).toContain('viewBox="0 0 400 12"');
	});

	it('drops the container fill, border and clip-path', () => {
		const element = rule();
		const { hf, fc, sw, sc } = shapeParams(element);
		const style = getShapeVisualStyle(element, hf, fc, sw, sc);
		expect(style.backgroundColor).toBe('transparent');
		expect(style.borderWidth).toBeUndefined();
		expect(style.borderTopWidth).toBeUndefined();
		expect(style.clipPath).toBeUndefined();
	});

	it('leaves an explicitly INSET closed preset to its CSS border', () => {
		// `algn="in"` is the one alignment a CSS border already paints correctly,
		// so a closed preset must not ALSO get a painted SVG stroke outline. It
		// does still get the transparent `pointer-events:stroke` hit band, because
		// this fixture is unfilled and textless: a hollow frame, whose interior
		// must let clicks through to whatever it is drawn over.
		const html = markup(
			rule({
				shapeType: 'rect',
				height: 100,
				shapeStyle: { strokeColor: '#000000', strokeWidth: 2, lineAlignment: 'in' },
			}),
		);
		expect(html).not.toContain('stroke="#000000"');
		expect(html).toContain('stroke="transparent"');
	});

	it('centres a closed preset at the default (omitted) alignment instead', () => {
		const html = markup(rule({ shapeType: 'rect', height: 100 }));
		expect(html).toContain('stroke="#000000"');
	});
});
