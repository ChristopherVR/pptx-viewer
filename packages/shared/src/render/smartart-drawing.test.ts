/**
 * Unit tests for the SmartArt pre-computed drawing-shape helpers
 * (smartart-drawing.ts). These exercise the pure projection + palette + chrome
 * functions that back the `smartArtData.drawingShapes` render path. No DOM, no
 * framework code.
 */

import type {
	PptxSmartArtChrome,
	PptxSmartArtData,
	PptxSmartArtDrawingShape,
	SmartArtStyle,
} from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	buildChromeStyle,
	computeDrawingViewBox,
	DEFAULT_PALETTE,
	PALETTES,
	paletteColour,
	projectDrawingShapes,
	resolvePalette,
	styleShadowFilter,
} from './smartart-drawing';

// ── Test helpers ──────────────────────────────────────────────────────────────

const ID = 'el1';

function shape(over: Partial<PptxSmartArtDrawingShape> = {}): PptxSmartArtDrawingShape {
	return {
		id: 's1',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		...over,
	};
}

function data(over: Partial<PptxSmartArtData> = {}): PptxSmartArtData {
	return { nodes: [], ...over };
}

// ── computeDrawingViewBox ──────────────────────────────────────────────────────

describe('computeDrawingViewBox', () => {
	it('fits a single shape, rebasing to its own origin', () => {
		const vb = computeDrawingViewBox([shape({ x: 10, y: 20, width: 100, height: 50 })]);
		expect(vb).toStrictEqual({ minX: 10, minY: 20, width: 100, height: 50 });
	});

	it('spans the union bounding box of multiple shapes', () => {
		const vb = computeDrawingViewBox([
			shape({ id: 'a', x: 10, y: 10, width: 40, height: 40 }),
			shape({ id: 'b', x: 100, y: 60, width: 50, height: 30 }),
		]);
		expect(vb).toStrictEqual({ minX: 10, minY: 10, width: 140, height: 80 });
	});

	it('handles negative coordinates', () => {
		const vb = computeDrawingViewBox([
			shape({ id: 'a', x: -50, y: -20, width: 30, height: 10 }),
			shape({ id: 'b', x: 20, y: 40, width: 10, height: 10 }),
		]);
		expect(vb).toStrictEqual({ minX: -50, minY: -20, width: 80, height: 70 });
	});

	it('returns a 1x1 default for an empty shape list', () => {
		expect(computeDrawingViewBox([])).toStrictEqual({ minX: 0, minY: 0, width: 1, height: 1 });
	});

	it('clamps a zero-area span to a minimum width/height of 1', () => {
		const vb = computeDrawingViewBox([shape({ x: 5, y: 5, width: 0, height: 0 })]);
		expect(vb).toStrictEqual({ minX: 5, minY: 5, width: 1, height: 1 });
	});
});

// ── resolvePalette ─────────────────────────────────────────────────────────────

describe('resolvePalette', () => {
	it('returns the default palette when data is undefined', () => {
		expect(resolvePalette(undefined)).toBe(DEFAULT_PALETTE);
	});

	it('prefers colorTransform fill colours when present', () => {
		const fills = ['#111111', '#222222'];
		expect(resolvePalette(data({ colorTransform: { fillColors: fills } }))).toBe(fills);
	});

	it('falls back to the named scheme when colorTransform fills are empty', () => {
		expect(
			resolvePalette(data({ colorScheme: 'colorful2', colorTransform: { fillColors: [] } })),
		).toBe(PALETTES.colorful2);
	});

	it('resolves a named scheme', () => {
		expect(resolvePalette(data({ colorScheme: 'monochromatic1' }))).toBe(PALETTES.monochromatic1);
	});

	it('defaults to colorful1 when no scheme is set', () => {
		expect(resolvePalette(data({}))).toBe(PALETTES.colorful1);
		expect(DEFAULT_PALETTE).toBe(PALETTES.colorful1);
	});
});

// ── paletteColour ──────────────────────────────────────────────────────────────

