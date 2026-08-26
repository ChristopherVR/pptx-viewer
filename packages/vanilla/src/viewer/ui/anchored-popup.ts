import { computeAnchoredPopupPosition } from 'pptx-viewer-shared';

/**
 * Pins a ribbon dropdown/swatch menu to its trigger with `position: fixed`,
 * so it escapes the ribbon content row's `overflow-x: auto` clip (the
 * horizontal scroll container otherwise crops any `position: absolute` popup
 * to the row's own height - issue #183). Mirrors React's `RibbonMenu`, the
 * Vue binding's `v-anchored-popup` directive, and the Svelte binding's
 * `anchoredPopup` action; the geometry itself comes from the shared,
 * framework-agnostic `computeAnchoredPopupPosition`.
 *
 * Unlike those three - whose popups are hover-shown and stay mounted the
 * whole time - `makeDropdown`/`makeSwatchPicker` menus are click-toggled and
 * only exist in the DOM meaningfully while open, so this attaches its
 * resize/scroll listeners on `open()` and removes them on `close()` rather
 * than for the menu's whole lifetime.
 */
export interface AnchoredPopupOptions {
	/** Align the popup's right edge to the anchor's right edge instead of left. */
	alignRight?: boolean;
}

export interface AnchoredPopupHandle {
	/** Recompute and re-apply the popup's fixed position right now. */
	update(): void;
	/** Stop tracking (removes the resize/scroll listeners); call on close. */
	destroy(): void;
}

/** Reproduces the 4px visual gap the old `top: calc(100% + 4px)` CSS gave these menus. */
const GAP_PX = 4;

/** Open-time wiring: position `menuEl` under `anchorEl` and keep it synced while open. */
export function attachAnchoredPopup(
	menuEl: HTMLElement,
	anchorEl: HTMLElement,
	options?: AnchoredPopupOptions,
): AnchoredPopupHandle {
	const update = (): void => {
		const { top, left, right } = computeAnchoredPopupPosition(anchorEl.getBoundingClientRect(), {
			alignRight: options?.alignRight,
		});
		menuEl.style.position = 'fixed';
		menuEl.style.margin = '0';
		menuEl.style.top = `${top + GAP_PX}px`;
		menuEl.style.left = left === null ? 'auto' : `${left}px`;
		menuEl.style.right = right === null ? 'auto' : `${right}px`;
	};

	update();
	window.addEventListener('resize', update);
	document.addEventListener('scroll', update, true);

	return {
		update,
		destroy(): void {
			window.removeEventListener('resize', update);
			document.removeEventListener('scroll', update, true);
		},
	};
}
