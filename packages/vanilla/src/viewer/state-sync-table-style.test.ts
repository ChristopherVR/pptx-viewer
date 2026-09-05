/**
 * A table style DEFINITION edit ("Edit style...") must repaint the canvas.
 *
 * `tableStyleMap` is not part of `state.slides`, so the store listener that
 * decides when to re-render never noticed a change to it: unlike the other
 * four bindings' reactive frameworks, this store's listener IS the
 * reactivity, and a key left off its comparison list simply never repaints
 * again. An edit rendered once (whatever triggered the first paint after the
 * edit landed) and then stopped tracking further edits/deletes.
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

const BASE: ViewerState = createInitialViewerState();

function state(overrides: Partial<ViewerState> = {}): ViewerState {
	return { ...BASE, ...overrides };
}

describe('state sync repaints when tableStyleMap changes', () => {
	it('re-renders the stage and the thumbnails on a table style map edit', () => {
		const { sync, renderStage, renderThumbnails } = harness();
		const before = state({ tableStyleMap: { a: { styleId: 'a', styleName: 'a' } } });
		const after = state({
			tableStyleMap: {
				a: { styleId: 'a', styleName: 'a' },
				b: { styleId: 'b', styleName: 'b' },
			},
		});

		sync(after, before);

		expect(renderStage).toHaveBeenCalledOnce();
		expect(renderThumbnails).toHaveBeenCalledOnce();
	});

	it('does not re-render when nothing changed (identity check, not deep-equal)', () => {
		const { sync, renderStage, renderThumbnails } = harness();
		const same = state();

		sync(same, same);

		expect(renderStage).not.toHaveBeenCalled();
		expect(renderThumbnails).not.toHaveBeenCalled();
	});
});
