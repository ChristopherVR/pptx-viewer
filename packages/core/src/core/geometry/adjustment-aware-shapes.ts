/**
 * Adjustment-aware geometry for shapes whose silhouette depends on the
 * source PPTX's `shapeAdjustments` values.
 *
 * The static `PRESET_SHAPE_CLIP_PATHS` table renders every shape at its
 * default adjustment values. This module supplements that table for the
 * subset of shapes where ignoring the adjustments produces a visibly wrong
 * outline (callouts, pies, donuts, block-arcs, etc.).
 *
 * Adjustment encodings (per ECMA-376 §20.1.9 / DrawingML preset shapes):
 *   - **Distance** adjustments (`adjN` for callout pointer X/Y, donut hole,
 *     band thickness, arrow head) are stored as 1/100,000ths of the body's
 *     width or height. A pointer X of 25000 means 25% of width.
 *   - **Angle** adjustments (`adjN` for sweep angles on pie/arc/blockArc/
 *     circularArrow) are stored as 1/60,000ths of a degree. An angle value
 *     of 16,200,000 corresponds to 270°.
 *
 * Default adjustment values are sourced from the `avLst` block of each
 * shape's `presetShapeDefinitions` entry in ECMA-376 Annex E. The defaults
 * applied here are documented inline.
 *
 * The exported {@link getAdjustmentAwareClipPath} returns a CSS
 * `clip-path` string (always a `polygon(...)` for cross-browser safety —
 * Firefox <105 lacks `path()` clip-path support). Returns `undefined`
 * when the shape isn't in the supported set, allowing callers to fall
 * back to the static preset polygon.
 *
 * @module adjustment-aware-shapes
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** OOXML angle unit: 60,000ths of a degree. */
const ANGLE_UNITS_PER_DEGREE = 60000;

/** OOXML distance unit (relative): 100,000ths of width/height. */
const DISTANCE_UNITS_PER_FRACTION = 100000;

/** Polygon vertex count for arc-based shapes (balance of fidelity vs. size). */
const ARC_VERTEX_COUNT = 32;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert an OOXML angle adjustment value (60,000ths of a degree) to radians.
 * Falls back to {@link defaultUnits} when {@link value} is non-finite.
 */
function angleAdjToRadians(value: number | undefined, defaultUnits: number): number {
	const raw = typeof value === 'number' && Number.isFinite(value) ? value : defaultUnits;
	const degrees = raw / ANGLE_UNITS_PER_DEGREE;
	return (degrees * Math.PI) / 180;
}

/**
 * Convert an OOXML distance adjustment value (100,000ths of a fraction)
 * to a unit fraction in [-2, 2]. Negative or oversized values are clamped
 * to a sane range that keeps the resulting polygon finite.
 */
function distanceAdjToFraction(value: number | undefined, defaultUnits: number): number {
	const raw = typeof value === 'number' && Number.isFinite(value) ? value : defaultUnits;
	const fraction = raw / DISTANCE_UNITS_PER_FRACTION;
	if (fraction < -2) {
		return -2;
	}
	if (fraction > 2) {
		return 2;
	}
	return fraction;
}

/**
 * Format a numeric coordinate in pixels as a CSS length with three decimals.
 * Used to keep clip-path strings deterministic for snapshot tests.
 */
function px(value: number): string {
	if (!Number.isFinite(value)) {
		return '0px';
	}
	return `${value.toFixed(3)}px`;
}

/** Format a unitless percentage to three decimals. */
function pct(fraction: number): string {
	if (!Number.isFinite(fraction)) {
		return '0%';
	}
	return `${(fraction * 100).toFixed(3)}%`;
}

/** Build a polygon clip-path string from a list of [x, y] points (in px). */
function polygonFromPoints(points: ReadonlyArray<readonly [number, number]>): string {
	const parts = points.map(([x, y]) => `${px(x)} ${px(y)}`);
	return `polygon(${parts.join(', ')})`;
}

/** Build a polygon clip-path string from a list of [xFrac, yFrac] points. */
function polygonFromFractions(points: ReadonlyArray<readonly [number, number]>): string {
	const parts = points.map(([x, y]) => `${pct(x)} ${pct(y)}`);
	return `polygon(${parts.join(', ')})`;
}

/**
 * Sample N+1 points on the ellipse inscribed in the [0,width]x[0,height] box,
 * sweeping from {@link startAngle} to {@link endAngle} (radians, OOXML
 * convention: 0 = +x axis, sweeping clockwise to match screen Y-down).
 *
 * Both endpoints are included.
 */
