/**
 * Orientation-aware bend geometry for multi-segment elbow connectors
 * (`bentConnector3/4/5`, `curvedConnector3/4/5`).
 *
 * PowerPoint's elbow connectors do NOT avoid obstacles (obstacle-avoiding A*
 * routing lives in `connector-router.ts` and is applied separately by
 * `connector-path.ts`, only when a binding supplies an obstacle list; that is
 * out of scope here). What they DO is pick the bend axis from the actual
 * relative position of the two connection points: a connector between shapes
 * that sit roughly side-by-side bends around a vertical mid-line (an
 * "H-V-H" Z-shape), while one between vertically-stacked shapes bends around
 * a horizontal mid-line (a "V-H-V" S-shape). The ECMA-376 `bentConnector3/4/5`
 * / `curvedConnector3/4/5` preset-geometry formulas are always expressed
 * against the connector's own local box (an `adj1` fraction of `w`, etc), so
 * the same numeric formula is reused here for both orientations; only which
 * axis plays the "primary" (adjustment-driven) role changes. This mirrors the
 * segment-count differentiation `packages/core/src/core/geometry/connector-geometry.ts`
 * already applies (2/3/4/5-segment paths from `adj1`/`adj2`/`adj3`), extended
 * with the orientation choice so a connector between stacked shapes no longer
 * renders the exact same "always exits sideways" shape as one between shapes
 * side by side.
 *
 * No framework imports.
 */

import type { PptxElement } from 'pptx-viewer-core';

import type { RouterPoint } from './connector-router-types';

/** Segment counts implied by the `bentConnector*` / `curvedConnector*` preset names. */
export type ElbowSegments = 3 | 4 | 5;

/**
 * Normalise one of a connector's OOXML adjustment values (`adj1`/`adj2`/`adj3`,
 * falling back to the generic `adj`) to a 0..1 fraction that positions an
 * elbow bend line or curve control point. OOXML stores these in 1000ths of a
 * percent (0..100000); values already in 0..1 are passed through. Defaults to
 * `fallback` (the spec midpoint, `0.5`) when no usable adjustment is present,
 * so an explicitly authored `adj1`/`adj2`/`adj3` always wins over the
 * auto-computed default.
 */
export function connectorAdjustmentFraction(
	element: PptxElement,
	key: string,
	fallback = 0.5,
): number {
	const adj = (element as { shapeAdjustments?: Record<string, number> }).shapeAdjustments;
	const raw = adj?.[key] ?? adj?.adj;
	if (typeof raw !== 'number' || !Number.isFinite(raw)) {
		return fallback;
	}
	const fraction = Math.abs(raw) > 1 ? raw / 100000 : raw;
	return Math.min(1, Math.max(0, fraction));
}

/**
 * Normalise a connector's first adjustment value (`adj1`/`adj`) to a 0..1
 * fraction. Kept as a named entry point for `adj1` specifically (the only
 * adjustment a `bentConnector3`/`curvedConnector3` elbow uses); see
 * {@link connectorAdjustmentFraction} for `adj2`/`adj3`.
 */
export function connectorBendFraction(element: PptxElement): number {
	return connectorAdjustmentFraction(element, 'adj1', 0.5);
}

/**
 * Segment count implied by a lower-cased `bentConnector*` / `curvedConnector*`
 * shape type (`bentConnector2`/`curvedConnector2` are handled by their own
 * fixed-shape branch in `connector-path.ts` before this is consulted).
 * Unknown/missing suffixes fall back to `3` (the Z-shape), matching the
 * historical behaviour for a bare `"bentConnector"` / `"curvedConnector"`.
 */
export function elbowSegmentCount(lowerShapeType: string): ElbowSegments {
	if (lowerShapeType.includes('connector4')) {
		return 4;
	}
	if (lowerShapeType.includes('connector5')) {
		return 5;
	}
	return 3;
}

/**
 * True when the primary bend axis should run along x, i.e. the two endpoints
 * differ more in x than in y. There is no explicit connection-site "side"
 * (top/bottom/left/right) available at this layer (see `connector-path.ts`
 * module docs), so the dominant axis of the resolved endpoints is the
 * tractable, well-behaved proxy: shapes mostly side by side get a
 * vertical-mid-line route, shapes mostly stacked get a horizontal-mid-line
 * route. Ties favour horizontal, matching the historical (pre-fix) behaviour.
 */
export function isHorizontalPrimary(x1: number, y1: number, x2: number, y2: number): boolean {
	return Math.abs(x2 - x1) >= Math.abs(y2 - y1);
}

/** `(u, v)` -> `(x, y)`, transposed when the secondary axis is horizontal. */
function axisMapper(horizontalPrimary: boolean): (u: number, v: number) => RouterPoint {
	return (u, v) => (horizontalPrimary ? { x: u, y: v } : { x: v, y: u });
}

