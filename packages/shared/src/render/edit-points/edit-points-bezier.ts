/**
 * Cubic Bezier helpers for the Edit Points model: evaluation, splitting,
 * tight bounds, nearest-point projection, and the conversions that fold
 * quadratics and elliptical arcs into cubics.
 *
 * @module render/edit-points/edit-points-bezier
 */
import type { EditPoint } from './edit-points-types';

/** A cubic from `p0` to `p3` with controls `p1`, `p2`. */
export interface CubicBezier {
	p0: EditPoint;
	p1: EditPoint;
	p2: EditPoint;
	p3: EditPoint;
}

function lerp(a: EditPoint, b: EditPoint, t: number): EditPoint {
	return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** The point at parameter `t` (0..1). */
export function cubicPointAt(c: CubicBezier, t: number): EditPoint {
	const u = 1 - t;
	const a = u * u * u;
	const b = 3 * u * u * t;
	const d = 3 * u * t * t;
	const e = t * t * t;
	return {
		x: a * c.p0.x + b * c.p1.x + d * c.p2.x + e * c.p3.x,
		y: a * c.p0.y + b * c.p1.y + d * c.p2.y + e * c.p3.y,
	};
}

/** Split at `t` (de Casteljau); both halves together trace the original. */
export function splitCubic(c: CubicBezier, t: number): [CubicBezier, CubicBezier] {
	const p01 = lerp(c.p0, c.p1, t);
	const p12 = lerp(c.p1, c.p2, t);
	const p23 = lerp(c.p2, c.p3, t);
	const p012 = lerp(p01, p12, t);
	const p123 = lerp(p12, p23, t);
	const mid = lerp(p012, p123, t);
	return [
		{ p0: c.p0, p1: p01, p2: p012, p3: mid },
		{ p0: mid, p1: p123, p2: p23, p3: c.p3 },
	];
}

/** Parameters in (0, 1) where one coordinate of the cubic has a turning point. */
function extremaParams(a: number, b: number, c: number, d: number): number[] {
	// Derivative of the cubic in one axis: 3(qa t^2 + qb t + qc).
	const qa = -a + 3 * b - 3 * c + d;
	const qb = 2 * (a - 2 * b + c);
	const qc = b - a;
	const out: number[] = [];
	if (Math.abs(qa) < 1e-12) {
		if (Math.abs(qb) > 1e-12) {
			out.push(-qc / qb);
		}
	} else {
		const disc = qb * qb - 4 * qa * qc;
		if (disc >= 0) {
			const root = Math.sqrt(disc);
			out.push((-qb + root) / (2 * qa), (-qb - root) / (2 * qa));
		}
	}
	return out.filter((t) => t > 0 && t < 1);
}

/** Tight bounds of a cubic (not the looser hull of its control points). */
export function cubicBounds(c: CubicBezier): {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
} {
	const ts = [
		0,
		1,
		...extremaParams(c.p0.x, c.p1.x, c.p2.x, c.p3.x),
		...extremaParams(c.p0.y, c.p1.y, c.p2.y, c.p3.y),
	];
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const t of ts) {
		const p = cubicPointAt(c, t);
		minX = Math.min(minX, p.x);
		minY = Math.min(minY, p.y);
		maxX = Math.max(maxX, p.x);
		maxY = Math.max(maxY, p.y);
	}
	return { minX, minY, maxX, maxY };
}

/**
 * The parameter of the point on the cubic nearest `target`: a coarse sample
 * followed by a few rounds of local refinement, plenty for picking where a
 * user grabbed a segment.
 */
export function nearestCubicParam(c: CubicBezier, target: EditPoint): number {
	const dist = (t: number): number => {
		const p = cubicPointAt(c, t);
		return (p.x - target.x) ** 2 + (p.y - target.y) ** 2;
	};
	const samples = 32;
	let best = 0;
	let bestDist = Infinity;
	for (let i = 0; i <= samples; i++) {
		const t = i / samples;
		const d = dist(t);
		if (d < bestDist) {
			bestDist = d;
			best = t;
		}
	}
	let step = 1 / samples;
	for (let round = 0; round < 12; round++) {
		step /= 2;
		for (const t of [best - step, best + step]) {
			if (t >= 0 && t <= 1) {
				const d = dist(t);
				if (d < bestDist) {
					bestDist = d;
					best = t;
				}
			}
		}
	}
	return best;
}

/** Parameter of the point on segment `a`..`b` nearest `target`. */
export function nearestLineParam(a: EditPoint, b: EditPoint, target: EditPoint): number {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const len = dx * dx + dy * dy;
	if (len === 0) {
		return 0;
	}
	return Math.min(1, Math.max(0, ((target.x - a.x) * dx + (target.y - a.y) * dy) / len));
}

