import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { cssPropertyName, mergeStyles, styleToString } from './css';
import { getContainerStyle, getShapeFillStrokeStyle } from './element-style';
import { getTextBlockStyle } from './text-style';

describe('cssPropertyName', () => {
	it('kebab-cases camelCase properties', () => {
		expect(cssPropertyName('zIndex')).toBe('z-index');
		expect(cssPropertyName('backgroundColor')).toBe('background-color');
	});

	it('prefixes vendor properties and passes custom properties through', () => {
		expect(cssPropertyName('WebkitBoxReflect')).toBe('-webkit-box-reflect');
		expect(cssPropertyName('--pptx-primary')).toBe('--pptx-primary');
	});
});

describe('styleToString', () => {
	it('serialises maps and skips empty values', () => {
		expect(styleToString({ left: '5px', zIndex: 3, filter: '' })).toBe('left: 5px; z-index: 3');
		expect(styleToString(undefined)).toBe('');
	});

	it('merges styles with later maps winning', () => {
		expect(mergeStyles({ color: 'red', left: '1px' }, { color: 'blue' })).toStrictEqual({
			color: 'blue',
			left: '1px',
		});
	});
});

describe('element styles (shared render helpers)', () => {
	const base = { id: 'e1', x: 5, y: 6, width: 100, height: 40 };

	it('positions elements absolutely with size and z-index', () => {
		const style = getContainerStyle({ ...base, type: 'text', text: 'hi' } as PptxElement, 7);
		expect(style.position).toBe('absolute');
		expect(style.left).toBe('5px');
		expect(style.top).toBe('6px');
		expect(style.width).toBe('100px');
		expect(style.zIndex).toBe(7);
	});

	it('renders ellipse shapes with a full border radius', () => {
		const style = getShapeFillStrokeStyle({
			...base,
			type: 'shape',
			shapeType: 'ellipse',
			shapeStyle: { fillColor: '#ff0000' },
		} as PptxElement);
		expect(style.borderRadius).toBe('9999px');
		expect(style.backgroundColor).toBe('#ff0000');
	});

	it('renders stroke borders from the shape style', () => {
		const style = getShapeFillStrokeStyle({
			...base,
			type: 'shape',
			shapeType: 'rect',
			shapeStyle: { strokeColor: '#00ff00', strokeWidth: 2 },
		} as PptxElement);
		expect(style.border).toBe('2px solid #00ff00');
	});

	it('builds flex text-block styles with alignment', () => {
		const style = getTextBlockStyle({
			...base,
			type: 'text',
			text: 'hi',
			textStyle: { color: '#123456', fontSize: 20, align: 'center', vAlign: 'middle' },
		} as PptxElement);
		expect(style.color).toBe('#123456');
		expect(style.fontSize).toBe('20px');
		expect(style.textAlign).toBe('center');
		expect(style.justifyContent).toBe('center');
	});

	// This binding's own copy of the text-block builder never read either
	// property, so a shrink-to-fit title painted 43% too large and a
	// `wrap="none"` line wrapped to three. Both now come from the shared builder.
	it('applies the normAutofit font scale and never wraps a wrap="none" body', () => {
		const autofit = getTextBlockStyle({
			...base,
			type: 'text',
			text: 'hi',
			textStyle: { fontSize: 40, autoFit: true, autoFitMode: 'normal', autoFitFontScale: 0.7 },
		} as PptxElement);
		expect(autofit.fontSize).toBe('28px');

		const noWrap = getTextBlockStyle({
			...base,
			type: 'text',
			text: 'hi',
			textStyle: { textWrap: 'none' },
		} as PptxElement);
		expect(noWrap.whiteSpace).toBe('nowrap');
	});
});

/**
 * issue #132 - gradient tiling must survive into the style map.
 *
 * `backgroundPosition` was the one key the shared `ComputedFillStyle` emitted
 * that this binding never copied, so an oversized `a:tileRect` (PowerPoint's
 * corner-radial preset writes `l="-100000" t="-100000"`) got its
 * `background-size` but stayed pinned at `0 0`.
 */
describe('shape gradient tiling (#132)', () => {
	const gradientShape = (extra: Record<string, unknown> = {}) =>
		({
			id: 'e1',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			type: 'shape',
			shapeType: 'ellipse',
			shapeStyle: {
				fillMode: 'gradient',
				fillGradientType: 'radial',
				fillGradientPathType: 'circle',
				fillGradientFillToRect: { l: 0, t: 0, r: 1, b: 1 },
				fillGradientStops: [
					{ color: '#BFBFBF', position: 0 },
					{ color: '#FFFFFF', position: 100 },
				],
				...extra,
			},
		}) as unknown as PptxElement;

	it('carries the background-position of an oversized tileRect', () => {
		const style = getShapeFillStrokeStyle(
			gradientShape({ fillGradientTileRect: { l: -1, t: -1, r: 0, b: 0 } }),
		);
		expect(style.backgroundSize).toBe('200% 200%');
		expect(style.backgroundPosition).toBe('100% 100%');
	});

	it('emits a circle path gradient browsers can actually parse', () => {
		// `circle <percentage>` is invalid CSS: the declaration is discarded and
		// the shape renders unfilled.
		expect(String(getShapeFillStrokeStyle(gradientShape()).backgroundImage)).not.toMatch(
			/circle\s+[\d.]+%/u,
		);
	});
});
