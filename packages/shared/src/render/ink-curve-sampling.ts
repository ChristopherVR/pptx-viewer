/**
 * Curve-segment sampling for `extractPathPoints` (`ink-rendering.ts`): given a
 * cubic or quadratic Bezier segment, produce a run of points that actually
 * lie ON the curve, spaced at equal ARC LENGTH rather than equal parametric
 * `t`.
 *
 * Placing samples at equal parametric `t` steps is NOT the same as placing
 * them at equal distances along the curve: an extreme curve (control points
 * bunched toward one end) moves much faster through space over one half of
 * `t` than the other, so equal-`t` samples land visibly closer together on
 * the slow-moving half. This is fixed by evaluating the curve at a fine,
 * fixed resolution to build a cumulative chord-length table (independent of
 * the final sample count, so the length ESTIMATE doesn't inherit the very
 * bias it exists to correct), then inverting that table to find the `t` for
 * each equally-spaced target arc length.
 *
 * Split out of `ink-rendering.ts` (which was already over this repo's 300-LOC
 * file-size guideline) so the reparametrization gets its own focused module.
 *
 * @module ink-curve-sampling
 */
import type { PathPoint } from './ink-rendering';

function distance(a: PathPoint, b: PathPoint): number {
	return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Target spacing (px) between curve samples, before min/max clamping. */
const CURVE_SAMPLE_SPACING_PX = 4;
/** Always sample at least this many interior points per curve segment. */
const CURVE_MIN_SAMPLES = 4;
/** Cap samples per curve segment so a huge curve can't blow up point count. */
const CURVE_MAX_SAMPLES = 24;

/**
 * Number of `t` steps to evaluate along a curve segment, scaled by its
 * control-polygon ("hull") length so longer or tighter curves get
 * proportionally more samples.
 */
function curveSampleCount(hullLength: number): number {
	const raw = Math.ceil(hullLength / CURVE_SAMPLE_SPACING_PX);
	return Math.max(CURVE_MIN_SAMPLES, Math.min(CURVE_MAX_SAMPLES, raw));
}

/** Evaluate a cubic Bezier at parameter `t` via De Casteljau's algorithm. */
function cubicBezierAt(
	p0: PathPoint,
	p1: PathPoint,
	p2: PathPoint,
	p3: PathPoint,
	t: number,
): PathPoint {
	const mt = 1 - t;
	const a = { x: mt * p0.x + t * p1.x, y: mt * p0.y + t * p1.y };
	const b = { x: mt * p1.x + t * p2.x, y: mt * p1.y + t * p2.y };
	const c = { x: mt * p2.x + t * p3.x, y: mt * p2.y + t * p3.y };
	const ab = { x: mt * a.x + t * b.x, y: mt * a.y + t * b.y };
	const bc = { x: mt * b.x + t * c.x, y: mt * b.y + t * c.y };
	return { x: mt * ab.x + t * bc.x, y: mt * ab.y + t * bc.y };
}

/** Evaluate a quadratic Bezier at parameter `t` via De Casteljau's algorithm. */
function quadBezierAt(p0: PathPoint, p1: PathPoint, p2: PathPoint, t: number): PathPoint {
	const mt = 1 - t;
	const a = { x: mt * p0.x + t * p1.x, y: mt * p0.y + t * p1.y };
	const b = { x: mt * p1.x + t * p2.x, y: mt * p1.y + t * p2.y };
	return { x: mt * a.x + t * b.x, y: mt * a.y + t * b.y };
}

/** Fixed resolution for the arc-length lookup table, independent of the segment's own (length-scaled) sample count. */
const ARC_LENGTH_LUT_STEPS = 64;

/** Cumulative chord-length table: `lengths[i]` is the arc length from `t=0` to `ts[i]`. */
interface ArcLengthLut {
	ts: number[];
	lengths: number[];
}

/** Build a fixed-resolution arc-length lookup table for a curve evaluator. */
function buildArcLengthLut(evalAt: (t: number) => PathPoint): ArcLengthLut {
	const ts: number[] = [0];
	const lengths: number[] = [0];
	let prev = evalAt(0);
	let total = 0;
	for (let i = 1; i <= ARC_LENGTH_LUT_STEPS; i++) {
		const t = i / ARC_LENGTH_LUT_STEPS;
		const pt = evalAt(t);
		total += distance(prev, pt);
		ts.push(t);
		lengths.push(total);
		prev = pt;
	}
	return { ts, lengths };
}

/** Invert an arc-length table: the parametric `t` whose cumulative length equals `targetLength`. */
function tAtArcLength(lut: ArcLengthLut, targetLength: number): number {
	const { ts, lengths } = lut;
	const total = lengths[lengths.length - 1];
	if (total <= 0) {
		return 1;
	}
	const clamped = Math.max(0, Math.min(total, targetLength));
	for (let i = 1; i < lengths.length; i++) {
		if (lengths[i] >= clamped) {
			const segmentLength = lengths[i] - lengths[i - 1];
			const frac = segmentLength > 0 ? (clamped - lengths[i - 1]) / segmentLength : 0;
			return ts[i - 1] + (ts[i] - ts[i - 1]) * frac;
		}
	}
	return 1;
}

/** Sample a curve evaluator at `count` equal-arc-length intervals (excludes `t=0`, includes `t=1`). */
function sampleByArcLength(evalAt: (t: number) => PathPoint, count: number): PathPoint[] {
	const lut = buildArcLengthLut(evalAt);
	const total = lut.lengths[lut.lengths.length - 1];
	const samples: PathPoint[] = [];
	for (let i = 1; i <= count; i++) {
		const t = tAtArcLength(lut, (i / count) * total);
		samples.push(evalAt(t));
	}
	return samples;
}

/** Append the interior + endpoint samples for a cubic curve segment starting at `current`. */
export function sampleCubicSegment(
	points: PathPoint[],
	current: PathPoint | undefined,
	p1: PathPoint,
	p2: PathPoint,
	end: PathPoint,
): PathPoint {
	if (!current) {
		// No known start point (malformed path): fall back to the raw
		// control points rather than dropping data.
		points.push(p1, p2, end);
		return end;
	}
	const hull = distance(current, p1) + distance(p1, p2) + distance(p2, end);
	const samples = curveSampleCount(hull);
	points.push(...sampleByArcLength((t) => cubicBezierAt(current, p1, p2, end, t), samples));
	return end;
}

/** Append the interior + endpoint samples for a quadratic curve segment starting at `current`. */
export function sampleQuadSegment(
	points: PathPoint[],
	current: PathPoint | undefined,
	cp: PathPoint,
	end: PathPoint,
): PathPoint {
	if (!current) {
		points.push(cp, end);
		return end;
	}
	const hull = distance(current, cp) + distance(cp, end);
	const samples = curveSampleCount(hull);
	points.push(...sampleByArcLength((t) => quadBezierAt(current, cp, end, t), samples));
	return end;
}
