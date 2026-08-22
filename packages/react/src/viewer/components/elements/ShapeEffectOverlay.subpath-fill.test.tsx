import type { PptxElement } from 'pptx-viewer-core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { getShapeVisualStyle } from '../../utils/shape-visual-style';
import { shapeParams } from './element-shape-params';
import { ShapeEffectOverlay } from './ShapeEffectOverlay';

/**
 * Per-sub-path FILL overlay (bugs: 41 presets lose per-subpath fill modes;
 * custGeom per-subpath fill was React-only).
 *
 * `smileyFace`'s eyes are authored `fill="none"` open strokes; merging every
 * sub-path into one clip-path + flat `background-color` (the pre-fix
 * behaviour) painted them FILLED and distorted instead. `actionButtonBlank`'s
 * inset bevel well is authored `fill="darken"`; the merge painted it the same
 * flat colour as the face, so the shading vanished.
 */
function smileyFace(overrides: Record<string, unknown> = {}): PptxElement {
	return {
		id: 'smiley-1',
		type: 'shape',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		shapeType: 'smileyFace',
		shapeStyle: { fillColor: '#FFD400', ...overrides },
	} as unknown as PptxElement;
}

const markup = (element: PptxElement) =>
	renderToStaticMarkup(<ShapeEffectOverlay element={element} />);

describe('shapeEffectOverlay per-sub-path fill', () => {
	it('paints smileyFace as layered paths, with the eyes unfilled', () => {
		const html = markup(smileyFace());
		expect(html).toContain('pptx-react-subpath-fill');
		// At least one sub-path (the face) is filled with the shape colour...
		expect(html).toContain('fill="#FFD400"');
		// ...and at least one (an eye) opts out of fill entirely.
		expect(html).toContain('fill="none"');
	});

	it('drops the container fill so the layered paths are not painted underneath a flat colour', () => {
		const element = smileyFace();
		const { hf, fc, sw, sc } = shapeParams(element);
		const style = getShapeVisualStyle(element, hf, fc, sw, sc);
		expect(style.backgroundColor).toBe('transparent');
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
		const html = markup(element);
		const fills = [...html.matchAll(/fill="([^"]+)"/gu)].map((m) => m[1]);
		expect(new Set(fills).size).toBeGreaterThan(1);
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
		expect(markup(element)).not.toContain('pptx-react-subpath-fill');
	});
});