function sampleEllipseArc(
	width: number,
	height: number,
	startAngle: number,
	endAngle: number,
	steps: number,
): Array<[number, number]> {
	const cx = width / 2;
	const cy = height / 2;
	const rx = width / 2;
	const ry = height / 2;
	const points: Array<[number, number]> = [];
	const safeSteps = Math.max(1, Math.floor(steps));
	for (let i = 0; i <= safeSteps; i++) {
		const t = i / safeSteps;
		const angle = startAngle + (endAngle - startAngle) * t;
		// OOXML uses screen coordinates: +x right, +y down. Standard parametric
		// ellipse with sin(angle) on Y already matches that orientation.
		const x = cx + rx * Math.cos(angle);
		const y = cy + ry * Math.sin(angle);
		points.push([x, y]);
	}
	return points;
}

/**
 * Normalise an arbitrary angle (radians) to [0, 2π).
 */
function normaliseAngle(angle: number): number {
	const twoPi = Math.PI * 2;
	let a = angle % twoPi;
	if (a < 0) {
		a += twoPi;
	}
	return a;
}

/**
 * Compute the clockwise sweep from {@link startAngle} to {@link endAngle}.
 * If end <= start, adds 2π so the result is always in (0, 2π].
 */
function clockwiseSweep(startAngle: number, endAngle: number): number {
	const start = normaliseAngle(startAngle);
	let end = normaliseAngle(endAngle);
	if (end <= start) {
		end += Math.PI * 2;
	}
	return end - start;
}

// ---------------------------------------------------------------------------
// Shape builders
// ---------------------------------------------------------------------------

/**
 * pie / pieWedge / chord:
 *   adj1 = start angle (60,000ths of degree). Spec default: 0 (3 o'clock).
 *   adj2 = end angle.                          Spec default: 16,200,000 (270°, 12 o'clock).
 *
 * pie:      filled wedge from start→end including the centre.
 * pieWedge: same outline as pie at default 90°/180° quadrant — we treat it
 *           as a synonym of pie for adjustment purposes.
 * chord:    connect arc endpoints with a straight line (no centre vertex).
 */
function buildPie(
	width: number,
	height: number,
	adjustments: Record<string, number> | undefined,
	includeCentre: boolean,
): string {
	const startAngle = angleAdjToRadians(adjustments?.adj1, 0);
	const endAngle = angleAdjToRadians(adjustments?.adj2, 16_200_000);
	const sweep = clockwiseSweep(startAngle, endAngle);
	const arc = sampleEllipseArc(width, height, startAngle, startAngle + sweep, ARC_VERTEX_COUNT);
	const points: Array<[number, number]> = [];
	if (includeCentre) {
		points.push([width / 2, height / 2]);
	}
	for (const p of arc) {
		points.push(p);
	}
	return polygonFromPoints(points);
}

/**
 * arc: open arc — only the ring outline. We approximate by sampling the
 * ellipse from start→end then walking back along an inner ellipse offset
 * by the OOXML default stroke band (~25% of min(width,height)). Without
 * a thickness adjustment the arc preset has zero fill area, so we render
 * a thin band so the silhouette differs from a degenerate polygon.
 */
function buildArc(
	width: number,
	height: number,
	adjustments: Record<string, number> | undefined,
): string {
	const startAngle = angleAdjToRadians(adjustments?.adj1, 0);
	const endAngle = angleAdjToRadians(adjustments?.adj2, 16_200_000);
	const sweep = clockwiseSweep(startAngle, endAngle);
	const cx = width / 2;
	const cy = height / 2;
	// Outer ring = full inscribed ellipse. Inner ring = 50% radius (matches
	// the static preset's silhouette which renders a thick crescent).
	const inner = 0.5;
	const outerArc = sampleEllipseArc(
		width,
		height,
		startAngle,
		startAngle + sweep,
		ARC_VERTEX_COUNT,
	);
	const innerArc: Array<[number, number]> = [];
	for (let i = ARC_VERTEX_COUNT; i >= 0; i--) {
		const t = i / ARC_VERTEX_COUNT;
		const angle = startAngle + sweep * t;
		innerArc.push([
			cx + (width / 2) * inner * Math.cos(angle),
			cy + (height / 2) * inner * Math.sin(angle),
		]);
	}
	return polygonFromPoints([...outerArc, ...innerArc]);
}

/**
 * donut:
 *   adj1 = inner radius (1/100,000 of half min-dim). Spec default: 25,000 (25%).
 *
 * Renders as outer ellipse plus inner ellipse traced backwards. Because
 * CSS clip-path polygons can't carve true holes, we connect inner→outer at
 * the seam (12 o'clock). The seam is a single-pixel-wide bridge that's
 * visually negligible at typical sizes.
 */
