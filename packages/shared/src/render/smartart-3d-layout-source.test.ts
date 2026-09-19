/**
 * `resolveSmartArt3DLayout` tests: the 3D model must be built from the same
 * source the SVG renderers draw (the cached `dsp:` drawing when present),
 * so switching the 3D scene on never changes a diagram's geometry or colours.
 */
import type { PptxSmartArtDrawingShape, PptxSmartArtNode } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { drawingShapesLayoutResult, resolveSmartArt3DLayout } from './smartart-3d-layout-source';
import { DEFAULT_PALETTE } from './smartart-drawing';

const style = { name: 'flat' } as never;

const nodes: PptxSmartArtNode[] = [
	{ id: 'n1', text: 'Item 1', level: 0 },
	{ id: 'n2', text: 'Item 2', level: 0 },
	{ id: 'n3', text: 'Item 3', level: 0 },
] as PptxSmartArtNode[];

/** The cached drawing our own save pipeline writes for a 600x340 Basic Block List. */
const cachedRows: PptxSmartArtDrawingShape[] = [
	{
		id: 'a',
		shapeType: 'roundRect',
		x: 8,
		y: 8,
		width: 584,
		height: 104,
		fillColor: '#4472C4',
		text: 'Item 1',
		fontSize: 11,
	},
	{
		id: 'b',
		shapeType: 'roundRect',
		x: 8,
		y: 118,
		width: 584,
		height: 104,
		fillColor: '#ED7D31',
		text: 'Item 2',
		fontSize: 11,
	},
	{
		id: 'c',
		shapeType: 'roundRect',
		x: 8,
		y: 228,
		width: 584,
		height: 104,
		fillColor: '#A5A5A5',
		text: 'Item 3',
		fontSize: 11,
	},
];

describe('resolveSmartArt3DLayout', () => {
	it('uses the cached drawing shapes (geometry + theme fills) when the element has them', () => {
		const layout = resolveSmartArt3DLayout(
			{ resolvedLayoutType: 'list', drawingShapes: cachedRows },
			nodes,
			{ width: 600, height: 340 },
			DEFAULT_PALETTE,
			style,
			'el',
		);
		expect(layout.family).toBe('list');
		expect(layout.nodes).toHaveLength(3);
		const rects = layout.nodes.filter((n) => n.kind === 'rect');
		expect(rects).toHaveLength(3);
		// Full-width rows in element coordinates (the shapes' own 584x324 box is
		// fitted `meet` into 600x340, exactly as the SVG renderer does), the
		// theme's accent fills, not the palette's, and the cached label text.
		const scale = Math.min(600 / 584, 340 / 324);
		for (const r of rects) {
			expect(r.kind === 'rect' && r.width).toBeCloseTo(584 * scale, 3);
		}
		expect(rects.map((r) => r.fill)).toStrictEqual(['#4472C4', '#ED7D31', '#A5A5A5']);
		expect(rects.map((r) => r.text)).toStrictEqual(['Item 1', 'Item 2', 'Item 3']);
	});

	it('fits the drawing into the element box like the SVG renderers (xMidYMid meet)', () => {
		// The same drawing authored at twice the scale must land on identical
		// element-box geometry (the fit is relative to the shapes' own box).
		const wide = cachedRows.map((s) => ({
			...s,
			x: s.x * 2,
			y: s.y * 2,
			width: s.width * 2,
			height: s.height * 2,
		}));
		const base = drawingShapesLayoutResult(
			'el',
			cachedRows,
			{ width: 600, height: 340 },
			DEFAULT_PALETTE,
			style,
			'list',
		);
		const doubled = drawingShapesLayoutResult(
			'el',
			wide,
			{ width: 600, height: 340 },
			DEFAULT_PALETTE,
			style,
			'list',
		);
		const b0 = base?.nodes[0];
		const d0 = doubled?.nodes[0];
		expect(b0?.kind).toBe('rect');
		if (b0?.kind === 'rect' && d0?.kind === 'rect') {
			expect(d0.width).toBeCloseTo(b0.width, 3);
			expect(d0.height).toBeCloseTo(b0.height, 3);
			expect(d0.x).toBeCloseTo(b0.x, 3);
			expect(d0.y).toBeCloseTo(b0.y, 3);
		}
		// A box much wider than the drawing fits by height and centres horizontally.
		const centred = drawingShapesLayoutResult(
			'el',
			cachedRows,
			{ width: 1000, height: 340 },
			DEFAULT_PALETTE,
			style,
			'list',
		);
		const c0 = centred?.nodes[0];
		if (c0?.kind === 'rect') {
			const scale = 340 / 324;
			expect(c0.width).toBeCloseTo(584 * scale, 3);
			expect(c0.x).toBeCloseTo((1000 - 584 * scale) / 2, 3);
		}
	});

	it('skips unpainted shapes and maps ellipses to circle nodes', () => {
		const shapes: PptxSmartArtDrawingShape[] = [
			{ id: 'bg', shapeType: 'rect', x: 0, y: 0, width: 300, height: 300, fillNone: true },
			{
				id: 'dot',
				shapeType: 'ellipse',
				x: 100,
				y: 50,
				width: 100,
				height: 200,
				fillColor: '#123456',
				text: 'Hub',
			},
		];
		const layout = drawingShapesLayoutResult(
			'el',
			shapes,
			{ width: 300, height: 300 },
			DEFAULT_PALETTE,
			style,
			'cycle',
		);
		expect(layout?.nodes).toHaveLength(1);
		const dot = layout?.nodes[0];
		expect(dot?.kind).toBe('circle');
		if (dot?.kind === 'circle') {
			expect(dot.cx).toBeCloseTo(150, 3);
			expect(dot.cy).toBeCloseTo(150, 3);
			expect(dot.r).toBeCloseTo(50, 3);
			expect(dot.ry).toBeCloseTo(100, 3);
			expect(dot.fill).toBe('#123456');
		}
	});

	it('falls back to the layout engine when there is no cached drawing', () => {
		const layout = resolveSmartArt3DLayout(
			{ layout: 'basicBlockList' },
			nodes,
			{ width: 600, height: 340 },
			DEFAULT_PALETTE,
			style,
			'el',
		);
		expect(layout.nodes.length).toBeGreaterThan(0);
		expect(layout.nodes[0].fill).toBe(DEFAULT_PALETTE[0]);
	});
});
