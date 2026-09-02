/**
 * B3: a chart arms its on-canvas mark hit-testing only while it is selected
 * (`render/elements/chart-editable.ts`), and the chart's own DOM node is not
 * rebuilt by the selection-overlay path selection normally uses (that overlay
 * paints a box from the element's bounds without touching the rendered node).
 * So a CHART entering or leaving the selection must force a stage re-render,
 * or a freshly selected chart never re-arms and a freshly deselected one stays
 * armed. Only a chart: rebuilding the stage on every selection change replaced
 * the node under the pointer between the two clicks of a double-click, so a
 * table cell could no longer be opened for editing (`selection-render-trigger.ts`).
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import type { RenderController } from './render-controller';
import { createInitialViewerState } from './state';
import type { ViewerState } from './state';
import { createStateSync } from './state-sync';
import type { ViewerChrome } from './ui';

function harness(): {
	sync: ReturnType<typeof createStateSync>;
	renderStage: ReturnType<typeof vi.fn>;
} {
	const renderStage = vi.fn();
	const chrome = {
		setLoading: vi.fn(),
		setError: vi.fn(),
		setPresenting: vi.fn(),
	} as unknown as ViewerChrome;
	const sync = createStateSync({
		getChrome: () => chrome,
		renderer: { renderStage, renderThumbnails: vi.fn() } as unknown as RenderController,
		callbacks: {},
	});
	return { sync, renderStage };
}

const SLIDE = {
	id: 'slide-1',
	elements: [
		{ id: 'chart-1', type: 'chart', x: 0, y: 0, width: 10, height: 10 },
		{ id: 'table-1', type: 'table', x: 0, y: 0, width: 10, height: 10 },
	] as PptxElement[],
} as PptxSlide;

const BASE: ViewerState = { ...createInitialViewerState(), slides: [SLIDE], currentSlide: 0 };

function state(overrides: Partial<ViewerState> = {}): ViewerState {
	return { ...BASE, ...overrides };
}

describe('state sync repaints the stage when the selection changes', () => {
	it('re-renders when a chart is selected', () => {
		const { sync, renderStage } = harness();
		sync(state({ selectedElementIds: ['chart-1'] }), state({ selectedElementIds: [] }));
		expect(renderStage).toHaveBeenCalledOnce();
	});

	it('re-renders when a chart is deselected', () => {
		const { sync, renderStage } = harness();
		sync(state({ selectedElementIds: [] }), state({ selectedElementIds: ['chart-1'] }));
		expect(renderStage).toHaveBeenCalledOnce();
	});

	it('keeps the stage DOM when a non-chart element is selected (double-click must still form)', () => {
		const { sync, renderStage } = harness();
		sync(state({ selectedElementIds: ['table-1'] }), state({ selectedElementIds: [] }));
		expect(renderStage).not.toHaveBeenCalled();
	});

	it('stays quiet when nothing changed', () => {
		const { sync, renderStage } = harness();
		const shared = state({ selectedElementIds: ['chart-1'] });
		sync(shared, shared);
		expect(renderStage).not.toHaveBeenCalled();
	});
});