describe('paletteColour', () => {
	it('indexes directly within bounds', () => {
		expect(paletteColour(0, DEFAULT_PALETTE)).toBe(DEFAULT_PALETTE[0]);
		expect(paletteColour(2, DEFAULT_PALETTE)).toBe(DEFAULT_PALETTE[2]);
	});

	it('wraps around the palette length', () => {
		const len = DEFAULT_PALETTE.length;
		expect(paletteColour(len, DEFAULT_PALETTE)).toBe(DEFAULT_PALETTE[0]);
		expect(paletteColour(len + 1, DEFAULT_PALETTE)).toBe(DEFAULT_PALETTE[1]);
	});
});

// ── buildChromeStyle ───────────────────────────────────────────────────────────

describe('buildChromeStyle', () => {
	it('returns the base style when chrome is undefined', () => {
		expect(buildChromeStyle(undefined)).toStrictEqual({
			width: '100%',
			height: '100%',
			'box-sizing': 'border-box',
			overflow: 'hidden',
		});
	});

	it('applies a background colour', () => {
		const chrome: PptxSmartArtChrome = { backgroundColor: '#abcdef' };
		expect(buildChromeStyle(chrome)['background-color']).toBe('#abcdef');
	});

	it('applies an outline border with the supplied width', () => {
		const chrome: PptxSmartArtChrome = { outlineColor: '#ff0000', outlineWidth: 3 };
		expect(buildChromeStyle(chrome).border).toBe('3px solid #ff0000');
	});

	it('defaults outline width to 1px when omitted', () => {
		const chrome: PptxSmartArtChrome = { outlineColor: '#00ff00' };
		expect(buildChromeStyle(chrome).border).toBe('1px solid #00ff00');
	});

	it('does not set a border when only an outline width is present', () => {
		const chrome: PptxSmartArtChrome = { outlineWidth: 5 };
		expect(buildChromeStyle(chrome).border).toBeUndefined();
	});
});

// ── projectDrawingShapes ───────────────────────────────────────────────────────

