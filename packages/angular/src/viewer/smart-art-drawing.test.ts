/**
 * Tests for smart-art-drawing.ts (drawing-shapes path helpers).
 *
 * All assertions target pure TypeScript exports: no Angular, no DOM, no
 * TestBed. The SVG-fallback layout math is now owned by the shared engine and
 * tested in `pptx-viewer-shared`'s `smartart-layout.test.ts`.
 */
import type { PptxSmartArtData, PptxSmartArtDrawingShape } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	buildChromeStyle,
	computeDrawingViewBox,
	DEFAULT_PALETTE,
	paletteColour,
	PALETTES,
	projectDrawingShapes,
	resolvePalette,
	styleShadowFilter,
} from './smart-art-drawing';

// ──────────────────────────────────────────────────────────────────────────
// fixtures
// ──────────────────────────────────────────────────────────────────────────

function shape(over: Partial<PptxSmartArtDrawingShape> & { id: string }): PptxSmartArtDrawingShape {
	return {
		shapeType: 'roundRect',
		x: 0,
		y: 0,
		width: 100,
		height: 60,
		...over,
	};
}

function smartArtData(over: Partial<PptxSmartArtData> = {}): PptxSmartArtData {
	return { nodes: [], ...over };
}

// ──────────────────────────────────────────────────────────────────────────
// paletteColour
// ──────────────────────────────────────────────────────────────────────────

describe('paletteColour', () => {
	it('returns the colour at the given index', () => {
		const pal = ['#aaa', '#bbb', '#ccc'];
		expect(paletteColour(0, pal)).toBe('#aaa');
		expect(paletteColour(2, pal)).toBe('#ccc');
	});

	it('wraps around for indices beyond the palette length', () => {
		const pal = ['#aaa', '#bbb'];
		expect(paletteColour(2, pal)).toBe('#aaa');
		expect(paletteColour(3, pal)).toBe('#bbb');
	});
});

// ──────────────────────────────────────────────────────────────────────────
// resolvePalette
// ──────────────────────────────────────────────────────────────────────────

describe('resolvePalette', () => {
	it('returns the default palette when data is undefined', () => {
		expect(resolvePalette(undefined)).toBe(DEFAULT_PALETTE);
	});

	it('returns colorTransform fill colours when present', () => {
		const custom = ['#111', '#222', '#333'];
		const data = smartArtData({ colorTransform: { fillColors: custom, lineColors: [] } });
		expect(resolvePalette(data)).toStrictEqual(custom);
	});

	it('ignores an empty colorTransform fill array and falls back to the scheme', () => {
		const data = smartArtData({
			colorScheme: 'monochromatic1',
			colorTransform: { fillColors: [], lineColors: [] },
		});
		expect(resolvePalette(data)).toBe(PALETTES.monochromatic1);
	});

	it('returns the named scheme palette when no colorTransform is present', () => {
		expect(resolvePalette(smartArtData({ colorScheme: 'colorful2' }))).toBe(PALETTES.colorful2);
	});

	it('falls back to colorful1 for an unrecognised scheme', () => {
		const data = smartArtData({ colorScheme: 'unknown' as never });
		expect(resolvePalette(data)).toBe(DEFAULT_PALETTE);
	});
});

// ──────────────────────────────────────────────────────────────────────────
// styleShadowFilter
// ──────────────────────────────────────────────────────────────────────────

describe('styleShadowFilter', () => {
	it('returns undefined for flat style', () => {
		expect(styleShadowFilter('flat')).toBeUndefined();
	});

	it('returns a drop-shadow for moderate and intense', () => {
		expect(styleShadowFilter('moderate')).toContain('3px');
		expect(styleShadowFilter('intense')).toContain('6px');
	});
});

// ──────────────────────────────────────────────────────────────────────────
// buildChromeStyle
// ──────────────────────────────────────────────────────────────────────────

describe('buildChromeStyle', () => {
	it('returns a base 100% width/height map when chrome is undefined', () => {
		const s = buildChromeStyle(undefined);
		expect(s['width']).toBe('100%');
		expect(s['height']).toBe('100%');
		expect(s['background-color']).toBeUndefined();
		expect(s['border']).toBeUndefined();
	});

	it('applies background colour and border together', () => {
		const s = buildChromeStyle({
			backgroundColor: '#f0f0f0',
			outlineColor: '#333',
			outlineWidth: 2,
		});
		expect(s['background-color']).toBe('#f0f0f0');
		expect(s['border']).toBe('2px solid #333');
	});

	it('defaults the outline width to 1 when omitted', () => {
		expect(buildChromeStyle({ outlineColor: '#333' })['border']).toBe('1px solid #333');
	});
});

// ──────────────────────────────────────────────────────────────────────────
// computeDrawingViewBox
// ──────────────────────────────────────────────────────────────────────────

