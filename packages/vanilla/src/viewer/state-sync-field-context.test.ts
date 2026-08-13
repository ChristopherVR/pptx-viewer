/**
 * The Header & Footer dialog must repaint the canvas.
 *
 * The footer / date / slide-number strings do not live on the slide model at
 * all: they come from `PptxHeaderFooter` through the shared field-substitution
 * context, so setting a footer changes `state.headerFooter` and NOTHING in
 * `state.slides`. The store listener only re-rendered on slide-shaped keys, so
 * "Apply to All" updated the model, the save wrote the right master, and the
 * canvas went on painting the string the deck was loaded with until some
 * unrelated edit forced a repaint.
 *
 * `customProperties` feeds the same context (`docproperty` field runs) and had
 * the identical hole.
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
	renderThumbnails: ReturnType<typeof vi.fn>;
} {
	const renderStage = vi.fn();
	const renderThumbnails = vi.fn();
	// Every chrome member the listener touches is optional except these three,
	// which it calls unconditionally on a transition.
	const chrome = {
		setLoading: vi.fn(),
		setError: vi.fn(),
		setPresenting: vi.fn(),
	} as unknown as ViewerChrome;
	const sync = createStateSync({
		getChrome: () => chrome,
		renderer: { renderStage, renderThumbnails } as unknown as RenderController,
		callbacks: {},
	});
	return { sync, renderStage, renderThumbnails };
}

/**
 * A real initial state, so the listener finds every key it reads.
 *
 * Derived from ONE shared base on purpose: the listener compares by identity,
 * and two fresh `createInitialViewerState()` calls differ in every array, which
 * would fire the slide-change branch and hide what these tests are asserting.
 */
const BASE: ViewerState = createInitialViewerState();

function state(overrides: Partial<ViewerState> = {}): ViewerState {
	return { ...BASE, ...overrides };
}

describe('state sync repaints when the field-substitution context changes', () => {
	it('re-renders the stage and the thumbnails on a footer edit', () => {
		const { sync, renderStage, renderThumbnails } = harness();
		const before = state({ headerFooter: { hasFooter: true, footerText: 'Old' } });
		const after = state({ headerFooter: { hasFooter: true, footerText: 'Confidential' } });

		sync(after, before);

		expect(renderStage).toHaveBeenCalledOnce();
		expect(renderThumbnails).toHaveBeenCalledOnce();
	});

	it('re-renders on a custom document-property edit', () => {
		const { sync, renderStage } = harness();
		sync(state({ customProperties: [{ name: 'Owner', value: 'Ada', type: 'lpwstr' }] }), state());
		expect(renderStage).toHaveBeenCalledOnce();
	});

	it('stays quiet when neither changed', () => {
		const { sync, renderStage, renderThumbnails } = harness();
		const shared = state();
		sync(shared, shared);
		expect(renderStage).not.toHaveBeenCalled();
		expect(renderThumbnails).not.toHaveBeenCalled();
	});
});
