import type { ElementAnimationState } from 'pptx-viewer-shared';

/**
 * `apply-animation-styles`: imperatively push each element's native-animation
 * state onto the live presentation stage. The Svelte analogue of the Vue
 * presentation mode's `applyAnimationStyles` (in `PresentationMode.vue`): for
 * every `[data-element-id]` node under `root`, apply its resolved visibility
 * (entrance hide-until-revealed / exit), the CSS-animation shorthand (entrance /
 * emphasis / exit / `p:animClr` colour keyframes), and a pointer cursor on
 * interactive / hover trigger shapes.
 *
 * Structural reveals (chart / SmartArt staged build, `p:animClr` fill / stroke
 * relinquish) are applied declaratively by the renderers themselves, which read
 * the same {@link ElementAnimationState} map via the element-states context.
 *
 * Kept DOM-only and framework-free (the reactive state map + shared native
 * timeline maths live in `AnimationPlayback` / `pptx-viewer-shared`) so the
 * reactive wiring can call it from an effect and it stays trivially testable.
 */

const EMPTY_IDS: ReadonlySet<string> = new Set();

/**
 * Apply the tracked element states to every `[data-element-id]` node under
 * `root`. Elements without a state get their managed properties cleared, so a
 * previously-hidden entrance becomes visible once its state is dropped (e.g. on
 * slide change / reset).
 */
export function applyAnimationStyles(
	root: HTMLElement,
	states: Map<string, ElementAnimationState>,
	interactiveIds: ReadonlySet<string> = EMPTY_IDS,
	hoverIds: ReadonlySet<string> = EMPTY_IDS,
): void {
	root.querySelectorAll<HTMLElement>('[data-element-id]').forEach((el) => {
		const id = el.dataset.elementId;
		if (!id) {
			return;
		}
		const state = states.get(id);
		el.style.animation = state?.cssAnimation ?? '';
		el.style.visibility = state?.visible === false ? 'hidden' : '';
		el.style.cursor = interactiveIds.has(id) || hoverIds.has(id) ? 'pointer' : '';
	});

	// Staged text builds render one span per paragraph / word / letter, keyed
	// `data-anim-id` (`<elementId>::c0-3`) rather than `data-element-id`. They
	// need the same per-frame patch or the pieces stay at whatever state they
	// were first rendered with and the build never visibly runs.
	root.querySelectorAll<HTMLElement>('[data-anim-id]').forEach((el) => {
		const id = el.dataset.animId;
		if (!id) {
			return;
		}
		const state = states.get(id);
		el.style.animation = state?.cssAnimation ?? '';
		el.style.visibility = state?.visible === false ? 'hidden' : '';
	});
}
