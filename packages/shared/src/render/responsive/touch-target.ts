/**
 * touch-target.ts: minimum hit-area sizing for icon/text buttons inside dense
 * panels, shared by every binding.
 *
 * The chart data grid's add-row/add-series/remove-row/remove-series buttons,
 * the table data grid's row/column controls, and similar dense-panel icon
 * buttons were sized for a mouse (a handful of pixels of padding around an
 * 11-13px icon or label), which is comfortably clickable but far under the
 * ~44px touch target WCAG 2.5.5 / Apple HIG / Material guidance recommends,
 * and is the single most common finding when auditing these panels at
 * 360x640. This module is the one place that decision is made; bindings map
 * the returned pixel size onto their own button style (a min-width/min-height
 * utility class, an inline style, or a CSS custom property).
 *
 * @pure
 */
import { isDensePanelCompact } from './dense-panel-viewport';

/** WCAG 2.5.5 (AAA) / platform-HIG minimum touch target, in CSS pixels. */
export const MIN_TOUCH_TARGET_PX = 44;

/** The un-adjusted size dense-panel icon/text buttons use above the breakpoint. */
export const DEFAULT_DENSE_BUTTON_PX = 28;

/**
 * The minimum width/height (px) a dense-panel button's hit area must have at
 * this viewport width. Below `MOBILE_BREAKPOINT` every dense-panel control is
 * touch-reachable and must clear `MIN_TOUCH_TARGET_PX`; at or above it, the
 * existing compact mouse-sized button is left alone.
 */
export function getDensePanelTouchTargetPx(width: number): number {
	return isDensePanelCompact(width) ? MIN_TOUCH_TARGET_PX : DEFAULT_DENSE_BUTTON_PX;
}

/** Inline min-width/min-height pair a binding can spread onto a button's style. */
export interface TouchTargetBoxSize {
	minWidth: number;
	minHeight: number;
}

/** Convenience wrapper around {@link getDensePanelTouchTargetPx} for style objects. */
export function getDensePanelTouchTargetBox(width: number): TouchTargetBoxSize {
	const size = getDensePanelTouchTargetPx(width);
	return { minWidth: size, minHeight: size };
}
