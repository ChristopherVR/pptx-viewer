/**
 * Unit tests for chart-events.ts: mapping `<pptx-three-view>` chart events
 * onto a binding's chart selection / value-commit path. Pure TypeScript.
 */
import type { PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import type { ChartPartRef } from '../render/chart-view-model';
import {
	applyChart3DDrag,
	applyChart3DSelect,
	handleThreeViewChartEvent,
	THREE_VIEW_EVENTS,
	threeViewStateOf,
} from './chart-events';
import type { Chart3DSelectionBridge } from './chart-events';

const chartData: PptxChartData = {
	chartType: 'bar3D',
	categories: ['A', 'B'],
	series: [{ name: 'S', values: [10, 20] }],
};

function makeBridge(overrides: Partial<Chart3DSelectionBridge> = {}): Chart3DSelectionBridge & {
	setSelection: ReturnType<typeof vi.fn>;
	setDragValue: ReturnType<typeof vi.fn>;
	commitChartData: ReturnType<typeof vi.fn>;
} {
	return {
		elementId: 'chart-1',
		chartData,
		canSelect: true,
		selectedElementId: null,
		setSelection: vi.fn(),
		setDragValue: vi.fn(),
		commitChartData: vi.fn(),
		...overrides,
	} as Chart3DSelectionBridge & {
		setSelection: ReturnType<typeof vi.fn>;
		setDragValue: ReturnType<typeof vi.fn>;
		commitChartData: ReturnType<typeof vi.fn>;
	};
}

const part: ChartPartRef = { role: 'dataPoint', seriesIndex: 0, pointIndex: 1 };

describe('applyChart3DSelect', () => {
	it('selects a part on this element when canSelect', () => {
		const bridge = makeBridge();
		applyChart3DSelect(bridge, part);
		expect(bridge.setSelection).toHaveBeenCalledWith({ elementId: 'chart-1', part });
	});

	it('clears the selection on empty-space click when this element was selected', () => {
		const bridge = makeBridge({ selectedElementId: 'chart-1' });
		applyChart3DSelect(bridge, null);
		expect(bridge.setSelection).toHaveBeenCalledWith(null);
	});

	it('does nothing on empty-space click when a different element is selected', () => {
		const bridge = makeBridge({ selectedElementId: 'other' });
		applyChart3DSelect(bridge, null);
		expect(bridge.setSelection).not.toHaveBeenCalled();
	});

	it('is a no-op on a read-only mount', () => {
		const bridge = makeBridge({ canSelect: false });
		applyChart3DSelect(bridge, part);
		expect(bridge.setSelection).not.toHaveBeenCalled();
	});
});

describe('applyChart3DDrag', () => {
	it('drives the drag badge and never commits on move', () => {
		const bridge = makeBridge();
		applyChart3DDrag(bridge, { part, value: 42, phase: 'move' });
		expect(bridge.setDragValue).toHaveBeenCalledWith(42);
		expect(bridge.commitChartData).not.toHaveBeenCalled();
	});

	it('clears the badge and commits the new value on commit', () => {
		const bridge = makeBridge();
		applyChart3DDrag(bridge, { part, value: 99, phase: 'commit' });
		expect(bridge.setDragValue).toHaveBeenCalledWith(null);
		expect(bridge.commitChartData).toHaveBeenCalledWith({
			...chartData,
			series: [{ name: 'S', values: [10, 99] }],
		});
	});

	it('is a no-op on a read-only mount', () => {
		const bridge = makeBridge({ canSelect: false });
		applyChart3DDrag(bridge, { part, value: 99, phase: 'commit' });
		expect(bridge.setDragValue).not.toHaveBeenCalled();
		expect(bridge.commitChartData).not.toHaveBeenCalled();
	});

	it('does not commit a series-level part (no pointIndex)', () => {
		const bridge = makeBridge();
		const seriesPart: ChartPartRef = { role: 'series', seriesIndex: 0 };
		applyChart3DDrag(bridge, { part: seriesPart, value: 99, phase: 'commit' });
		expect(bridge.commitChartData).not.toHaveBeenCalled();
	});
});

function customEvent(type: string, detail: unknown): Event {
	return { type, detail } as unknown as Event;
}

describe('handleThreeViewChartEvent', () => {
	it('routes a select event to the bridge and reports handled', () => {
		const bridge = makeBridge();
		const handled = handleThreeViewChartEvent(
			customEvent(THREE_VIEW_EVENTS.select, { part }),
			bridge,
		);
		expect(handled).toBeTruthy();
		expect(bridge.setSelection).toHaveBeenCalledWith({ elementId: 'chart-1', part });
	});

	it('routes a drag event to the bridge and reports handled', () => {
		const bridge = makeBridge();
		const handled = handleThreeViewChartEvent(
			customEvent(THREE_VIEW_EVENTS.drag, { part, value: 5, phase: 'move' }),
			bridge,
		);
		expect(handled).toBeTruthy();
		expect(bridge.setDragValue).toHaveBeenCalledWith(5);
	});

	it('reports unhandled for an unrelated event type', () => {
		const bridge = makeBridge();
		expect(
			handleThreeViewChartEvent(customEvent(THREE_VIEW_EVENTS.state, { state: 'ready' }), bridge),
		).toBeFalsy();
	});
});

describe('threeViewStateOf', () => {
	it('reads the state off a pptx-three-state event', () => {
		expect(threeViewStateOf(customEvent(THREE_VIEW_EVENTS.state, { state: 'ready' }))).toBe(
			'ready',
		);
	});

	it('returns null for any other event type', () => {
		expect(threeViewStateOf(customEvent(THREE_VIEW_EVENTS.select, { part }))).toBeNull();
	});
});
