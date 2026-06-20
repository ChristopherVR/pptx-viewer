/**
 * Tests for smart-art-renderer-helpers.ts
 *
 * All assertions target pure TypeScript exports: no Angular, no DOM, no
 * TestBed.  Mirrors the Vue test coverage in
 *   packages/vue/src/viewer/components/SmartArtRenderer.test.ts
 * where applicable, adapted to the helper-function API.
 */
import type {
	PptxSmartArtData,
	PptxSmartArtDrawingShape,
	PptxSmartArtNode,
} from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	buildChromeStyle,
	buildFallbackBlocks,
	computeDrawingViewBox,
	DEFAULT_PALETTE,
	flattenNodes,
	paletteColour,
	PALETTES,
	projectDrawingShapes,
	resolvePalette,
	styleShadowFilter,
	styleStrokeWidth,
	truncate,
} from './smart-art-renderer-helpers';

// ==========================================================================
// Test fixtures
// ==========================================================================

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

function node(id: string, text: string, children?: PptxSmartArtNode[]): PptxSmartArtNode {
	return { id, text, children };
}

function smartArtData(over: Partial<PptxSmartArtData> = {}): PptxSmartArtData {
	return { nodes: [], ...over };
}

// ==========================================================================
// paletteColour
// ==========================================================================

describe('paletteColour', () => {
	it('returns the colour at the given index', () => {
		const pal = ['#aaa', '#bbb', '#ccc'];
		expect(paletteColour(0, pal)).toBe('#aaa');
		expect(paletteColour(1, pal)).toBe('#bbb');
		expect(paletteColour(2, pal)).toBe('#ccc');
	});

	it('wraps around for indices >= palette length', () => {
		const pal = ['#aaa', '#bbb'];
		expect(paletteColour(2, pal)).toBe('#aaa');
		expect(paletteColour(3, pal)).toBe('#bbb');
		expect(paletteColour(5, pal)).toBe('#bbb');
	});
});

// ==========================================================================
// resolvePalette
// ==========================================================================

describe('resolvePalette', () => {
	it('returns DEFAULT_PALETTE when data is undefined', () => {
		expect(resolvePalette(undefined)).toBe(DEFAULT_PALETTE);
	});

	it('returns colorTransform fill colours when present', () => {
		const custom = ['#111', '#222', '#333'];
		const data = smartArtData({
			colorTransform: { fillColors: custom, lineColors: [] },
		});
		expect(resolvePalette(data)).toStrictEqual(custom);
	});

	it('ignores an empty colorTransform fill array and falls back to scheme', () => {
		const data = smartArtData({
			colorScheme: 'monochromatic1',
			colorTransform: { fillColors: [], lineColors: [] },
		});
		expect(resolvePalette(data)).toBe(PALETTES.monochromatic1);
	});

	it('returns the named scheme palette when no colorTransform present', () => {
		const data = smartArtData({ colorScheme: 'colorful2' });
		expect(resolvePalette(data)).toBe(PALETTES.colorful2);
	});

	it('falls back to colorful1 palette for an unrecognised scheme', () => {
		// Cast forces an invalid scheme value to test the fallback.
		const data = smartArtData({ colorScheme: 'unknown' as never });
		expect(resolvePalette(data)).toBe(DEFAULT_PALETTE);
	});
});

// ==========================================================================
// styleShadowFilter / styleStrokeWidth
// ==========================================================================

describe('styleShadowFilter', () => {
	it('returns undefined for flat style', () => {
		expect(styleShadowFilter('flat')).toBeUndefined();
	});

	it('returns a drop-shadow for moderate', () => {
		expect(styleShadowFilter('moderate')).toContain('drop-shadow');
	});

	it('returns a heavier drop-shadow for intense', () => {
		const moderate = styleShadowFilter('moderate') ?? '';
		const intense = styleShadowFilter('intense') ?? '';
		// Intense shadow has a larger blur radius (6px) than moderate (3px).
		expect(intense).toContain('6px');
		expect(moderate).toContain('3px');
	});
});

describe('styleStrokeWidth', () => {
	it('returns 0 for flat', () => {
		expect(styleStrokeWidth('flat')).toBe(0);
	});

	it('returns 1.5 for moderate', () => {
		expect(styleStrokeWidth('moderate')).toBe(1.5);
	});

	it('returns 2 for intense', () => {
		expect(styleStrokeWidth('intense')).toBe(2);
	});
});

// ==========================================================================
// truncate
// ==========================================================================

describe('truncate', () => {
	it('returns the original string when within max', () => {
		expect(truncate('hello', 10)).toBe('hello');
		expect(truncate('hello', 5)).toBe('hello');
	});

	it('truncates and appends ellipsis when over max', () => {
		// max=7 → slice(0, 6) = 'hello ' then append '…'
		expect(truncate('hello world', 7)).toBe('hello …');
	});
});

// ==========================================================================
// buildChromeStyle
// ==========================================================================