function buildDonut(
	width: number,
	height: number,
	adjustments: Record<string, number> | undefined,
): string {
	const innerFraction = Math.max(0, Math.min(0.5, distanceAdjToFraction(adjustments?.adj1, 25000)));
	const cx = width / 2;
	const cy = height / 2;
	const rxOuter = width / 2;
	const ryOuter = height / 2;
	const rxInner = rxOuter * (1 - innerFraction * 2);
	const ryInner = ryOuter * (1 - innerFraction * 2);
	const points: Array<[number, number]> = [];
	const seamAngle = -Math.PI / 2; // 12 o'clock
	// Outer ring CW
	for (let i = 0; i <= ARC_VERTEX_COUNT; i++) {
		const t = i / ARC_VERTEX_COUNT;
		const a = seamAngle + Math.PI * 2 * t;
		points.push([cx + rxOuter * Math.cos(a), cy + ryOuter * Math.sin(a)]);
	}
	// Bridge to inner ring start
	points.push([cx + rxInner * Math.cos(seamAngle), cy + ryInner * Math.sin(seamAngle)]);
	// Inner ring CCW
	for (let i = ARC_VERTEX_COUNT; i >= 0; i--) {
		const t = i / ARC_VERTEX_COUNT;
		const a = seamAngle + Math.PI * 2 * t;
		points.push([cx + rxInner * Math.cos(a), cy + ryInner * Math.sin(a)]);
	}
	// Close back to outer seam
	points.push([cx + rxOuter * Math.cos(seamAngle), cy + ryOuter * Math.sin(seamAngle)]);
	return polygonFromPoints(points);
}

/**
 * blockArc:
 *   adj1 = start angle (deg/60000). Spec default: 10,800,000 (180°).
 *   adj2 = end angle.                Spec default: 0 (360° / 0°).
 *   adj3 = band thickness (1/100,000 of half min-dim). Spec default: 25,000 (25%).
 */
function buildBlockArc(
	width: number,
	height: number,
	adjustments: Record<string, number> | undefined,
): string {
	const startAngle = angleAdjToRadians(adjustments?.adj1, 10_800_000);
	const endAngle = angleAdjToRadians(adjustments?.adj2, 0);
	const sweep = clockwiseSweep(startAngle, endAngle);
	const thickness = Math.max(0.01, Math.min(0.5, distanceAdjToFraction(adjustments?.adj3, 25000)));
	const cx = width / 2;
	const cy = height / 2;
	const rxOuter = width / 2;
	const ryOuter = height / 2;
	const rxInner = rxOuter * (1 - thickness * 2);
	const ryInner = ryOuter * (1 - thickness * 2);
	const points: Array<[number, number]> = [];
	for (let i = 0; i <= ARC_VERTEX_COUNT; i++) {
		const t = i / ARC_VERTEX_COUNT;
		const a = startAngle + sweep * t;
		points.push([cx + rxOuter * Math.cos(a), cy + ryOuter * Math.sin(a)]);
	}
	for (let i = ARC_VERTEX_COUNT; i >= 0; i--) {
		const t = i / ARC_VERTEX_COUNT;
		const a = startAngle + sweep * t;
		points.push([cx + rxInner * Math.cos(a), cy + ryInner * Math.sin(a)]);
	}
	return polygonFromPoints(points);
}

/**
 * wedgeRectCallout:
 *   adj1 = pointer X, in 1/100,000 of width, with origin at body centre.
 *          Range typically [-100,000, +100,000] with values outside [-50,000,
 *          +50,000] putting the tip outside the body. Spec default: -20,833.
 *   adj2 = pointer Y, in 1/100,000 of height. Spec default: 62,500.
 *
 * The body is the full bounding rectangle; the pointer is a triangle whose
 * tip lies at the (adj1, adj2) location and whose base sits on the nearest
 * body edge (with a small fixed-width gap so the tail is visible).
 */
function buildWedgeRectCallout(
	width: number,
	height: number,
	adjustments: Record<string, number> | undefined,
): string {
	return buildWedgeBodyCallout(width, height, adjustments, 'rect');
}

/**
 * wedgeRoundRectCallout:
 *   adj1, adj2 = pointer X, Y (same as wedgeRectCallout).
 *   adj3       = corner radius (1/100,000 of min(width,height)).
 *                Spec default: 16,667.
 */
function buildWedgeRoundRectCallout(
	width: number,
	height: number,
	adjustments: Record<string, number> | undefined,
): string {
	return buildWedgeBodyCallout(width, height, adjustments, 'roundRect');
}

