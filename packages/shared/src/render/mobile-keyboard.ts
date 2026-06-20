/**
 * Framework-agnostic virtual-keyboard inset maths shared by the React, Vue, and
 * Angular bindings. On a touch device the on-screen keyboard shrinks the
 * `VisualViewport` (its `height`) without changing the layout viewport
 * (`window.innerHeight`). The difference is how many CSS pixels the keyboard
 * covers at the bottom of the screen.
 *
 * Each binding wires a tiny `visualViewport` `resize` listener and feeds the
 * live measurements through {@link computeKeyboardInset} and
 * {@link computeScrollDelta}; the pure maths lives here so every binding keeps
 * the focused field visible identically (and is unit-testable without a DOM).
 */

/**
 * Below this many covered CSS pixels we treat the keyboard as closed. URL-bar
 * collapse / browser-chrome jitter routinely shrinks the visual viewport by a
 * few dozen pixels; a real on-screen keyboard covers far more (typically
 * 250px+), so this threshold rejects the noise without missing a real keyboard.
 */
export const KEYBOARD_OPEN_THRESHOLD = 120;

/** A snapshot of the layout + visual viewport, as numbers (DOM-free). */
export interface ViewportMetrics {
	/** Layout-viewport height, i.e. `window.innerHeight` (CSS px). */
	layoutHeight: number;
	/** Visual-viewport height, i.e. `visualViewport.height` (CSS px). */
	visualHeight: number;
	/** Visual-viewport top offset, i.e. `visualViewport.offsetTop` (CSS px). */
	offsetTop: number;
}

/**
 * Compute how many CSS pixels the on-screen keyboard covers at the bottom of
 * the layout viewport.
 *
 * The visible region spans `[offsetTop, offsetTop + visualHeight]` inside the
 * layout viewport `[0, layoutHeight]`; whatever sits below the visible region
 * is covered by the keyboard (and/or the collapsed browser chrome):
 *
 *   inset = layoutHeight - (visualHeight + offsetTop)
 *
 * Clamped to `>= 0` and rounded. Returns `0` for non-finite or zero inputs so a
 * missing `VisualViewport` (desktop, SSR, old browsers) reports "no keyboard".
 */
export function computeKeyboardInset(m: ViewportMetrics): number {
	const { layoutHeight, visualHeight, offsetTop } = m;
	if (
		!Number.isFinite(layoutHeight) ||
		!Number.isFinite(visualHeight) ||
		!Number.isFinite(offsetTop) ||
		layoutHeight <= 0 ||
		visualHeight <= 0
	) {
		return 0;
	}
	const inset = layoutHeight - (visualHeight + offsetTop);
	if (inset <= 0) {
		return 0;
	}
	return Math.round(inset);
}

/** Whether a given keyboard inset (CSS px) is large enough to count as "open". */
export function isKeyboardOpen(
	inset: number,
	threshold: number = KEYBOARD_OPEN_THRESHOLD,
): boolean {
	return inset >= threshold;
}

/**
 * Read the live viewport metrics from `window`/`visualViewport`. Returns `null`
 * when neither is available (SSR / non-DOM test), so callers can skip wiring.
 */
export function readViewportMetrics(
	win: Window | undefined = typeof window !== 'undefined' ? window : undefined,
): ViewportMetrics | null {
	if (!win) {
		return null;
	}
	const vv = win.visualViewport;
	if (!vv) {
		return null;
	}
	return {
		layoutHeight: win.innerHeight,
		visualHeight: vv.height,
		offsetTop: vv.offsetTop,
	};
}

/** A rectangle's vertical extent in layout-viewport CSS pixels. */
export interface VerticalRect {
	/** Distance from the top of the layout viewport to the rect's top edge. */
	top: number;
	/** Distance from the top of the layout viewport to the rect's bottom edge. */
	bottom: number;
}

/**
 * Given the focused element's vertical rect (relative to the layout viewport),
 * the layout-viewport height, and the keyboard inset, compute how far the page
 * must scroll (delta in CSS px) to bring the rect fully inside the area NOT
 * covered by the keyboard. Positive = scroll down (content up); negative =
 * scroll up. `0` means already visible.
 *
 * @param margin - Extra breathing room (CSS px) to keep above the keyboard / below
 *                 the top edge so the field is not flush against the boundary.
 */
export function computeScrollDelta(
	rect: VerticalRect,
	layoutHeight: number,
	keyboardInset: number,
	margin: number = 16,
): number {
	const visibleBottom = layoutHeight - keyboardInset;
	// Field hidden behind the keyboard: scroll content up so its bottom (plus a
	// margin) sits at the top of the keyboard.
	if (rect.bottom > visibleBottom - margin) {
		return rect.bottom - (visibleBottom - margin);
	}
	// Field scrolled above the top edge: scroll content down to reveal it.
	if (rect.top < margin) {
		return rect.top - margin;
	}
	return 0;
}