/**
 * Compute the bend waypoints (including the two endpoints) for a
 * `segments`-segment orthogonal elbow between `(x1,y1)` and `(x2,y2)`,
 * honouring `adj1`/`adj2`/`adj3` fractions (already normalised to 0..1 by
 * `connectorAdjustmentFraction`; explicit authored values win, 0.5 is the
 * spec default when absent).
 *
 * Segment counts mirror the OOXML presets:
 * - `3` (`bentConnector3`, Z-shape): one bend line, positioned by `adj1`.
 * - `4` (`bentConnector4`): a staircase through `adj1` (primary axis) and
 *   `adj2` (secondary axis).
 * - `5` (`bentConnector5`): a staircase with two primary-axis bend lines
 *   (`adj1`, `adj3`) joined by one secondary-axis crossing (`adj2`).
 */
export function elbowWaypoints(
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	segments: ElbowSegments,
	adj1: number,
	adj2: number,
	adj3: number,
): RouterPoint[] {
	const horizontalPrimary = isHorizontalPrimary(x1, y1, x2, y2);
	const u1 = horizontalPrimary ? x1 : y1;
	const v1 = horizontalPrimary ? y1 : x1;
	const u2 = horizontalPrimary ? x2 : y2;
	const v2 = horizontalPrimary ? y2 : x2;
	const toXY = axisMapper(horizontalPrimary);

	if (segments === 3) {
		const mu = u1 + (u2 - u1) * adj1;
		return [toXY(u1, v1), toXY(mu, v1), toXY(mu, v2), toXY(u2, v2)];
	}
	if (segments === 4) {
		const mu = u1 + (u2 - u1) * adj1;
		const mv = v1 + (v2 - v1) * adj2;
		return [toXY(u1, v1), toXY(mu, v1), toXY(mu, mv), toXY(u2, mv), toXY(u2, v2)];
	}
	const mu1 = u1 + (u2 - u1) * adj1;
	const mv = v1 + (v2 - v1) * adj2;
	const mu2 = u1 + (u2 - u1) * adj3;
	return [toXY(u1, v1), toXY(mu1, v1), toXY(mu1, mv), toXY(mu2, mv), toXY(mu2, v2), toXY(u2, v2)];
}

/** Format one `RouterPoint` as `"x,y"` for inline use in an SVG path `d`. */
function fmt(p: RouterPoint): string {
	return `${p.x},${p.y}`;
}

/** One cubic-Bezier path segment whose control points collapse onto `ctrl`. */
function curveTo(ctrl: RouterPoint, end: RouterPoint): string {
	return `C${fmt(ctrl)} ${fmt(ctrl)} ${fmt(end)}`;
}

/**
 * Render the same `segments`-segment elbow as a smooth path: cubic Beziers
 * whose control points sit on the elbow's own corners, so curved connectors
 * get the same orientation-aware, segment-count-aware routing as
 * {@link elbowWaypoints} while never producing a sharp corner.
 *
 * `segments === 3` emits a single cubic Bezier through the two corner points
 * (already smooth on its own, no interior breakpoint needed). `4` and `5`
 * each insert one extra breakpoint per interior corner (halfway along the
 * secondary axis) so the curve visibly bends near the corner instead of
 * overshooting it, mirroring the multi-segment cubic construction
 * `packages/core/src/core/geometry/connector-geometry.ts` uses for
 * `curvedConnector4`/`curvedConnector5`.
 */
export function curvedElbowPathD(
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	segments: ElbowSegments,
	adj1: number,
	adj2: number,
	adj3: number,
): string {
	const horizontalPrimary = isHorizontalPrimary(x1, y1, x2, y2);
	const u1 = horizontalPrimary ? x1 : y1;
	const v1 = horizontalPrimary ? y1 : x1;
	const u2 = horizontalPrimary ? x2 : y2;
	const v2 = horizontalPrimary ? y2 : x2;
	const toXY = axisMapper(horizontalPrimary);
	const start = toXY(u1, v1);

	if (segments === 3) {
		const mu = u1 + (u2 - u1) * adj1;
		return `M${fmt(start)} C${fmt(toXY(mu, v1))} ${fmt(toXY(mu, v2))} ${fmt(toXY(u2, v2))}`;
	}

	if (segments === 4) {
		const mu = u1 + (u2 - u1) * adj1;
		const mv = v1 + (v2 - v1) * adj2;
		const vq = v1 + (mv - v1) * 0.5;
		const midU = (mu + u2) / 2;
		return [
			`M${fmt(start)}`,
			curveTo(toXY(mu, v1), toXY(mu, vq)),
			curveTo(toXY(mu, mv), toXY(midU, mv)),
			curveTo(toXY(u2, mv), toXY(u2, v2)),
		].join(' ');
	}

	const mu1 = u1 + (u2 - u1) * adj1;
	const mv = v1 + (v2 - v1) * adj2;
	const mu2 = u1 + (u2 - u1) * adj3;
	const vq1 = v1 + (mv - v1) * 0.5;
	const vq2 = mv + (v2 - mv) * 0.5;
	const midU = (mu1 + mu2) / 2;
	return [
		`M${fmt(start)}`,
		curveTo(toXY(mu1, v1), toXY(mu1, vq1)),
		curveTo(toXY(mu1, mv), toXY(midU, mv)),
		curveTo(toXY(mu2, mv), toXY(mu2, vq2)),
		curveTo(toXY(mu2, v2), toXY(u2, v2)),
	].join(' ');
}
