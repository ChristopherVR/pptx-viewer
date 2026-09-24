/**
 * Flatten an SVG path `d` string into closed polygon loops (2D points), for
 * consumers that need a concrete outline rather than curve primitives (the
 * three.js SmartArt renderer extrudes/fills a shape's outline as a flat
 * polygon; sampling curves here keeps that consumer three.js-agnostic and
 * pure/testable).
 *
 * Supports M/L/H/V/C/Q/S/A/Z, both absolute and relative variants, and
 * multiple subpaths (each additional `M` starts a new loop; the first loop is
 * the outer boundary, subsequent loops are holes - the same convention as
 * `THREE.Shape`/`THREE.Path`.holes).
 *
 * @module render/svg-path-flatten
 */

/** A single 2D point. */
export interface Point2 {
	x: number;
	y: number;
}

const COMMAND_RE = /[MLCQZAHVSmlcqzahvs][^MLCQZAHVSmlcqzahvs]*/gu;
const NUMBER_RE = /-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/gu;

interface Token {
	type: string;
	values: number[];
}

function tokenize(d: string): Token[] {
	const tokens: Token[] = [];
	const matches = d.match(COMMAND_RE);
	if (!matches) {
		return tokens;
	}
	for (const raw of matches) {
		const type = raw[0];
		const nums = raw.slice(1).match(NUMBER_RE);
		tokens.push({ type, values: nums ? nums.map((n) => Number.parseFloat(n)) : [] });
	}
	return tokens;
}

/** Sample a cubic Bezier at `segments` steps (excluding the start point). */
function sampleCubic(
	p0: Point2,
	p1: Point2,
	p2: Point2,
	p3: Point2,
	segments: number,
	out: Point2[],
): void {
	for (let i = 1; i <= segments; i++) {
		const t = i / segments;
		const mt = 1 - t;
		const x =
			mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x;
		const y =
			mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y;
		out.push({ x, y });
	}
}

/** Sample a quadratic Bezier at `segments` steps (excluding the start point). */
function sampleQuadratic(
	p0: Point2,
	p1: Point2,
	p2: Point2,
	segments: number,
	out: Point2[],
): void {
	for (let i = 1; i <= segments; i++) {
		const t = i / segments;
		const mt = 1 - t;
		const x = mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x;
		const y = mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y;
		out.push({ x, y });
	}
}

/**
 * Sample an SVG elliptical arc (endpoint parameterization, SVG spec F.6) into
 * points, appended to `out`. Excludes the start point.
 */
function sampleArc(
	start: Point2,
	rxIn: number,
	ryIn: number,
	xAxisRotationDeg: number,
	largeArcFlag: boolean,
	sweepFlag: boolean,
	end: Point2,
	segments: number,
	out: Point2[],
): void {
	if (rxIn === 0 || ryIn === 0 || (start.x === end.x && start.y === end.y)) {
		out.push(end);
		return;
	}
	const phi = (xAxisRotationDeg * Math.PI) / 180;
	const cosPhi = Math.cos(phi);
	const sinPhi = Math.sin(phi);
	let rx = Math.abs(rxIn);
	let ry = Math.abs(ryIn);

	const dx2 = (start.x - end.x) / 2;
	const dy2 = (start.y - end.y) / 2;
	const x1p = cosPhi * dx2 + sinPhi * dy2;
	const y1p = -sinPhi * dx2 + cosPhi * dy2;

	const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
	if (lambda > 1) {
		const scale = Math.sqrt(lambda);
		rx *= scale;
		ry *= scale;
	}

	const sign = largeArcFlag !== sweepFlag ? 1 : -1;
	const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
	const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
	const coef = sign * Math.sqrt(Math.max(0, num / den));
	const cxp = (coef * (rx * y1p)) / ry;
	const cyp = (coef * -(ry * x1p)) / rx;

	const cx = cosPhi * cxp - sinPhi * cyp + (start.x + end.x) / 2;
	const cy = sinPhi * cxp + cosPhi * cyp + (start.y + end.y) / 2;

	const angle = (ux: number, uy: number, vx: number, vy: number): number => {
		const sign2 = ux * vy - uy * vx < 0 ? -1 : 1;
		const dot = Math.max(
			-1,
			Math.min(1, (ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy))),
		);
		return sign2 * Math.acos(dot);
	};

	const theta1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
	let deltaTheta = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
	if (!sweepFlag && deltaTheta > 0) {
		deltaTheta -= 2 * Math.PI;
	} else if (sweepFlag && deltaTheta < 0) {
		deltaTheta += 2 * Math.PI;
	}

	const steps = Math.max(2, Math.round(segments * (Math.abs(deltaTheta) / (Math.PI / 2))));
	for (let i = 1; i <= steps; i++) {
		const theta = theta1 + (deltaTheta * i) / steps;
		const x = cx + rx * Math.cos(theta) * cosPhi - ry * Math.sin(theta) * sinPhi;
		const y = cy + rx * Math.cos(theta) * sinPhi + ry * Math.sin(theta) * cosPhi;
		out.push({ x, y });
	}
}