/**
 * wedgeEllipseCallout: same adjustments as wedgeRectCallout but the body
 * is an ellipse inscribed in the bounding box. Spec defaults: adj1 =
 * -20,833, adj2 = 62,500.
 */
function buildWedgeEllipseCallout(
	width: number,
	height: number,
	adjustments: Record<string, number> | undefined,
): string {
	return buildWedgeBodyCallout(width, height, adjustments, 'ellipse');
}

/**
 * Common implementation for the wedge*Callout family.
 *
 * The pointer is constructed as follows:
 *   1. Compute tip position in shape-local coordinates.
 *   2. Project the tip onto the body boundary along the line from the
 *      body centre to the tip — this gives the "base centre".
 *   3. The pointer's two base corners are offset perpendicular to that
 *      line by 8% of the body's longer side (provides a visible tail).
 *   4. The pointer is unioned with the body polygon by walking the body
 *      perimeter and inserting the two base corners at the appropriate
 *      seam, then jumping out to the tip and back.
 */
function buildWedgeBodyCallout(
	width: number,
	height: number,
	adjustments: Record<string, number> | undefined,
	bodyKind: 'rect' | 'roundRect' | 'ellipse',
): string {
	const adj1 = distanceAdjToFraction(adjustments?.adj1, -20833);
	const adj2 = distanceAdjToFraction(adjustments?.adj2, 62500);
	const adj3 = distanceAdjToFraction(adjustments?.adj3, 16667);
	const cx = width / 2;
	const cy = height / 2;
	// Pointer tip in absolute coords: PPTX uses 0..1 of width/height with
	// the origin at the top-left of the bounding box _expanded_ to include
	// the pointer. For our clip-path, tip is at (adj1*width + cx, adj2*height + cy)
	// matching most renderers' interpretation: adj1=0, adj2=0.5 → tip at
	// horizontal centre, half a body-height below the body top edge.
	// Here we treat adj1/adj2 as offsets from centre, which matches the
	// ECMA-376 sample renderings of (-20833, 62500) → bottom-left tip.
	const tipX = cx + adj1 * width;
	const tipY = cy + adj2 * height;
	// Body boundary points (high-resolution polygon for ellipse/round-rect).
	const body =
		bodyKind === 'ellipse'
			? buildEllipsePolygon(width, height, ARC_VERTEX_COUNT * 2)
			: bodyKind === 'roundRect'
				? buildRoundRectPolygon(
						width,
						height,
						Math.max(0, Math.min(0.5, adj3)) * Math.min(width, height),
					)
				: buildRectPolygon(width, height);
	// Base centre = closest point on body boundary to tip.
	const baseCentre = closestPointOnPolygon(body, [tipX, tipY]);
	// Tail width = 12% of the larger body side, capped to the distance
	// from the base centre to either polygon vertex on each side.
	const tailWidth = Math.max(8, 0.12 * Math.max(width, height));
	const tangent = perpendicularTangentAt(body, baseCentre, [tipX, tipY]);
	const half: [number, number] = [tangent[0] * tailWidth * 0.5, tangent[1] * tailWidth * 0.5];
	const baseLeft: [number, number] = [baseCentre[0] - half[0], baseCentre[1] - half[1]];
	const baseRight: [number, number] = [baseCentre[0] + half[0], baseCentre[1] + half[1]];
	// Insert the pointer into the body polygon at the seam closest to
	// baseCentre. Walk the body, find the segment containing baseCentre,
	// emit baseLeft → tip → baseRight at that point.
	const merged = insertPointerIntoPolygon(body, baseCentre, baseLeft, baseRight, [tipX, tipY]);
	return polygonFromPoints(merged);
}

/** Build a 4-vertex rectangle polygon. */
function buildRectPolygon(width: number, height: number): Array<[number, number]> {
	return [
		[0, 0],
		[width, 0],
		[width, height],
		[0, height],
	];
}

/**
 * Build a rounded-rect polygon. Each corner is sampled with 8 vertices.
 */
function buildRoundRectPolygon(
	width: number,
	height: number,
	radius: number,
): Array<[number, number]> {
	const r = Math.max(0, Math.min(Math.min(width, height) / 2, radius));
	if (r <= 0.01) {
		return buildRectPolygon(width, height);
	}
	const corners: Array<[number, number, number]> = [
		// [centerX, centerY, startAngle (radians)]
		[width - r, r, -Math.PI / 2], // top-right starts at 12 o'clock, sweeps to 3
		[width - r, height - r, 0],
		[r, height - r, Math.PI / 2],
		[r, r, Math.PI],
	];
	const points: Array<[number, number]> = [];
	const cornerSteps = 8;
	for (const [ccx, ccy, a0] of corners) {
		for (let i = 0; i <= cornerSteps; i++) {
			const t = i / cornerSteps;
			const a = a0 + (Math.PI / 2) * t;
			points.push([ccx + r * Math.cos(a), ccy + r * Math.sin(a)]);
		}
	}
	return points;
}

