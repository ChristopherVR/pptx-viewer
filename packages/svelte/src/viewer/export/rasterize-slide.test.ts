import type { PptxSlide } from 'pptx-viewer-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../i18n/translator';
import { createRasterizeSlide } from './rasterize-slide';

const { renderToCanvas } = vi.hoisted(() => ({ renderToCanvas: vi.fn() }));
vi.mock(import('./render-to-canvas'), () => ({ renderToCanvas }));

function fakeCanvas(): HTMLCanvasElement {
	return document.createElement('canvas');
}

function slide(id: string, slideNumber = 1): PptxSlide {
	return { id, rId: `rId-${id}`, slideNumber, elements: [] };
}

function makeContainer(): HTMLElement {
	const container = document.createElement('div');
	document.body.appendChild(container);
	return container;
}

describe('createRasterizeSlide', () => {
	afterEach(() => {
		vi.clearAllMocks();
		document.body.replaceChildren();
	});

	it('mounts a hidden off-screen stage host into the container', () => {
		const container = makeContainer();
		const ctl = createRasterizeSlide({
			doc: document,
			container,
			getSlides: () => [],
			getCanvasSize: () => ({ width: 960, height: 540 }),
			getMediaDataUrls: () => new Map(),
			getTranslator: () => createTranslator(() => 'en'),
			smartArt3D: false,
			surfaceChart3D: false,
			barChart3D: false,
			pieChart3D: false,
			waitForFrame: () => Promise.resolve(),
		});

		const host = container.querySelector<HTMLElement>('.pptx-svelte-export-stage');
		expect(host).toBeTruthy();
		expect(host?.getAttribute('aria-hidden')).toBe('true');
		expect(host?.style.left).toBe('-99999px');

		ctl.destroy();
		expect(container.querySelector('.pptx-svelte-export-stage')).toBeNull();
	});

	it('renders the requested slide into the stage and rasterises it', async () => {
		renderToCanvas.mockResolvedValue(fakeCanvas());
		const container = makeContainer();

		const ctl = createRasterizeSlide({
			doc: document,
			container,
			getSlides: () => [slide('s1')],
			getCanvasSize: () => ({ width: 960, height: 540 }),
			getMediaDataUrls: () => new Map(),
			getTranslator: () => createTranslator(() => 'en'),
			smartArt3D: false,
			surfaceChart3D: false,
			barChart3D: false,
			pieChart3D: false,
			waitForFrame: () => Promise.resolve(),
		});

		const canvas = await ctl.rasterizeSlide(0);
		expect(canvas).toBeInstanceOf(HTMLCanvasElement);
		expect(renderToCanvas).toHaveBeenCalledOnce();

		const [stageEl, options] = renderToCanvas.mock.calls[0] as [
			HTMLElement,
			Record<string, unknown>,
		];
		expect(stageEl.classList.contains('pptx-svelte-stage')).toBeTruthy();
		expect(options).toMatchObject({
			backgroundColor: '#ffffff',
			scale: 2,
			width: 960,
			height: 540,
		});

		ctl.destroy();
	});

	it('rejects for an out-of-range slide index without capturing anything', async () => {
		const container = makeContainer();
		const ctl = createRasterizeSlide({
			doc: document,
			container,
			getSlides: () => [],
			getCanvasSize: () => ({ width: 960, height: 540 }),
			getMediaDataUrls: () => new Map(),
			getTranslator: () => createTranslator(() => 'en'),
			smartArt3D: false,
			surfaceChart3D: false,
			barChart3D: false,
			pieChart3D: false,
			waitForFrame: () => Promise.resolve(),
		});

		await expect(ctl.rasterizeSlide(0)).rejects.toThrow(/no slide at index 0/);
		expect(renderToCanvas).not.toHaveBeenCalled();
		ctl.destroy();
	});

	it('replaces the stage contents on each call (only the latest slide is mounted)', async () => {
		renderToCanvas.mockResolvedValue(fakeCanvas());
		const container = makeContainer();
		const slides = [slide('s1', 1), slide('s2', 2)];

		const ctl = createRasterizeSlide({
			doc: document,
			container,
			getSlides: () => slides,
			getCanvasSize: () => ({ width: 960, height: 540 }),
			getMediaDataUrls: () => new Map(),
			getTranslator: () => createTranslator(() => 'en'),
			smartArt3D: false,
			surfaceChart3D: false,
			barChart3D: false,
			pieChart3D: false,
			waitForFrame: () => Promise.resolve(),
		});

		await ctl.rasterizeSlide(0);
		await ctl.rasterizeSlide(1);

		const host = container.querySelector('.pptx-svelte-export-stage');
		expect(host?.children).toHaveLength(1);
		ctl.destroy();
	});

	it('destroy() unmounts the last-rendered stage and removes the host', async () => {
		renderToCanvas.mockResolvedValue(fakeCanvas());
		const container = makeContainer();

		const ctl = createRasterizeSlide({
			doc: document,
			container,
			getSlides: () => [slide('s1')],
			getCanvasSize: () => ({ width: 960, height: 540 }),
			getMediaDataUrls: () => new Map(),
			getTranslator: () => createTranslator(() => 'en'),
			smartArt3D: false,
			surfaceChart3D: false,
			barChart3D: false,
			pieChart3D: false,
			waitForFrame: () => Promise.resolve(),
		});

		await ctl.rasterizeSlide(0);
		expect(container.querySelector('.pptx-svelte-export-stage')?.children).toHaveLength(1);

		ctl.destroy();
		expect(container.querySelector('.pptx-svelte-export-stage')).toBeNull();
	});
});
