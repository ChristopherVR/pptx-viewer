import { ANIMATION_KEYFRAMES_CSS, SLIDE_TRANSITION_KEYFRAMES_CSS } from 'pptx-viewer-shared';
import type { CSSProperties } from 'pptx-viewer-shared';

/** `<style>` id for the once-per-document presentation keyframe block. */
const KEYFRAMES_ELEMENT_ID = 'pptx-vanilla-presentation-keyframes';

/**
 * Inject the entrance-animation and slide-transition `@keyframes` blocks into a
 * document's `<head>` exactly once. Both binding-agnostic keyframe sets live in
 * `pptx-viewer-shared`; presentation-mode element styles / transition overlays
 * reference them by name. Idempotent per document.
 */
export function ensurePresentationKeyframes(doc: Document): void {
	if (doc.getElementById(KEYFRAMES_ELEMENT_ID)) {
		return;
	}
	const style = doc.createElement('style');
	style.id = KEYFRAMES_ELEMENT_ID;
	style.textContent = `${ANIMATION_KEYFRAMES_CSS}\n${SLIDE_TRANSITION_KEYFRAMES_CSS}`;
	(doc.head ?? doc.documentElement).appendChild(style);
}

/**
 * Apply the resolved per-element animation styles to every animated element
 * under `root`, keyed by `data-element-id`. Elements in a revealed click group
 * get their running animation CSS; elements with a pending (not-yet-revealed)
 * entrance get their hidden style; everything else is reset to its natural
 * (fully visible) state.
 *
 * This mirrors the Vue `applyAnimationStyles` driver but writes through
 * `style.setProperty` (the shared style maps use kebab-case property names).
 */
export function applyAnimationStyles(
	root: HTMLElement,
	revealed: Map<string, CSSProperties>,
	pending: Map<string, CSSProperties>,
): void {
	const nodes = root.querySelectorAll<HTMLElement>('[data-element-id]');
	nodes.forEach((el) => {
		const id = el.dataset.elementId;
		if (!id) {
			return;
		}
		// Reset any styles a previous step wrote; `animation` (shorthand) clears
		// every animation longhand at once.
		el.style.animation = '';
		el.style.opacity = '';
		const active = revealed.get(id) ?? pending.get(id);
		if (active) {
			for (const [property, value] of Object.entries(active)) {
				el.style.setProperty(property, value);
			}
		}
	});
}