/** Build a closed ellipse polygon with N vertices. */
function buildEllipsePolygon(
	width: number,
	height: number,
	steps: number,
): Array<[number, number]> {
	const cx = width / 2;
	const cy = height / 2;
	const rx = width / 2;
	const ry = height / 2;
	const points: Array<[number, number]> = [];
	for (let i = 0; i < steps; i++) {
		const a = (i / steps) * Math.PI * 2;
		points.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
	}
	return points;
}

/**
 * Find the closest point on a closed polygon to {@link target}, returning
 * the projected point on the nearest edge.
 */
function closestPointOnPolygon(
	polygon: ReadonlyArray<readonly [number, number]>,
	target: readonly [number, number],
): [number, number] {
	let bestPoint: [number, number] = [polygon[0][0], polygon[0][1]];
	let bestDist = Infinity;
	for (let i = 0; i < polygon.length; i++) {
		const a = polygon[i];
		const b = polygon[(i + 1) % polygon.length];
		const projected = projectPointOntoSegment(a, b, target);
		const dx = projected[0] - target[0];
		const dy = projected[1] - target[1];
		const d = dx * dx + dy * dy;
		if (d < bestDist) {
			bestDist = d;
			bestPoint = projected;
		}
	}
	return bestPoint;
}

/** Project {@link p} onto segment (a,b), clamping to endpoints. */
function projectPointOntoSegment(
	a: readonly [number, number],
	b: readonly [number, number],
	p: readonly [number, number],
): [number, number] {
	const abx = b[0] - a[0];
	const aby = b[1] - a[1];
	const len2 = abx * abx + aby * aby;
	if (len2 <= 0) {
		return [a[0], a[1]];
	}
	const apx = p[0] - a[0];
	const apy = p[1] - a[1];
	let t = (apx * abx + apy * aby) / len2;
	if (t < 0) {
		t = 0;
	} else if (t > 1) {
		t = 1;
	}
	return [a[0] + abx * t, a[1] + aby * t];
}

/**
 * Compute a unit tangent at {@link basePoint} on {@link polygon},
 * oriented so that it's perpendicular to the line from the polygon
 * centre toward the tip. This keeps the pointer's base perpendicular
 * to the body normal, which matches PowerPoint's rendering.
 */
function perpendicularTangentAt(
	polygon: ReadonlyArray<readonly [number, number]>,
	basePoint: readonly [number, number],
	tip: readonly [number, number],
): [number, number] {
	const dx = tip[0] - basePoint[0];
	const dy = tip[1] - basePoint[1];
	const len = Math.hypot(dx, dy);
	if (len < 1e-6) {
		// Degenerate: tip on body. Use polygon edge tangent.
		const a = polygon[0];
		const b = polygon[1 % polygon.length];
		const ex = b[0] - a[0];
		const ey = b[1] - a[1];
		const elen = Math.hypot(ex, ey) || 1;
		return [ex / elen, ey / elen];
	}
	// Perpendicular in screen coords (rotate (dx,dy) by 90°).
	return [-dy / len, dx / len];
}

/**
 * Insert the pointer (baseLeft → tip → baseRight) into the body polygon
 * by replacing the segment that contains {@link baseCentre}.
 */
