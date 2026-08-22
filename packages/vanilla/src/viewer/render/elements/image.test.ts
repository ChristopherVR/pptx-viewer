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
		expect(layer?.style.transform).toBe('scaleY(-1)');
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
});
