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

/**
 * Angular kept its own hand-ported copy of the geometry cascade, and it had
 * drifted four separate ways before it was routed through shared
 * `resolveShapeGeometry`. Each of these failed on the old copy.
 */
describe('getShapeFillStrokeStyle - geometry cascade parity', () => {
	it('normalises `oval` onto the ellipse branch', () => {
		// Angular compared `shapeType` RAW (`=== 'ellipse' || === 'circle'`), so
		// `oval` - a preset offered in the shape picker - fell through to a
		// clip-path here while the other four bindings gave it a radius.
		const style = getShapeFillStrokeStyle(
			baseElement({ shapeType: 'oval', shapeStyle: {} } as Partial<PptxElement>),
		);
		expect(style['border-radius']).toBe('50%');
	});

	it('is case-insensitive about the preset name', () => {
		const style = getShapeFillStrokeStyle(
			baseElement({ shapeType: 'Ellipse', shapeStyle: {} } as Partial<PptxElement>),
		);
		expect(style['border-radius']).toBe('50%');
	});

	it('rounds a roundRect by its AUTHORED adjustment, not a flat 10%', () => {
		// The old copy used `Math.min(w, h) * 0.1` and ignored `a:avLst/adj`
		// entirely - wrong even for the default, which is 16667/50000 * 0.5 =
		// ~16.7% of the short side. Here: 50 * 0.5 * (25000/50000) = 12.5px.
		const style = getShapeFillStrokeStyle(
			baseElement({
				shapeType: 'roundRect',
				shapeStyle: {},
				shapeAdjustments: { adj: 25000 },
			} as unknown as Partial<PptxElement>),
		);
		expect(style['border-radius']).toBe('12.5px');
	});

	it('leaves a connector box bare', () => {
		// The old copy had no connector branch at all.
		const style = getShapeFillStrokeStyle(
			baseElement({ type: 'connector', shapeStyle: {} } as unknown as Partial<PptxElement>),
		);
		expect(style['background-color']).toBe('transparent');
		expect(style['border']).toBe('none');
	});
});

/**
 * Shape 3D (`a:spPr/a:scene3d` + `a:spPr/a:sp3d`) reaches the style map.
 *
 * This binding never called `getComputed3dStyle`, so every bevelled / extruded
 * / camera-rotated shape rendered FLAT here and correct in the other four,
 * while the Angular inspector still shipped the UI to author it.
 */
describe('getShapeFillStrokeStyle - shape 3D', () => {
	it('applies the camera transform and perspective from a:scene3d', () => {
		const style = getShapeFillStrokeStyle(
			baseElement({
				shapeStyle: {
					fillColor: '#3366CC',
					fillMode: 'solid',
					scene3d: { cameraPreset: 'isometricTopUp' },
				},
			} as unknown as Partial<PptxElement>),
		);
		expect(String(style['transform'])).toContain('rotate');
		expect(style['perspective']).toBeDefined();
		expect(style['transform-style']).toBe('preserve-3d');
	});

	it('stacks the a:sp3d extrusion depth into box-shadow without losing the effect shadow', () => {
		const style = getShapeFillStrokeStyle(
			baseElement({
				shapeStyle: {
					fillColor: '#3366CC',
					fillMode: 'solid',
					shadowColor: '#000000',
					shadowBlur: 4,
					shadowOffsetX: 2,
					shadowOffsetY: 2,
					shape3d: { extrusionHeight: 20, extrusionColor: '#224488' },
				},
			} as unknown as Partial<PptxElement>),
		);
		const shadow = String(style['box-shadow']);
		// The drop shadow survives (it is first) and the extrusion is appended.
		expect(shadow).toContain('2px 2px');
		expect(shadow.split(',').length).toBeGreaterThan(1);
	});

	it('is a strict no-op for a shape with no 3D data', () => {
		const style = getShapeFillStrokeStyle(
			baseElement({ shapeStyle: { fillColor: '#3366CC', fillMode: 'solid' } }),
		);
		expect(style['transform']).toBeUndefined();
		expect(style['perspective']).toBeUndefined();
		expect(style['transform-style']).toBeUndefined();
	});
});

/**
 * The whole outline (`a:ln`) now comes from shared `getComputedStrokeStyle`.
 * Before that, `grep compoundLine packages/angular/src` returned nothing (a
 * double / thickThin / thinThick / tri outline painted as one solid line here
 * and as parallel strands everywhere else), and `strokeOpacity` /
 * `a:miter/@lim` never reached the DOM either.
 */
describe('getShapeFillStrokeStyle - outline', () => {
	it('paints a compound outline with border-style: double', () => {
		const style = getShapeFillStrokeStyle(
			baseElement({
				shapeStyle: { strokeColor: '#FF0000', strokeWidth: 8, compoundLine: 'dbl' },
			} as unknown as Partial<PptxElement>),
		);
		expect(style['border']).toBe('8px double #FF0000');
	});

	it('lets the compound type outrank the dash pattern', () => {
		// The local `dot|sysDot ? dotted : dashed` ternary this replaced ignored
		// `compoundLine` entirely, so a compound dashed line lost its strands.
		const style = getShapeFillStrokeStyle(
			baseElement({
				shapeStyle: {
					strokeColor: '#FF0000',
					strokeWidth: 8,
					strokeDash: 'dash',
					compoundLine: 'tri',
				},
			} as unknown as Partial<PptxElement>),
		);
		expect(String(style['border'])).toContain(' double ');
	});

	it('applies strokeOpacity to the border colour', () => {
		const style = getShapeFillStrokeStyle(
			baseElement({
				shapeStyle: { strokeColor: '#FF0000', strokeWidth: 2, strokeOpacity: 0.5 },
			} as unknown as Partial<PptxElement>),
		);
		expect(style['border']).toBe('2px solid rgba(255, 0, 0, 0.5)');
	});

	it('emits the inherited SVG stroke properties, including a:miter/@lim', () => {
		const style = getShapeFillStrokeStyle(
			baseElement({
				shapeStyle: {
					strokeColor: '#FF0000',
					strokeWidth: 2,
					lineJoin: 'miter',
					miterLimit: 800000,
					lineCap: 'rnd',
				},
			} as unknown as Partial<PptxElement>),
		);
		expect(style['stroke-linejoin']).toBe('miter');
		expect(style['stroke-linecap']).toBe('round');
		expect(style['stroke-miterlimit']).toBe(8);
	});

	it('leaves a plain dashed line exactly as before', () => {
		const style = getShapeFillStrokeStyle(
			baseElement({
				shapeStyle: { strokeColor: '#FF0000', strokeWidth: 4, strokeDash: 'dash' },
			} as unknown as Partial<PptxElement>),
		);
		expect(style['border']).toBe('4px dashed #FF0000');
	});
});
