import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { getContainerStyle, getShapeFillStrokeStyle, getTextBlockStyle } from './element-style';

function shape(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'shape',
		id: 's1',
		x: 10,
		y: 20,
		width: 100,
		height: 50,
		...overrides,
	} as PptxElement;
}

describe('getContainerStyle', () => {
	it('positions and sizes the element absolutely', () => {
		const style = getContainerStyle(shape(), 3);
		expect(style.position).toBe('absolute');
		expect(style.left).toBe('10px');
		expect(style.top).toBe('20px');
		expect(style.width).toBe('100px');
		expect(style.height).toBe('50px');
		expect(style.zIndex).toBe(3);
	});

	it('applies rotation and flip transforms', () => {
		const style = getContainerStyle(shape({ rotation: 45, flipHorizontal: true }), 0);
		expect(style.transform).toContain('rotate(45deg)');
		expect(style.transform).toContain('scaleX(-1)');
	});
});

describe('getShapeFillStrokeStyle', () => {
	it('renders solid fill and stroke', () => {
		// Pinned to `algn="in"`: the default `ctr` alignment now routes a solid
		// outline through the SVG stroke overlay instead of a CSS border (see
		// shared `stroke-outline.ts`).
		const style = getShapeFillStrokeStyle(
			shape({
				shapeStyle: {
					fillColor: '#ff0000',
					strokeColor: '#000',
					strokeWidth: 2,
					lineAlignment: 'in',
				},
			}),
		);
		expect(style.backgroundColor).toBe('#ff0000');
		expect(style.border).toBe('2px solid #000');
	});

	it('maps stroke dash to a CSS border style', () => {
		// Pinned to `algn="in"`: the default `ctr` alignment now routes a solid
		// outline through the SVG stroke overlay instead of a CSS border (see
		// shared `stroke-outline.ts`), and this test is specifically about the
		// dash-type mapping.
		const dotted = getShapeFillStrokeStyle(
			shape({
				shapeStyle: {
					strokeColor: '#000',
					strokeWidth: 1,
					strokeDash: 'dot',
					lineAlignment: 'in',
				},
			}),
		);
		expect(dotted.border).toBe('1px dotted #000');
		const dashed = getShapeFillStrokeStyle(
			shape({
				shapeStyle: {
					strokeColor: '#000',
					strokeWidth: 1,
					strokeDash: 'dash',
					lineAlignment: 'in',
				},
			}),
		);
		expect(dashed.border).toBe('1px dashed #000');
	});

	it('rounds ellipse geometry with a per-axis 50% radius', () => {
		const style = getShapeFillStrokeStyle(shape({ shapeType: 'ellipse' }));
		expect(style.borderRadius).toBe('50%');
		expect(style.clipPath).toBeUndefined();
	});

	it('rounds roundRect geometry by adjustment value', () => {
		const style = getShapeFillStrokeStyle(
			shape({ shapeType: 'roundRect', width: 100, height: 100, shapeAdjustments: { adj: 25000 } }),
		);
		// adj 25000/50000 = 0.5 → radius = min(100,100) * 0.5 * 0.5 = 25px
		expect(style.borderRadius).toBe('25px');
		expect(style.clipPath).toBeUndefined();
	});

	it('emits a clip-path for non-rect preset geometries', () => {
		const style = getShapeFillStrokeStyle(shape({ shapeType: 'triangle', width: 120, height: 80 }));
		expect(style.clipPath).toBeTypeOf('string');
		expect(style.clipPath).not.toBe('');
		expect(style.borderRadius).toBeUndefined();
	});

	it('reshapes a custom-geometry clip-path LIVE from shapeAdjustments, not the frozen pathData', () => {
		// `x1 = w * adj1 / 100000`; pathData was frozen at the authored default
		// (adj1 = 25000, x1 = 50) but shapeAdjustments already carries an
		// in-progress drag (adj1 = 75000, x1 = 150) - the on-canvas counterpart
		// to a handle drag that has not committed yet (limitations.md: "a:custGeom
		// adjustment-handle drag: Commits on release, not live").
		const rawData = {
			avLstXml: { 'a:gd': { '@_name': 'adj1', '@_fmla': 'val 25000' } },
			gdLstXml: { 'a:gd': { '@_name': 'x1', '@_fmla': '*/ w adj1 100000' } },
			pathLstXml: {
				'a:path': {
					'@_w': '200',
					'@_h': '100',
					'a:moveTo': { 'a:pt': { '@_x': '0', '@_y': '0' } },
					'a:lnTo': [
						{ 'a:pt': { '@_x': 'x1', '@_y': '0' } },
						{ 'a:pt': { '@_x': 'x1', '@_y': '100' } },
					],
					'a:close': {},
				},
			},
		};
		const style = getShapeFillStrokeStyle(
			shape({
				shapeType: 'custom',
				width: 200,
				height: 100,
				pathData: 'M 0 0 L 50 0 L 50 100 Z',
				pathWidth: 200,
				pathHeight: 100,
				customGeometryRawData: rawData,
				shapeAdjustments: { adj1: 75000 },
			} as Partial<PptxElement>),
		);
		expect(style.clipPath).toBe("path('M 0 0 L 150 0 L 150 100 Z')");
	});

	it('leaves a line shape bare for the stroke overlay to paint', () => {
		// `line` is stroke-only geometry: `ShapeEffectOverlay` strokes the
		// evaluated path from shared `buildStrokeOutline`. A CSS border here would
		// box the shape into the rectangle it does not have, and the preset's
		// clip-path (a zero-area open path) would clip the overlay away.
		const style = getShapeFillStrokeStyle(
			shape({
				type: 'shape',
				shapeType: 'line',
				shapeStyle: { strokeColor: '#123456', strokeWidth: 3 },
			}),
		);
		expect(style.backgroundColor).toBe('transparent');
		expect(style.border).toBe('none');
		expect(style.borderTop).toBeUndefined();
		expect(style.clipPath).toBeUndefined();
	});

	it('does the same for a degenerate 1-EMU rule', () => {
		const style = getShapeFillStrokeStyle(
			shape({
				type: 'shape',
				shapeType: 'line',
				width: 400,
				height: 0,
				shapeStyle: { strokeColor: '#123456', strokeWidth: 3 },
			}),
		);
		expect(style.border).toBe('none');
		expect(style.borderTop).toBeUndefined();
	});
});

