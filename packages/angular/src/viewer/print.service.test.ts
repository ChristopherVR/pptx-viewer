import { Injector, runInInjectionContext } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import type { ChartPptxElement, PptxSlide } from 'pptx-viewer-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_PRINT_SETTINGS } from './print-helpers';
import { PrintService } from './print.service';

function chartSlide(): PptxSlide {
	const chart: ChartPptxElement = {
		id: 'chart-1',
		type: 'chart',
		x: 20,
		y: 20,
		width: 400,
		height: 240,
		chartData: {
			chartType: 'bar',
			title: 'Quarterly revenue',
			categories: ['Q1', 'Q2'],
			series: [{ name: 'Revenue', values: [12, 18], color: '#123456' }],
		},
	};
	return { id: 'slide-1', rId: 'rId1', slideNumber: 1, elements: [chart] };
}

describe('printService SVG slides', () => {
	const write = vi.fn();
	const print = vi.fn();

	beforeEach(() => {
		vi.useFakeTimers();
		write.mockClear();
		print.mockClear();
		vi.spyOn(window, 'open').mockReturnValue({
			document: { open: vi.fn(), write, close: vi.fn() },
			focus: vi.fn(),
			print,
		} as unknown as Window);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	function service(): PrintService {
		const injector = Injector.create({
			providers: [
				{
					provide: TranslateService,
					useValue: { instant: (key: string) => key },
				},
			],
		});
		return runInInjectionContext(injector, () => new PrintService());
	}

	it('prints direct slides as rich SVG without calling captureSlide', async () => {
		const captureSlide = vi.fn(async () => 'data:image/png;base64,raster');

		const opened = await service().print(
			{ ...DEFAULT_PRINT_SETTINGS, printWhat: 'slides' },
			[chartSlide()],
			0,
			captureSlide,
			{ width: 960, height: 540 },
		);

		expect(opened).toBeTruthy();
		expect(captureSlide).not.toHaveBeenCalled();
		expect(write).toHaveBeenCalledOnce();
		const documentHtml = String(write.mock.calls[0][0]);
		expect(documentHtml).toContain('<svg');
		expect(documentHtml).toContain('data-pptx-element="chart"');
		expect(documentHtml).toContain('data-chart-mark="bar"');
		expect(documentHtml).toContain('Quarterly revenue');
	});

	it('keeps notes pages on the raster capture path', async () => {
		const captureSlide = vi.fn(async () => 'data:image/png;base64,raster');

		await service().print(
			{ ...DEFAULT_PRINT_SETTINGS, printWhat: 'notes' },
			[chartSlide()],
			0,
			captureSlide,
		);

		expect(captureSlide).toHaveBeenCalledOnce();
		expect(String(write.mock.calls[0][0])).toContain('data:image/png;base64,raster');
	});
});
