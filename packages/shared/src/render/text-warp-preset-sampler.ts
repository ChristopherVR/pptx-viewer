/**
 * Samples the spec-transcribed `prstTxWarp` top/bottom paths in
 * `text-warp-preset-definitions.ts` at a normalised horizontal position,
 * using `pptx-viewer-core`'s OOXML guide-formula evaluator so the same
 * arithmetic, clamping (`pin`), and conditional operators the spec defines
 * resolve `adj`-dependent guides exactly as PowerPoint's own preset-shape
 * geometry does.
 *
 * The box is normalised to `w = h = 100000` (matching the 0..100000 scale
 * `adj`/`adj2` are already stored in, see `PptxHandlerRuntimeShapeBodyParsing`
 * parsing `textWarpAdj` as the raw unscaled `val`), so every resolved guide
 * value is already a fraction of `h` in `0..100000` and only needs dividing
 * by 100000 to become the `0..1` fraction `envelopeCurveAt` returns.
 */
import { evaluateGuides } from 'pptx-viewer-core';

import type { WarpCurveSegment } from './text-warp-preset-definitions';
import { WARP_PRESET_DEFINITIONS } from './text-warp-preset-definitions';

/** OOXML angles are stored in 60,000ths of a degree. */
function angleToRadians(ooxmlAngle: number): number {
	return (ooxmlAngle / 60000) * (Math.PI / 180);
}

const BOX = 100000;

function sampleLine(y0: number, y1: number, u: number): number {
	return y0 + (y1 - y0) * u;
}

function sampleQuad(y0: number, yc: number, y1: number, u: number): number {
	// x(t) = w*t exactly here because the control point's x is always the
	// midpoint `hc`, so t == u; see the module doc in
	// text-warp-preset-definitions.ts for the derivation.
	const mt = 1 - u;
	return mt * mt * y0 + 2 * mt * u * yc + u * u * y1;
}

function sampleCubic(y0: number, yc1: number, yc2: number, y1: number, u: number): number {
	// x(t) == w*t exactly here too: the control points sit at the evenly
	// spaced x = w/3 and x = 2w/3 (`x0`/`x1` in the spec), which makes the
	// cubic's x-component reduce algebraically to a linear function of t.
	const mt = 1 - u;
	return mt * mt * mt * y0 + 3 * mt * mt * u * yc1 + 3 * mt * u * u * yc2 + u * u * u * y1;
}

/**
 * Sample an elliptical `arcTo` segment at normalised horizontal position `u`.
 *
 * The OOXML `arcTo` command draws an ellipse of radii `(wR, hR)` centred so
 * the current pen position `(penX, penY)` lies on it at angle `stAng`,
 * sweeping `swAng`. Solve for the traversal distance `d` (`0..|swAng|`) along
 * that sweep whose `x` matches `u * w`: writing the sweep as
 * `angle = stAng + sign(swAng) * d`, the identity
 * `cos(angle) = cos(stAng)*cos(d) - sign(swAng)*sin(stAng)*sin(d)` is a unit
 * rotation of `d` (`A = cos(stAng)`, `B = -sign(swAng)*sin(stAng)`,
 * `A^2+B^2=1`), so it solves in closed form as `d = phi -+ acos(cosVal)` for
 * `phi = atan2(B, A)`, picking whichever root lands in `[0, |swAng|]`.
 *
 * A plain "is the angle inside `[stAng, stAng+swAng]`" range check (tried
 * first, 2026-09-06) is NOT equivalent: `textCanUp` and `textCanDown` both
 * sweep exactly `π` from `stAng = cd2 = π`, just in opposite directions, so
 * their swept angle sets both normalise to the same `[0, π]` interval and a
 * range check cannot tell them apart - it silently picked the same branch for
 * both, making `textCanUp` arch the wrong way (verified against a PowerPoint
 * COM screenshot; see `text-warp-preset-sampler.test.ts`).
 */