describe('projectDrawingShapes', () => {
	const VB = { minX: 10, minY: 20, width: 200, height: 100 };

	it('rebases positions relative to the viewBox origin', () => {
		const shapes = [shape({ x: 60, y: 70, width: 40, height: 30 })];
		const [r] = projectDrawingShapes(ID, shapes, VB, DEFAULT_PALETTE, 'flat');
		expect(r.x).toBe(50);
		expect(r.y).toBe(50);
		expect(r.cx).toBe(70);
		expect(r.cy).toBe(65);
	});

	it('builds a deterministic key from element id, shape id and index', () => {
		const [r] = projectDrawingShapes(ID, [shape({ id: 'abc' })], VB, DEFAULT_PALETTE, 'flat');
		expect(r.key).toBe('el1-dsp-abc-0');
	});

	it('picks the primitive that paints each preset, through the alias normaliser', () => {
		const [ell, oval, round, rect, chevron, homePlate, picture] = projectDrawingShapes(
			ID,
			[
				shape({ id: 'e', shapeType: 'ellipse' }),
				// `oval` is the spelling the shape picker inserts.
				shape({ id: 'o', shapeType: 'oval' }),
				shape({ id: 'r', shapeType: 'roundRect', width: 100, height: 50 }),
				shape({ id: 'p', shapeType: 'rect' }),
				shape({ id: 'c', shapeType: 'chevron' }),
				shape({ id: 'h', shapeType: 'homePlate' }),
				shape({ id: 'i', fillImageUrl: 'data:image/png;base64,AAA' }),
			],
			VB,
			DEFAULT_PALETTE,
			'flat',
		);

		expect(ell.kind).toBe('ellipse');
		expect(oval.kind).toBe('ellipse');
		expect(ell.rx).toBe(0);
		expect(round.kind).toBe('rect');
		// rx = min(width, height) * 0.1 = 50 * 0.1
		expect(round.rx).toBe(5);
		expect(rect.kind).toBe('rect');
		expect(rect.rx).toBe(0);
		expect(chevron.kind).toBe('polygon');
		expect(chevron.points).toBeTruthy();
		expect(homePlate.kind).toBe('polygon');
		// A resolved picture fill paints the body instead of any colour.
		expect(picture.kind).toBe('image');
	});

	it('resolves a gradient fill to a paint server the binding can emit', () => {
		const [linear, radial] = projectDrawingShapes(
			ID,
			[
				shape({
					id: 'g1',
					fillGradientStops: [
						{ color: '#ffffff', position: 0 },
						{ color: '#156082', position: 100, opacity: 0.5 },
					],
					fillGradientType: 'linear',
					fillGradientAngle: 90,
				}),
				shape({
					id: 'g2',
					fillGradientStops: [
						{ color: '#000000', position: 0 },
						{ color: '#ffffff', position: 100 },
					],
					fillGradientType: 'radial',
				}),
			],
			VB,
			DEFAULT_PALETTE,
			'flat',
		);

		expect(linear.gradient?.kind).toBe('linear');
		expect(linear.fill).toBe(`url(#${linear.gradient!.id})`);
		expect(linear.gradient!.stops).toStrictEqual([
			{ offset: '0%', color: '#ffffff' },
			{ offset: '100%', color: '#156082', opacity: 0.5 },
		]);
		// A 90 degree axis runs top to bottom.
		expect(linear.gradient!.y1).toBe('0%');
		expect(linear.gradient!.y2).toBe('100%');
		expect(radial.gradient?.kind).toBe('radial');
		expect(radial.gradient!.r).toBe('50%');
	});

	it('uses a pattern fill foreground as the flat stand-in', () => {
		const [r] = projectDrawingShapes(
			ID,
			[shape({ fillColor: '#111111', fillPatternForegroundColor: '#abcdef' })],
			VB,
			DEFAULT_PALETTE,
			'flat',
		);
		expect(r.fill).toBe('#abcdef');
	});

	it('falls back to palette colour, cycling by index, when no fillColor', () => {
		const shapes = [shape({ id: 'a' }), shape({ id: 'b' })];
		const out = projectDrawingShapes(ID, shapes, VB, ['#aaaaaa', '#bbbbbb'], 'flat');
		expect(out[0].fill).toBe('#aaaaaa');
		expect(out[1].fill).toBe('#bbbbbb');
	});

	it('honours an explicit shape fillColor over the palette', () => {
		const [r] = projectDrawingShapes(
			ID,
			[shape({ fillColor: '#123456' })],
			VB,
			DEFAULT_PALETTE,
			'flat',
		);
		expect(r.fill).toBe('#123456');
	});

	it('derives stroke from style when no explicit strokeColor (flat = none)', () => {
		const [r] = projectDrawingShapes(ID, [shape()], VB, DEFAULT_PALETTE, 'flat');
		expect(r.stroke).toBe('none');
		expect(r.strokeWidth).toBe(0);
	});

	it('derives a translucent stroke for intense style', () => {
		const [r] = projectDrawingShapes(ID, [shape()], VB, DEFAULT_PALETTE, 'intense');
		expect(r.stroke).toBe('rgba(255,255,255,0.3)');
		expect(r.strokeWidth).toBe(2);
	});

	it('honours explicit stroke colour and width', () => {
		const [r] = projectDrawingShapes(
			ID,
			[shape({ strokeColor: '#000000', strokeWidth: 4 })],
			VB,
			DEFAULT_PALETTE,
			'flat',
		);
		expect(r.stroke).toBe('#000000');
		expect(r.strokeWidth).toBe(4);
	});

	it('emits a rotation transform about the shape centre when rotated', () => {
		const [r] = projectDrawingShapes(
			ID,
			[shape({ x: 60, y: 70, width: 40, height: 30, rotation: 45 })],
			VB,
			DEFAULT_PALETTE,
			'flat',
		);
		expect(r.transform).toBe('rotate(45 70 65)');
	});

	it('omits the transform when not rotated', () => {
		const [r] = projectDrawingShapes(ID, [shape()], VB, DEFAULT_PALETTE, 'flat');
		expect(r.transform).toBeUndefined();
	});

	it('wraps a long label instead of cutting it', () => {
		const sentence = 'Located in urban areas, far from the rural villages it serves';
		const [r] = projectDrawingShapes(
			ID,
			[shape({ width: 120, text: sentence })],
			VB,
			DEFAULT_PALETTE,
			'flat',
		);

		expect(r.textLines.length).toBeGreaterThan(1);
		expect(r.textLines.map((line) => line.text).join(' ')).toBe(sentence);
	});

	it('keeps a short label on one line, centred on the shape', () => {
		const [r] = projectDrawingShapes(ID, [shape({ text: 'short' })], VB, DEFAULT_PALETTE, 'flat');

		expect(r.textLines).toHaveLength(1);
		expect(r.textLines[0]!.text).toBe('short');
		expect(r.textLines[0]!.y).toBeCloseTo(r.textY, 5);
	});

	it('stacks wrapped lines around the shape centre', () => {
		const [r] = projectDrawingShapes(
			ID,
			[shape({ width: 60, text: 'alpha beta gamma delta epsilon' })],
			VB,
			DEFAULT_PALETTE,
			'flat',
		);
		const offsets = r.textLines.map((line) => line.y - r.textY);

		expect(offsets[0]!).toBeLessThan(0);
		expect(offsets.at(-1)!).toBeGreaterThan(0);
		expect(offsets.reduce((sum, offset) => sum + offset, 0)).toBeCloseTo(0, 5);
	});

	it('emits no lines when the shape has no text', () => {
		const [r] = projectDrawingShapes(ID, [shape()], VB, DEFAULT_PALETTE, 'flat');
		expect(r.textLines).toStrictEqual([]);
	});

	it('derives a readable font colour from the fill and clamps the font size', () => {
		const [onDark] = projectDrawingShapes(
			ID,
			[shape({ height: 1000, fillColor: '#1f3864' })],
			VB,
			DEFAULT_PALETTE,
			'flat',
		);
		const [onLight] = projectDrawingShapes(
			ID,
			[shape({ height: 1000, fillColor: '#ffffff' })],
			VB,
			DEFAULT_PALETTE,
			'flat',
		);

		expect(onDark.fontColor).toBe('#ffffff');
		expect(onLight.fontColor).toBe('#1a1a1a');
		// height * 0.2 = 200, clamped to the 14px ceiling
		expect(onDark.fontSize).toBe(14);
	});

	it('leaves an a:noFill shape unpainted and reads contrast from the shape below', () => {
		const [panel, label] = projectDrawingShapes(
			ID,
			[
				shape({ x: 0, y: 0, width: 200, height: 100, fillColor: '#1f3864' }),
				shape({ x: 10, y: 10, width: 180, height: 80, fillNone: true, text: 'Heading' }),
			],
			VB,
			DEFAULT_PALETTE,
			'flat',
		);

		expect(panel!.fill).toBe('#1f3864');
		expect(label!.fill).toBe('none');
		expect(label!.fontColor).toBe('#ffffff');
	});

	it('carries a resolved picture fill through to the renderer', () => {
		const [r] = projectDrawingShapes(
			ID,
			[shape({ fillImageUrl: 'data:image/png;base64,AAA' })],
			VB,
			DEFAULT_PALETTE,
			'flat',
		);
		expect(r.imageUrl).toBe('data:image/png;base64,AAA');
	});

	it('floors a derived font size at 8px for tiny shapes', () => {
		const [r] = projectDrawingShapes(ID, [shape({ height: 4 })], VB, DEFAULT_PALETTE, 'flat');
		expect(r.fontSize).toBe(8);
	});

	it('honours explicit font colour and size', () => {
		const [r] = projectDrawingShapes(
			ID,
			[shape({ fontColor: '#abcabc', fontSize: 22 })],
			VB,
			DEFAULT_PALETTE,
			'flat',
		);
		expect(r.fontColor).toBe('#abcabc');
		expect(r.fontSize).toBe(22);
	});

	it('returns an empty array for no shapes', () => {
		expect(projectDrawingShapes(ID, [], VB, DEFAULT_PALETTE, 'flat')).toStrictEqual([]);
	});
});

// ── styleShadowFilter ──────────────────────────────────────────────────────────

describe('styleShadowFilter', () => {
	it('returns undefined for flat style', () => {
		expect(styleShadowFilter('flat')).toBeUndefined();
	});

	it('returns a drop-shadow for moderate and intense styles', () => {
		for (const style of ['moderate', 'intense'] as SmartArtStyle[]) {
			const f = styleShadowFilter(style);
			expect(f).toBeDefined();
			expect(f).toContain('drop-shadow');
		}
	});
});
