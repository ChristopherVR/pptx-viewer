import type { PptxChartData } from 'pptx-viewer-core';
import type { ChartPartRef } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

import {
	onChart3DSelect,
	onChart3DValueDragCommit,
	selectedChart3DPart,
} from './chart-3d-interaction-support';
import type { ChartCanvasEditContext, ChartPartSelection } from './chart-part-selection';

function makeCtx(overrides: Partial<ChartCanvasEditContext> = {}): ChartCanvasEditContext {
	return {
		selection: ref<ChartPartSelection | null>(null),
		setSelection: vi.fn(),
		canSelectCharts: () => true,
		canEditChart: () => true,
		updateElement: vi.fn(),
		...overrides,
	};
}

function chartData(): PptxChartData {
	return {
		chartType: 'bar3D',
		series: [{ name: 'S1', values: [1, 2, 3] }],
		categories: ['A', 'B', 'C'],
	} as unknown as PptxChartData;
}

const part: ChartPartRef = { role: 'dataPoint', seriesIndex: 0, pointIndex: 1 };

describe('selectedChart3DPart', () => {
	it('returns null when the context is undefined', () => {
		expect(selectedChart3DPart(undefined, 'el-1')).toBeNull();
	});

	it('returns null when the selection belongs to a different element', () => {
		const ctx = makeCtx({ selection: ref({ elementId: 'el-2', part }) });
		expect(selectedChart3DPart(ctx, 'el-1')).toBeNull();
	});

	it('returns the part when the selection belongs to this element', () => {
		const ctx = makeCtx({ selection: ref({ elementId: 'el-1', part }) });
		expect(selectedChart3DPart(ctx, 'el-1')).toStrictEqual(part);
	});
});

describe('onChart3DSelect', () => {
	it('does nothing when the context is undefined', () => {
		expect(() => onChart3DSelect(undefined, 'el-1', part)).not.toThrow();
	});

	it('does nothing when charts are not selectable', () => {
		const ctx = makeCtx({ canSelectCharts: () => false });
		onChart3DSelect(ctx, 'el-1', part);
		expect(ctx.setSelection).not.toHaveBeenCalled();
	});

	it('sets the selection scoped to this element when selectable', () => {
		const ctx = makeCtx();
		onChart3DSelect(ctx, 'el-1', part);
		expect(ctx.setSelection).toHaveBeenCalledWith({ elementId: 'el-1', part });
	});

	it('clears the selection when the scene reports a null part', () => {
		const ctx = makeCtx();
		onChart3DSelect(ctx, 'el-1', null);
		expect(ctx.setSelection).toHaveBeenCalledWith(null);
	});
});

describe('onChart3DValueDragCommit', () => {
	it('does nothing when the context is undefined', () => {
		expect(() => onChart3DValueDragCommit(undefined, 'el-1', chartData(), part, 5)).not.toThrow();
	});

	it('does nothing when the chart is not editable', () => {
		const ctx = makeCtx({ canEditChart: () => false });
		onChart3DValueDragCommit(ctx, 'el-1', chartData(), part, 5);
		expect(ctx.updateElement).not.toHaveBeenCalled();
	});

	it('does nothing when there is no chart data', () => {
		const ctx = makeCtx();
		onChart3DValueDragCommit(ctx, 'el-1', undefined, part, 5);
		expect(ctx.updateElement).not.toHaveBeenCalled();
	});

	it('does nothing when the part has no pointIndex (a whole-series mark)', () => {
		const ctx = makeCtx();
		onChart3DValueDragCommit(ctx, 'el-1', chartData(), { role: 'series', seriesIndex: 0 }, 5);
		expect(ctx.updateElement).not.toHaveBeenCalled();
	});

	it('commits the new value through withChartPointValue and updateElement', () => {
		const ctx = makeCtx();
		onChart3DValueDragCommit(ctx, 'el-1', chartData(), part, 5);
		expect(ctx.updateElement).toHaveBeenCalledOnce();
		const [elementId, patch] = vi.mocked(ctx.updateElement).mock.calls[0]!;
		expect(elementId).toBe('el-1');
		const nextData = (patch as { chartData: PptxChartData }).chartData;
		expect(nextData.series[0]?.values?.[1]).toBe(5);
	});
});
