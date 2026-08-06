import { createViewerZoomStore, viewerZoomPercent } from 'pptx-viewer-shared';

import { clampSlideIndex, resolveNavigationKey } from './navigation';
import { viewerStoreSelection } from './viewer-store.svelte';

/**
 * Reactive viewer chrome state (runes-based): current slide, zoom mode, and
 * fullscreen flag. The Svelte analogue of the Vue binding's `useViewerState`
 * essentials, kept out of the SFC so it is unit-testable without a DOM.
 */
export class ViewerState {
	/** Number of slides in the loaded presentation. */
	slideCount = $state(0);
	/** Active slide index (0-based). */
	current = $state(0);
	/**
	 * The zoom itself lives in the shared `createViewerZoomStore`, so the model
	 * is one definition across all five bindings rather than this binding's own
	 * "percent, or null for fit" encoding. That encoding is kept at THIS
	 * boundary (see the accessor below) so no component or `deck-api` call site
	 * has to change.
	 */
	readonly #zoom = createViewerZoomStore();
	readonly #zoomSelection = viewerStoreSelection(this.#zoom, (state) => state);
	/** True while the viewer root is the fullscreen element. */
	isFullscreen = $state(false);

	/** Manual zoom percent, or `null` for fit-to-viewport. */
	get zoomPercent(): number | null {
		const state = this.#zoomSelection.value;
		return state.manual ? viewerZoomPercent(state.zoom) : null;
	}

	set zoomPercent(percent: number | null) {
		if (percent === null) {
			this.#zoom.dispatch({ type: 'zoom-to-fit' });
			return;
		}
		this.#zoom.dispatch({ type: 'set-zoom', zoom: percent / 100 });
	}

	/** Reset for a freshly-loaded presentation. */
	reset(slideCount: number, initialSlide = 0): void {
		this.slideCount = Math.max(0, slideCount);
		this.current = clampSlideIndex(initialSlide, this.slideCount);
		this.zoomPercent = null;
	}

	goTo(index: number): void {
		this.current = clampSlideIndex(index, this.slideCount);
	}

	next(): void {
		this.goTo(this.current + 1);
	}

	prev(): void {
		this.goTo(this.current - 1);
	}

	first(): void {
		this.goTo(0);
	}

	last(): void {
		this.goTo(this.slideCount - 1);
	}

	/**
	 * Zoom one step in/out from the currently-effective percent. While in fit
	 * mode the state does not know the fitted percent (it depends on viewport
	 * measurements), so the component passes it in.
	 */
	zoomIn(effectivePercent: number): void {
		// Seed the store with wherever the view actually is before stepping, then
		// step: both land as ONE notification, so a press is one render.
		this.#zoom.dispatch(
			{ type: 'set-zoom', zoom: (this.zoomPercent ?? effectivePercent) / 100 },
			{ type: 'zoom-in' },
		);
	}

	zoomOut(effectivePercent: number): void {
		this.#zoom.dispatch(
			{ type: 'set-zoom', zoom: (this.zoomPercent ?? effectivePercent) / 100 },
			{ type: 'zoom-out' },
		);
	}

	zoomToFit(): void {
		this.#zoom.dispatch({ type: 'zoom-to-fit' });
	}

	/**
	 * Apply a keyboard navigation key. Returns true when the key was handled
	 * (so the caller can `preventDefault()`).
	 */
	handleNavigationKey(key: string): boolean {
		const action = resolveNavigationKey(key);
		if (!action || this.slideCount === 0) {
			return false;
		}
		switch (action) {
			case 'next':
				this.next();
				break;
			case 'prev':
				this.prev();
				break;
			case 'first':
				this.first();
				break;
			case 'last':
				this.last();
				break;
		}
		return true;
	}
}
