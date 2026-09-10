/**
 * SmartArt DiagramML interpreter - cycle ring geometry (fixed-point solve).
 *
 * Split out of `smartart-layout-interpreter-cycle.ts` to keep that file under
 * the repo's per-file line budget. See that module's doc comment for the full
 * COM-verified derivation of the "natural circle, then isotropic CONTAIN fit,
 * centred" model (round 11/SESSION 8: live PowerPoint COM proved cached
 * SmartArt geometry is placed at its OWN constraint-derived size, centred in
 * the frame when smaller than it, never independently stretched per axis -
 * see ECMA-376 21.4.7; a prior "anisotropic fill-to-box" model in this file
 * was measured against a reader bug that has since been fixed and reproduced
 * NO real PowerPoint output, see the parent module's own doc comment for the
 * full correction history); this file is purely the numeric machinery (no
 * constraint reading).
 *
 * Pure geometry; no framework code.
 */

import { resolveRingAxisOffset } from './smartart-layout-interpreter-cycle-ring-offset';
import type { BoundingBox } from './smartart-layout-types';

const DEG_TO_RAD = Math.PI / 180;

/** One natural-space (pre box-fit) point on the ring. */
interface NaturalPoint {
	x: number;
	y: number;
}

/** Result of fitting `n` ring nodes (plus an optional centred hub) to `box`. */
export interface CycleRingLayout {
	/** Node CENTRE points, in box-local pixel coordinates (0..box.width / 0..box.height). */
	centers: NaturalPoint[];
	/** Uniform node width/height across the whole ring, in pixels. */
	nodeWidth: number;
	nodeHeight: number;
	/** The ring's own natural centre, mapped into box-local pixel coordinates - the best available centre for a `ctrShpMap="fNode"` hub. */
	hubCenter: NaturalPoint;
	/** Hub half-extents (pixels) that keep it clear of the nearest ring node - see the module doc comment's `naturalHubRadius` note. */
	hubHalfWidth: number;
	hubHalfHeight: number;
}

/** Degenerate cases (`n<=0`/`n===1`) shared by both the ratio and absolute-gap paths. */
function degenerateRingLayout(
	n: number,
	heightOverWidth: number,
	box: BoundingBox,
): CycleRingLayout | undefined {
	const boxCentre = { x: box.width / 2, y: box.height / 2 };
	if (n <= 0) {
		return {
			centers: [],
			nodeWidth: 0,
			nodeHeight: 0,
			hubCenter: boxCentre,
			hubHalfWidth: 0,
			hubHalfHeight: 0,
		};
	}
	if (n === 1) {
		// No adjacent sibling to size against: the single ring node simply
		// fills the box at its own declared aspect (matching a plain lone item).
		const w0 = box.width;
		const h0 = Math.min(box.height, box.width * Math.max(0.01, heightOverWidth));
		return {
			centers: [boxCentre],
			nodeWidth: w0,
			nodeHeight: h0,
			hubCenter: boxCentre,
			hubHalfWidth: 0,
			hubHalfHeight: 0,
		};
	}
	return undefined;
}

/**
 * A hub+ring composite's own centre-to-satellite sizing (see
 * `smartart-layout-interpreter-cycle-hub-ratio.ts`'s `resolveHubToNodeRatio`/
 * `resolveHubGapRatio`): `factor` is the ring item's width as a fraction of
 * the hub's own (so the hub's natural half-width is `0.5 / factor`), and
 * `gapRatio` is the declared `sp` space between the hub's edge and each
 * satellite's edge, both already converted to this module's own natural
 * unit space (ring item width = 1).
 */
export interface HubRingGeometry {
	factor: number;
	gapRatio: number;
}

