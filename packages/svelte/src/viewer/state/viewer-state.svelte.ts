import { clampSlideIndex, resolveNavigationKey, zoomInPercent, zoomOutPercent } from './navigation';

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
	/** Manual zoom percent, or `null` for fit-to-viewport. */
	zoomPercent = $state<number | null>(null);
	/** True while the viewer root is the fullscreen element. */
	isFullscreen = $state(false);

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
		this.zoomPercent = zoomInPercent(this.zoomPercent ?? effectivePercent);
	}

	zoomOut(effectivePercent: number): void {
		this.zoomPercent = zoomOutPercent(this.zoomPercent ?? effectivePercent);
	}

	zoomToFit(): void {
		this.zoomPercent = null;
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
