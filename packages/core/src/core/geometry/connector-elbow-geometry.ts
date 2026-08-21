/**
 * Orientation-aware bend geometry for multi-segment elbow connectors
 * (`bentConnector3/4/5`, `curvedConnector3/4/5`), factored out of
 * `connector-geometry.ts` to keep that file under the repo's file-size
 * convention.
 *
 * `getConnectorPathGeometry` used to bend every `bentConnector3/4/5` /
 * `curvedConnector3/4/5` around a fixed axis: the first adjustment
 * (`adj1`) always positioned a point along `width`, the second (`adj2`)
 * always along `height`, regardless of whether the connector's own box was
 * wide (connecting shapes that sit side by side) or tall (connecting shapes
 * stacked one above the other). A connector between vertically-stacked
 * shapes therefore rendered as if it still exited sideways.
 *
 * This mirrors `packages/shared/src/render/connector-elbow-geometry.ts`
 * (the same fix, ported into the same shared package's own version of this
 * function): the "primary" bend axis is chosen from whichever of `width` /
 * `height` is larger (ties favour horizontal, matching the historical
 * pre-fix behaviour), and the OOXML preset formula is expressed generically
 * against a `(primary, secondary)` coordinate pair, then mapped onto
 * `(x, y)` depending on which axis won. Core cannot import from
 * `pptx-viewer-shared` (the dependency only goes the other way), so this is
 * a deliberate, faithful re-implementation against core's own coordinate
 * model rather than a shared import: core already expresses each segment
 * count (`3`/`4`/`5`) as its own branch reading `adj1`/`adj2`/`adj3`
 * independently, so only the axis choice needed adding here.
 *
 * No framework imports.
 */

/** Segment counts implied by the `bentConnector*` / `curvedConnector*` preset names. */
export type ElbowSegments = 3 | 4 | 5;

/** One `(x, y)` waypoint. */
export type ElbowPoint = readonly [number, number];

/** One cubic-Bezier segment: a single control point (used twice) and an end point. */
export interface ElbowCurveSegment {
	control: ElbowPoint;
	end: ElbowPoint;
}

interface OrientedAxes {
	/** Maps a `(primary, secondary)` pair onto `(x, y)`. */
	toXY: (primary: number, secondary: number) => ElbowPoint;
	primarySize: number;
	secondarySize: number;
	/** The endpoint's coordinate along the primary axis (flip-aware: `startX`/`startY` etc). */
	primaryEnd: number;
	secondaryStart: number;
	secondaryEnd: number;
}

/**
 * True when the primary bend axis should run along x, i.e. the connector's
 * own box is wider than it is tall. There is no explicit connection-site
 * "side" (top/bottom/left/right) available at this layer, so box dominance
 * is the tractable proxy: shapes mostly side by side get a vertical-mid-line
 * route (H-V-H), shapes mostly stacked get a horizontal-mid-line route
 * (V-H-V). Ties favour horizontal, matching the historical (pre-fix)
 * behaviour, so every existing horizontal-dominant test keeps its exact
 * output.
 */
export function isHorizontalPrimaryAxis(width: number, height: number): boolean {
	return width >= height;
}

function orientAxes(
	startX: number,
	startY: number,
	endX: number,
	endY: number,
	width: number,
	height: number,
): OrientedAxes {
	const horizontalPrimary = isHorizontalPrimaryAxis(width, height);
	return {
		toXY: (primary, secondary) => (horizontalPrimary ? [primary, secondary] : [secondary, primary]),
		primarySize: horizontalPrimary ? width : height,
		secondarySize: horizontalPrimary ? height : width,
		primaryEnd: horizontalPrimary ? endX : endY,
		secondaryStart: horizontalPrimary ? startY : startX,
		secondaryEnd: horizontalPrimary ? endY : endX,
	};
}

