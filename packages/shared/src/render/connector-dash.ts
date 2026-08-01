/**
 * Dash patterns for connector lines.
 *
 * Split out of `connector-path.ts` alongside the arrow markers: a connector's
 * stroke decoration is a separate concern from where the line is routed, and
 * both are configured independently in the inspector.
 *
 * Pure and framework-agnostic.
 */

import { getSvgStrokeDasharray, normalizeStrokeDashType } from './element-style-transform';

/** A single custom-dash segment (percent-of-line-width, 1000ths of a percent). */
export interface DashSegment {
	dash: number;
	space: number;
}

/**
 * Return the SVG `stroke-dasharray` string for a given OOXML stroke dash preset
 * and width, or `undefined` for solid lines (no attribute needed).
 *
 * Produces a distinct pattern per preset (`dash`, `lgDash`, `dashDot`,
 * `sysDashDotDot`, etc.) rather than collapsing every non-dot preset to a single
 * `3w/w` approximation, and honours a `custDash` segment list (`a:custDash/a:ds`)
 * when supplied. This delegates to the same {@link getSvgStrokeDasharray} the
 * shape/border code uses, so connectors and shape outlines stay in lock-step.
 *
 * @param dash               Raw `a:ln/@prstDash` token (e.g. `"lgDashDot"`).
 * @param strokeWidth        Resolved stroke width in px.
 * @param customDashSegments Optional `custDash` segments; when present they take
 *                           precedence and are rendered as an explicit pattern.
 */
export function buildDashArray(
	dash: string | undefined,
	strokeWidth: number,
	customDashSegments?: ReadonlyArray<DashSegment>,
): string | undefined {
	const segments =
		customDashSegments && customDashSegments.length > 0
			? customDashSegments.map((seg) => ({ dash: seg.dash, space: seg.space }))
			: undefined;
	// A `custDash` implies the `custom` dash family even when no `@prstDash`
	// token was authored alongside it.
	const dashType = segments ? 'custom' : normalizeStrokeDashType(dash);
	return getSvgStrokeDasharray(dashType, strokeWidth, segments);
}
