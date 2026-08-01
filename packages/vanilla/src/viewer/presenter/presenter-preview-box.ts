/**
 * Sizing the console's scaled slide previews.
 *
 * `renderSlideNode(slide, scale)` returns a full-size stage (1280x720 for a
 * 16:9 deck) shrunk with a CSS `transform`. A transform does not change layout,
 * so the node still CLAIMS 720px of column height however small it looks. In a
 * flex column that is not a cosmetic detail: the presenter rail's next-slide
 * preview claimed the whole rail, and the speaker notes below it were pushed
 * clean off the bottom of the screen while every DOM probe reported them
 * present. Each preview therefore goes in a host box sized to the SCALED
 * dimensions, with the overflow clipped.
 *
 * @module viewer/presenter/presenter-preview-box
 */

/** Deck dimensions in CSS pixels at scale 1. */
export interface PresenterCanvasSize {
	width: number;
	height: number;
}

/**
 * Give `host` the layout box a slide rendered at `scale` actually occupies.
 *
 * @param host - The element the scaled stage was appended to.
 */
export function sizePreviewHost(
	host: HTMLElement,
	canvas: PresenterCanvasSize,
	scale: number,
): void {
	host.style.width = `${String(Math.round(canvas.width * scale))}px`;
	host.style.height = `${String(Math.round(canvas.height * scale))}px`;
	host.style.overflow = 'hidden';
	// The stage is transform-scaled from its top-left corner, so the host has to
	// anchor there too or the shrunk slide floats in the middle of its own box.
	host.style.position = 'relative';
}

/** The scale at which a deck of `canvas` width fits `targetWidth`. */
export function scaleForWidth(canvas: PresenterCanvasSize, targetWidth: number): number {
	return canvas.width > 0 ? targetWidth / canvas.width : 1;
}

/** The scale at which a deck fits entirely inside `width` x `height`. */
export function scaleToFit(canvas: PresenterCanvasSize, width: number, height: number): number {
	if (canvas.width <= 0 || canvas.height <= 0) {
		return 1;
	}
	return Math.max(0.01, Math.min(width / canvas.width, height / canvas.height));
}