describe('computeDrawingViewBox', () => {
	it('returns a 1x1 unit box when the shapes array is empty', () => {
		expect(computeDrawingViewBox([])).toStrictEqual({ minX: 0, minY: 0, width: 1, height: 1 });
	});

	it('computes the tight bounding box for a set of shapes', () => {
		const shapes: PptxSmartArtDrawingShape[] = [
			shape({ id: 's1', x: 10, y: 20, width: 100, height: 60 }),
			shape({ id: 's2', x: 50, y: 0, width: 80, height: 40 }),
		];
		const vb = computeDrawingViewBox(shapes);
		expect(vb.minX).toBe(10);
		expect(vb.minY).toBe(0);
		expect(vb.width).toBe(120);
		expect(vb.height).toBe(80);
	});
});

// ──────────────────────────────────────────────────────────────────────────
// projectDrawingShapes
// ──────────────────────────────────────────────────────────────────────────

describe('projectDrawingShapes', () => {
	it('projects one shape per raw drawing shape', () => {
		const shapes: PptxSmartArtDrawingShape[] = [
			shape({ id: 's1', x: 0, y: 0 }),
			shape({ id: 's2', x: 0, y: 70 }),
		];
		const vb = computeDrawingViewBox(shapes);
		expect(projectDrawingShapes('el1', shapes, vb, DEFAULT_PALETTE, 'flat')).toHaveLength(2);
	});

	it('marks ellipse shapes correctly', () => {
		const shapes: PptxSmartArtDrawingShape[] = [shape({ id: 's1', shapeType: 'ellipse' })];
		const vb = computeDrawingViewBox(shapes);
		const [rendered] = projectDrawingShapes('el1', shapes, vb, DEFAULT_PALETTE, 'flat');
		expect(rendered.kind).toBe('ellipse');
	});

	it('rebases positions relative to the viewBox minX/minY', () => {
		const shapes: PptxSmartArtDrawingShape[] = [
			shape({ id: 's1', x: 50, y: 30, width: 100, height: 60 }),
		];
		const vb = computeDrawingViewBox(shapes);
		const [rendered] = projectDrawingShapes('el1', shapes, vb, DEFAULT_PALETTE, 'flat');
		expect(rendered.x).toBe(0);
		expect(rendered.y).toBe(0);
	});

	it('keeps a long label whole, wrapped across lines', () => {
		const sentence = 'a long authored sentence that will not fit on one line of the shape';
		const shapes: PptxSmartArtDrawingShape[] = [shape({ id: 's1', text: sentence })];
		const vb = computeDrawingViewBox(shapes);
		const [rendered] = projectDrawingShapes('el1', shapes, vb, DEFAULT_PALETTE, 'flat');

		expect(rendered.textLines.length).toBeGreaterThan(1);
		expect(rendered.textLines.map((line) => line.text).join(' ')).toBe(sentence);
	});

	it('uses the shape fillColor when present, otherwise the palette', () => {
		const shapes: PptxSmartArtDrawingShape[] = [
			shape({ id: 's1', fillColor: '#custom1' }),
			shape({ id: 's2', x: 0, y: 70 }),
		];
		const vb = computeDrawingViewBox(shapes);
		const [r0, r1] = projectDrawingShapes('el1', shapes, vb, ['#pal0', '#pal1'], 'flat');
		expect(r0.fill).toBe('#custom1');
		expect(r1.fill).toBe('#pal1');
	});

	it('builds a transform attribute from rotation, and undefined when absent', () => {
		const rotated: PptxSmartArtDrawingShape[] = [shape({ id: 's1', rotation: 45 })];
		const plain: PptxSmartArtDrawingShape[] = [shape({ id: 's2' })];
		const [r0] = projectDrawingShapes(
			'el1',
			rotated,
			computeDrawingViewBox(rotated),
			DEFAULT_PALETTE,
			'flat',
		);
		const [r1] = projectDrawingShapes(
			'el1',
			plain,
			computeDrawingViewBox(plain),
			DEFAULT_PALETTE,
			'flat',
		);
		expect(r0.transform).toMatch(/^rotate\(45 /u);
		expect(r1.transform).toBeUndefined();
	});

	it('generates stable, unique keys', () => {
		const shapes: PptxSmartArtDrawingShape[] = [
			shape({ id: 's1' }),
			shape({ id: 's2', x: 0, y: 70 }),
		];
		const vb = computeDrawingViewBox(shapes);
		const keys = projectDrawingShapes('el1', shapes, vb, DEFAULT_PALETTE, 'flat').map((r) => r.key);
		expect(new Set(keys).size).toBe(2);
		expect(keys[0]).toContain('el1');
		expect(keys[0]).toContain('s1');
	});
});
