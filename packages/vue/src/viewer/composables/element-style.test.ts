import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { getContainerStyle, getShapeFillStrokeStyle, getTextBlockStyle } from './element-style';

function shape(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'shape',
		id: 's1',
		x: 10,
		y: 20,
		width: 100,
		height: 50,
		...overrides,
	} as PptxElement;
}

describe('getContainerStyle', () => {
	it('positions and sizes the element absolutely', () => {
		const style = getContainerStyle(shape(), 3);
		expect(style.position).toBe('absolute');
		expect(style.left).toBe('10px');
		expect(style.top).toBe('20px');
		expect(style.width).toBe('100px');
		expect(style.height).toBe('50px');
		expect(style.zIndex).toBe(3);
	});

	it('applies rotation and flip transforms', () => {
		const style = getContainerStyle(shape({ rotation: 45, flipHorizontal: true }), 0);
		expect(style.transform).toContain('rotate(45deg)');
		expect(style.transform).toContain('scaleX(-1)');
	});
});

describe('getShapeFillStrokeStyle', () => {
	it('renders solid fill and stroke', () => {
		const style = getShapeFillStrokeStyle(
			shape({ shapeStyle: { fillColor: '#ff0000', strokeColor: '#000', strokeWidth: 2 } }),
		);
		expect(style.backgroundColor).toBe('#ff0000');
		expect(style.border).toBe('2px solid #000');
	});

	it('maps stroke dash to a CSS border style', () => {
		const dotted = getShapeFillStrokeStyle(
			shape({ shapeStyle: { strokeColor: '#000', strokeWidth: 1, strokeDash: 'dot' } }),
		);
		expect(dotted.border).toBe('1px dotted #000');
		const dashed = getShapeFillStrokeStyle(
			shape({ shapeStyle: { strokeColor: '#000', strokeWidth: 1, strokeDash: 'dash' } }),
		);
		expect(dashed.border).toBe('1px dashed #000');
	});

	it('rounds ellipse geometry with a pill radius', () => {
		const style = getShapeFillStrokeStyle(shape({ shapeType: 'ellipse' }));
		expect(style.borderRadius).toBe('9999px');
		expect(style.clipPath).toBeUndefined();
	});

	it('rounds roundRect geometry by adjustment value', () => {
		const style = getShapeFillStrokeStyle(
			shape({ shapeType: 'roundRect', width: 100, height: 100, shapeAdjustments: { adj: 25000 } }),
		);
		// adj 25000/50000 = 0.5 → radius = min(100,100) * 0.5 * 0.5 = 25px
		expect(style.borderRadius).toBe('25px');
		expect(style.clipPath).toBeUndefined();
	});

	it('emits a clip-path for non-rect preset geometries', () => {
		const style = getShapeFillStrokeStyle(shape({ shapeType: 'triangle', width: 120, height: 80 }));
		expect(style.clipPath).toBeTypeOf('string');
		expect(style.clipPath).not.toBe('');
		expect(style.borderRadius).toBeUndefined();
	});

	it('clips a sized line shape via the preset path (matches React order)', () => {
		// The preset evaluator returns a `path()` for `line`, which (exactly as
		// in the React `getShapeVisualStyle` cascade) wins ahead of the bare
		// top-edge fallback. The fallback only applies when no clip-path resolves
		// (e.g. degenerate dimensions).
		const style = getShapeFillStrokeStyle(
			shape({
				type: 'shape',
				shapeType: 'line',
				shapeStyle: { strokeColor: '#123456', strokeWidth: 3 },
			}),
		);
		expect(style.clipPath).toBeTypeOf('string');
		expect(style.borderTop).toBeUndefined();
	});

	it('draws a bare top edge for a line shape with no resolvable clip-path', () => {
		// width/height of 0 forces the cascade to skip the path evaluator; `line`
		// has no static-table entry, so the bare top-edge fallback is used.
		const style = getShapeFillStrokeStyle(
			shape({
				type: 'shape',
				shapeType: 'line',
				width: 0,
				height: 0,
				shapeStyle: { strokeColor: '#123456', strokeWidth: 3 },
			}),
		);
		expect(style.backgroundColor).toBe('transparent');
		expect(style.border).toBe('none');
		expect(style.borderTop).toBe('3px solid #123456');
	});
});

describe('getTextBlockStyle', () => {
	it('maps font + alignment from textStyle', () => {
		const style = getTextBlockStyle(
			shape({ textStyle: { fontSize: 18, bold: true, align: 'center', vAlign: 'middle' } }),
		);
		// Font size is emitted in CSS px (unitless React convention), not pt;
		// appending pt would inflate every glyph by ~1.33× and overflow the box.
		expect(style.fontSize).toBe('18px');
		expect(style.fontWeight).toBe('bold');
		expect(style.textAlign).toBe('center');
		expect(style.justifyContent).toBe('center');
	});

	it('applies a default 1.25 line-height and honours explicit line spacing', () => {
		expect(getTextBlockStyle(shape({ textStyle: { fontSize: 18 } })).lineHeight).toBe(1.25);
		expect(
			getTextBlockStyle(shape({ textStyle: { fontSize: 18, lineSpacing: 0.9 } })).lineHeight,
		).toBe(0.9);
		expect(
			getTextBlockStyle(shape({ textStyle: { fontSize: 18, lineSpacingExactPt: 20 } })).lineHeight,
		).toBe('20pt');
	});

	it('insets text from the box with default body padding', () => {
		const style = getTextBlockStyle(shape({ textStyle: { fontSize: 18 } }));
		expect(style.paddingLeft).toBe(`${91440 / 9525}px`);
		expect(style.paddingTop).toBe(`${45720 / 9525}px`);
	});
});
