import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { getShapeFillStrokeStyle } from '../element-styles';
import { renderShapeSubpathFillOverlay } from './shape-filter-defs';

/**
 * Per-sub-path FILL overlay (bugs: 41 presets lose per-subpath fill modes;
 * custGeom per-subpath fill was React-only).
 *
 * `smileyFace`'s eyes are authored `fill="none"` open strokes; merging every
 * sub-path into one clip-path + flat `background-color` (the pre-fix
 * behaviour) painted them FILLED and distorted instead.
 */
function smileyFace(): PptxElement {
	return {
		id: 'smiley-1',
		type: 'shape',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		shapeType: 'smileyFace',
		shapeStyle: { fillColor: '#FFD400' },
	} as unknown as PptxElement;
}

describe('renderShapeSubpathFillOverlay', () => {
	it('paints smileyFace as layered paths, with the eyes unfilled', () => {
		const svg = renderShapeSubpathFillOverlay(document, smileyFace());
		expect(svg).not.toBeNull();
		expect(svg?.getAttribute('class')).toBe('pptx-vanilla-subpath-fill');
		const paths = [...(svg?.querySelectorAll('path') ?? [])];
		expect(paths.some((p) => p.getAttribute('fill') === '#FFD400')).toBeTruthy();
		expect(paths.some((p) => p.getAttribute('fill') === 'none')).toBeTruthy();
	});

	it('drops the container fill so the layered paths are not painted underneath a flat colour', () => {
		const style = getShapeFillStrokeStyle(smileyFace());
		expect(style['backgroundColor']).toBe('transparent');
	});

	it('shades the actionButtonBlank inset bevel well instead of painting it flat', () => {
		const element = {
			id: 'btn-1',
			type: 'shape',
			x: 0,
			y: 0,
			width: 120,
			height: 120,
			shapeType: 'actionButtonBlank',
			shapeStyle: { fillColor: '#4472C4' },
		} as unknown as PptxElement;
		const svg = renderShapeSubpathFillOverlay(document, element);
		const fills = new Set(
			[...(svg?.querySelectorAll('path') ?? [])].map((p) => p.getAttribute('fill')),
		);
		expect(fills.size).toBeGreaterThan(1);
	});

	it('renders nothing extra for an ordinary single-fill preset (rect)', () => {
		const element = {
			id: 'rect-1',
			type: 'shape',
			x: 0,
			y: 0,
			width: 100,
			height: 60,
			shapeType: 'rect',
			shapeStyle: { fillColor: '#336699' },
		} as unknown as PptxElement;
		expect(renderShapeSubpathFillOverlay(document, element)).toBeNull();
	});
});