function sampleArc(
	penX: number,
	penY: number,
	wR: number,
	hR: number,
	stAngDeg: number,
	swAngDeg: number,
	u: number,
): number {
	if (wR === 0 || hR === 0) {
		return penY;
	}
	const stAng = angleToRadians(stAngDeg);
	const swAng = angleToRadians(swAngDeg);
	const cx = penX - wR * Math.cos(stAng);
	const cy = penY - hR * Math.sin(stAng);
	const targetX = u * BOX;
	const cosVal = Math.max(-1, Math.min(1, (targetX - cx) / wR));

	const sign = swAng < 0 ? -1 : 1;
	const maxD = Math.abs(swAng);
	const A = Math.cos(stAng);
	const B = -sign * Math.sin(stAng);
	const phi = Math.atan2(B, A);
	const acosVal = Math.acos(cosVal); // in [0, pi]

	const twoPi = Math.PI * 2;
	// Normalise a candidate `d` into whichever representative (mod 2*pi, or
	// its `- 2*pi` twin) falls inside the valid `[0, maxD]` traversal range.
	const fitToRange = (raw: number): number | undefined => {
		let wrapped = raw % twoPi;
		if (wrapped < 0) {
			wrapped += twoPi;
		}
		if (wrapped <= maxD + 1e-6) {
			return wrapped;
		}
		const alt = wrapped - twoPi;
		if (alt >= -1e-6 && alt <= maxD + 1e-6) {
			return alt;
		}
		return undefined;
	};

	const d =
		fitToRange(phi - acosVal) ?? fitToRange(phi + acosVal) ?? Math.max(0, Math.min(maxD, phi));
	const angle = stAng + sign * d;
	return cy + hR * Math.sin(angle);
}

function sampleSegment(seg: WarpCurveSegment, u: number, vars: Map<string, number>): number {
	const g = (name: string): number => vars.get(name) ?? 0;
	switch (seg.type) {
		case 'line':
			return sampleLine(g(seg.startY), g(seg.endY), u);
		case 'quad':
			return sampleQuad(g(seg.startY), g(seg.ctrlY), g(seg.endY), u);
		case 'cubic':
			return sampleCubic(g(seg.startY), g(seg.ctrl1Y), g(seg.ctrl2Y), g(seg.endY), u);
		case 'arc':
			return sampleArc(
				g(seg.penX),
				g(seg.penY),
				g(seg.wR),
				g(seg.hR),
				g(seg.stAng),
				g(seg.swAng),
				u,
			);
		default:
			return 0;
	}
}

/** Top/bottom envelope fractions (0..1 of box height) at horizontal position `u`. */
export interface SampledWarpCurve {
	top: number;
	bottom: number;
}

/**
 * Sample the spec-transcribed top/bottom curve for `preset` at normalised
 * horizontal position `u` (0 = left edge, 1 = right edge). Returns
 * `undefined` when `preset` has no transcribed definition (the caller should
 * fall back to a reconstruction in that case).
 */
export function sampleWarpPresetCurve(
	preset: string,
	u: number,
	adj: number | undefined,
	adj2: number | undefined,
): SampledWarpCurve | undefined {
	const def = WARP_PRESET_DEFINITIONS[preset];
	if (!def) {
		return undefined;
	}
	const adjustments = new Map<string, number>([
		['adj', adj ?? def.defaultAdj],
		['adj2', adj2 ?? 0],
	]);
	const vars = evaluateGuides([...def.gdLst], { w: BOX, h: BOX }, adjustments);
	const clampedU = Math.max(0, Math.min(1, u));
	return {
		top: sampleSegment(def.top, clampedU, vars) / BOX,
		bottom: sampleSegment(def.bottom, clampedU, vars) / BOX,
	};
}

/** Preset names with a spec-transcribed definition (exported for tests/tooling). */
export function hasWarpPresetDefinition(preset: string): boolean {
	return preset in WARP_PRESET_DEFINITIONS;
}
