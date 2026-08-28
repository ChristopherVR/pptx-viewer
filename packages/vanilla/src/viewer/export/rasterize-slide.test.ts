import type { PptxSlide } from 'pptx-viewer-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import { createElementRendererRegistry } from '../render';
import { createDefaultRegistry } from '../render/elements';
import { createInitialViewerState, createStore } from '../state';
import { createRasterizeSlide } from './rasterize-slide';

const { renderToCanvas } = vi.hoisted(() => ({ renderToCanvas: vi.fn() }));
vi.mock(import('./render-to-canvas'), () => ({ renderToCanvas }));

function fakeCanvas(): HTMLCanvasElement {
	return document.createElement('canvas');
}

function slide(): PptxSlide {
	return { id: 's1', rId: 'rId1', slideNumber: 1, elements: [] };
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
			store: createStore(createInitialViewerState()),
			registry: createElementRendererRegistry(),
			getTranslator: () => createTranslator(),
			getSmartArt3D: () => false,
			getSurfaceChart3D: () => false,
			getBarChart3D: () => false,
			getLineChart3D: () => false,
			getAreaChart3D: () => false,
			getPieChart3D: () => false,
			getImageResolutionScale: () => 1,
			waitForFrame: () => Promise.resolve(),
		});

		const host = container.querySelector<HTMLElement>('.pptxv-export-stage');
		expect(host).toBeTruthy();
		expect(host?.getAttribute('aria-hidden')).toBe('true');
		expect(host?.style.left).toBe('-99999px');

		ctl.destroy();
		expect(container.querySelector('.pptxv-export-stage')).toBeNull();
	});

	it('renders the requested slide into the stage and rasterises it', async () => {
		renderToCanvas.mockResolvedValue(fakeCanvas());
		const container = makeContainer();
		const store = createStore(createInitialViewerState());
		store.set({ slides: [slide()], canvasSize: { width: 960, height: 540 } });

		const ctl = createRasterizeSlide({
			doc: document,
			container,
			store,
			registry: createElementRendererRegistry(),
			getTranslator: () => createTranslator(),
			getSmartArt3D: () => false,
			getSurfaceChart3D: () => false,
			getBarChart3D: () => false,
			getLineChart3D: () => false,
			getAreaChart3D: () => false,
			getPieChart3D: () => false,
			getImageResolutionScale: () => 1,
			waitForFrame: () => Promise.resolve(),
		});

		const canvas = await ctl.rasterizeSlide(0);
		expect(canvas).toBeInstanceOf(HTMLCanvasElement);
		expect(renderToCanvas).toHaveBeenCalledOnce();

		const [stageEl, options] = renderToCanvas.mock.calls[0] as [
			HTMLElement,
			Record<string, unknown>,
		];
		expect(stageEl.classList.contains('pptxv-stage')).toBeTruthy();
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
			store: createStore(createInitialViewerState()),
			registry: createElementRendererRegistry(),
			getTranslator: () => createTranslator(),
			getSmartArt3D: () => false,
			getSurfaceChart3D: () => false,
			getBarChart3D: () => false,
			getLineChart3D: () => false,
			getAreaChart3D: () => false,
			getPieChart3D: () => false,
			getImageResolutionScale: () => 1,
			waitForFrame: () => Promise.resolve(),
		});

		await expect(ctl.rasterizeSlide(0)).rejects.toThrow(/no slide at index 0/);
		expect(renderToCanvas).not.toHaveBeenCalled();
		ctl.destroy();
	});

	// The capture stage renders outside the live render controller, so it has to
	// build its own field context; without it an exported PNG/PDF printed the
	// authored "Slide #" placeholder while the screen showed "Slide 1".
	it('substitutes field runs on the capture stage from the store state', async () => {
		renderToCanvas.mockResolvedValue(fakeCanvas());
		const container = makeContainer();
		const store = createStore(createInitialViewerState());
		store.set({
			slides: [
				{
					...slide(),
					slideNumber: 2,
					elements: [
						{
							id: 'f1',
							type: 'text',
							x: 0,
							y: 0,
							width: 200,
							height: 40,
							textSegments: [{ text: 'Slide #', style: {}, fieldType: 'slidenum' }],
						},
						{
							id: 'f2',
							type: 'text',
							x: 0,
							y: 60,
							width: 200,
							height: 40,
							textSegments: [{ text: '<title>', style: {}, fieldType: 'slidetitle' }],
						},
						{
							id: 't1',
							type: 'text',
							x: 0,
							y: 120,
							width: 200,
							height: 40,
							text: 'Results',
							placeholderType: 'title',
						},
					],
				} as unknown as PptxSlide,
			],
			canvasSize: { width: 960, height: 540 },
			headerFooter: { footerText: 'Confidential' },
		});

		const ctl = createRasterizeSlide({
			doc: document,
			container,
			store,
			// The real renderers (not the bare registry the other cases use): this
			// case asserts on rendered text, so the text renderer must be present.
			registry: createDefaultRegistry(),
			getTranslator: () => createTranslator(),
			getSmartArt3D: () => false,
			getSurfaceChart3D: () => false,
			getBarChart3D: () => false,
			getLineChart3D: () => false,
			getAreaChart3D: () => false,
			getPieChart3D: () => false,
			getImageResolutionScale: () => 1,
			waitForFrame: () => Promise.resolve(),
		});

		await ctl.rasterizeSlide(0);
		const [stageEl] = renderToCanvas.mock.calls[0] as [HTMLElement];
		expect(stageEl.textContent).toContain('2');
		expect(stageEl.textContent).not.toContain('Slide #');
		expect(stageEl.textContent).toContain('Results');
		expect(stageEl.textContent).not.toContain('<title>');

		ctl.destroy();
	});

	it('replaces the stage contents on each call (only the latest slide is mounted)', async () => {
		renderToCanvas.mockResolvedValue(fakeCanvas());
		const container = makeContainer();
		const store = createStore(createInitialViewerState());
		store.set({
			slides: [slide(), { ...slide(), id: 's2', slideNumber: 2 }],
			canvasSize: { width: 960, height: 540 },
		});

		const ctl = createRasterizeSlide({
			doc: document,
			container,
			store,
			registry: createElementRendererRegistry(),
			getTranslator: () => createTranslator(),
			getSmartArt3D: () => false,
			getSurfaceChart3D: () => false,
			getBarChart3D: () => false,
			getLineChart3D: () => false,
			getAreaChart3D: () => false,
			getPieChart3D: () => false,
			getImageResolutionScale: () => 1,
			waitForFrame: () => Promise.resolve(),
		});

		await ctl.rasterizeSlide(0);
		await ctl.rasterizeSlide(1);

		const host = container.querySelector('.pptxv-export-stage');
		expect(host?.children).toHaveLength(1);
		ctl.destroy();
	});
});