function insertPointerIntoPolygon(
	polygon: ReadonlyArray<readonly [number, number]>,
	baseCentre: readonly [number, number],
	baseLeft: readonly [number, number],
	baseRight: readonly [number, number],
	tip: readonly [number, number],
): Array<[number, number]> {
	let bestIndex = 0;
	let bestDist = Infinity;
	for (let i = 0; i < polygon.length; i++) {
		const a = polygon[i];
		const b = polygon[(i + 1) % polygon.length];
		const projected = projectPointOntoSegment(a, b, baseCentre);
		const dx = projected[0] - baseCentre[0];
		const dy = projected[1] - baseCentre[1];
		const d = dx * dx + dy * dy;
		if (d < bestDist) {
			bestDist = d;
			bestIndex = i;
		}
	}
	// Build output polygon: vertices [0..bestIndex], baseLeft, tip, baseRight, [bestIndex+1..].
	// Order baseLeft/baseRight so that we walk the same direction as the polygon
	// (CCW by construction → keep the corner that is "ahead" along the edge).
	const out: Array<[number, number]> = [];
	for (let i = 0; i <= bestIndex; i++) {
		out.push([polygon[i][0], polygon[i][1]]);
	}
	const next = polygon[(bestIndex + 1) % polygon.length];
	const ex = next[0] - polygon[bestIndex][0];
	const ey = next[1] - polygon[bestIndex][1];
	// Project both base corners onto the edge to determine which one we hit first.
	const tLeft =
		(baseLeft[0] - polygon[bestIndex][0]) * ex + (baseLeft[1] - polygon[bestIndex][1]) * ey;
	const tRight =
		(baseRight[0] - polygon[bestIndex][0]) * ex + (baseRight[1] - polygon[bestIndex][1]) * ey;
	if (tLeft <= tRight) {
		out.push([baseLeft[0], baseLeft[1]]);
		out.push([tip[0], tip[1]]);
		out.push([baseRight[0], baseRight[1]]);
	} else {
		out.push([baseRight[0], baseRight[1]]);
		out.push([tip[0], tip[1]]);
		out.push([baseLeft[0], baseLeft[1]]);
	}
	for (let i = bestIndex + 1; i < polygon.length; i++) {
		out.push([polygon[i][0], polygon[i][1]]);
	}
	return out;
}

/**
 * cloudCallout:
 *   adj1, adj2 = pointer X/Y (same encoding as wedgeRectCallout).
 *
 * The body is approximated by a 32-bump cloud-like polygon; the pointer
 * is rendered as a chain of three shrinking ellipsoids (matching the
 * OOXML spec's "trail of bubbles" leader). Each bubble's diameter is a
 * fraction of the body's smaller side. Spec defaults: adj1 = -20,833,
 * adj2 = 62,500.
 */
function buildCloudCallout(
	width: number,
	height: number,
	adjustments: Record<string, number> | undefined,
): string {
	const adj1 = distanceAdjToFraction(adjustments?.adj1, -20833);
	const adj2 = distanceAdjToFraction(adjustments?.adj2, 62500);
	const cx = width / 2;
	const cy = height / 2;
	const tipX = cx + adj1 * width;
	const tipY = cy + adj2 * height;
	// Body: 24-bump cloud silhouette inscribed in (0,0..width,height).
	const bumpCount = 24;
	const body: Array<[number, number]> = [];
	const baseRx = width / 2;
	const baseRy = height / 2;
	// Inset to leave room for bump amplitude.
	const inset = 0.85;
	const bumpAmplitude = 1 - inset;
	for (let i = 0; i < bumpCount; i++) {
		const a = (i / bumpCount) * Math.PI * 2;
		// Modulate radius with a cosine of (bumpCount/2 * angle) to create scallops.
		const radial = inset + bumpAmplitude * Math.abs(Math.cos((bumpCount / 2) * a));
		body.push([cx + baseRx * radial * Math.cos(a), cy + baseRy * radial * Math.sin(a)]);
	}
	// Bubble chain: 3 bubbles between body edge and tip.
	const baseCentre = closestPointOnPolygon(body, [tipX, tipY]);
	const dx = tipX - baseCentre[0];
	const dy = tipY - baseCentre[1];
	const bubbleSizes = [0.06, 0.04, 0.025];
	const bubbleCentresT = [0.4, 0.7, 1.0];
	const minDim = Math.min(width, height);
	const out: Array<[number, number]> = [];
	for (const p of body) {
		out.push([p[0], p[1]]);
	}
	// Append each bubble as a small ellipse polygon, joined by a thin bridge
	// (visual quality is acceptable because bubbles occupy <10% of body area).
	for (let b = 0; b < bubbleSizes.length; b++) {
		const bx = baseCentre[0] + dx * bubbleCentresT[b];
		const by = baseCentre[1] + dy * bubbleCentresT[b];
		const r = minDim * bubbleSizes[b];
		const steps = 12;
		for (let i = 0; i <= steps; i++) {
			const a = (i / steps) * Math.PI * 2;
			out.push([bx + r * Math.cos(a), by + r * Math.sin(a)]);
		}
		// Bridge back to last body vertex to close the polygon for CSS.
		out.push([baseCentre[0], baseCentre[1]]);
	}
	return polygonFromPoints(out);
}

