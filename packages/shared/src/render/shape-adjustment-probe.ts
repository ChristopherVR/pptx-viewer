/**
 * `shape-adjustment-probe`: the measuring instruments behind the derived
 * `a:ahLst` adjust handles.
 *
 * Split out of `shape-adjustment-handles` (which owns the public descriptors
 * and the drag solve) purely for the repo's 300-LOC file budget. Everything
 * here is introspection over a `PresetShapeGeometryDefinition`: which of its
 * `adj` guides are ANGLES, what range each is pinned to, and where its geometry
 * actually moves when one is nudged.
 *
 * None of it reads `def.rect`: the preset table's text rectangles are known to
 * disagree with PowerPoint for 117 of the 194 entries, and a handle measured
 * off one would inherit that error. Handles are measured off `pathLst`, the
 * same command stream the renderer paints.
 *
 * @module render/shape-adjustment-probe
 */
import { evaluatePresetShape } from 'pptx-viewer-core';
import type { PresetShapeGeometryDefinition } from 'pptx-viewer-core';

/** OOXML angle unit: 60000ths of a degree. A full turn is 21,600,000. */
export const ANGLE_UNITS_PER_TURN = 21600000;
export const ANGLE_UNITS_PER_RADIAN = ANGLE_UNITS_PER_TURN / (2 * Math.PI);

/** Fallback clamp for an adjustment no `pin` guide bounds. */
const UNBOUNDED_CARTESIAN = 1000000;

/** The operator token of a guide formula (`'pin 0 adj 50000'` -> `'pin'`). */
function formulaOperator(formula: string): string {
	return formula.trim().split(/\s+/u)[0] ?? '';
}

/**
 * The `adj` keys that reach an ANGLE operand, transitively.
 *
 * `pie`, `arc`, `chord`, `blockArc` and the circular arrows adjust an angle in
 * 60000ths of a degree, so a linear projection of the pointer would be wrong
 * over anything but a tiny drag. Which keys those are is read off the data
 * rather than listed: a key is angular when it reaches an `arcTo` start/sweep
 * angle, or the angle operand (argument 1) of `cos` / `sin` / `tan`.
 * `blockArc`'s `adj3` also reaches `cos`, but as argument 0 (a radius), so it
 * correctly stays cartesian.
 */
export function angularAdjustmentKeys(def: PresetShapeGeometryDefinition): Set<string> {
	const deps = new Map<string, Set<string>>();
	const angular = new Set<string>();
	const adjustmentKeys = new Set(Object.keys(def.avLst ?? {}));

	const depsOfToken = (token: string): Set<string> =>
		adjustmentKeys.has(token) ? new Set([token]) : (deps.get(token) ?? new Set<string>());

	for (const guide of def.gdLst ?? []) {
		const own = new Set<string>();
		for (const arg of guide.args) {
			for (const key of depsOfToken(arg)) {
				own.add(key);
			}
		}
		deps.set(guide.name, own);
		const op = formulaOperator(guide.formula);
		// `cos x y` = x * cos(y): argument 1 is the angle, argument 0 a radius.
		if ((op === 'cos' || op === 'sin' || op === 'tan') && guide.args[1] !== undefined) {
			for (const key of depsOfToken(guide.args[1])) {
				angular.add(key);
			}
		}
	}

	for (const path of def.pathLst) {
		for (const cmd of path.commands) {
			if (cmd.kind !== 'arcTo') {
				continue;
			}
			for (const token of [cmd.stAng, cmd.swAng]) {
				for (const key of depsOfToken(token)) {
					angular.add(key);
				}
			}
		}
	}

	return angular;
}

/**
 * The `[min, max]` an adjustment is clamped to, read off the preset's own
 * `pin <lo> <key> <hi>` guide - the same pair `<ahXY minX maxX>` repeats.
 * `chevron`'s upper bound is the guide `maxAdj`, so the bound is resolved
 * against the evaluated variable map rather than assumed numeric.
 */
