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

	it('marks ellipses and round-rects', () => {
		const [ell, round, rect] = projectDrawingShapes(
			ID,
			[
				shape({ id: 'e', shapeType: 'ellipse' }),
				shape({ id: 'r', shapeType: 'roundRect', width: 100, height: 50 }),
				shape({ id: 'p', shapeType: 'rect' }),
			],
			VB,
			DEFAULT_PALETTE,
			'flat',
		);
		expect(ell.isEllipse).toBeTruthy();
		expect(ell.rx).toBe(0);
		expect(round.isEllipse).toBeFalsy();
		// rx = min(width, height) * 0.1 = 50 * 0.1
		expect(round.rx).toBe(5);
		expect(rect.isEllipse).toBeFalsy();
		expect(rect.rx).toBe(0);
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

	it('truncates long text to 30 chars and leaves short text alone', () => {
		const long = 'x'.repeat(60);
		const [r] = projectDrawingShapes(ID, [shape({ text: long })], VB, DEFAULT_PALETTE, 'flat');
		expect(r.text).toBeDefined();
		expect(r.text!).toHaveLength(30);
		const [s] = projectDrawingShapes(ID, [shape({ text: 'short' })], VB, DEFAULT_PALETTE, 'flat');
		expect(s.text).toBe('short');
	});

	it('leaves text undefined when the shape has none', () => {
		const [r] = projectDrawingShapes(ID, [shape()], VB, DEFAULT_PALETTE, 'flat');
		expect(r.text).toBeUndefined();
	});

	it('defaults font colour to white and clamps a derived font size', () => {
		const [r] = projectDrawingShapes(ID, [shape({ height: 1000 })], VB, DEFAULT_PALETTE, 'flat');
		expect(r.fontColor).toBe('white');
		// height * 0.2 = 200, clamped to the 14px ceiling
		expect(r.fontSize).toBe(14);
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