/**
 * circularArrow:
 *   adj1 = band thickness (1/100,000 of half min-dim). Spec default: 12,500.
 *   adj2 = start angle (deg/60000).                    Spec default: 1,142,319 (~19°).
 *   adj3 = end angle.                                  Spec default: 20,457,681 (~341°).
 *   adj4 = arrow head size (1/100,000 of half min-dim).Spec default: 12,500.
 *
 * The silhouette consists of: outer arc (start→end-headSweep), arrow head
 * triangle (back, tip, front), inner arc (end-headSweep→start), closed.
 */
function buildCircularArrow(
	width: number,
	height: number,
	adjustments: Record<string, number> | undefined,
): string {
	const thickness = Math.max(0.02, Math.min(0.45, distanceAdjToFraction(adjustments?.adj1, 12500)));
	const startAngle = angleAdjToRadians(adjustments?.adj2, 1_142_319);
	const endAngle = angleAdjToRadians(adjustments?.adj3, 20_457_681);
	const headSize = Math.max(0, Math.min(0.45, distanceAdjToFraction(adjustments?.adj4, 12500)));
	const sweep = clockwiseSweep(startAngle, endAngle);
	// Reserve last `headFraction` of the sweep for the arrow head.
	const headSweep = Math.min(sweep * 0.4, headSize * Math.PI);
	const bandSweepEnd = startAngle + sweep - headSweep;
	const cx = width / 2;
	const cy = height / 2;
	const rxOuter = width / 2;
	const ryOuter = height / 2;
	const rxInner = rxOuter * (1 - thickness * 2);
	const ryInner = ryOuter * (1 - thickness * 2);
	const points: Array<[number, number]> = [];
	// Outer arc start→bandSweepEnd
	for (let i = 0; i <= ARC_VERTEX_COUNT; i++) {
		const t = i / ARC_VERTEX_COUNT;
		const a = startAngle + (bandSweepEnd - startAngle) * t;
		points.push([cx + rxOuter * Math.cos(a), cy + ryOuter * Math.sin(a)]);
	}
	// Arrow head: back-outer (already at last point) → tip → back-inner.
	const tipAngle = startAngle + sweep;
	const headRadialOuter = (rxOuter + rxInner) / 2 + (rxOuter - rxInner) * (0.5 + headSize);
	const headRadialOuterY = (ryOuter + ryInner) / 2 + (ryOuter - ryInner) * (0.5 + headSize);
	const tipRadialMid = (rxOuter + rxInner) / 2;
	const tipRadialMidY = (ryOuter + ryInner) / 2;
	// Outer barb (extends beyond outer ring)
	points.push([
		cx + headRadialOuter * Math.cos(bandSweepEnd),
		cy + headRadialOuterY * Math.sin(bandSweepEnd),
	]);
	// Tip (mid-radius at end angle)
	points.push([cx + tipRadialMid * Math.cos(tipAngle), cy + tipRadialMidY * Math.sin(tipAngle)]);
	// Inner barb
	const innerBarbX = rxInner - (rxOuter - rxInner) * headSize;
	const innerBarbY = ryInner - (ryOuter - ryInner) * headSize;
	points.push([cx + innerBarbX * Math.cos(bandSweepEnd), cy + innerBarbY * Math.sin(bandSweepEnd)]);
	// Inner arc back to start
	for (let i = ARC_VERTEX_COUNT; i >= 0; i--) {
		const t = i / ARC_VERTEX_COUNT;
		const a = startAngle + (bandSweepEnd - startAngle) * t;
		points.push([cx + rxInner * Math.cos(a), cy + ryInner * Math.sin(a)]);
	}
	return polygonFromPoints(points);
}

/**
 * swooshArrow:
 *   adj1 = head size (1/100,000 of width). Spec default: 25,000 (25%).
 *   adj2 = tail thickness (1/100,000 of height). Spec default: 25,000 (25%).
 *
 * Silhouette: a quadratic curve from bottom-left up to top-right with a
 * triangular arrow head at the right tip. Approximated by sampling the
 * curve at 16 points along upper and lower edges.
 */
