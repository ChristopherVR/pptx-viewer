import type { ImagePptxElement } from 'pptx-viewer-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ElementRenderContext } from '../types';
import { renderImageElement } from './image';

const resolveSource = vi.fn(async (_src: string, _effect: unknown) =>
	Promise.resolve('data:image/png;base64,processed'),
);
vi.mock(import('pptx-viewer-shared'), async (importOriginal) => ({
	...(await importOriginal()),
	resolveColorChangedImageSource: (src: string, effect: unknown) => resolveSource(src, effect),
}));

function context(): ElementRenderContext {
	return {
		document,
		mediaDataUrls: new Map(),
		renderElement: () => null,
	} as unknown as ElementRenderContext;
}

describe('renderImageElement source effects', () => {
	beforeEach(() => resolveSource.mockClear());

	it('applies clrChange asynchronously and renders a color wash overlay', async () => {
		const element: ImagePptxElement = {
			type: 'image',
			id: 'image-1',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			imageData: 'data:image/png;base64,source',
			imageEffects: {
				clrChange: { clrFrom: '#00FF00', clrTo: '#FF0000' },
				colorWash: { color: '#112233', opacity: 35 },
			},
		};
		const node = renderImageElement(element, 0, context()) as HTMLElement;
		await vi.waitFor(() =>
			expect((node.querySelector('img') as HTMLImageElement).src).toContain('processed'),
		);
		expect(resolveSource).toHaveBeenCalledOnce();
		const wash = node.querySelector('.pptxv-image-color-wash') as HTMLElement;
		expect(wash.style.backgroundColor).toBe('#112233');
		expect(wash.style.opacity).toBe('0.35');
	});

	it('counter-flips the img when a blipFill disables rotWithShape (issue: flipped picture fill)', () => {
		// Regression: a custGeom trapezoid with flipV="1" whose blipFill carries
		// `rotWithShape="0"` used to render its photo upside down, because only
		// the outer container's transform flipped the whole picture. The
		// `<img>` must carry the exact inverse transform so the bitmap stays
		// upright while the container's clip-path (the shape's own geometry)
		// still flips.
		const element = {
			type: 'picture',
			id: 'pic-rotwithshape',
			x: 0,
			y: 0,
			width: 100,
			height: 60,
			flipVertical: true,
			shapeType: 'custom',
			imageData: 'data:image/png;base64,source',
			shapeStyle: { fillMode: 'image', fillImageRotWithShape: false },
		} as unknown as ImagePptxElement;
		const node = renderImageElement(element, 0, context()) as HTMLElement;
		const img = node.querySelector('img') as HTMLImageElement;
		expect(img.style.transform).toBe('scaleY(-1)');
		expect(node.style.transform).toContain('scaleY(-1)');
	});

	it('does not counter-flip the img when rotWithShape is unset (default true)', () => {
		const element = {
			type: 'picture',
			id: 'pic-rotwithshape-default',
			x: 0,
			y: 0,
			width: 100,
			height: 60,
			flipVertical: true,
			imageData: 'data:image/png;base64,source',
			shapeStyle: { fillMode: 'image' },
		} as unknown as ImagePptxElement;
		const node = renderImageElement(element, 0, context()) as HTMLElement;
		const img = node.querySelector('img') as HTMLImageElement;
		expect(img.style.transform).not.toContain('scaleY(-1)');
	});

	it('applies a clip-path when the picture has a crop shape', () => {
		const element: ImagePptxElement = {
			type: 'image',
			id: 'image-crop',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			imageData: 'data:image/png;base64,source',
			cropShape: 'ellipse',
		};
		const node = renderImageElement(element, 0, context()) as HTMLElement;
		// The crop clip rides the stationary FRAME (the img may be transformed
		// by a source crop, which would scale and shift an img-level clip).
		expect(node.style.clipPath).toContain('path(');
	});

	it('applies no clip-path when the picture has no crop shape', () => {
		const element: ImagePptxElement = {
			type: 'image',
			id: 'image-no-crop',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			imageData: 'data:image/png;base64,source',
		};
		const node = renderImageElement(element, 0, context()) as HTMLElement;
		const img = node.querySelector('img') as HTMLImageElement;
		expect(img.style.clipPath).toBe('');
	});

	it('renders a picture whose only blip is an SVG extension', () => {
		// Regression: `<a:blip>` with no `r:embed`, only `asvg:svgBlip`, resolved
		// to nothing here while React painted it, so icon artwork silently vanished.
		const element = {
			type: 'picture',
			id: 'pic-svg',
			x: 0,
			y: 0,
			width: 40,
			height: 40,
			svgData: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
		} as unknown as ImagePptxElement;

		const node = renderImageElement(element, 0, context()) as HTMLElement;
		const img = node.querySelector('img') as HTMLImageElement | null;

		expect(img?.getAttribute('src')).toBe('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=');
	});

	it('applies the authored source crop rather than fitting the whole bitmap', () => {
		// Regression: a hard-coded `object-fit: contain` ignored `<a:srcRect>`, so
		// an inset cropped out of a wide composite showed the whole composite.
		const element = {
			type: 'picture',
			id: 'pic-crop',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			imageData: 'data:image/png;base64,source',
			cropLeft: 0.25,
			cropRight: 0.25,
		} as unknown as ImagePptxElement;

		const node = renderImageElement(element, 0, context()) as HTMLElement;
		const img = node.querySelector('img') as HTMLImageElement;

		expect(img.style.objectFit).toBe('fill');
		expect(img.style.transform).toBe('translate(-50%, 0%) scale(2, 1)');
		// The scaled-up source must not paint outside its own frame.
		expect(node.style.overflow).toBe('hidden');
	});

	it('renders a mirrored <img> reflection sibling with no -webkit-box-reflect', () => {
		const element = {
			type: 'picture',
			id: 'pic-reflect',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			imageData: 'data:image/png;base64,source',
			shapeStyle: { reflectionStartOpacity: 0.5, reflectionDistance: 4 },
		} as unknown as ImagePptxElement;

		const node = renderImageElement(element, 0, context()) as HTMLElement;
		const layer = node.querySelector('.pptxv-reflection') as HTMLElement | null;

		expect(layer).not.toBeNull();
		expect(layer?.style.position).toBe('absolute');
		// A vertical mirror; shared now emits it as scale(1, -1).
		expect(layer?.style.transform).toBe('scale(1, -1)');
		expect(node.innerHTML).not.toContain('box-reflect');
		const reflectedImg = layer?.querySelector('img');
		expect(reflectedImg?.getAttribute('src')).toBe('data:image/png;base64,source');
	});

	it('renders no reflection sibling without a:reflection', () => {
		const element = {
			type: 'picture',
			id: 'pic-noreflect',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			imageData: 'data:image/png;base64,source',
		} as unknown as ImagePptxElement;

		const node = renderImageElement(element, 0, context()) as HTMLElement;
		expect(node.querySelector('.pptxv-reflection')).toBeNull();
	});

	it('clips a custGeom oval-cut picture on the FRAME, not the img', () => {
		// Regression: the picture's own shape geometry (an authored oval
		// custGeom) must clip the stationary frame. A pixel-space clip on the
		// `<img>` would be scaled and shifted by the source-crop transform, and
		// the oval rendered past its frame.
		const element = {
			type: 'picture',
			id: 'pic-oval',
			x: 0,
			y: 0,
			width: 756,
			height: 427,
			imageData: 'data:image/png;base64,source',
			shapeType: 'custom',
			pathData: 'M 0 0 L 100 0 L 100 100 Z',
			pathWidth: 100,
			pathHeight: 100,
		} as unknown as ImagePptxElement;

		const node = renderImageElement(element, 0, context()) as HTMLElement;
		const img = node.querySelector('img') as HTMLImageElement;

		expect(node.style.clipPath.startsWith('path(')).toBeTruthy();
		expect(img.style.clipPath).toBe('');
	});

	it('prefers the geometry mask over the derived crop shape when both exist', () => {
		// On load `cropShape` is derived from the picture's own prstGeom, so an
		// oval custGeom picture carries BOTH a geometry mask and a truthy
		// cropShape ('ellipse'). The img-level crop clip would be scaled and
		// shifted by the source-crop transform - the geometry mask wins.
		const element = {
			type: 'picture',
			id: 'pic-both',
			x: 0,
			y: 0,
			width: 756,
			height: 427,
			imageData: 'data:image/png;base64,source',
			shapeType: 'custom',
			pathData: 'M 0 0 L 100 0 L 100 100 Z',
			pathWidth: 100,
			pathHeight: 100,
			cropShape: 'ellipse',
		} as unknown as ImagePptxElement;

		const node = renderImageElement(element, 0, context()) as HTMLElement;
		const img = node.querySelector('img') as HTMLImageElement;

		expect(node.style.clipPath.startsWith('path(')).toBeTruthy();
		expect(img.style.clipPath).toBe('');
	});
});

