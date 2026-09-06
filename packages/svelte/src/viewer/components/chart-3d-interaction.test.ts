import type { ChartPptxElement, PptxChartData } from 'pptx-viewer-core';
import type { ChartPartRef } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';

import { Chart3DInteractionController } from './chart-3d-interaction.svelte';

/**
 * `Chart3DInteractionController`: the runes-state wrapper the five
 * interactive 3D chart views (bar3D/line3D/area3D/pie3D/surface3D) share for
 * click-to-select / drag-to-value state, mirroring `chart-drag.test.ts` for
 * the 2D `ChartDragController`.
 */
const element: ChartPptxElement = {
	id: 'chart3d-1',
	type: 'chart',
	x: 0,
	y: 0,
	width: 400,
	height: 300,
	chartData: {
		chartType: 'bar3D',
		categories: ['A', 'B'],
		series: [{ name: 'S1', values: [10, 20] }],
	},
};

interface FakeHandle {
	setSelectedPart: (part: ChartPartRef | null) => void;
}

function makeController(overrides?: {
	commit?: (elementId: string, chartData: PptxChartData) => void;
	handle?: FakeHandle;
	element?: ChartPptxElement;
}): {
	controller: Chart3DInteractionController<FakeHandle>;
	commit: ReturnType<typeof vi.fn>;
	handle: FakeHandle;
} {
	const commit = vi.fn(overrides?.commit);
	const handle: FakeHandle = overrides?.handle ?? { setSelectedPart: vi.fn() };
	const controller = new Chart3DInteractionController<FakeHandle>({
		element: () => overrides?.element ?? element,
		commit,
		getHandle: () => handle,
	});
	return { controller, commit, handle };
}

describe('chart3DInteractionController', () => {
	it('tracks the selected part on onSelect without touching the handle', () => {
		const { controller, handle } = makeController();
		const part: ChartPartRef = { role: 'dataPoint', seriesIndex: 0, pointIndex: 1 };

		controller.onSelect(part);

		expect(controller.selectedPart).toStrictEqual(part);
		// The scene already painted its own highlight before calling `onSelect`;
		// this must not redundantly call the handle back.
		expect(handle.setSelectedPart).not.toHaveBeenCalled();
	});

	it('clears the selection when onSelect fires with null (empty-space click)', () => {
		const { controller } = makeController();
		controller.onSelect({ role: 'dataPoint', seriesIndex: 0, pointIndex: 0 });

		controller.onSelect(null);

		expect(controller.selectedPart).toBeNull();
	});

	it('formats a live badge and paints the highlight during a drag preview', () => {
		const { controller, handle } = makeController();
		const part: ChartPartRef = { role: 'dataPoint', seriesIndex: 0, pointIndex: 1 };

		controller.onValueDragPreview(part, 42);

		expect(controller.selectedPart).toStrictEqual(part);
		expect(controller.dragLabel).toBe('42');
		expect(handle.setSelectedPart).toHaveBeenCalledExactlyOnceWith(part);
	});

	it('commits the final value ONCE via withChartPointValue on drag release', () => {
		const { controller, commit, handle } = makeController();
		const part: ChartPartRef = { role: 'dataPoint', seriesIndex: 0, pointIndex: 1 };

		controller.onValueDragCommit(part, 99);

		expect(commit).toHaveBeenCalledExactlyOnceWith(
			'chart3d-1',
			expect.objectContaining({
				series: [expect.objectContaining({ values: [10, 99] })],
			}),
		);
		expect(controller.dragLabel).toBeNull();
		expect(handle.setSelectedPart).toHaveBeenCalledExactlyOnceWith(part);
	});

	it('does not commit when the part carries no pointIndex (a series-level mark)', () => {
		const { controller, commit } = makeController();

		controller.onValueDragCommit({ role: 'series', seriesIndex: 0 }, 99);

		expect(commit).not.toHaveBeenCalled();
	});

	it('does not commit for a non-chart element or a chart with no data', () => {
		const { controller, commit } = makeController({
			element: { ...element, chartData: undefined },
		});

		controller.onValueDragCommit({ role: 'dataPoint', seriesIndex: 0, pointIndex: 0 }, 5);

		expect(commit).not.toHaveBeenCalled();
	});

	it('re-applies the tracked selection onto a freshly mounted handle', () => {
		const { controller } = makeController();
		const part: ChartPartRef = { role: 'dataPoint', seriesIndex: 1, pointIndex: 0 };
		controller.onSelect(part);

		const newHandle: FakeHandle = { setSelectedPart: vi.fn() };
		controller.syncSelection(newHandle);

		expect(newHandle.setSelectedPart).toHaveBeenCalledExactlyOnceWith(part);
	});

	it('is a no-op when syncSelection is called with no handle', () => {
		const { controller } = makeController();
		expect(() => controller.syncSelection(undefined)).not.toThrow();
	});
});
