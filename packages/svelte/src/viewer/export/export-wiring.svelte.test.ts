import type { PptxSlide } from 'pptx-viewer-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../i18n/translator';
import { createExportWiring } from './export-wiring.svelte';
import { createExportingApi } from './exporting-api';

/**
 * `.svelte.test.ts` because `createExportWiring` returns an `ExportController`
 * (`.svelte.ts`, `$state`-backed). Covers the lazy off-screen stage creation
 * (falls back to `document.body` before the viewer root mounts) and that
 * `createExportingApi` binds through to the live controller.
 */

const { renderToCanvas } = vi.hoisted(() => ({ renderToCanvas: vi.fn() }));
vi.mock(import('./render-to-canvas'), () => ({ renderToCanvas }));

function fakeCanvas(): HTMLCanvasElement {
	return document.createElement('canvas');
}

function slide(id: string): PptxSlide {
	return { id, rId: `rId-${id}`, slideNumber: 1, elements: [] };
}

describe('createExportWiring', () => {
	afterEach(() => {
		vi.clearAllMocks();
		document.body.replaceChildren();
	});

	it('falls back to document.body when the container getter returns undefined', async () => {
		renderToCanvas.mockResolvedValue(fakeCanvas());
		const wiring = createExportWiring({
			getContainer: () => undefined,
			getSlides: () => [slide('s1')],
			getCanvasSize: () => ({ width: 960, height: 540 }),
			getMediaDataUrls: () => new Map(),
			getCurrent: () => 0,
			getTranslator: () => createTranslator(() => 'en'),
			getSmartArt3D: () => false,
			getSurfaceChart3D: () => false,
			getBarChart3D: () => false,
			getLineChart3D: () => false,
			getAreaChart3D: () => false,
			getPieChart3D: () => false,
		});

		await wiring.controller.exportSlidePng(0);
		expect(document.body.querySelector('.pptx-svelte-export-stage')).toBeTruthy();

		wiring.destroy();
		expect(document.body.querySelector('.pptx-svelte-export-stage')).toBeNull();
	});

	it('exposes exportSlidePng/exportPdf via createExportingApi bound to the live controller', async () => {
		renderToCanvas.mockResolvedValue(fakeCanvas());
		const wiring = createExportWiring({
			getContainer: () => undefined,
			getSlides: () => [slide('s1')],
			getCanvasSize: () => ({ width: 960, height: 540 }),
			getMediaDataUrls: () => new Map(),
			getCurrent: () => 0,
			getTranslator: () => createTranslator(() => 'en'),
			getSmartArt3D: () => false,
			getSurfaceChart3D: () => false,
			getBarChart3D: () => false,
			getLineChart3D: () => false,
			getAreaChart3D: () => false,
			getPieChart3D: () => false,
		});
		const api = createExportingApi(wiring.controller);

		const spy = vi.spyOn(wiring.controller, 'exportSlidePng');
		await api.exportSlidePng(0);
		expect(spy).toHaveBeenCalledWith(0);

		wiring.destroy();
	});
});
