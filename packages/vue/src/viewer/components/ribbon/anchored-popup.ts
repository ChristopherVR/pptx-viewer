import { computeAnchoredPopupPosition } from 'pptx-viewer-shared';
import type { Directive } from 'vue';

/**
 * `v-anchored-popup="{ anchor }"` - pins a ribbon dropdown/popover to its
 * trigger with `position: fixed`, so it escapes the ribbon content row's
 * `overflow-x: auto` clip (the horizontal scroll container otherwise crops
 * any `position: absolute` popup to the row's own height, or the popup's
 * layout pushes the row wide instead - issue #183). Mirrors React's
 * `RibbonMenu` and the Svelte binding's `anchoredPopup` action; the geometry
 * itself comes from the shared, framework-agnostic
 * `computeAnchoredPopupPosition`.
 *
 * Coordinates re-sync on mount/update, on the anchor's `mouseenter` (these
 * popovers are shown via CSS `:hover`, not a JS open flag), on any scroll
 * (capture phase, so ancestor scrolls count), and on window resize.
 */
export interface AnchoredPopupBinding {
	/** The trigger element the popup hangs below (its left/right/bottom edges are tracked). */
	anchor: HTMLElement | null | undefined;
	/** Align the popup's right edge to the anchor's right edge instead of left. */
	alignRight?: boolean;
}

interface AnchoredPopupInstance {
	cleanup: () => void;
}

const instances = new WeakMap<HTMLElement, AnchoredPopupInstance>();

function applyPosition(el: HTMLElement, binding: AnchoredPopupBinding): void {
	const anchor = binding.anchor;
	if (!anchor) {
		return;
	}
	const { top, left, right } = computeAnchoredPopupPosition(anchor.getBoundingClientRect(), {
		alignRight: binding.alignRight,
	});
	el.style.position = 'fixed';
	el.style.margin = '0';
	el.style.top = `${top}px`;
	el.style.left = left === null ? 'auto' : `${left}px`;
	el.style.right = right === null ? 'auto' : `${right}px`;
}

function bind(el: HTMLElement, binding: { value: AnchoredPopupBinding }): void {
	instances.get(el)?.cleanup();
	const update = (): void => applyPosition(el, binding.value);
	update();
	const anchor = binding.value.anchor;
	anchor?.addEventListener('mouseenter', update);
	window.addEventListener('resize', update);
	document.addEventListener('scroll', update, true);
	instances.set(el, {
		cleanup: () => {
			anchor?.removeEventListener('mouseenter', update);
			window.removeEventListener('resize', update);
			document.removeEventListener('scroll', update, true);
		},
	});
}

export const vAnchoredPopup: Directive<HTMLElement, AnchoredPopupBinding> = {
	mounted: bind,
	updated: bind,
	unmounted(el) {
		instances.get(el)?.cleanup();
		instances.delete(el);
	},
};