/** A quadratic `p0 -> q -> p2` as the identical cubic's two control points. */
export function quadToCubicControls(
	p0: EditPoint,
	q: EditPoint,
	p2: EditPoint,
): { c1: EditPoint; c2: EditPoint } {
	return {
		c1: { x: p0.x + (2 / 3) * (q.x - p0.x), y: p0.y + (2 / 3) * (q.y - p0.y) },
		c2: { x: p2.x + (2 / 3) * (q.x - p2.x), y: p2.y + (2 / 3) * (q.y - p2.y) },
	};
}

/**
 * An axis-aligned elliptical arc as a run of cubics (one per <= 90 degrees),
 * parameterised the way the geometry engine draws `a:arcTo`: the point at
 * angle `a` is `(cx + rx cos a, cy + ry sin a)`.
 */
export function ellipseArcToCubics(
	cx: number,
	cy: number,
	rx: number,
	ry: number,
	startRad: number,
	sweepRad: number,
): Array<{ c1: EditPoint; c2: EditPoint; end: EditPoint }> {
	if (rx <= 0 || ry <= 0 || sweepRad === 0 || !Number.isFinite(sweepRad)) {
		return [];
	}
	const pieces = Math.max(1, Math.ceil(Math.abs(sweepRad) / (Math.PI / 2) - 1e-9));
	const delta = sweepRad / pieces;
	const k = (4 / 3) * Math.tan(delta / 4);
	const out: Array<{ c1: EditPoint; c2: EditPoint; end: EditPoint }> = [];
	let a = startRad;
	for (let i = 0; i < pieces; i++) {
		const b = a + delta;
		const cosA = Math.cos(a);
		const sinA = Math.sin(a);
		const cosB = Math.cos(b);
		const sinB = Math.sin(b);
		out.push({
			c1: { x: cx + rx * (cosA - k * sinA), y: cy + ry * (sinA + k * cosA) },
			c2: { x: cx + rx * (cosB + k * sinB), y: cy + ry * (sinB - k * cosB) },
			end: { x: cx + rx * cosB, y: cy + ry * sinB },
		});
		a = b;
	}
	return out;
}

/**
 * An SVG `A` command (from the current point) as cubics, via the standard
 * endpoint-to-centre conversion (SVG 1.1 appendix F.6). Rotated ellipses are
 * supported for completeness even though the preset engine never emits one.
 */
export function svgArcToCubics(
	from: EditPoint,
	rxIn: number,
	ryIn: number,
	xAxisRotationDeg: number,
	largeArc: boolean,
	sweep: boolean,
	to: EditPoint,
): Array<{ c1: EditPoint; c2: EditPoint; end: EditPoint }> {
	if (from.x === to.x && from.y === to.y) {
		return [];
	}
	let rx = Math.abs(rxIn);
	let ry = Math.abs(ryIn);
	if (rx === 0 || ry === 0) {
		return [{ c1: from, c2: to, end: to }];
	}
	const phi = (xAxisRotationDeg * Math.PI) / 180;
	const cosPhi = Math.cos(phi);
	const sinPhi = Math.sin(phi);
	const dx = (from.x - to.x) / 2;
	const dy = (from.y - to.y) / 2;
	const x1p = cosPhi * dx + sinPhi * dy;
	const y1p = -sinPhi * dx + cosPhi * dy;
	const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
	if (lambda > 1) {
		const s = Math.sqrt(lambda);
		rx *= s;
		ry *= s;
	}
	const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
	const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
	let coef = den === 0 ? 0 : Math.sqrt(Math.max(0, num / den));
	if (largeArc === sweep) {
		coef = -coef;
	}
	const cxp = (coef * rx * y1p) / ry;
	const cyp = (-coef * ry * x1p) / rx;
	const cx = cosPhi * cxp - sinPhi * cyp + (from.x + to.x) / 2;
	const cy = sinPhi * cxp + cosPhi * cyp + (from.y + to.y) / 2;
	const angle = (ux: number, uy: number, vx: number, vy: number): number =>
		Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
	const theta1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
	let dTheta = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
	if (!sweep && dTheta > 0) {
		dTheta -= 2 * Math.PI;
	} else if (sweep && dTheta < 0) {
		dTheta += 2 * Math.PI;
	}
	const unrotated = ellipseArcToCubics(0, 0, rx, ry, theta1, dTheta);
	const place = (p: EditPoint): EditPoint => ({
		x: cosPhi * p.x - sinPhi * p.y + cx,
		y: sinPhi * p.x + cosPhi * p.y + cy,
	});
	const pieces = unrotated.map((piece) => ({
		c1: place(piece.c1),
		c2: place(piece.c2),
		end: place(piece.end),
	}));
	// Snap the final end point to the exact target so rounding never opens a
	// hairline gap before the next command.
	if (pieces.length > 0) {
		pieces[pieces.length - 1].end = { x: to.x, y: to.y };
	}
	return pieces;
}