/**
 * `a:tile/@sx`/`@sy` (ECMA-376 §20.1.8.58) is a percentage of the picture's
 * own NATIVE pixel size, not of the container. The tile div is re-styled in
 * place with an absolute-pixel `backgroundSize` once the async native-size
 * probe resolves.
 */
describe('renderImageElement tiled-picture native size', () => {
	const SRC = 'data:image/png;base64,tile-src';

	/** A minimal `Image`-like stub whose `onload` fires on the next microtask. */
	class FakeImage {
		naturalWidth = 800;
		naturalHeight = 400;
		onload: (() => void) | null = null;
		onerror: (() => void) | null = null;
		#src = '';
		get src(): string {
			return this.#src;
		}
		set src(value: string) {
			this.#src = value;
			queueMicrotask(() => this.onload?.());
		}
	}

	beforeEach(() => {
		vi.stubGlobal('Image', FakeImage);
	});

	function tiledElement(): ImagePptxElement {
		return {
			type: 'image',
			id: 'image-tiled',
			x: 0,
			y: 0,
			width: 200,
			height: 100,
			tileScaleX: 0.1,
			tileScaleY: 0.25,
			imageData: SRC,
		} as unknown as ImagePptxElement;
	}

	it('renders the container-relative percentage before the native size resolves', () => {
		const node = renderImageElement(tiledElement(), 0, context()) as HTMLElement;
		const tile = node.querySelector<HTMLElement>('.pptxv-image-tile');
		expect(tile?.style.backgroundSize).toBe('10% 25%');
	});

	it('switches to an absolute-pixel backgroundSize once the native size resolves', async () => {
		const node = renderImageElement(tiledElement(), 0, context()) as HTMLElement;
		const tile = node.querySelector<HTMLElement>('.pptxv-image-tile');
		// 800 * 0.1 = 80, 400 * 0.25 = 100.
		await vi.waitFor(() => expect(tile?.style.backgroundSize).toBe('80px 100px'));
	});
});
