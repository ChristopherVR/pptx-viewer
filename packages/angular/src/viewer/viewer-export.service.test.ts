/**
 * viewer-export.service.test.ts: GIF/video capture-scale wiring.
 *
 * Before `resolveExportCaptureDecision` existed, `exportGif`/`exportVideo`
 * called `captureSlideCanvases` with no scale argument, which defaulted to a
 * fixed 2x regardless of File > Options > Advanced > Default Resolution (see
 * `captureSlideCanvases`'s own default in `viewer-export-capture.ts`), and
 * `exportCanvasesToGif` never downscaled its captured frames. These tests
 * pin both: the resolved `imageResolutionScale` reaches the capture scale,
 * and the shared post-capture cap reaches `exportCanvasesToGif`.
 *
 * `ViewerExportService` only needs `inject()`-able providers, not a full
 * TestBed: its collaborators are mocked directly.
 */
import { Injector, runInInjectionContext, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ExportService } from './export.service';
import { LoadContentService } from './load-content.service';
import { PrintService } from './print.service';
import type { ExportHost } from './viewer-export-capture';
import { ViewerExportService } from './viewer-export.service';

function fakeCanvas(): HTMLCanvasElement {
	return { width: 800, height: 600, getContext: () => null } as unknown as HTMLCanvasElement;
}

function createService(exportSvc: ExportService): ViewerExportService {
	const injector = Injector.create({
		providers: [
			{ provide: ExportService, useValue: exportSvc },
			{ provide: LoadContentService, useValue: { canvasSize: () => ({ width: 0, height: 0 }) } },
			{ provide: PrintService, useValue: { print: vi.fn() } },
			{ provide: TranslateService, useValue: { instant: (key: string) => key } },
		],
	});
	return runInInjectionContext(injector, () => new ViewerExportService());
}

function hostWith(imageResolutionScale?: () => number): ExportHost {
	return {
		activeSlideIndex: signal(0),
		slideCount: () => 1,
		mergedSlides: () => [],
		resolveStage: () => document.createElement('div'),
		imageResolutionScale,
	};
}

describe('viewerExportService.exportGif', () => {
	let exportSvc: {
		renderElement: ReturnType<typeof vi.fn>;
		exportCanvasesToGif: ReturnType<typeof vi.fn>;
	};

	beforeEach(() => {
		exportSvc = {
			renderElement: vi.fn(async () => fakeCanvas()),
			exportCanvasesToGif: vi.fn(),
		};
	});

	it('captures at 2x the default (1x) image-resolution multiplier and caps at 1920px', async () => {
		const svc = createService(exportSvc as unknown as ExportService);
		svc.bind(hostWith());

		await svc.exportGif();

		expect(exportSvc.renderElement).toHaveBeenCalledWith(expect.any(HTMLElement), 2);
		expect(exportSvc.exportCanvasesToGif).toHaveBeenCalledWith(
			expect.any(Array),
			2000,
			'presentation.gif',
			1920,
		);
	});

	it('scales capture with a higher Default Resolution option, cap unchanged', async () => {
		const svc = createService(exportSvc as unknown as ExportService);
		svc.bind(hostWith(() => 330 / 96));

		await svc.exportGif();

		expect(exportSvc.renderElement).toHaveBeenCalledWith(
			expect.any(HTMLElement),
			expect.closeTo((2 * 330) / 96, 5),
		);
		expect(exportSvc.exportCanvasesToGif).toHaveBeenCalledWith(
			expect.any(Array),
			2000,
			'presentation.gif',
			1920,
		);
	});
});

describe('viewerExportService.exportVideo', () => {
	it('captures at 2x the resolved image-resolution multiplier', async () => {
		const exportSvc = {
			renderElement: vi.fn(async () => fakeCanvas()),
			exportCanvasesToWebm: vi.fn(async () => {}),
		};
		const svc = createService(exportSvc as unknown as ExportService);
		svc.bind(hostWith(() => 0.25));

		await svc.exportVideo();

		expect(exportSvc.renderElement).toHaveBeenCalledWith(expect.any(HTMLElement), 0.5);
	});
});