/**
 * Compute the bend waypoints (including the two endpoints) for a
 * `segments`-segment orthogonal elbow between `(startX,startY)` and
 * `(endX,endY)`, honouring `adj1`/`adj2`/`adj3` fractions (already
 * normalised to 0..1 by `getConnectorAdjustment`).
 *
 * Segment counts mirror the OOXML presets:
 * - `3` (`bentConnector3`, Z-shape): one bend line, positioned by `adj1`.
 * - `4` (`bentConnector4`): a staircase through `adj1` (primary axis) and
 *   `adj2` (secondary axis).
 * - `5` (`bentConnector5`): a staircase with two primary-axis bend lines
 *   (`adj1`, `adj3`) joined by one secondary-axis crossing (`adj2`).
 */
export function elbowWaypoints(
	startX: number,
	startY: number,
	endX: number,
	endY: number,
	width: number,
	height: number,
	segments: ElbowSegments,
	adj1: number,
	adj2: number,
	adj3: number,
): ElbowPoint[] {
	const axes = orientAxes(startX, startY, endX, endY, width, height);
	const { toXY, primarySize, secondarySize, secondaryStart, secondaryEnd, primaryEnd } = axes;
	const mid1 = primarySize * adj1;

	if (segments === 3) {
		return [[startX, startY], toXY(mid1, secondaryStart), toXY(mid1, secondaryEnd), [endX, endY]];
	}

	const secMid = secondarySize * adj2;
	if (segments === 4) {
		return [
			[startX, startY],
			toXY(mid1, secondaryStart),
			toXY(mid1, secMid),
			toXY(primaryEnd, secMid),
			[endX, endY],
		];
	}

	const mid2 = primarySize * adj3;
	return [
		[startX, startY],
		toXY(mid1, secondaryStart),
		toXY(mid1, secMid),
		toXY(mid2, secMid),
		toXY(mid2, secondaryEnd),
		[endX, endY],
	];
}

/**
 * Compute the cubic-Bezier segments (control point used twice, plus an end
 * point) for a `segments`-segment smooth elbow, mirroring
 * {@link elbowWaypoints}'s orientation and adjustment handling. `segments`
 * yields `segments - 1` curve segments.
 */
export function elbowCurveSegments(
	startX: number,
	startY: number,
	endX: number,
	endY: number,
	width: number,
	height: number,
	segments: ElbowSegments,
	adj1: number,
	adj2: number,
	adj3: number,
): ElbowCurveSegment[] {
	const axes = orientAxes(startX, startY, endX, endY, width, height);
	const { toXY, primarySize, secondarySize, secondaryStart, secondaryEnd, primaryEnd } = axes;
	const mid1 = primarySize * adj1;

	if (segments === 3) {
		const secMid = (secondaryStart + secondaryEnd) / 2;
		return [
			{ control: toXY(mid1, secondaryStart), end: toXY(mid1, secMid) },
			{ control: toXY(mid1, secondaryEnd), end: toXY(primaryEnd, secondaryEnd) },
		];
	}

	const secMid = secondarySize * adj2;
	const quarterSec = secondaryStart + (secMid - secondaryStart) * 0.5;

	if (segments === 4) {
		const midPrimaryBetween = (mid1 + primaryEnd) / 2;
		return [
			{ control: toXY(mid1, secondaryStart), end: toXY(mid1, quarterSec) },
			{ control: toXY(mid1, secMid), end: toXY(midPrimaryBetween, secMid) },
			{ control: toXY(primaryEnd, secMid), end: toXY(primaryEnd, secondaryEnd) },
		];
	}

	const mid2 = primarySize * adj3;
	const midPrimaryBetween = (mid1 + mid2) / 2;
	const threeQuarterSec = secMid + (secondaryEnd - secMid) * 0.5;
	return [
		{ control: toXY(mid1, secondaryStart), end: toXY(mid1, quarterSec) },
		{ control: toXY(mid1, secMid), end: toXY(midPrimaryBetween, secMid) },
		{ control: toXY(mid2, secMid), end: toXY(mid2, threeQuarterSec) },
		{ control: toXY(mid2, secondaryEnd), end: toXY(primaryEnd, secondaryEnd) },
	];
}
