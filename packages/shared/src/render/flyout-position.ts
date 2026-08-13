/**
 * `flyout-position`: keeping a pointer-anchored overlay inside the window.
 *
 * A context menu opens at the pointer, which means it opens near an edge as
 * often as not. Clamping only the low edge (`Math.max(x, 8)`) looks like
 * clamping and is not: a right-click in the bottom third of the window puts the
 * menu's commands below the fold, where they are visible to a locator and
 * unclickable by a user. Svelte shipped exactly that, so its "Merge Selected
 * Cells" entry existed, resolved, and could never be pressed.
 *
 * Vanilla already had the correct two-sided version inline. This is that
 * function, lifted so a binding cannot ship half of it.
 *
 * @module render/flyout-position
 */

/** Where a flyout wants to sit, how big it is, and what it must fit inside. */
export interface FlyoutPositionInput {
	/** Anchor point, in viewport coordinates (a pointer event's clientX/Y). */
	x: number;
	y: number;
	/** Measured size of the flyout. Zero is treated as "not measured yet". */
	width: number;
	height: number;
	/** The box it must stay inside, normally the window's inner size. */
	viewportWidth: number;
	viewportHeight: number;
	/** Gap kept from every edge, in px. */
	margin?: number;
}

/** The clamped top-left corner, in viewport coordinates. */
export interface FlyoutPosition {
	left: number;
	top: number;
}

const DEFAULT_MARGIN = 8;

/**
 * The top-left corner a flyout should use so it stays fully on screen.
 *
 * Flips back inwards at the right and bottom edges rather than shifting the
 * anchor, which is what every desktop menu does, and never returns a negative
 * coordinate even when the flyout is larger than the viewport (a tall menu on a
 * short window should be reachable from the top, not cut off at both ends).
 */
export function clampFlyoutPosition(input: FlyoutPositionInput): FlyoutPosition {
	const margin = input.margin ?? DEFAULT_MARGIN;
	// An unmeasured flyout (first render, before layout) clamps on the anchor
	// alone; the caller re-runs this once the size is known.
	const maxLeft = input.viewportWidth - input.width - margin;
	const maxTop = input.viewportHeight - input.height - margin;
	return {
		left: Math.max(margin, input.width > 0 ? Math.min(input.x, maxLeft) : input.x),
		top: Math.max(margin, input.height > 0 ? Math.min(input.y, maxTop) : input.y),
	};
}
