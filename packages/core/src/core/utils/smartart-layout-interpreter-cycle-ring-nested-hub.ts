/**
 * SmartArt DiagramML interpreter - the `n===1` nested hub+one-satellite ring
 * case (round 46).
 *
 * Split out of `smartart-layout-interpreter-cycle-ring.ts` to keep that file
 * under the repo's per-file line budget. Pure geometry; no framework code.
 */

import type { CycleRingLayout, HubRingGeometry } from './smartart-layout-interpreter-cycle-ring';
import type { BoundingBox } from './smartart-layout-types';

const DEG_TO_RAD = Math.PI / 180;

/**
 * A genuinely nested hub+one-satellite ring whose node width is ALREADY
 * known (`radial-cluster--hier5.pptx`'s `cycle_3`, both "Four" (hub) and
 * "Five" (satellite) independently sized off the same diagram-wide `userS`
 * fact - see `arrangeCycle`'s own `knownNodeWidthPx` doc comment). Unlike
 * the plain `n===1` degenerate case (no hub, stretches to fill the box),
 * this places the hub at the box centre and the one satellite at `r0` (hub
 * half-extent + `hubGeometry.gapRatio` + item half-extent, in node-width
 * units - the SAME formula the non-degenerate hub+ring path uses) along
 * `stAngDeg`, both sized at the known width.
 */
export function nestedHubSatelliteRingLayout(
	stAngDeg: number,
	heightOverWidth: number,
	box: BoundingBox,
	hubGeometry: HubRingGeometry,
	nodeWidthPx: number,
): CycleRingLayout {
	const boxCentre = { x: box.width / 2, y: box.height / 2 };
	const halfH = Math.max(0.01, heightOverWidth) / 2;
	const hubHalfWidthNat = 0.5 / Math.max(1e-6, hubGeometry.factor);
	const r0Nat = hubHalfWidthNat + Math.max(0, hubGeometry.gapRatio) + 0.5;
	const angleRad = (stAngDeg - 90) * DEG_TO_RAD;
	const r0Px = r0Nat * nodeWidthPx;
	const satellite = {
		x: boxCentre.x + r0Px * Math.cos(angleRad),
		y: boxCentre.y + r0Px * Math.sin(angleRad),
	};
	return {
		centers: [satellite],
		nodeWidth: nodeWidthPx,
		nodeHeight: nodeWidthPx * Math.max(0.01, heightOverWidth),
		hubCenter: boxCentre,
		hubHalfWidth: hubHalfWidthNat * nodeWidthPx,
		hubHalfHeight: hubHalfWidthNat * (halfH / 0.5) * nodeWidthPx,
	};
}
