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
});
