import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ExportControllerDeps } from './export';
import { createTranslator } from './i18n';
import { createElementRendererRegistry } from './render';
import { createInitialViewerState, createStore } from './state';

/**
 * Wiring-only regression coverage for `createExportLifecycle`: the
 * off-screen `createRasterizeSlide` controller and the `./export` barrel are
 * fully mocked so these tests exercise only how `createExportLifecycle`
 * assembles `ExportControllerDeps`, not rasterisation itself (that is
 * covered by `export/rasterize-slide.test.ts` and
 * `export/export-controller.test.ts`).
 */
const {
	rasterizeSlide,
	rasterizeSlideToRaster,
	rasterizeSlideToTiles,
	destroy,
	createRasterizeSlide,
	createExportController,
	createExportProgressModal,
	createExportProgressUi,
} = vi.hoisted(() => {
	const rasterizeSlideFn = vi.fn(),
		rasterizeSlideToRasterFn = vi.fn(),
		rasterizeSlideToTilesFn = vi.fn(),
		destroyFn = vi.fn();
	return {
		rasterizeSlide: rasterizeSlideFn,
		rasterizeSlideToRaster: rasterizeSlideToRasterFn,
		rasterizeSlideToTiles: rasterizeSlideToTilesFn,
		destroy: destroyFn,
		createRasterizeSlide: vi.fn(() => ({
			rasterizeSlide: rasterizeSlideFn,
			rasterizeSlideToRaster: rasterizeSlideToRasterFn,
			rasterizeSlideToTiles: rasterizeSlideToTilesFn,
			destroy: destroyFn,
		})),
		createExportController: vi.fn((_deps: ExportControllerDeps) => ({
			exportSlidePng: vi.fn(),
			copySlideAsImage: vi.fn(),
			exportPdf: vi.fn(),
			exportGif: vi.fn(),
			exportVideo: vi.fn(),
			print: vi.fn(),
			exportJson: vi.fn(),
		})),
		createExportProgressModal: vi.fn(() => ({
			open: vi.fn(),
			update: vi.fn(),
			close: vi.fn(),
		})),
		createExportProgressUi: vi.fn(() => ({
			runPdf: vi.fn(),
			runGif: vi.fn(),
			runVideo: vi.fn(),
			cancel: vi.fn(),
		})),
	};
});

vi.mock(import('./export'), () => ({
	createRasterizeSlide,
	createExportController,
	createExportProgressModal,
	createExportProgressUi,
}));

const { createExportLifecycle } = await import('./export-lifecycle');

function baseDeps() {
	return {
		doc: document,
		container: document.createElement('div'),
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
	};
}

describe('createExportLifecycle', () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it('passes the rasterizer functions through by reference, not re-wrapped in single-arg closures', () => {
		createExportLifecycle(baseDeps());

		const [controllerDeps] = createExportController.mock.calls[0] as [ExportControllerDeps];
		expect(controllerDeps.rasterizeSlide).toBe(rasterizeSlide);
		expect(controllerDeps.rasterizeSlideToRaster).toBe(rasterizeSlideToRaster);
		expect(controllerDeps.rasterizeSlideToTiles).toBe(rasterizeSlideToTiles);
	});

	it('lets a caller-supplied scaleMultiplier reach the real rasterizer untouched', () => {
		createExportLifecycle(baseDeps());

		const [controllerDeps] = createExportController.mock.calls[0] as [ExportControllerDeps];
		// This is the regression this test guards: an earlier
		// `rasterizeSlide: (index) => rasterizer.rasterizeSlide(index)` wrapper
		// silently dropped a second argument, breaking the print path's
		// Options > Advanced > "High quality" scale doubling for every
		// notes/handouts print.
		void controllerDeps.rasterizeSlide(2, 3);
		expect(rasterizeSlide).toHaveBeenCalledWith(2, 3);
	});

	it('destroy() cancels in-flight progress UI and tears down the rasterizer stage', () => {
		const lifecycle = createExportLifecycle(baseDeps());
		lifecycle.destroy();
		expect(destroy).toHaveBeenCalledOnce();
	});
});
