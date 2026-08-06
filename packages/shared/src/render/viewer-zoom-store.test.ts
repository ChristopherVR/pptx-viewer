/**
 * The zoom slice's behaviour contract, plus the notification counts that make
 * it worth putting on the runtime at all (issue #145).
 */
import { describe, it, expect, vi } from 'vitest';

import {
	createViewerZoomStore,
	effectiveZoomScale,
	reduceViewerZoom,
	viewerZoomPercent,
	DEFAULT_VIEWER_ZOOM_STATE,
} from './viewer-zoom-store';
import { MAX_ZOOM_SCALE, MIN_ZOOM_SCALE } from './zoom-step';

describe('viewer zoom commands', () => {
	it('steps in and out by the shared step', () => {
		const store = createViewerZoomStore();
		store.dispatch({ type: 'zoom-in' });
		expect(store.getState().zoom).toBe(1.1);
		store.dispatch({ type: 'zoom-out' });
		expect(store.getState().zoom).toBe(1);
	});

	it('clamps to the shared bounds', () => {
		const store = createViewerZoomStore({ zoom: MAX_ZOOM_SCALE });
		store.dispatch({ type: 'zoom-in' });
		expect(store.getState().zoom).toBe(MAX_ZOOM_SCALE);

		store.dispatch({ type: 'set-zoom', zoom: 0 });
		expect(store.getState().zoom).toBe(MIN_ZOOM_SCALE);
	});

	it('marks the zoom manual once the user acts', () => {
		const store = createViewerZoomStore();
		expect(store.getState().manual).toBeFalsy();

		store.dispatch({ type: 'zoom-in' });

		expect(store.getState().manual).toBeTruthy();
	});

	it('zoom-to-fit returns to 1x and gives up manual control', () => {
		const store = createViewerZoomStore();
		store.dispatch({ type: 'set-zoom', zoom: 2 });

		store.dispatch({ type: 'zoom-to-fit' });

		expect(store.getState().zoom).toBe(1);
		expect(store.getState().manual).toBeFalsy();
	});

	it('a viewport measurement never counts as a user zoom', () => {
		// A window resize must not look like the user took control, or the canvas
		// would stop following the viewport for the rest of the session.
		const store = createViewerZoomStore();

		store.dispatch({ type: 'set-fit-scale', fitScale: 0.5 });

		expect(store.getState().fitScale).toBe(0.5);
		expect(store.getState().manual).toBeFalsy();
	});

	it('ignores a nonsensical fit measurement', () => {
		const store = createViewerZoomStore();
		store.dispatch({ type: 'set-fit-scale', fitScale: 0 });
		expect(store.getState().fitScale).toBe(1);
		store.dispatch({ type: 'set-fit-scale', fitScale: Number.NaN });
		expect(store.getState().fitScale).toBe(1);
	});

	it('leaves state untouched for an unknown command', () => {
		const state = DEFAULT_VIEWER_ZOOM_STATE;
		expect(reduceViewerZoom(state, { type: 'nope' } as never)).toBe(state);
	});
});

describe('derived readings', () => {
	it('effective scale is the product of fit and user zoom', () => {
		expect(effectiveZoomScale({ zoom: 2, fitScale: 0.5, manual: true })).toBe(1);
	});

	it('percent reports the user factor', () => {
		expect(viewerZoomPercent(1.1)).toBe(110);
	});
});

describe('zoom notification cost', () => {
	it('says nothing when a step is already clamped at the limit', () => {
		const store = createViewerZoomStore({ zoom: MAX_ZOOM_SCALE, manual: true });
		const listener = vi.fn();
		store.subscribe(listener);

		store.dispatch({ type: 'zoom-in' });
		store.dispatch({ type: 'zoom-in' });

		expect(listener).not.toHaveBeenCalled();
	});

	it('says nothing when a fit measurement repeats', () => {
		// A ResizeObserver fires on every layout pass, most of which report the
		// size it already had.
		const store = createViewerZoomStore();
		const listener = vi.fn();
		store.subscribe(listener);

		store.dispatch({ type: 'set-fit-scale', fitScale: 1 });
		store.dispatch({ type: 'set-fit-scale', fitScale: 1 });

		expect(listener).not.toHaveBeenCalled();
	});

	it('does not wake a zoom subscriber when only the fit scale moves', () => {
		const store = createViewerZoomStore();
		const onZoom = vi.fn();
		store.subscribeSelector((s) => s.zoom, onZoom);

		store.dispatch({ type: 'set-fit-scale', fitScale: 0.4 });

		expect(onZoom).not.toHaveBeenCalled();
	});

	it('wakes an effective-scale subscriber when either input moves', () => {
		const store = createViewerZoomStore();
		const onScale = vi.fn();
		store.subscribeSelector(effectiveZoomScale, onScale);

		store.dispatch({ type: 'set-fit-scale', fitScale: 0.5 });
		expect(onScale).toHaveBeenCalledExactlyOnceWith(0.5, 1);

		store.dispatch({ type: 'zoom-in' });
		expect(onScale).toHaveBeenCalledTimes(2);
	});

	it('lands a fit measurement and a zoom reset as one notification', () => {
		const store = createViewerZoomStore({ zoom: 2, manual: true });
		const listener = vi.fn();
		store.subscribe(listener);

		store.dispatch({ type: 'set-fit-scale', fitScale: 0.5 }, { type: 'zoom-to-fit' });

		expect(listener).toHaveBeenCalledOnce();
		expect(store.getState()).toStrictEqual({ zoom: 1, fitScale: 0.5, manual: false });
	});
});