function buildSwooshArrow(
	width: number,
	height: number,
	adjustments: Record<string, number> | undefined,
): string {
	const headSize = Math.max(0.05, Math.min(0.6, distanceAdjToFraction(adjustments?.adj1, 25000)));
	const tail = Math.max(0.02, Math.min(0.5, distanceAdjToFraction(adjustments?.adj2, 25000)));
	const headWidth = width * headSize;
	const tailH = height * tail;
	const steps = 16;
	const points: Array<[number, number]> = [];
	// Upper curve: from (0, height) → (width - headWidth, 0). Quadratic Bezier
	// with control point at (width - headWidth, height). Use parametric form.
	const p0u: [number, number] = [0, height - tailH * 0.5];
	const p1u: [number, number] = [width - headWidth, height * 0.5];
	const p2u: [number, number] = [width - headWidth, 0];
	for (let i = 0; i <= steps; i++) {
		const t = i / steps;
		const x = (1 - t) * (1 - t) * p0u[0] + 2 * (1 - t) * t * p1u[0] + t * t * p2u[0];
		const y = (1 - t) * (1 - t) * p0u[1] + 2 * (1 - t) * t * p1u[1] + t * t * p2u[1];
		points.push([x, y]);
	}
	// Arrow head: top-back, tip, bottom-back.
	points.push([width - headWidth * 0.4, height * 0.05]);
	points.push([width, height * 0.5]);
	points.push([width - headWidth * 0.4, height * 0.95]);
	// Lower curve: back from (width - headWidth, height) → (0, height).
	const p0l: [number, number] = [width - headWidth, height];
	const p1l: [number, number] = [width - headWidth - tailH, height];
	const p2l: [number, number] = [0, height];
	for (let i = 0; i <= steps; i++) {
		const t = i / steps;
		const x = (1 - t) * (1 - t) * p0l[0] + 2 * (1 - t) * t * p1l[0] + t * t * p2l[0];
		const y = (1 - t) * (1 - t) * p0l[1] + 2 * (1 - t) * t * p1l[1] + t * t * p2l[1];
		points.push([x, y]);
	}
	return polygonFromPoints(points);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Set of OOXML preset shape names this module supports. Lowercase.
 */
const SUPPORTED_SHAPES = new Set([
	'pie',
	'piewedge',
	'chord',
	'arc',
	'donut',
	'nosmoking',
	'blockarc',
	'wedgerectcallout',
	'wedgeroundrectcallout',
	'wedgeellipsecallout',
	'cloudcallout',
	'circulararrow',
	'swootharrow', // common typo guard
	'swoosharrow',
]);

/**
 * Build a CSS `clip-path` value for {@link shapeType} that incorporates
 * the supplied `shapeAdjustments`. Returns `undefined` for shapes that
 * are not in the adjustment-aware table — callers should fall back to
 * the static preset polygon.
 *
 * @param shapeType  The OOXML preset geometry name (e.g. `"pie"`).
 * @param width      The element width in pixels.
 * @param height     The element height in pixels.
 * @param adjustments Optional adjustment record from `PptxElement.shapeAdjustments`.
 *                    Keys are `adj`, `adj1`, `adj2`, etc.
 * @returns A CSS `clip-path` polygon expression, or `undefined`.
 */
export function getAdjustmentAwareClipPath(
	shapeType: string,
	width: number,
	height: number,
	adjustments?: Record<string, number>,
): string | undefined {
	if (!shapeType) {
		return undefined;
	}
	const safeWidth = Number.isFinite(width) && width > 0 ? width : 1;
	const safeHeight = Number.isFinite(height) && height > 0 ? height : 1;
	const normalised = shapeType.toLowerCase();
	if (!SUPPORTED_SHAPES.has(normalised)) {
		return undefined;
	}
	switch (normalised) {
		case 'pie':
		case 'piewedge':
			return buildPie(safeWidth, safeHeight, adjustments, true);
		case 'chord':
			return buildPie(safeWidth, safeHeight, adjustments, false);
		case 'arc':
			return buildArc(safeWidth, safeHeight, adjustments);
		case 'donut':
		case 'nosmoking':
			return buildDonut(safeWidth, safeHeight, adjustments);
		case 'blockarc':
			return buildBlockArc(safeWidth, safeHeight, adjustments);
		case 'wedgerectcallout':
			return buildWedgeRectCallout(safeWidth, safeHeight, adjustments);
		case 'wedgeroundrectcallout':
			return buildWedgeRoundRectCallout(safeWidth, safeHeight, adjustments);
		case 'wedgeellipsecallout':
			return buildWedgeEllipseCallout(safeWidth, safeHeight, adjustments);
		case 'cloudcallout':
			return buildCloudCallout(safeWidth, safeHeight, adjustments);
		case 'circulararrow':
			return buildCircularArrow(safeWidth, safeHeight, adjustments);
		case 'swoosharrow':
		case 'swootharrow':
			return buildSwooshArrow(safeWidth, safeHeight, adjustments);
		default:
			return undefined;
	}
}

// Suppress "unused" diagnostics for helper that consumers may want for tests.
// (`polygonFromFractions` is exported below for unit-test reuse.)
export const _internalForTests = {
	polygonFromFractions,
	angleAdjToRadians,
	distanceAdjToFraction,
};
