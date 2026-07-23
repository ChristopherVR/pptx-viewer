/**
 * `animation-motion-path`: parse an OOXML `p:animMotion/@path` string into a
 * dense list of waypoints (percentages of the element box) suitable for driving
 * a CSS `@keyframes translate()` animation.
 *
 * Unlike a naive parser that treats cubic-bezier `C` control points as literal
 * waypoints (which produces a jagged polyline through the control handles), this
 * module samples each `C` segment along the real bezier curve so the motion
 * stays smooth. `M`/`L` segments contribute their endpoints unchanged, and both
 * absolute (upper-case) and relative (lower-case) commands are supported.
 *
 * @module render/animation-motion-path
 */

/** A single sampled point on a motion path, in element-box percentage units. */
export interface MotionPoint {
	x: number;
	y: number;
}

/**
 * Number of intermediate samples taken along each cubic-bezier `C` segment.
 * Eight sub-steps keeps curves visibly smooth without bloating the generated
 * `@keyframes` block.
 */
const BEZIER_SAMPLES = 8;

/** Evaluate one axis of a cubic bezier at parameter `t` (0..1). */
function cubicAt(p0: number, c1: number, c2: number, p3: number, t: number): number {
	const mt = 1 - t;
	return mt * mt * mt * p0 + 3 * mt * mt * t * c1 + 3 * mt * t * t * c2 + t * t * t * p3;
}

/** Whether every token consumed for a command produced a finite number. */
function allFinite(values: number[]): boolean {
	return values.every((v) => Number.isFinite(v));
}

/**
 * Parse a motion-path `d`-style string into dense waypoints scaled to element
 * box percentages (path coordinate `1.0` maps to `100%`). Cubic-bezier `C`
 * segments are sampled along the true curve rather than through their control
 * points. Returns an empty array for an unparseable path.
 */
export function parseMotionPathPoints(motionPath: string): MotionPoint[] {
	const tokens = motionPath.match(/[MLCZmlcz]|-?\d*\.?\d+(?:[eE][-+]?\d+)?/gu);
	if (!tokens) {
		return [];
	}

	const points: MotionPoint[] = [];
	let curX = 0;
	let curY = 0;
	let startX = 0;
	let startY = 0;
	let i = 0;
	let cmd = '';

	const nextNum = (): number => Number(tokens[i++]);
	const push = (x: number, y: number): void => {
		points.push({ x: x * 100, y: y * 100 });
	};

	while (i < tokens.length) {
		const tok = tokens[i];
		if (/^[MLCZmlcz]$/u.test(tok)) {
			cmd = tok;
			i++;
			if (cmd === 'Z' || cmd === 'z') {
				curX = startX;
				curY = startY;
			}
			continue;
		}

		const rel = cmd === cmd.toLowerCase();
		const upper = cmd.toUpperCase();

		if (upper === 'M' || upper === 'L') {
			let x = nextNum();
			let y = nextNum();
			if (!allFinite([x, y])) {
				break;
			}
			if (rel) {
				x += curX;
				y += curY;
			}
			curX = x;
			curY = y;
			if (upper === 'M') {
				startX = x;
				startY = y;
				// A subsequent coordinate pair after an `M` is an implicit lineto.
				cmd = rel ? 'l' : 'L';
			}
			push(x, y);
		} else if (upper === 'C') {
			let c1x = nextNum();
			let c1y = nextNum();
			let c2x = nextNum();
			let c2y = nextNum();
			let ex = nextNum();
			let ey = nextNum();
			if (!allFinite([c1x, c1y, c2x, c2y, ex, ey])) {
				break;
			}
			if (rel) {
				c1x += curX;
				c1y += curY;
				c2x += curX;
				c2y += curY;
				ex += curX;
				ey += curY;
			}
			for (let s = 1; s <= BEZIER_SAMPLES; s++) {
				const t = s / BEZIER_SAMPLES;
				push(cubicAt(curX, c1x, c2x, ex, t), cubicAt(curY, c1y, c2y, ey, t));
			}
			curX = ex;
			curY = ey;
		} else {
			// Unrecognised token: advance to avoid an infinite loop.
			i++;
		}
	}

	return points;
}
