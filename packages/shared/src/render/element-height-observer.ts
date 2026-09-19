/**
 * Live height of a DOM element, for layout that has to clear a strip whose
 * height is not a constant (the docked "Speaker notes" bar is a different
 * height in every binding and grows when its pane expands).
 *
 * Framework-neutral on purpose: every binding wraps this in its own reactive
 * primitive (a React state setter, a Vue ref, an Angular signal, a Svelte
 * rune, a plain callback in vanilla) instead of re-implementing the observer,
 * so the measurement rules cannot drift between them.
 */

/**
 * Report `el`'s rendered height in CSS px now and again on every resize.
 *
 * A `display: none` element reports `0`, which is exactly what a consumer
 * clearing the element wants (nothing to clear). Returns a disposer; it does
 * NOT report `0` on dispose, so a caller whose element is going away resets
 * its own state (it usually does that in the same cleanup).
 *
 * Falls back to a single initial measurement where `ResizeObserver` does not
 * exist (SSR, very old browsers, some test DOMs).
 */
export function observeElementHeight(el: Element, onHeight: (height: number) => void): () => void {
	onHeight(el.getBoundingClientRect().height);
	if (typeof ResizeObserver === 'undefined') {
		return () => undefined;
	}
	const observer = new ResizeObserver((entries) => {
		const entry = entries[entries.length - 1];
		if (entry) {
			// `borderBoxSize` when available: `contentRect` excludes padding and
			// border, and the strip's own border is part of what must be cleared.
			const box = entry.borderBoxSize?.[0]?.blockSize;
			onHeight(box ?? el.getBoundingClientRect().height);
		}
	});
	observer.observe(el);
	return () => observer.disconnect();
}