describe('getTextBlockStyle', () => {
	it('maps font + alignment from textStyle', () => {
		const style = getTextBlockStyle(
			shape({ textStyle: { fontSize: 18, bold: true, align: 'center', vAlign: 'middle' } }),
		);
		// Font size is emitted in CSS px (unitless React convention), not pt;
		// appending pt would inflate every glyph by ~1.33× and overflow the box.
		expect(style.fontSize).toBe('18px');
		// Numeric weight, as React emits: this style is now built by the shared
		// `buildTextBlockStyle` that both bindings render from.
		expect(style.fontWeight).toBe(700);
		expect(style.textAlign).toBe('center');
		expect(style.justifyContent).toBe('center');
	});

	// Defect A / B: this binding's own copy of the builder never read either
	// property, so a shrink-to-fit title painted 43% too large and a
	// `wrap="none"` line wrapped. Both now come from the shared builder.
	it('applies the normAutofit font scale and never wraps a wrap="none" body', () => {
		expect(
			getTextBlockStyle(
				shape({
					textStyle: {
						fontSize: 40,
						autoFit: true,
						autoFitMode: 'normal',
						autoFitFontScale: 0.7,
					},
				}),
			).fontSize,
		).toBe('28px');
		expect(getTextBlockStyle(shape({ textStyle: { textWrap: 'none' } })).whiteSpace).toBe('nowrap');
		expect(getTextBlockStyle(shape({ textStyle: {} })).whiteSpace).toBe('pre-wrap');
	});

	it('never shrinks the font for spAutoFit, however much text overflows', () => {
		// a:spAutoFit resizes the SHAPE to fit the text (ECMA-376), never the
		// font; a box authored in PowerPoint already has its `a:ext` sized to
		// fit, so the font must render unshrunk even for a box too small to
		// hold the text at that size.
		const style = getTextBlockStyle(
			shape({
				width: 50,
				height: 30,
				text: 'x'.repeat(2000),
				textStyle: { fontSize: 40, autoFit: true, autoFitMode: 'shrink' },
			}),
		);
		expect(style.fontSize).toBe('40px');
	});

	it("applies PowerPoint's 1.2 default line-height and honours explicit line spacing", () => {
		// 1.2 is PowerPoint's single spacing, measured via COM (issue #131).
		expect(getTextBlockStyle(shape({ textStyle: { fontSize: 18 } })).lineHeight).toBe(1.2);
		// The spcPct multiplier stacks on the 1.2 base: 0.9 * 1.2 = 1.08.
		expect(
			getTextBlockStyle(shape({ textStyle: { fontSize: 18, lineSpacing: 0.9 } })).lineHeight,
		).toBeCloseTo(1.08, 10);
		expect(
			getTextBlockStyle(shape({ textStyle: { fontSize: 18, lineSpacingExactPt: 20 } })).lineHeight,
		).toBe('20pt');
	});

	it('insets text from the box with default body padding', () => {
		const style = getTextBlockStyle(shape({ textStyle: { fontSize: 18 } }));
		expect(style.paddingLeft).toBe(`${91440 / 9525}px`);
		expect(style.paddingTop).toBe(`${45720 / 9525}px`);
	});

	it('clamps a:bodyPr/@vertOverflow="ellipsis" to a multi-line "…" truncation', () => {
		// Regression: shared's `resolveVertOverflowEllipsisStyle` composes this
		// AFTER `buildTextBodyLayoutStyle`'s flex-column display within one
		// `buildTextBlockStyle` call, so it must win rather than being clobbered
		// by the earlier flex layout this binding also asks for (`bodyLayout: true`).
		const style = getTextBlockStyle(
			shape({ width: 100, height: 100, textStyle: { fontSize: 24, vertOverflow: 'ellipsis' } }),
		);
		expect(style.display).toBe('-webkit-box');
		expect(style.overflow).toBe('hidden');
		expect(style.textOverflow).toBe('ellipsis');
		expect(style.WebkitLineClamp).toBeTypeOf('number');
	});
});

