/**
 * One zoom step, for every binding's zoom controls.
 *
 * The status-bar and ribbon +/- buttons are the same control in all five
 * bindings, but each binding owned its own step: React, Vue and Angular added
 * 0.1 to the scale while Vanilla and Svelte multiplied it by 1.25, so the same
 * click zoomed 10% in three apps and 25% in the other two. Nothing tied the
 * five numbers together, which is why they diverged silently.
 *
 * React's additive step is the reference (100% means fit-to-viewport there, so
 * the readout reads 100/110/120% and lands on round numbers). These helpers
 * are the single definition of it; a binding that needs percentages rather
 * than a scale factor uses the `*Percent` pair, which is the same arithmetic.
 *
 * @module render/zoom-step
 */

/** Scale added or removed by one press of zoom in / zoom out. */
export const ZOOM_STEP = 0.1;

/** Smallest user zoom the controls will step down to (20%). */
export const MIN_ZOOM_SCALE = 0.2;

/** Largest user zoom the controls will step up to (500%). */
export const MAX_ZOOM_SCALE = 5;

/**
 * Round to whole percentage points.
 *
 * Repeated additive stepping otherwise accumulates binary-float dust
 * (1.1 + 0.1 === 1.2000000000000002), which leaks into the zoom readout.
 */
function roundZoom(scale: number): number {
	return Math.round(scale * 100) / 100;
}

/** Clamp a user zoom scale into {@link MIN_ZOOM_SCALE}..{@link MAX_ZOOM_SCALE}. */
export function clampZoomScale(scale: number): number {
	if (!Number.isFinite(scale)) {
		return 1;
	}
	return Math.min(Math.max(scale, MIN_ZOOM_SCALE), MAX_ZOOM_SCALE);
}

/** The scale one zoom-in press moves to, clamped. */
export function zoomInScale(scale: number): number {
	return clampZoomScale(roundZoom(scale + ZOOM_STEP));
}

/** The scale one zoom-out press moves to, clamped. */
export function zoomOutScale(scale: number): number {
	return clampZoomScale(roundZoom(scale - ZOOM_STEP));
}

/** Smallest zoom percentage the controls will step down to. */
export const ZOOM_MIN_PERCENT = MIN_ZOOM_SCALE * 100;

/** Largest zoom percentage the controls will step up to. */
export const ZOOM_MAX_PERCENT = MAX_ZOOM_SCALE * 100;

/** The percentage one zoom-in press moves to, clamped. */
export function zoomInPercent(percent: number): number {
	return Math.round(zoomInScale(percent / 100) * 100);
}

/** The percentage one zoom-out press moves to, clamped. */
export function zoomOutPercent(percent: number): number {
	return Math.round(zoomOutScale(percent / 100) * 100);
}
