/**
 * canvas-fit.service.ts: Auto-fit scale measurement for `SlideCanvasComponent`.
 * Computes the largest scale (capped at 1 by default) fitting its scroll
 * viewport, reserving host-configurable decorative padding, so the parent's `zoom`
 * input means "100% of fit" rather than "100% of the authored slide size".
 * Thumbnail consumers (slides panel, slide sorter) set `autoFit` false and
 * manage their own scale via `zoom` instead.
 *
 * Extracted from {@link SlideCanvasComponent}. Provided per canvas instance
 * (`providers: [CanvasFitService]` on `SlideCanvasComponent`), so each
 * canvas (main editor, thumbnails, presentation overlay, ...) measures its
 * own viewport independently. The component wires the ResizeObserver /
 * `afterNextRender` lifecycle (both require the component's injection
 * context) and calls {@link recompute}; this service only owns the
 * measurement math and the resulting signal.
 */

import { Injectable, signal } from '@angular/core';

import { calculateViewportFit } from '../internal/shared';
import type { CanvasSize, ViewportFitOptions } from '../internal/shared';

/** Live host accessors the fit computation needs. */
interface CanvasFitHost {
	readonly autoFit: () => boolean;
	readonly viewportElement: () => HTMLElement | undefined;
	readonly canvasSize: () => CanvasSize;
	readonly fitOptions?: () => ViewportFitOptions;
}

@Injectable()
export class CanvasFitService {
	/**
	 * Auto-fit scale (capped at 1 by default): how the fixed-size slide fits
	 * the scroll viewport. The authored slide is e.g. 1280x720, which overflows
	 * a phone; without this it renders off-screen at `zoom=1`.
	 */
	readonly fitScale = signal(1);

	private host: CanvasFitHost | null = null;

	/** Wire the host accessors (called once from the component constructor). */
	bind(host: CanvasFitHost): void {
		this.host = host;
	}

	/**
	 * Recompute {@link fitScale} from the current viewport size. Call after the
	 * view renders and whenever the viewport or slide size may have changed
	 * (ResizeObserver, `canvasSize` change).
	 */
	recompute(): void {
		if (!this.host) {
			return;
		}
		// Thumbnail consumers manage their own scale via `zoom`; keep fit at 1 so
		// the two scales don't compound.
		if (!this.host.autoFit()) {
			this.fitScale.set(1);
			return;
		}
		const el = this.host.viewportElement();
		const size = this.host.canvasSize();
		if (!el || !size.width || !size.height) {
			this.fitScale.set(1);
			return;
		}
		const fit = calculateViewportFit(
			{
				viewportWidth: el.clientWidth,
				viewportHeight: el.clientHeight,
				canvasWidth: size.width,
				canvasHeight: size.height,
				...this.host.fitOptions?.(),
			},
			{ fitPadding: { horizontal: 8, vertical: 16 }, maxFitScale: 1 },
		);
		this.fitScale.set(fit.scale);
	}
}
