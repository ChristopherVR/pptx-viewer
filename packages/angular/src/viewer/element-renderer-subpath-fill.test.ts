/**
 * Unit tests for the per-sub-path FILL overlay wiring in
 * `ElementRendererComponent` (bugs: 41 presets lose per-subpath fill modes;
 * custGeom per-subpath fill was React-only).
 *
 * Like the other `element-renderer-*.test.ts` files, this exercises the
 * accessor the template binds to (`getSubpathFillOverlay`) plus the style
 * module's fill suppression, rather than instantiating the component. The
 * template's job on top of these is a plain `@if` + `@for` over the paints.
 *
 * `smileyFace`'s eyes are authored `fill="none"` open strokes; merging every
 * sub-path into one clip-path + flat `background-color` (the pre-fix
 * behaviour) painted them FILLED and distorted instead.
 */
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { getSubpathFillOverlay } from './element-effect-defs';
import { getShapeFillStrokeStyle } from './element-style';

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

describe('elementRenderer per-sub-path fill overlay', () => {
	it('resolves smileyFace as layered paints, with the eyes unfilled', () => {
		const overlay = getSubpathFillOverlay(smileyFace());
		expect(overlay).toBeDefined();
		expect(overlay!.paints.some((p) => p.fill === '#FFD400')).toBeTruthy();
		expect(overlay!.paints.some((p) => p.fill === 'none')).toBeTruthy();
	});

	it('drops the container fill so the layered paths are not painted underneath a flat colour', () => {
		const style = getShapeFillStrokeStyle(smileyFace());
		expect(style['background-color']).toBe('transparent');
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
		const overlay = getSubpathFillOverlay(element);
		expect(overlay).toBeDefined();
		const fills = new Set(overlay!.paints.map((p) => p.fill));
		expect(fills.size).toBeGreaterThan(1);
	});

	it('resolves nothing extra for an ordinary single-fill preset (rect)', () => {
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
		expect(getSubpathFillOverlay(element)).toBeUndefined();
	});
});
