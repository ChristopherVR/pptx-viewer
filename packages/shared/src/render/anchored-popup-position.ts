/**
 * Pure position math for a ribbon dropdown/popover pinned to its trigger with
 * CSS `position: fixed`.
 *
 * The ribbon content row is a horizontal scroll container
 * (`overflow-x: auto`), which clips any `position: absolute` popup to the
 * row's own box - the popup's dropdown/swatch grid gets cropped to the ribbon
 * row's height, or the row itself gains an unwanted scrollbar as the popup
 * pushes its layout wide (issue #183). `position: fixed`, computed from the
 * trigger's `getBoundingClientRect()`, escapes that clipping while the popup
 * stays a DOM descendant of its trigger (so outside-click `contains()` checks
 * and hover-based visibility keep working unchanged).
 *
 * This returns the pure geometry only; each binding is responsible for
 * re-invoking it on mount, on the trigger's hover/open, on any ancestor
 * scroll (capture phase), and on window resize, and for applying `top` /
 * `left` / `right` as inline styles on its own `position: fixed` popup node.
 * No gap to the anchor is baked in here - every binding already adds its own
 * few pixels of visual gap (padding-top / margin-top on the popup), and this
 * keeps that unchanged.
 */

/** The subset of `DOMRect` this needs, so callers can pass a real rect or a plain object (tests). */
export interface AnchorRect {
	readonly left: number;
	readonly right: number;
	readonly bottom: number;
}

export interface AnchoredPopupPosition {
	readonly top: number;
	/** Set when aligning from the left edge; `null` when aligning from the right instead. */
	readonly left: number | null;
	/** Set when aligning from the right edge; `null` when aligning from the left instead. */
	readonly right: number | null;
}

export interface AnchoredPopupPositionOptions {
	/** Align the popup's right edge to the anchor's right edge instead of its left. */
	alignRight?: boolean;
	/** The viewport width `right` is measured from; defaults to `window.innerWidth`. */
	viewportWidth?: number;
}

/** Compute where a `position: fixed` popup should sit relative to its anchor. */
export function computeAnchoredPopupPosition(
	anchorRect: AnchorRect,
	options?: AnchoredPopupPositionOptions,
): AnchoredPopupPosition {
	const top = anchorRect.bottom;
	if (options?.alignRight) {
		const viewportWidth =
			options.viewportWidth ?? (typeof window !== 'undefined' ? window.innerWidth : 0);
		return { top, left: null, right: viewportWidth - anchorRect.right };
	}
	return { top, left: anchorRect.left, right: null };
}
