/**
 * Tests for the SmartArt insert-gallery preview geometry.
 *
 * Pure view-model generation (no TestBed): every layout resolves to a preview
 * kind and a set of SVG primitives the thin `pptx-smart-art-preview` component
 * renders. Mirrors the React `SmartArtPreviews.tsx` resolver coverage.
 */
import { describe, expect, it } from 'vitest';

import { previewKindForLayout, previewShapesForLayout } from './smart-art-preview-geometry';

describe('previewKindForLayout', () => {
	it('maps list layouts to the blockList kind', () => {
		expect(previewKindForLayout('basicBlockList')).toBe('blockList');
		expect(previewKindForLayout('stackedList')).toBe('blockList');
	});

	it('maps chevron/process layouts to the chevron kind', () => {
		expect(previewKindForLayout('basicChevronProcess')).toBe('chevron');
		expect(previewKindForLayout('upwardArrow')).toBe('chevron');
	});

	it('maps cycle and radial families distinctly', () => {
		expect(previewKindForLayout('basicCycle')).toBe('cycle');
		expect(previewKindForLayout('basicRadial')).toBe('radial');
	});

	it('maps hierarchy and venn families', () => {
		expect(previewKindForLayout('hierarchy')).toBe('hierarchy');
		expect(previewKindForLayout('basicVenn')).toBe('venn');
	});

	it('falls back to generic for uncatalogued previews', () => {
		expect(previewKindForLayout('basicPyramid')).toBe('generic');
	});
});

describe('previewShapesForLayout', () => {
	it('block list yields three rects', () => {
		const shapes = previewShapesForLayout('basicBlockList');
		expect(shapes).toHaveLength(3);
		expect(shapes.every((s) => s.kind === 'rect')).toBe(true);
	});

	it('chevron yields three polygons', () => {
		const shapes = previewShapesForLayout('segmentedProcess');
		expect(shapes).toHaveLength(3);
		expect(shapes.every((s) => s.kind === 'polygon')).toBe(true);
	});

	it('cycle yields four circles positioned around a centre', () => {
		const shapes = previewShapesForLayout('basicCycle');
		expect(shapes).toHaveLength(4);
		expect(shapes.every((s) => s.kind === 'circle')).toBe(true);
	});

	it('radial yields a centre circle plus three spokes (line + circle each)', () => {
		const shapes = previewShapesForLayout('basicRadial');
		// 1 centre + 3 * (line + circle) = 7
		expect(shapes).toHaveLength(7);
		expect(shapes.filter((s) => s.kind === 'line')).toHaveLength(3);
		expect(shapes.filter((s) => s.kind === 'circle')).toHaveLength(4);
	});

	it('hierarchy yields rects and connector lines', () => {
		const shapes = previewShapesForLayout('hierarchy');
		expect(shapes.some((s) => s.kind === 'rect')).toBe(true);
		expect(shapes.some((s) => s.kind === 'line')).toBe(true);
	});

	it('venn yields three translucent overlapping circles', () => {
		const shapes = previewShapesForLayout('basicVenn');
		expect(shapes).toHaveLength(3);
		expect(shapes.every((s) => s.kind === 'circle' && s.opacity === 0.3)).toBe(true);
	});

	it('generic fallback yields three rects', () => {
		const shapes = previewShapesForLayout('basicPyramid');
		expect(shapes).toHaveLength(3);
		expect(shapes.every((s) => s.kind === 'rect')).toBe(true);
	});

	it('produces only finite coordinates', () => {
		const shapes = previewShapesForLayout('basicCycle');
		for (const s of shapes) {
			if (s.kind === 'circle') {
				expect(Number.isFinite(s.cx)).toBe(true);
				expect(Number.isFinite(s.cy)).toBe(true);
			}
		}
	});
});
