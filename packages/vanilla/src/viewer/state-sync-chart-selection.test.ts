/**
 * B3: a chart arms its on-canvas mark hit-testing only while it is selected
 * (`render/elements/chart-editable.ts`), and the chart's own DOM node is not
 * rebuilt by the selection-overlay path selection normally uses (that overlay
 * paints a box from the element's bounds without touching the rendered node).
 * So a selection change must force a stage re-render, or a freshly selected
 * chart never re-arms and a freshly deselected one stays armed.
 */
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

const BASE: ViewerState = createInitialViewerState();

function state(overrides: Partial<ViewerState> = {}): ViewerState {
	return { ...BASE, ...overrides };
}

describe('state sync repaints the stage when the selection changes', () => {
	it('re-renders when an element is selected', () => {
		const { sync, renderStage } = harness();
		sync(state({ selectedElementIds: ['chart-1'] }), state({ selectedElementIds: [] }));
		expect(renderStage).toHaveBeenCalledOnce();
	});

	it('re-renders when the selection is cleared', () => {
		const { sync, renderStage } = harness();
		sync(state({ selectedElementIds: [] }), state({ selectedElementIds: ['chart-1'] }));
		expect(renderStage).toHaveBeenCalledOnce();
	});

	it('stays quiet when nothing changed', () => {
		const { sync, renderStage } = harness();
		const shared = state({ selectedElementIds: ['chart-1'] });
		sync(shared, shared);
		expect(renderStage).not.toHaveBeenCalled();
	});
});