describe('buildChromeStyle', () => {
	it('returns base 100% width/height map when chrome is undefined', () => {
		const s = buildChromeStyle(undefined);
		expect(s['width']).toBe('100%');
		expect(s['height']).toBe('100%');
		expect(s['background-color']).toBeUndefined();
		expect(s['border']).toBeUndefined();
	});

	it('applies background-color when present', () => {
		const s = buildChromeStyle({ backgroundColor: '#f0f0f0' });
		expect(s['background-color']).toBe('#f0f0f0');
	});

	it('applies border with explicit outlineWidth', () => {
		const s = buildChromeStyle({ outlineColor: '#333', outlineWidth: 2 });
		expect(s['border']).toBe('2px solid #333');
	});

	it('defaults outlineWidth to 1 when not specified', () => {
		const s = buildChromeStyle({ outlineColor: '#333' });
		expect(s['border']).toBe('1px solid #333');
	});

	it('applies both background and border together', () => {
		const s = buildChromeStyle({
			backgroundColor: '#f0f0f0',
			outlineColor: '#333',
			outlineWidth: 2,
		});
		expect(s['background-color']).toBe('#f0f0f0');
		expect(s['border']).toBe('2px solid #333');
	});
});

// ==========================================================================
// computeDrawingViewBox
// ==========================================================================

describe('computeDrawingViewBox', () => {
	it('returns a 1×1 unit box when the shapes array is empty', () => {
		const vb = computeDrawingViewBox([]);
		expect(vb).toStrictEqual({ minX: 0, minY: 0, width: 1, height: 1 });
	});

	it('computes the tight bounding box for a set of shapes', () => {
		const shapes: PptxSmartArtDrawingShape[] = [
			shape({ id: 's1', x: 10, y: 20, width: 100, height: 60 }),
			shape({ id: 's2', x: 50, y: 0, width: 80, height: 40 }),
		];
		const vb = computeDrawingViewBox(shapes);
		// minX=10, minY=0, maxX=130, maxY=80
		expect(vb.minX).toBe(10);
		expect(vb.minY).toBe(0);
		expect(vb.width).toBe(120); // 130 - 10
		expect(vb.height).toBe(80); // 80 - 0
	});

	it('handles a single shape', () => {
		const shapes: PptxSmartArtDrawingShape[] = [
			shape({ id: 's1', x: 5, y: 10, width: 200, height: 100 }),
		];
		const vb = computeDrawingViewBox(shapes);
		expect(vb.minX).toBe(5);
		expect(vb.minY).toBe(10);
		expect(vb.width).toBe(200);
		expect(vb.height).toBe(100);
	});
});

// ==========================================================================
// projectDrawingShapes
// ==========================================================================