/** Ring geometry for a already-resolved, dimensionless `gapFactor` (a fraction of the node's own width). */
function ringLayoutForGapFactor(
	n: number,
	stAngDeg: number,
	spanDeg: number,
	gapFactor: number,
	heightOverWidth: number,
	box: BoundingBox,
	hubGeometry?: HubRingGeometry,
	sibTransBulgeRatio?: number,
): CycleRingLayout {
	const degenerate = degenerateRingLayout(n, heightOverWidth, box);
	if (degenerate) {
		return degenerate;
	}
	const full = Math.abs(spanDeg) >= 360;
	const step = full ? spanDeg / n : spanDeg / (n - 1);
	const halfStepRad = (Math.abs(step) * DEG_TO_RAD) / 2;
	const clampedGap = Math.max(0, gapFactor);
	const sinHalf = Math.sin(halfStepRad);
	// Chord between adjacent ring indices = (1 + gapFactor) node-widths (unit
	// width 1 in this natural space) -> solve the ring radius R0.
	let r0 = sinHalf > 1e-6 ? (1 + clampedGap) / (2 * sinHalf) : 0;
	if (hubGeometry) {
		// A hub+ring composite's own `r0` (hub centre to satellite centre) is
		// governed by the hub-to-satellite gap (`sp`), not by how close
		// adjacent satellites sit to EACH OTHER (`sibSp`, the chord-based `r0`
		// above) - COM-verified against `basic-radial--hier5.pptx` (see
		// `resolveHubGapRatio`'s own doc comment for the exact derivation).
		// `sibSp` still applies as a genuine MINIMUM (MS's own "Cycle
		// Algorithm" reference): take whichever `r0` is LARGER, never smaller
		// than the adjacent-satellite chord distance already solved above.
		const hubHalfWidth = 0.5 / Math.max(1e-6, hubGeometry.factor);
		const r0Hub = hubHalfWidth + hubGeometry.gapRatio + 0.5;
		r0 = Math.max(r0, r0Hub);
	}

	const natural: NaturalPoint[] = Array.from({ length: n }, (_, i) => {
		const angleRad = (stAngDeg + i * step - 90) * DEG_TO_RAD;
		return { x: r0 * Math.cos(angleRad), y: r0 * Math.sin(angleRad) };
	});

	const halfW = 0.5;
	const halfH = Math.max(0.01, heightOverWidth) / 2;
	const xs = natural.map((p) => p.x);
	const ys = natural.map((p) => p.y);
	// A `sibTrans` curve connector (see `smartart-layout-interpreter-cycle-
	// sibtrans.ts`'s own module doc comment) bulges past the chord between
	// two adjacent satellite centres by up to its own declared "height", in
	// EITHER direction depending on where each pair of satellites sits
	// relative to the ring's own centre - applied here as a uniform
	// isotropic expansion of the satellites' own bounding extremes on all 4
	// sides, the simplest model that does not need each connector pair's own
	// exact bulge direction resolved individually.
	const bulge = Math.max(0, sibTransBulgeRatio ?? 0);
	const minX = Math.min(...xs) - halfW - bulge;
	const maxX = Math.max(...xs) + halfW + bulge;
	const minY = Math.min(...ys) - halfH - bulge;
	const maxY = Math.max(...ys) + halfH + bulge;
	const naturalBoundW = Math.max(1e-6, maxX - minX);
	const naturalBoundH = Math.max(1e-6, maxY - minY);
	// A SINGLE isotropic scale (never independent per-axis stretching, see
	// the module doc comment for the live-COM correction): the tighter of the
	// two per-axis "fill" candidates wins. The slack this leaves on the OTHER
	// axis is centred WHEN that axis's own two extremes are reached by an
	// EQUAL count of satellites, but FLUSH against whichever edge is reached
	// by FEWER satellites otherwise - see `resolveRingAxisOffset`'s own doc
	// comment for the live-COM measurement (`radial-cycle--hier5.pptx`) that
	// established this, and why it reduces to plain centring for
	// `basic-cycle--flat3.pptx` (this reproduces the cached 231.90x231.90
	// EXACT CIRCLE, 231.98 computed, 0.03% off, centred with ~143.4px margin
	// on the non-binding axis - matches to within rounding) and
	// `basic-radial--hier5.pptx` (a hub+ring family, n=4: a point sits at
	// BOTH poles, so both axes are genuinely 1-vs-1 tied - its own
	// 4-satellite content bounding box is centred on both axes in the cached
	// drawing, measured margins ~141.6px horizontal, ~2.0px vertical,
	// symmetric on both sides each) without any special-casing.
	const scale = Math.min(box.width / naturalBoundW, box.height / naturalBoundH);
	const scaleX = scale;
	const scaleY = scale;
	const offsetX = resolveRingAxisOffset(box.width, naturalBoundW, scaleX, xs);
	const offsetY = resolveRingAxisOffset(box.height, naturalBoundH, scaleY, ys);

	const centers = natural.map((p) => ({
		x: (p.x - minX) * scaleX + offsetX,
		y: (p.y - minY) * scaleY + offsetY,
	}));
	const hubCenter = { x: (0 - minX) * scaleX + offsetX, y: (0 - minY) * scaleY + offsetY };
	// Largest hub half-extent (natural units) that clears every ring node's
	// own edge from the shared natural centre.
	const naturalHubRadius = Math.max(0, r0 - Math.max(halfW, halfH));

	return {
		centers,
		nodeWidth: scaleX,
		nodeHeight: heightOverWidth * scaleY,
		hubCenter,
		hubHalfWidth: naturalHubRadius * scaleX,
		hubHalfHeight: naturalHubRadius * scaleY,
	};
}