/**
 * issue #132 - the gradient tile offset must survive into the style map.
 *
 * `backgroundPosition` was the one key the shared `ComputedFillStyle` emitted
 * that this binding never copied, so PowerPoint's stock corner-radial preset
 * (`a:tileRect l="-100000" t="-100000"`: a tile twice the shape hung off its
 * top-left) got its `background-size` but stayed pinned at `0 0`.
 */
describe('getShapeFillStrokeStyle gradient tiling (#132)', () => {
	it('carries the background-position of an oversized tileRect', () => {
		const style = getShapeFillStrokeStyle(
			shape({
				shapeStyle: {
					fillMode: 'gradient',
					fillGradientType: 'radial',
					fillGradientPathType: 'circle',
					fillGradientFillToRect: { l: 0, t: 0, r: 1, b: 1 },
					fillGradientTileRect: { l: -1, t: -1, r: 0, b: 0 },
					fillGradientStops: [
						{ color: '#BFBFBF', position: 0 },
						{ color: '#FFFFFF', position: 100 },
					],
				},
			} as Partial<PptxElement>),
		);
		expect(style.backgroundImage).toContain('radial-gradient');
		expect(style.backgroundSize).toBe('200% 200%');
		expect(style.backgroundPosition).toBe('100% 100%');
	});

	it('emits a circle path gradient browsers can actually parse', () => {
		const style = getShapeFillStrokeStyle(
			shape({
				shapeStyle: {
					fillMode: 'gradient',
					fillGradientType: 'radial',
					fillGradientPathType: 'circle',
					fillGradientFillToRect: { l: 0, t: 0, r: 1, b: 1 },
					fillGradientStops: [
						{ color: '#BFBFBF', position: 0 },
						{ color: '#FFFFFF', position: 100 },
					],
				},
			} as Partial<PptxElement>),
		);
		// `circle <percentage>` is invalid CSS: the browser discards the whole
		// declaration and the shape renders unfilled.
		expect(style.backgroundImage).not.toMatch(/circle\s+[\d.]+%/u);
	});
});
