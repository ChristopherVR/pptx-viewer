/**
 * `use:anchoredPopup` - pins a ribbon dropdown to its trigger with
 * `position: fixed`, so the popup escapes the ribbon content row's
 * `overflow-x: auto` clip (the horizontal scroll container would otherwise
 * crop any absolutely-positioned menu to the row's height). This mirrors
 * React's `RibbonMenu`, which renders its menus fixed for the same reason.
 *
 * Pass the trigger/anchor element; coordinates re-sync on mount, on any scroll
 * (capture phase, so ancestor scrolls count), and on window resize.
 */
export interface AnchoredPopupOptions {
	/** The element the popup hangs below (its left/bottom edges are tracked). */
	anchor: HTMLElement | undefined;
	/** Align the popup's right edge to the anchor's right edge instead of left. */
	alignRight?: boolean;
}

export function anchoredPopup(node: HTMLElement, options: AnchoredPopupOptions) {
	let current = options;

	function update(): void {
		const anchor = current.anchor;
		if (!anchor) {
			return;
		}
		const rect = anchor.getBoundingClientRect();
		node.style.position = 'fixed';
		node.style.margin = '0';
		node.style.top = `${rect.bottom + 4}px`;
		if (current.alignRight) {
			node.style.left = 'auto';
			node.style.right = `${window.innerWidth - rect.right}px`;
		} else {
			node.style.right = 'auto';
			node.style.left = `${rect.left}px`;
		}
	}

	update();
	const onScroll = (): void => update();
	window.addEventListener('resize', onScroll);
	document.addEventListener('scroll', onScroll, true);

	return {
		update(next: AnchoredPopupOptions): void {
			current = next;
			update();
		},
		destroy(): void {
			window.removeEventListener('resize', onScroll);
			document.removeEventListener('scroll', onScroll, true);
		},
	};
}
