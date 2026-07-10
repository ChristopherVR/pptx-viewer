import type { CSSProperties } from 'pptx-viewer-shared';

/**
 * `apply-animation-styles`: imperatively push the current build styles onto the
 * live presentation stage. The Svelte analogue of the Vue presentation mode's
 * `applyAnimationStyles`: for every `[data-element-id]` node under `root`, clear
 * any previously-applied animation/opacity, then apply the element's resolved
 * revealed style (or its pending hidden style) if it has one.
 *
 * Kept DOM-only and framework-free (the reactive step + shared preset->CSS
 * maths live in `AnimationPlayback` / `pptx-viewer-shared`) so the reactive
 * wiring can call it from an effect and it stays trivially testable.
 */

/**
 * The inline properties this helper owns. Only these are cleared/re-applied, so
 * the element's own positioning (`left`/`top`) and geometry stay untouched. The
 * shared resolver emits `animation-*` longhands plus (for pending entrances) an
 * `opacity`; the shorthand `animation` is cleared too for safety.
 */
const MANAGED_PROPERTIES = [
	'animation',
	'animation-name',
	'animation-duration',
	'animation-delay',
	'animation-timing-function',
	'animation-fill-mode',
	'animation-iteration-count',
	'animation-direction',
	'opacity',
] as const;

/** Clear the managed inline properties, then apply `style` (if any). */
function applyOne(el: HTMLElement, style: CSSProperties | undefined): void {
	for (const property of MANAGED_PROPERTIES) {
		el.style.removeProperty(property);
	}
	if (!style) {
		return;
	}
	for (const [key, value] of Object.entries(style)) {
		el.style.setProperty(key, value);
	}
}

/**
 * Apply the revealed / pending build styles to every element under `root`.
 * `revealed` wins over `pending` for a given id (a revealed group's running
 * effect supersedes a not-yet-played entrance's hidden state).
 */
export function applyAnimationStyles(
	root: HTMLElement,
	revealed: Map<string, CSSProperties>,
	pending: Map<string, CSSProperties>,
): void {
	root.querySelectorAll<HTMLElement>('[data-element-id]').forEach((el) => {
		const id = el.dataset.elementId;
		if (!id) {
			return;
		}
		applyOne(el, revealed.get(id) ?? pending.get(id));
	});
}