describe('projectDrawingShapes', () => {
	it('projects one shape per raw drawing shape', () => {
		const shapes: PptxSmartArtDrawingShape[] = [
			shape({ id: 's1', x: 0, y: 0 }),
			shape({ id: 's2', x: 0, y: 70 }),
			shape({ id: 's3', x: 0, y: 140 }),
		];
		const vb = computeDrawingViewBox(shapes);
		const rendered = projectDrawingShapes('el1', shapes, vb, DEFAULT_PALETTE, 'flat');
		expect(rendered).toHaveLength(3);
	});

	it('marks ellipse shapes correctly', () => {
		const shapes: PptxSmartArtDrawingShape[] = [shape({ id: 's1', shapeType: 'ellipse' })];
		const vb = computeDrawingViewBox(shapes);
		const [rendered] = projectDrawingShapes('el1', shapes, vb, DEFAULT_PALETTE, 'flat');
		expect(rendered.isEllipse).toBeTruthy();
	});

	it('marks non-ellipse shapes as rect', () => {
		const shapes: PptxSmartArtDrawingShape[] = [shape({ id: 's1', shapeType: 'roundRect' })];
		const vb = computeDrawingViewBox(shapes);
		const [rendered] = projectDrawingShapes('el1', shapes, vb, DEFAULT_PALETTE, 'flat');
		expect(rendered.isEllipse).toBeFalsy();
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

	it('truncates text to 30 characters', () => {
		const longText = 'A'.repeat(35);
		const shapes: PptxSmartArtDrawingShape[] = [shape({ id: 's1', text: longText })];
		const vb = computeDrawingViewBox(shapes);
		const [rendered] = projectDrawingShapes('el1', shapes, vb, DEFAULT_PALETTE, 'flat');
		expect(rendered.text).toBe(`${'A'.repeat(29)}…`);
	});

	it('leaves text undefined when shape has no text', () => {
		const shapes: PptxSmartArtDrawingShape[] = [shape({ id: 's1' })];
		const vb = computeDrawingViewBox(shapes);
		const [rendered] = projectDrawingShapes('el1', shapes, vb, DEFAULT_PALETTE, 'flat');
		expect(rendered.text).toBeUndefined();
	});

	it('uses shape fillColor when provided, otherwise falls back to palette', () => {
		const shapes: PptxSmartArtDrawingShape[] = [
			shape({ id: 's1', fillColor: '#custom1' }),
			shape({ id: 's2', x: 0, y: 70 }),
		];
		const vb = computeDrawingViewBox(shapes);
		const [r0, r1] = projectDrawingShapes('el1', shapes, vb, ['#pal0', '#pal1'], 'flat');
		expect(r0.fill).toBe('#custom1');
		expect(r1.fill).toBe('#pal1');
	});

	it('includes stroke from shape.strokeColor when provided', () => {
		const shapes: PptxSmartArtDrawingShape[] = [shape({ id: 's1', strokeColor: '#stroke' })];
		const vb = computeDrawingViewBox(shapes);
		const [rendered] = projectDrawingShapes('el1', shapes, vb, DEFAULT_PALETTE, 'flat');
		expect(rendered.stroke).toBe('#stroke');
	});

	it('builds transform attribute from rotation', () => {
		const shapes: PptxSmartArtDrawingShape[] = [
			shape({ id: 's1', x: 0, y: 0, width: 100, height: 60, rotation: 45 }),
		];
		const vb = computeDrawingViewBox(shapes);
		const [rendered] = projectDrawingShapes('el1', shapes, vb, DEFAULT_PALETTE, 'flat');
		expect(rendered.transform).toMatch(/^rotate\(45 /u);
	});

	it('sets transform to undefined when rotation is absent', () => {
		const shapes: PptxSmartArtDrawingShape[] = [shape({ id: 's1' })];
		const vb = computeDrawingViewBox(shapes);
		const [rendered] = projectDrawingShapes('el1', shapes, vb, DEFAULT_PALETTE, 'flat');
		expect(rendered.transform).toBeUndefined();
	});

	it('generates stable, unique keys', () => {
		const shapes: PptxSmartArtDrawingShape[] = [
			shape({ id: 's1' }),
			shape({ id: 's2', x: 0, y: 70 }),
		];
		const vb = computeDrawingViewBox(shapes);
		const rendered = projectDrawingShapes('el1', shapes, vb, DEFAULT_PALETTE, 'flat');
		const keys = rendered.map((r) => r.key);
		expect(new Set(keys).size).toBe(2);
		expect(keys[0]).toContain('el1');
		expect(keys[0]).toContain('s1');
	});
});

// ==========================================================================
// flattenNodes
// ==========================================================================

describe('flattenNodes', () => {
	it('returns an empty array for no roots', () => {
		expect(flattenNodes([])).toStrictEqual([]);
	});

	it('returns a single flat node', () => {
		const n = node('1', 'Root');
		expect(flattenNodes([n])).toStrictEqual([n]);
	});

	it('flattens depth-first', () => {
		const root = node('1', 'Root', [node('2', 'Child A'), node('3', 'Child B')]);
		const flat = flattenNodes([root]);
		expect(flat.map((n) => n.text)).toStrictEqual(['Root', 'Child A', 'Child B']);
	});

	it('flattens deeply nested children', () => {
		const root = node('1', 'L0', [node('2', 'L1', [node('3', 'L2')])]);
		const flat = flattenNodes([root]);
		expect(flat).toHaveLength(3);
		expect(flat[2].text).toBe('L2');
	});
});

// ==========================================================================
// buildFallbackBlocks
// ==========================================================================

describe('buildFallbackBlocks', () => {
	it('returns one block per flattened node', () => {
		const nodes = [node('1', 'Alpha'), node('2', 'Beta')];
		const blocks = buildFallbackBlocks('el1', nodes, DEFAULT_PALETTE);
		expect(blocks).toHaveLength(2);
		expect(blocks[0].text).toBe('Alpha');
		expect(blocks[1].text).toBe('Beta');
	});

	it('assigns palette colours by index', () => {
		const pal = ['#r', '#g', '#b'];
		const nodes = [node('1', 'A'), node('2', 'B'), node('3', 'C'), node('4', 'D')];
		const blocks = buildFallbackBlocks('el1', nodes, pal);
		expect(blocks[0].fill).toBe('#r');
		expect(blocks[1].fill).toBe('#g');
		expect(blocks[2].fill).toBe('#b');
		expect(blocks[3].fill).toBe('#r'); // wraps
	});

	it('flattens nested nodes', () => {
		const root = node('1', 'Root', [node('2', 'Child A'), node('3', 'Child B')]);
		const blocks = buildFallbackBlocks('el1', [root], DEFAULT_PALETTE);
		expect(blocks).toHaveLength(3);
		expect(blocks[1].text).toBe('Child A');
	});

	it('generates unique keys per block', () => {
		const nodes = [node('1', 'A'), node('2', 'B')];
		const blocks = buildFallbackBlocks('el1', nodes, DEFAULT_PALETTE);
		const keys = blocks.map((b) => b.key);
		expect(new Set(keys).size).toBe(2);
		expect(keys[0]).toContain('el1');
	});

	it('returns an empty array for zero nodes', () => {
		expect(buildFallbackBlocks('el1', [], DEFAULT_PALETTE)).toStrictEqual([]);
	});
});
