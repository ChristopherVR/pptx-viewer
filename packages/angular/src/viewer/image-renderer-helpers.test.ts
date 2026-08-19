import type { PptxElement, PptxImageEffects } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildImageBiLevelTable, buildImageLuminanceTransfer } from '../internal/shared';
import { buildAngularImageRenderView } from './image-renderer-helpers';

function image(imageEffects?: PptxImageEffects, extra: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'image',
		id: 'angular-image',
		x: 0,
		y: 0,
		width: 320,
		height: 180,
		imageData: 'data:image/png;base64,AAAA',
		imageEffects,
		...extra,
	};
}

describe('buildAngularImageRenderView', () => {
	it('applies shared CSS, opacity, and advanced SVG filter definitions', () => {
		const view = buildAngularImageRenderView(
			image({
				brightness: 20,
				alphaModFix: 40,
				biLevel: 30,
				hsl: { lum: 20 },
				tint: { hue: 45, amt: -25 },
			}),
		);

		expect(view.imageStyle.filter).toContain('brightness(1.2)');
		expect(view.imageStyle.filter).toContain('url(#imgalpha-angular-image)');
		expect(view.imageStyle.opacity).toBe(0.4);
		expect(view.svgFilters).toHaveLength(1);
		// oxlint-disable-next-line eslint/one-var -- interleaved with expect() calls
		const markup = view.svgFilters[0].markup;
		expect(markup).toContain(`tableValues="${buildImageBiLevelTable(30)}"`);
		expect(markup).toContain('type="hueRotate" values="45"');
		// oxlint-disable-next-line eslint/one-var -- interleaved with expect() calls
		const luminance = buildImageLuminanceTransfer(20);
		expect(markup).toContain(`slope="${luminance.slope}" intercept="${luminance.intercept}"`);
		// oxlint-disable-next-line eslint/one-var -- interleaved with expect() calls
		const tint = buildImageLuminanceTransfer(-25);
		expect(markup).toContain(`slope="${tint.slope}" intercept="${tint.intercept}"`);
	});

	it('preserves shared effects when clrChange selects the processed-image path', () => {
		const view = buildAngularImageRenderView(
			image({
				contrast: 25,
				alphaModFix: 65,
				clrChange: { clrFrom: '#00FF00', clrTo: '#FF0000', clrToTransparent: false },
			}),
		);

		expect(view.clrChange).toStrictEqual({
			clrFrom: '#00FF00',
			clrTo: '#FF0000',
			clrToTransparent: false,
			tolerance: 12,
		});
		expect(view.imageStyle.filter).toContain('contrast(1.25)');
		expect(view.imageStyle.opacity).toBe(0.65);
	});

	it('builds the colorWash overlay style', () => {
		const view = buildAngularImageRenderView(
			image({ colorWash: { color: '#336699', opacity: 135 } }),
		);

		expect(view.colorWashStyle).toStrictEqual({
			position: 'absolute',
			inset: 0,
			'pointer-events': 'none',
			'background-color': '#336699',
			opacity: 1,
		});
	});

	it('leaves ordinary images free of effect-only style and definitions', () => {
		const view = buildAngularImageRenderView(image());

		expect(view.imageStyle).toStrictEqual({
			width: '100%',
			height: '100%',
			objectFit: 'fill',
			display: 'block',
		});
		expect(view.svgFilters).toStrictEqual([]);
		expect(view.clrChange).toBeUndefined();
		expect(view.colorWashStyle).toBeUndefined();
	});

	it('applies the authored source crop rather than fitting the whole bitmap', () => {
		// Regression: Angular hard-coded `object-fit: contain` and ignored
		// `<a:srcRect>`, so an inset cropped out of a wide composite image showed
		// the whole composite instead of its own region.
		const view = buildAngularImageRenderView(image({}, { cropLeft: 0.25, cropRight: 0.25 }));

		expect(view.imageStyle['objectFit']).toBe('fill');
		expect(view.imageStyle['transform']).toBe('translate(-50%, 0%) scale(2, 1)');
	});

	it('clips both the image and color wash to the authored crop shape', () => {
		const view = buildAngularImageRenderView(
			image({ colorWash: { color: '#336699', opacity: 40 } }, { cropShape: 'ellipse' }),
		);
		expect(view.imageStyle['clip-path']).toBeTruthy();
		expect(view.colorWashStyle?.['clip-path']).toBe(view.imageStyle['clip-path']);
	});
});

/**
 * `a:blipFill/a:tile`: a repeating texture. Angular alone had no branch for it,
 * so a tiled picture painted as one stretched copy here while React, Vue,
 * Svelte and Vanilla repeated it through shared `getImageTilingStyle`.
 */
describe('buildAngularImageRenderView - tiled pictures', () => {
	it('returns a repeating background layer instead of an <img> style', () => {
		const view = buildAngularImageRenderView(
			image(undefined, {
				tileScaleX: 0.25,
				tileScaleY: 0.25,
				tileAlignment: 'tl',
			} as Partial<PptxElement>),
		);

		expect(view.tilingStyle).toBeDefined();
		expect(view.tilingStyle?.backgroundRepeat).toBe('repeat');
		expect(view.tilingStyle?.backgroundSize).toBe('25% 25%');
		expect(view.tilingStyle?.backgroundPosition).toBe('0% 0%');
		expect(String(view.tilingStyle?.backgroundImage)).toContain('data:image/png;base64,AAAA');
	});

	it('anchors a centred tile grid at 50% 50%', () => {
		const view = buildAngularImageRenderView(
			image(undefined, {
				tileScaleX: 0.25,
				tileScaleY: 0.25,
				tileAlignment: 'ctr',
			} as Partial<PptxElement>),
		);
		expect(view.tilingStyle?.backgroundPosition).toBe('50% 50%');
	});

	it('carries the image effect filter and opacity onto the tile layer', () => {
		const view = buildAngularImageRenderView(
			image({ brightness: 20, alphaModFix: 40 }, {
				tileScaleX: 0.5,
				tileScaleY: 0.5,
			} as Partial<PptxElement>),
		);
		expect(String(view.tilingStyle?.filter)).toContain('brightness(1.2)');
		expect(view.tilingStyle?.opacity).toBe(0.4);
	});

	it('is undefined for an ordinary picture, which keeps the <img> branch', () => {
		expect(buildAngularImageRenderView(image()).tilingStyle).toBeUndefined();
	});
});
