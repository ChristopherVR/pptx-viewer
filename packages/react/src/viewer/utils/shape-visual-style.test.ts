import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { getShapeVisualStyle } from './shape-visual-style';

/** Minimal shape element with an overridable shapeStyle. */
function makeShape(shapeStyle?: Record<string, unknown>): PptxElement {
	return {
		id: 'shape-1',
		type: 'shape',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		shapeType: 'rect',
		shapeStyle,
	} as PptxElement;
}

describe('getShapeVisualStyle line join / cap (a:ln/@join, @cap, a:miter/@lim)', () => {
	it('maps join=miter to strokeLinejoin=miter with a miterlimit ratio', () => {
		// a:miter/@lim is 1000ths of a percent: 800000 => 8.0
		const style = getShapeVisualStyle(
			makeShape({ lineJoin: 'miter', miterLimit: 800000, strokeWidth: 2 }),
			true,
			'#ff0000',
			2,
			'#000000',
		);
		expect(style.strokeLinejoin).toBe('miter');
		expect(style.strokeMiterlimit).toBe(8);
	});

	it('maps join=bevel and round without a miterlimit', () => {
		expect(
			getShapeVisualStyle(makeShape({ lineJoin: 'bevel' }), true, '#fff', 1, '#000').strokeLinejoin,
		).toBe('bevel');
		const round = getShapeVisualStyle(makeShape({ lineJoin: 'round' }), true, '#fff', 1, '#000');
		expect(round.strokeLinejoin).toBe('round');
		expect(round.strokeMiterlimit).toBeUndefined();
	});

	it('maps every line-cap token (flat->butt, sq->square, rnd->round)', () => {
		expect(
			getShapeVisualStyle(makeShape({ lineCap: 'flat' }), true, '#fff', 1, '#000').strokeLinecap,
		).toBe('butt');
		expect(
			getShapeVisualStyle(makeShape({ lineCap: 'sq' }), true, '#fff', 1, '#000').strokeLinecap,
		).toBe('square');
		expect(
			getShapeVisualStyle(makeShape({ lineCap: 'rnd' }), true, '#fff', 1, '#000').strokeLinecap,
		).toBe('round');
	});
});

describe('getShapeVisualStyle soft-edge / fill-overlay effects', () => {
	it('references the soft-edge SVG filter instead of a whole-element blur()', () => {
		const style = getShapeVisualStyle(makeShape({ softEdgeRadius: 6 }), true, '#fff', 0, '#000');
		expect(style.filter).toBe('url(#soft-edge-shape-1)');
		expect(style.filter).not.toContain('blur(');
	});

	it('composes the soft-edge filter after glow in the filter chain', () => {
		const style = getShapeVisualStyle(
			makeShape({ glowColor: '#00ff00', glowRadius: 8, softEdgeRadius: 4 }),
			true,
			'#fff',
			0,
			'#000',
		);
		expect(style.filter).toContain('drop-shadow(');
		expect(style.filter).toContain('url(#soft-edge-shape-1)');
	});

	it('drops the whole-element mix-blend-mode when a fill-overlay colour is present', () => {
		const style = getShapeVisualStyle(
			makeShape({ dagFillOverlayColor: '#ff0000', dagFillOverlayBlend: 'mult' }),
			true,
			'#fff',
			0,
			'#000',
		);
		expect(style.mixBlendMode).toBeUndefined();
	});

	it('keeps the whole-element mix-blend-mode for the blend-only case (no overlay colour)', () => {
		const style = getShapeVisualStyle(
			makeShape({ dagFillOverlayBlend: 'screen' }),
			true,
			'#fff',
			0,
			'#000',
		);
		expect(style.mixBlendMode).toBe('screen');
	});
});
