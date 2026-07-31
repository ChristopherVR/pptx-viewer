import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { getContainerStyle, getShapeFillStrokeStyle, getTextBlockStyle } from './element-style';

/**
 * Minimal element factory. `getContainerStyle` only reads `PptxElementBase`
 * fields, so a controlled assertion to `PptxElement` is sufficient here.
 */
function baseElement(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'shape',
		id: 's1',
		name: '',
		x: 10,
		y: 20,
		width: 100,
		height: 50,
		...overrides,
	} as PptxElement;
}

describe('getContainerStyle', () => {
	it('positions and sizes the element absolutely', () => {
		const style = getContainerStyle(baseElement(), 3);
		expect(style['position']).toBe('absolute');
		expect(style['left']).toBe('10px');
		expect(style['top']).toBe('20px');
		expect(style['width']).toBe('100px');
		expect(style['height']).toBe('50px');
		expect(style['zIndex']).toBe(3);
	});

	it('emits a transform for rotation and flips', () => {
		const style = getContainerStyle(
			baseElement({ rotation: 45, flipHorizontal: true, flipVertical: true }),
			0,
		);
		expect(style['transform']).toBe('rotate(45deg) scaleX(-1) scaleY(-1)');
	});

	it('omits transform when there is no rotation or flip', () => {
		const style = getContainerStyle(baseElement(), 0);
		expect(style['transform']).toBeUndefined();
	});

	it('applies opacity and hidden display', () => {
		const style = getContainerStyle(baseElement({ opacity: 0.5, hidden: true }), 0);
		expect(style['opacity']).toBe(0.5);
		expect(style['display']).toBe('none');
	});
});

describe('getShapeFillStrokeStyle', () => {
	it('paints a solid fill colour', () => {
		const style = getShapeFillStrokeStyle(
			baseElement({ shapeStyle: { fillColor: '#0055AA', fillMode: 'solid' } }),
		);
		expect(style['background-color']).toBe('#0055AA');
		expect(style['background-image']).toBeUndefined();
	});

	it('uses the prebuilt gradient string for gradient fills', () => {
		const gradient = 'linear-gradient(90deg, #FF6B6B 0%, #556270 100%)';
		const style = getShapeFillStrokeStyle(
			baseElement({
				shapeStyle: { fillMode: 'gradient', fillColor: '#FF6B6B', fillGradient: gradient },
			}),
		);
		expect(style['background-image']).toBe(gradient);
		// Gradient takes precedence over the solid colour fallback.
		expect(style['background-color']).toBeUndefined();
	});

	it('renders an image fill stretched to fill by default', () => {
		const style = getShapeFillStrokeStyle(
			baseElement({ shapeStyle: { fillMode: 'image', fillImageUrl: 'data:image/png;base64,AAA' } }),
		);
		expect(style['background-image']).toBe('url(data:image/png;base64,AAA)');
		expect(style['background-repeat']).toBe('no-repeat');
		expect(style['background-size']).toBe('100% 100%');
		expect(style['background-color']).toBe('transparent');
	});

	it('tiles an image fill when fillImageMode is tile', () => {
		const style = getShapeFillStrokeStyle(
			baseElement({
				shapeStyle: { fillMode: 'image', fillImageUrl: 'u', fillImageMode: 'tile' },
			}),
		);
		expect(style['background-repeat']).toBe('repeat');
		expect(style['background-size']).toBe('auto');
	});

	it('does not paint a fill when fillMode is none', () => {
		const style = getShapeFillStrokeStyle(
			baseElement({ shapeStyle: { fillColor: '#123456', fillMode: 'none' } }),
		);
		expect(style['background-color']).toBeUndefined();
		expect(style['background-image']).toBeUndefined();
	});

	/**
	 * `<a:solidFill><a:schemeClr …><a:alpha val="0"/></a:schemeClr></a:solidFill>`
	 * is a fully TRANSPARENT solid fill, which PowerPoint decks use routinely for
	 * a full-bleed click-target rectangle laid over a background video. Angular
	 * used to emit the bare `fillColor` and drop `fillOpacity`, so that invisible
	 * overlay painted as an opaque block of colour and hid the whole slide behind
	 * it (`solution-explorer.pptx` slide 2 rendered as a flat green rectangle).
	 */
	it('applies fillOpacity to a solid fill', () => {
		const invisible = getShapeFillStrokeStyle(
			baseElement({
				shapeStyle: { fillColor: '#84E291', fillMode: 'solid', fillOpacity: 0 },
			}),
		);
		expect(invisible['background-color']).toBe('rgba(132, 226, 145, 0)');

		const half = getShapeFillStrokeStyle(
			baseElement({
				shapeStyle: { fillColor: '#84E291', fillMode: 'solid', fillOpacity: 0.5 },
			}),
		);
		expect(half['background-color']).toBe('rgba(132, 226, 145, 0.5)');

		// An unset opacity keeps the authored colour verbatim (matching React).
		const opaque = getShapeFillStrokeStyle(
			baseElement({ shapeStyle: { fillColor: '#84E291', fillMode: 'solid' } }),
		);
		expect(opaque['background-color']).toBe('#84E291');
	});
});

describe('getTextBlockStyle', () => {
	function textElement(textStyle: Record<string, unknown>): PptxElement {
		return baseElement({ type: 'text', text: 'hi', textStyle } as Partial<PptxElement>);
	}

	it('emits kebab-case CSS with px lengths for [ngStyle]', () => {
		const style = getTextBlockStyle(textElement({ fontSize: 18, bold: true, vAlign: 'middle' }));
		expect(style['font-size']).toBe('18px');
		expect(style['font-weight']).toBe('700');
		expect(style['justify-content']).toBe('center');
		expect(style['line-height']).toBe('1.2');
	});

	// This binding's own copy of the text-block builder never read either
	// property, so a shrink-to-fit title painted 43% too large and a
	// `wrap="none"` line wrapped to three. Both now come from the shared builder.
	it('applies the normAutofit font scale and never wraps a wrap="none" body', () => {
		const autofit = getTextBlockStyle(
			textElement({ fontSize: 40, autoFit: true, autoFitMode: 'normal', autoFitFontScale: 0.7 }),
		);
		expect(autofit['font-size']).toBe('28px');
		expect(getTextBlockStyle(textElement({ textWrap: 'none' }))['white-space']).toBe('nowrap');
		expect(getTextBlockStyle(textElement({}))['white-space']).toBe('pre-wrap');
	});
});