export function adjustmentRange(
	def: PresetShapeGeometryDefinition,
	key: string,
	vars: Map<string, number>,
	isAngular: boolean,
): { min: number; max: number } {
	const resolve = (token: string | undefined, fallback: number): number => {
		if (token === undefined) {
			return fallback;
		}
		const literal = Number(token);
		if (Number.isFinite(literal)) {
			return literal;
		}
		const resolved = vars.get(token);
		return resolved !== undefined && Number.isFinite(resolved) ? resolved : fallback;
	};

	for (const guide of def.gdLst ?? []) {
		if (formulaOperator(guide.formula) !== 'pin' || guide.args[1] !== key) {
			continue;
		}
		const min = resolve(guide.args[0], 0);
		const max = resolve(guide.args[2], UNBOUNDED_CARTESIAN);
		return max >= min ? { min, max } : { min: max, max: min };
	}
	return isAngular
		? { min: 0, max: ANGLE_UNITS_PER_TURN }
		: { min: -UNBOUNDED_CARTESIAN, max: UNBOUNDED_CARTESIAN };
}

/** How many scalars each SVG path command consumes, and where its point sits. */
const COMMAND_ARITY: Record<string, { take: number; points: number[] }> = {
	M: { take: 2, points: [0] },
	L: { take: 2, points: [0] },
	Q: { take: 4, points: [0, 2] },
	C: { take: 6, points: [0, 2, 4] },
	// `A rx ry rot largeArc sweep x y`: only the last pair is a coordinate.
	A: { take: 7, points: [5] },
};

/**
 * Every coordinate pair in an evaluated preset's path data, in order.
 *
 * The `d` strings come from this repo's own emitter, so the grammar is known
 * and {@link COMMAND_ARITY} is enough to walk it. The number alternative is
 * FIRST in the tokeniser so an exponent-form coordinate (`1e-7`) is consumed
 * whole rather than split at its `e` and mistaken for a command letter.
 */
export function pathCoordinates(paths: ReadonlyArray<{ d: string }>): number[] {
	const out: number[] = [];
	for (const path of paths) {
		const tokens = path.d.match(/-?\d*\.?\d+(?:e[-+]?\d+)?|[A-Za-z]/gu) ?? [];
		let command = '';
		let i = 0;
		while (i < tokens.length) {
			if (/^[A-Za-z]$/u.test(tokens[i])) {
				command = tokens[i];
				i += 1;
				continue;
			}
			const arity = COMMAND_ARITY[command];
			if (!arity) {
				i += 1;
				continue;
			}
			const values = tokens.slice(i, i + arity.take).map(Number);
			i += arity.take;
			for (const offset of arity.points) {
				out.push(values[offset], values[offset + 1]);
			}
		}
	}
	return out;
}

/** Evaluated path coordinates for `preset` at a given adjustment map. */
export function coordinatesAt(
	preset: string,
	width: number,
	height: number,
	adjustments: Record<string, number>,
): number[] | null {
	const result = evaluatePresetShape(preset, width, height, adjustments);
	return result ? pathCoordinates(result.paths) : null;
}

/** One vertex's movement between two evaluations of the same preset. */
export interface VertexDisplacement {
	index: number;
	dx: number;
	dy: number;
}

/**
 * The vertex that moves most between two evaluations, and by how much.
 *
 * An adjustment usually moves several vertices by exactly the same amount (a
 * `roundRect`'s corner radius moves all eight arc ends; `plus` moves all
 * twelve). PowerPoint always puts the handle on the topmost, then leftmost, of
 * those, so ties are broken that way rather than by path order: `roundRect`'s
 * path begins at `(l, x1)`, and taking that would have given a handle that
 * slides DOWN the left edge instead of along the top edge as
 * `<ahXY gdRefX="adj"><pos x="x1" y="t"/></ahXY>` specifies.
 */
export function dominantDisplacement(base: number[], probe: number[]): VertexDisplacement | null {
	const pairs = Math.floor(Math.min(base.length, probe.length) / 2);
	let best: VertexDisplacement | null = null;
	let bestDistance = 0;
	for (let i = 0; i < pairs; i++) {
		const dx = probe[i * 2] - base[i * 2];
		const dy = probe[i * 2 + 1] - base[i * 2 + 1];
		const distance = Math.hypot(dx, dy);
		if (distance > bestDistance * (1 + 1e-9)) {
			bestDistance = distance;
			best = { index: i, dx, dy };
			continue;
		}
		if (best === null || distance < bestDistance * (1 - 1e-9)) {
			continue;
		}
		// Tie: prefer the topmost vertex, then the leftmost.
		const y = base[i * 2 + 1];
		const bestY = base[best.index * 2 + 1];
		if (y < bestY - 1e-9 || (Math.abs(y - bestY) <= 1e-9 && base[i * 2] < base[best.index * 2])) {
			best = { index: i, dx, dy };
		}
	}
	return bestDistance > 0 ? best : null;
}
