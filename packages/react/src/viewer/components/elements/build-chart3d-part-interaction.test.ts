import type { ChartPptxElement, PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { buildChart3DPartInteraction } from './build-chart3d-part-interaction';

function makeElement(): ChartPptxElement {
	const chartData: PptxChartData = {
		chartType: 'bar3D',
		categories: ['Q1', 'Q2'],
		series: [{ name: 'A', values: [10, 20] }],
	};
	return {
		id: 'ch1',
		type: 'chart',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		chartData,
	} as ChartPptxElement;
}

describe('buildChart3DPartInteraction', () => {
	it('returns undefined for a non-editable mount', () => {
		const setSelection = vi.fn();
		const setDragValue = vi.fn();
		const interaction = buildChart3DPartInteraction({
			element: makeElement(),
			canEdit: false,
			selection: null,
			setSelection,
			setDragValue,
		});
		expect(interaction).toBeUndefined();
	});

	it('onSelect sets the selection scoped to this element', () => {
		const setSelection = vi.fn();
		const element = makeElement();
		const interaction = buildChart3DPartInteraction({
			element,
			canEdit: true,
			selection: null,
			setSelection,
			setDragValue: vi.fn(),
		});
		const part = { role: 'dataPoint' as const, seriesIndex: 0, pointIndex: 1 };
		interaction?.onSelect?.(part);
		expect(setSelection).toHaveBeenCalledWith({ elementId: element.id, part });
	});

	it('onSelect(null) clears the selection only when it belongs to this element', () => {
		const element = makeElement();
		const setSelection = vi.fn();
		const otherElementSelection = {
			elementId: 'other',
			part: { role: 'dataPoint' as const, seriesIndex: 0, pointIndex: 0 },
		};
		const interaction = buildChart3DPartInteraction({
			element,
			canEdit: true,
			selection: otherElementSelection,
			setSelection,
			setDragValue: vi.fn(),
		});
		interaction?.onSelect?.(null);
		expect(setSelection).not.toHaveBeenCalled();
	});

	it('onValueDragPreview only updates the live value badge, never the chart data', () => {
		const setDragValue = vi.fn();
		const onUpdateElement = vi.fn();
		const interaction = buildChart3DPartInteraction({
			element: makeElement(),
			canEdit: true,
			onUpdateElement,
			selection: null,
			setSelection: vi.fn(),
			setDragValue,
		});
		interaction?.onValueDragPreview?.({ role: 'dataPoint', seriesIndex: 0, pointIndex: 0 }, 42);
		expect(setDragValue).toHaveBeenCalledWith(42);
		expect(onUpdateElement).not.toHaveBeenCalled();
	});

	it('onValueDragCommit clears the badge and commits the new value via withChartPointValue', () => {
		const setDragValue = vi.fn();
		const onUpdateElement = vi.fn();
		const element = makeElement();
		const interaction = buildChart3DPartInteraction({
			element,
			canEdit: true,
			onUpdateElement,
			selection: null,
			setSelection: vi.fn(),
			setDragValue,
		});
		interaction?.onValueDragCommit?.({ role: 'dataPoint', seriesIndex: 0, pointIndex: 1 }, 99);
		expect(setDragValue).toHaveBeenCalledWith(null);
		expect(onUpdateElement).toHaveBeenCalledOnce();
		const updates = onUpdateElement.mock.calls[0]?.[0] as { chartData: PptxChartData };
		expect(updates.chartData.series[0]?.values[1]).toBe(99);
	});

	it('onValueDragCommit is a no-op without onUpdateElement', () => {
		const setDragValue = vi.fn();
		const interaction = buildChart3DPartInteraction({
			element: makeElement(),
			canEdit: true,
			selection: null,
			setSelection: vi.fn(),
			setDragValue,
		});
		expect(() =>
			interaction?.onValueDragCommit?.({ role: 'dataPoint', seriesIndex: 0, pointIndex: 0 }, 1),
		).not.toThrow();
		expect(setDragValue).toHaveBeenCalledWith(null);
	});
});
