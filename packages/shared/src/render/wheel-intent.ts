/**
 * `wheel-intent`: what a mouse-wheel / trackpad gesture MEANS, on PowerPoint's
 * terms.
 *
 * PowerPoint's desktop behaviour, which this reproduces:
 *  - Normal (editing) view: a plain wheel scrolls the view, and once there is
 *    nothing left to scroll it steps to the next / previous slide. Ctrl+wheel
 *    zooms.
 *  - Slide Show: every wheel notch navigates - down advances, up goes back.
 *  - The thumbnail rail scrolls independently, which is native CSS overflow and
 *    needs no handler at all.
 *
 * Pure arithmetic over `deltaY` / `deltaMode` / `ctrlKey`, so it lives here
 * rather than five times over: the exact shape `presentation-keymap` already
 * uses for keyboard input.
 *
 * @module render/wheel-intent
 */

/** What a wheel event should cause. */
export type WheelIntent =
	/** Zoom by `deltaScale` (positive zooms in). */
	| { readonly intent: 'zoom'; readonly deltaScale: number }
	| { readonly intent: 'next-slide' }
	| { readonly intent: 'previous-slide' }
	/** Let the browser scroll normally. */
	| { readonly intent: 'scroll' }
	/** Swallow it: charge accumulated toward a step that has not landed yet. */
	| { readonly intent: 'none' };

/** The fields of a `WheelEvent` this module reads. */
export interface WheelInput {
	readonly deltaY: number;
	/** 0 = pixel, 1 = line, 2 = page. Absent is treated as pixel. */
	readonly deltaMode?: number;
	readonly ctrlKey?: boolean;
	/** macOS pinch-zoom arrives as Meta on some browsers. */
	readonly metaKey?: boolean;
}

/**
 * Carries partial scroll charge between events so one trackpad flick is one
 * slide step rather than twenty. Create per viewport with
 * {@link createWheelStepBuffer}.
 */
export interface WheelStepBuffer {
	accumulated: number;
}

/** A fresh, empty step buffer. */
export function createWheelStepBuffer(): WheelStepBuffer {
	return { accumulated: 0 };
}

/** Firefox reports whole lines; Safari can report pages. Normalise to px. */
const LINE_PX = 16;
const PAGE_PX = 400;

/** Scroll distance that constitutes one slide step. */
const STEP_THRESHOLD_PX = 120;

/** Zoom applied per pixel of wheel travel. */
const ZOOM_PER_PX = 0.0015;

/**
 * A wheel event's travel in PIXELS, whatever unit it was reported in.
 *
 * Reading `deltaY` raw is why Ctrl+wheel zoom felt broken on Firefox: it
 * reports `deltaMode: 1` with ~3 lines per notch, so a notch moved zoom by
 * 0.003 instead of ~0.1.
 *
 * @param input The wheel event fields.
 * @returns Signed travel in pixels.
 */
export function normalizeWheelDelta({ deltaY, deltaMode = 0 }: WheelInput): number {
	if (deltaMode === 1) {
		return deltaY * LINE_PX;
	}
	if (deltaMode === 2) {
		return deltaY * PAGE_PX;
	}
	return deltaY;
}

/**
 * Add travel to the buffer and report whether it tipped a slide step.
 *
 * Reversing direction resets the charge, so flicking back does not first have
 * to unwind the charge built up going the other way.
 */
function accumulate(buffer: WheelStepBuffer, px: number): WheelIntent {
	if (px !== 0 && Math.sign(px) !== Math.sign(buffer.accumulated)) {
		buffer.accumulated = 0;
	}
	buffer.accumulated += px;
	if (buffer.accumulated >= STEP_THRESHOLD_PX) {
		buffer.accumulated = 0;
		return { intent: 'next-slide' };
	}
	if (buffer.accumulated <= -STEP_THRESHOLD_PX) {
		buffer.accumulated = 0;
		return { intent: 'previous-slide' };
	}
	return { intent: 'none' };
}

/**
 * Map a wheel event in the EDITING view.
 *
 * @param input The wheel event fields.
 * @param buffer Per-viewport step buffer.
 * @param canScrollFurther Whether the viewport still has scroll travel left in
 *   the gesture's direction. Derive this from the SCALED stage height, not
 *   `scrollHeight - clientHeight`: the stage is CSS-transformed, transforms do
 *   not affect layout, so the untransformed box leaves hundreds of px of
 *   phantom scroll range that would otherwise have to be wheeled through before
 *   the slide would step.
 * @returns The intent to act on.
 */
export function mapEditingWheel(
	input: WheelInput,
	buffer: WheelStepBuffer,
	canScrollFurther: boolean,
): WheelIntent {
	const px = normalizeWheelDelta(input);
	if (input.ctrlKey === true || input.metaKey === true) {
		buffer.accumulated = 0;
		return { intent: 'zoom', deltaScale: -px * ZOOM_PER_PX };
	}
	if (canScrollFurther) {
		buffer.accumulated = 0;
		return { intent: 'scroll' };
	}
	return accumulate(buffer, px);
}

/**
 * Map a wheel event during a SLIDE SHOW, where every notch navigates.
 *
 * @param input The wheel event fields.
 * @param buffer Per-viewport step buffer.
 * @returns The intent to act on.
 */
export function mapPresentationWheel(input: WheelInput, buffer: WheelStepBuffer): WheelIntent {
	return accumulate(buffer, normalizeWheelDelta(input));
}