/**
 * Fit `n` ring nodes evenly spaced by `spanDeg` (full circle when
 * `abs(spanDeg) >= 360`, else split over `n - 1` gaps like `stAng + spanAng`
 * landing on the LAST point) starting at `stAng`, honouring `minGapRatio`
 * (the resolved `sibSp`, floored - see `smartart-layout-interpreter-cycle-
 * constraints.ts`'s `DEFAULT_MIN_GAP_RATIO`) and `heightOverWidth` (the item
 * node's own resolved `h:w` fact), into `box`. See the parent module's doc
 * comment for the derivation and what it does and does not reproduce
 * exactly.
 *
 * `absoluteGapPx`, when given (an ABSOLUTE `sibSp` `val`, already converted
 * points -> pixels - see `resolveCycleRingParams`), OVERRIDES `minGapRatio`:
 * the gap is a fixed pixel quantity, but this function's own geometry is
 * solved in a "natural" unit space where the node's own width is 1 and only
 * scaled to real pixels at the very end (`nodeWidth === scaleX`), so an
 * absolute pixel gap has to be expressed as `gapFactor = absoluteGapPx /
 * nodeWidthPx` - which itself depends on `nodeWidth`, the very thing being
 * solved for. Resolved by fixed-point iteration (typically converges in a
 * handful of steps for the box sizes real diagrams use): guess a
 * `gapFactor`, compute the resulting `nodeWidth`, refine the guess from
 * `absoluteGapPx / nodeWidth`, repeat. COM-verified against
 * `continuous-cycle--flat3.pptx` (`sibSp val="15"`, i.e. 15pt = 20px): this
 * converges to `gapFactor ~= 0.0472`, `nodeWidth ~= 423.5` vs the cached
 * 420 (0.8%).
 *
 * `absoluteHubGapPx`, when given (an ABSOLUTE `sp val`, e.g. `radial-list
 * --hier5.pptx`'s own `<dgm:constr type="sp" val="20"/>` - see
 * `resolveCycleRingParams`'s own doc comment): the SAME fixed-point idea,
 * but refining `hubGeometry.gapRatio` (the hub-to-satellite gap, natural
 * units) toward `absoluteHubGapPx / nodeWidthPx` instead of `sibSp`'s own
 * `gapFactor` - `resolveHubGapRatio` only ever resolves a RATIO-form `sp`
 * (a declared `fact`), so an absolute `sp val` (no `fact` at all) needs this
 * SEPARATE iteration; both can run in the SAME loop when a layout declares
 * both an absolute `sibSp` AND an absolute `sp` (not observed in the
 * built-in gallery, but not assumed impossible either).
 */
export function computeCycleRingLayout(
	n: number,
	stAngDeg: number,
	spanDeg: number,
	minGapRatio: number,
	heightOverWidth: number,
	box: BoundingBox,
	absoluteGapPx?: number,
	hubGeometry?: HubRingGeometry,
	absoluteHubGapPx?: number,
): CycleRingLayout {
	const degenerate = degenerateRingLayout(n, heightOverWidth, box);
	if (degenerate) {
		return degenerate;
	}
	const needsGapIteration = absoluteGapPx !== undefined && absoluteGapPx > 0;
	const needsHubGapIteration =
		absoluteHubGapPx !== undefined && absoluteHubGapPx > 0 && hubGeometry !== undefined;
	if (!needsGapIteration && !needsHubGapIteration) {
		return ringLayoutForGapFactor(
			n,
			stAngDeg,
			spanDeg,
			minGapRatio,
			heightOverWidth,
			box,
			hubGeometry,
		);
	}
	let gapFactor = minGapRatio;
	let hub = hubGeometry;
	for (let iteration = 0; iteration < 20; iteration += 1) {
		const candidate = ringLayoutForGapFactor(
			n,
			stAngDeg,
			spanDeg,
			gapFactor,
			heightOverWidth,
			box,
			hub,
		);
		const nextGapFactor =
			needsGapIteration && candidate.nodeWidth > 1e-6
				? absoluteGapPx / candidate.nodeWidth
				: gapFactor;
		const nextHubGapRatio =
			needsHubGapIteration && candidate.nodeWidth > 1e-6
				? absoluteHubGapPx / candidate.nodeWidth
				: hub?.gapRatio;
		const gapConverged = Math.abs(nextGapFactor - gapFactor) < 1e-9;
		const hubGapConverged =
			!needsHubGapIteration || Math.abs((nextHubGapRatio ?? 0) - (hub?.gapRatio ?? 0)) < 1e-9;
		gapFactor = nextGapFactor;
		if (needsHubGapIteration && hub) {
			hub = { ...hub, gapRatio: nextHubGapRatio ?? hub.gapRatio };
		}
		if (gapConverged && hubGapConverged) {
			break;
		}
	}
	return ringLayoutForGapFactor(n, stAngDeg, spanDeg, gapFactor, heightOverWidth, box, hub);
}
