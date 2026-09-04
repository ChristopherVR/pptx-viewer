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
		// The crop clip lives on the stationary frame CONTAINER (the img carries
		// the source-crop transform, which would scale and shift a pixel-space
		// clip along with it). The container's clip-path clips the img and the
		// color wash alike.
		const view = buildAngularImageRenderView(
			image({ colorWash: { color: '#336699', opacity: 40 } }, { cropShape: 'ellipse' }),
		);
		expect(view.frameGeometryMask?.['clip-path']).toBeTruthy();
		// The geometry cascade resolves this plain picture to no border-radius
		// (no shape geometry), so the crop shape is the fallback clip on the
		// container.
		expect(view.frameGeometryMask?.['border-radius']).toBeUndefined();
		expect(view.imageStyle['clip-path']).toBeUndefined();
		expect(view.colorWashStyle?.['clip-path']).toBeUndefined();
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

	it('clips a custGeom oval-cut picture on the FRAME, not the img', () => {
		// Regression: the picture's own shape geometry (an authored oval
		// custGeom) must clip the stationary frame container. A pixel-space
		// clip on the `<img>` would be scaled and shifted by the source-crop
		// transform, and the oval rendered past its frame.
		const view = buildAngularImageRenderView(
			image(undefined, {
				shapeType: 'custom',
				pathData: 'M 0 0 L 100 0 L 100 100 Z',
				pathWidth: 100,
				pathHeight: 100,
			}),
		);

		expect(String(view.frameGeometryMask?.['clip-path'])).toMatch(/^path\(/);
		expect(view.imageStyle['clip-path']).toBeUndefined();
	});

	it('prefers the geometry mask over the derived crop shape when both exist', () => {
		// On load `cropShape` is derived from the picture's own prstGeom, so an
		// oval custGeom picture carries BOTH a geometry mask and a truthy
		// cropShape ('ellipse'). The img-level crop clip would be scaled and
		// shifted by the source-crop transform - the geometry mask wins, and
		// the derived crop shape must not ride the `<img>`.
		const view = buildAngularImageRenderView(
			image(undefined, {
				shapeType: 'custom',
				pathData: 'M 0 0 L 100 0 L 100 100 Z',
				pathWidth: 100,
				pathHeight: 100,
				cropShape: 'ellipse',
			}),
		);

		expect(String(view.frameGeometryMask?.['clip-path'])).toMatch(/^path\(/);
		expect(view.imageStyle['clip-path']).toBeUndefined();
		expect(view.tilingStyle?.['clip-path']).toBeUndefined();
		expect(view.colorWashStyle?.['clip-path']).toBeUndefined();
	});

	it('rounds an ellipse picture via border-radius on the frame', () => {
		const view = buildAngularImageRenderView(image(undefined, { shapeType: 'ellipse' }));

		expect(view.frameGeometryMask?.['border-radius']).toBe('50%');
		expect(view.imageStyle['border-radius']).toBeUndefined();
	});
});
