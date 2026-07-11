import type { CanvasSize } from 'pptx-viewer-shared';

import { fitScale } from './navigation';

/** Pull-based dependencies for {@link LayoutState}; read fresh on every access. */
export interface LayoutStateDeps {
	getCanvasSize(): CanvasSize;
	isFullscreen(): boolean;
	/** Manual zoom percent, or `null` for fit-to-viewport. */
	getZoomPercent(): number | null;
}

/**
 * LayoutState: the viewer's viewport-tracking + zoom maths, extracted from
 * `PowerPointViewer.svelte` to keep the SFC within the file-size budget. The
 * template writes {@link setViewport} from its stage resize callback; the
 * getters derive the effective stage scale from the reactive viewport size,
 * canvas size, fullscreen flag, and manual zoom (all tracked through the
 * runes signals they read).
 */
export class LayoutState {
	viewportWidth = $state(0);
	viewportHeight = $state(0);

	readonly #deps: LayoutStateDeps;

	constructor(deps: LayoutStateDeps) {
		this.#deps = deps;
	}

	setViewport(width: number, height: number): void {
		this.viewportWidth = width;
		this.viewportHeight = height;
	}

	/** Scale that fits the slide into the viewport (24px padding when windowed). */
	get fittedScale(): number {
		const { width, height } = this.#deps.getCanvasSize();
		return fitScale(
			this.viewportWidth,
			this.viewportHeight,
			width,
			height,
			this.#deps.isFullscreen() ? 0 : 24,
		);
	}

	/** Effective stage scale: fit-to-viewport unless a manual zoom is active. */
	get scale(): number {
		const zoom = this.#deps.getZoomPercent();
		return this.#deps.isFullscreen() || zoom === null ? this.fittedScale : zoom / 100;
	}

	/** The zoom percent shown in the toolbar (rounded, min 1). */
	get effectivePercent(): number {
		return Math.max(1, Math.round(this.scale * 100));
	}
}