/**
 * Flatten an SVG path `d` string into one or more closed polygon loops.
 *
 * @param d - The path `d` attribute string (absolute or relative commands).
 * @param curveSegments - Sample count per full curve (arcs scale down for
 *   short sweeps). Default 16, generous enough for shapes rendered at
 *   on-screen SmartArt sizes.
 */
export function flattenSvgPath(d: string, curveSegments = 16): Point2[][] {
	const tokens = tokenize(d);
	const loops: Point2[][] = [];
	let current: Point2[] = [];
	let cursor: Point2 = { x: 0, y: 0 };
	let subpathStart: Point2 = { x: 0, y: 0 };
	let lastControl: Point2 | undefined;
	let lastCommand = '';

	const closeLoop = (): void => {
		if (current.length > 0) {
			loops.push(current);
		}
		current = [];
	};

	for (const token of tokens) {
		const type = token.type;
		const upper = type.toUpperCase();
		const relative = type !== upper;
		const v = token.values;

		if (upper === 'M') {
			closeLoop();
			const x = relative ? cursor.x + v[0] : v[0];
			const y = relative ? cursor.y + v[1] : v[1];
			cursor = { x, y };
			subpathStart = cursor;
			current.push(cursor);
			// Extra coordinate pairs after the first M behave as implicit L.
			for (let i = 2; i + 1 < v.length; i += 2) {
				const lx = relative ? cursor.x + v[i] : v[i];
				const ly = relative ? cursor.y + v[i + 1] : v[i + 1];
				cursor = { x: lx, y: ly };
				current.push(cursor);
			}
		} else if (upper === 'L') {
			for (let i = 0; i + 1 < v.length; i += 2) {
				const x = relative ? cursor.x + v[i] : v[i];
				const y = relative ? cursor.y + v[i + 1] : v[i + 1];
				cursor = { x, y };
				current.push(cursor);
			}
		} else if (upper === 'H') {
			for (const value of v) {
				const x = relative ? cursor.x + value : value;
				cursor = { x, y: cursor.y };
				current.push(cursor);
			}
		} else if (upper === 'V') {
			for (const value of v) {
				const y = relative ? cursor.y + value : value;
				cursor = { x: cursor.x, y };
				current.push(cursor);
			}
		} else if (upper === 'C') {
			for (let i = 0; i + 5 < v.length; i += 6) {
				const p1 = relative
					? { x: cursor.x + v[i], y: cursor.y + v[i + 1] }
					: { x: v[i], y: v[i + 1] };
				const p2 = relative
					? { x: cursor.x + v[i + 2], y: cursor.y + v[i + 3] }
					: { x: v[i + 2], y: v[i + 3] };
				const p3 = relative
					? { x: cursor.x + v[i + 4], y: cursor.y + v[i + 5] }
					: { x: v[i + 4], y: v[i + 5] };
				sampleCubic(cursor, p1, p2, p3, curveSegments, current);
				cursor = p3;
				lastControl = p2;
			}
		} else if (upper === 'S') {
			for (let i = 0; i + 3 < v.length; i += 4) {
				const p1 =
					lastCommand === 'C' || lastCommand === 'S'
						? {
								x: 2 * cursor.x - (lastControl?.x ?? cursor.x),
								y: 2 * cursor.y - (lastControl?.y ?? cursor.y),
							}
						: cursor;
				const p2 = relative
					? { x: cursor.x + v[i], y: cursor.y + v[i + 1] }
					: { x: v[i], y: v[i + 1] };
				const p3 = relative
					? { x: cursor.x + v[i + 2], y: cursor.y + v[i + 3] }
					: { x: v[i + 2], y: v[i + 3] };
				sampleCubic(cursor, p1, p2, p3, curveSegments, current);
				cursor = p3;
				lastControl = p2;
			}
		} else if (upper === 'Q') {
			for (let i = 0; i + 3 < v.length; i += 4) {
				const p1 = relative
					? { x: cursor.x + v[i], y: cursor.y + v[i + 1] }
					: { x: v[i], y: v[i + 1] };
				const p2 = relative
					? { x: cursor.x + v[i + 2], y: cursor.y + v[i + 3] }
					: { x: v[i + 2], y: v[i + 3] };
				sampleQuadratic(cursor, p1, p2, curveSegments, current);
				cursor = p2;
				lastControl = p1;
			}
		} else if (upper === 'A') {
			for (let i = 0; i + 6 < v.length; i += 7) {
				const rx = v[i];
				const ry = v[i + 1];
				const rot = v[i + 2];
				const largeArc = v[i + 3] !== 0;
				const sweep = v[i + 4] !== 0;
				const end = relative
					? { x: cursor.x + v[i + 5], y: cursor.y + v[i + 6] }
					: { x: v[i + 5], y: v[i + 6] };
				sampleArc(cursor, rx, ry, rot, largeArc, sweep, end, curveSegments, current);
				cursor = end;
			}
		} else if (upper === 'Z') {
			cursor = subpathStart;
			current.push(cursor);
		}
		lastCommand = upper;
	}
	closeLoop();
	return loops;
}
