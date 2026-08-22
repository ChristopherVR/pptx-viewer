import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { getShapeFillStrokeStyle, getTextBlockStyle } from './element-styles';
import { renderStrokeOutline } from './elements/shape-filter-defs';

/** A text element carrying the given text style. */
function textElement(textStyle: Record<string, unknown>): PptxElement {
	return {
		id: 't1',
		type: 'text',
		x: 0,
		y: 0,
		width: 400,
		height: 100,
		text: 'hi',
		textStyle,
	} as unknown as PptxElement;
}

describe('getTextBlockStyle', () => {
	it('emits px lengths, since these maps are written straight onto element.style', () => {
		const style = getTextBlockStyle(textElement({ fontSize: 18, vAlign: 'bottom' }));
		expect(style['fontSize']).toBe('18px');
		expect(style['justifyContent']).toBe('flex-end');
		expect(style['lineHeight']).toBe(1.2);
	});

	// This binding's own copy of the text-block builder never read either
	// property, so a shrink-to-fit title painted 43% too large and a
	// `wrap="none"` line wrapped to three. Both now come from the shared builder.
	it('applies the normAutofit font scale and never wraps a wrap="none" body', () => {
		const autofit = getTextBlockStyle(
			textElement({ fontSize: 40, autoFit: true, autoFitMode: 'normal', autoFitFontScale: 0.7 }),
		);
		expect(autofit['fontSize']).toBe('28px');
		expect(getTextBlockStyle(textElement({ textWrap: 'none' }))['whiteSpace']).toBe('nowrap');
		expect(getTextBlockStyle(textElement({}))['whiteSpace']).toBe('pre-wrap');
	});

	it('never shrinks the font for spAutoFit, however much text overflows', () => {
		// a:spAutoFit resizes the SHAPE to fit the text (ECMA-376), never the
		// font; a box authored in PowerPoint already has its `a:ext` sized to
		// fit, so the font must render unshrunk regardless of the measured text.
		const autofit = getTextBlockStyle(
			textElement({ fontSize: 40, autoFit: true, autoFitMode: 'shrink' }),
		);
		expect(autofit['fontSize']).toBe('40px');
	});
});

/**
 * Stroke-only ("open") preset geometry (`<a:prstGeom prst="line"/>`, `arc`, the
 * connector family). These have no region to fill and no box to outline, so the
 * CSS border painted a rectangle edge where PowerPoint draws the line itself;
 * the shared `buildStrokeOutline` strokes the evaluated geometry instead.
 */
describe('stroke-only preset geometry', () => {
	/** The media deck's horizontal rule: `prst="line"`, 1 EMU tall, 1.5pt black. */
	const rule = (overrides: Record<string, unknown> = {}): PptxElement =>
		({
			id: 'rule-1',
			type: 'shape',
			x: 0,
			y: 0,
			width: 400,
			height: 0,
			shapeType: 'line',
			shapeStyle: { strokeColor: '#000000', strokeWidth: 2 },
			...overrides,
		}) as unknown as PptxElement;

	it('leaves the container bare: no fill, no border, no clip-path', () => {
		const style = getShapeFillStrokeStyle(rule());
		expect(style['backgroundColor']).toBe('transparent');
		expect(style['border']).toBe('none');
		expect(style['borderTop']).toBeUndefined();
		expect(style['clipPath']).toBeUndefined();
	});

	it('strokes the evaluated geometry over the padded box', () => {
		const svg = renderStrokeOutline(document, rule());
		expect(svg).not.toBeNull();
		expect(svg?.getAttribute('viewBox')).toBe('0 0 400 12');
		const path = svg?.querySelector('path');
		expect(path?.getAttribute('d')).toBe('M 0 0 L 400 1');
		expect(path?.getAttribute('stroke')).toBe('#000000');
		expect(svg?.querySelector('defs')).toBeNull();
	});

	it('leaves an explicitly INSET closed preset to its CSS border', () => {
		// `algn="in"` is the one alignment a CSS border already paints correctly;
		// the default `ctr` alignment routes the stroke through this SVG overlay
		// instead (see shared `stroke-outline.ts`).
		const box = rule({
			shapeType: 'rect',
			height: 100,
			shapeStyle: { strokeColor: '#000000', strokeWidth: 2, lineAlignment: 'in' },
		});
		expect(renderStrokeOutline(document, box)).toBeNull();
		expect(getShapeFillStrokeStyle(box)['border']).toContain('2px');
	});

	it('centres a closed preset at the default (omitted) alignment instead', () => {
		const box = rule({ shapeType: 'rect', height: 100 });
		expect(renderStrokeOutline(document, box)).not.toBeNull();
		expect(getShapeFillStrokeStyle(box)['border']).toBeUndefined();
	});
});
