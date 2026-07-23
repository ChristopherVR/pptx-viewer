/**
 * Spec-correct ECMA-376 preset shape evaluator.
 *
 * Looks up a `PresetShapeGeometryDefinition` from the table, evaluates every
 * `gdLst` formula against a built-in variable context (seeded with width /
 * height + the standard implicit guides) and the parsed `shapeAdjustments`,
 * then walks the `pathLst` and emits an SVG path data string. Path commands
 * use the same arc conversion as `custom-geometry.ts` (`ooxmlArcToSvg`) so the
 * output is byte-compatible with the existing custom-geometry pipeline.
 */

import { evaluateGuides } from './guide-formula-api';
import { evaluateFormula, parseFormula, resolveOperand } from './guide-formula-eval';
import { ooxmlArcToSvg } from './guide-formula-paths';
import type { PresetShapeGeometryDefinition } from './preset-shape-definitions-table';
import { PRESET_SHAPE_GEOMETRY_TABLE } from './preset-shape-definitions-table';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * One evaluated sub-path of a preset shape: its own SVG `d` string plus the
 * `@fill`/`@stroke` flags declared on the `<a:path>`. Lets a renderer honour
 * open, stroke-only presets (e.g. `arc`) instead of flood-filling them.
 */
export interface PresetSubpathResult {
	/** SVG path data for this single sub-path. */
	d: string;
	/** `<a:path>/@fill` (`'none' | 'norm' | ...`); `undefined` means default. */
	fill?: string;
	/** `<a:path>/@stroke`; `undefined`/`true` means stroked, `false` unstroked. */
	stroke?: boolean;
}

/**
 * Result of evaluating a preset shape: the merged SVG path data and an
 * optional text rectangle (in the shape's coordinate space, i.e. pixels).
 */
export interface PresetShapeEvaluationResult {
	svgPath: string;
	textRect?: { l: number; t: number; r: number; b: number };
	/**
	 * Per-sub-path geometry with fill/stroke flags. `svgPath` is these `d`
	 * strings concatenated; this array additionally preserves the paint intent.
	 */
	paths: PresetSubpathResult[];
	/**
	 * `true` when *every* sub-path declares `fill="none"` (an open, stroke-only
	 * geometry such as `arc`). Renderers should suppress the shape fill in this
	 * case rather than painting a filled wedge.
	 */
	fillNone: boolean;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Resolve a single guide token (numeric literal or guide name) plus
 * arithmetic-style suffixes the spec sometimes emits inline (rare in
 * `pathLst` coordinates but tolerated here for safety).
 */
function resolveToken(token: string, vars: Map<string, number>): number {
	const trimmed = token.trim();
	if (trimmed === '') {
		return 0;
	}
	// Numeric literal first
	const num = Number(trimmed);
	if (Number.isFinite(num)) {
		return num;
	}
	return resolveOperand(trimmed, vars);
}

/**
 * Build the initial guide context used to evaluate a preset shape's
 * `gdLst`. Seeds:
 *  - width / height (`w`, `h`)
 *  - standard position guides (`l`, `t`, `r`, `b`, `hc`, `vc`, `wd2`, `hd2`)
 *  - short-side guides (`ss`, `ssd2`, `ssd4`, `ssd6`, `ssd8`, `ssd16`, `ssd32`)
 *    plus the rest of the divisor family handled by `createBuiltinVariables`.
 *  - the preset's `avLst` defaults, then any `adjustments` overrides.
 */
function buildAdjustmentMap(
	def: PresetShapeGeometryDefinition,
	adjustments?: Record<string, number>,
): Map<string, number> {
	const adj = new Map<string, number>();
	if (def.avLst) {
		for (const [name, value] of Object.entries(def.avLst)) {
			adj.set(name, value);
		}
	}
	if (adjustments) {
		for (const [name, value] of Object.entries(adjustments)) {
			if (Number.isFinite(value)) {
				adj.set(name, value);
			}
		}
	}
	return adj;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Look up a preset shape definition. Performs a case-sensitive lookup first,
 * then falls back to a small lower-case index so `roundrect` (a common typo
 * casing) still resolves to `roundRect`.
 */
export function lookupPresetShape(name: string): PresetShapeGeometryDefinition | undefined {
	if (!name) {
		return undefined;
	}
	const direct = PRESET_SHAPE_GEOMETRY_TABLE[name];
	if (direct) {
		return direct;
	}
	const lower = name.toLowerCase();
	for (const key of Object.keys(PRESET_SHAPE_GEOMETRY_TABLE)) {
		if (key.toLowerCase() === lower) {
			return PRESET_SHAPE_GEOMETRY_TABLE[key];
		}
	}
	return undefined;
}

/**
 * Evaluate an ECMA-376 preset geometry against the given dimensions and
 * (optional) adjustment overrides. Returns `undefined` when the shape is not
 * present in the populated table so callers can fall back to the legacy
 * polygon-based clip-path data.
 *
 * Behaviour:
 *  1. Resolve the definition from `PRESET_SHAPE_GEOMETRY_TABLE`.
 *  2. Build an adjustment map from `def.avLst` overlaid with `adjustments`.
 *  3. Evaluate `def.gdLst` in order (each guide may reference earlier guides
 *     and any built-in / adjustment variable).
 *  4. Walk every path in `def.pathLst`, converting each command into SVG
 *     path data. Multiple paths are concatenated separated by spaces; every
 *     `arcTo` is routed through `ooxmlArcToSvg` for byte-identical output
 *     with `custom-geometry.ts`.
 *  5. Resolve the optional `rect` reference into pixel coordinates.
 */
export function evaluatePresetShape(
	name: string,
	width: number,
	height: number,
	adjustments?: Record<string, number>,
): PresetShapeEvaluationResult | undefined {
	const def = lookupPresetShape(name);
	if (!def) {
		return undefined;
	}

	// Defensive: clamp size to non-negative finite numbers. Zero-size shapes
	// must not crash; they emit a degenerate but valid path string.
	const w = Number.isFinite(width) && width > 0 ? width : 0;
	const h = Number.isFinite(height) && height > 0 ? height : 0;

	const adj = buildAdjustmentMap(def, adjustments);
	const guides = (def.gdLst ?? []).map((g) => ({ name: g.name, formula: g.formula }));
	const vars = evaluateGuides(guides, { w, h }, adj);

	const paths: PresetSubpathResult[] = [];
	for (const path of def.pathLst) {
		const parts: string[] = [];
		// Track pen position so arcTo conversion can derive the implicit
		// ellipse centre in the same way custom-geometry.ts does.
		let penX = 0;
		let penY = 0;
		let moveX = 0;
		let moveY = 0;

		for (const cmd of path.commands) {
			switch (cmd.kind) {
				case 'moveTo': {
					const x = resolveToken(cmd.x, vars);
					const y = resolveToken(cmd.y, vars);
					parts.push(`M ${x} ${y}`);
					penX = x;
					penY = y;
					moveX = x;
					moveY = y;
					break;
				}
				case 'lnTo': {
					const x = resolveToken(cmd.x, vars);
					const y = resolveToken(cmd.y, vars);
					parts.push(`L ${x} ${y}`);
					penX = x;
					penY = y;
					break;
				}
				case 'quadBezTo': {
					const x1 = resolveToken(cmd.x1, vars);
					const y1 = resolveToken(cmd.y1, vars);
					const x2 = resolveToken(cmd.x2, vars);
					const y2 = resolveToken(cmd.y2, vars);
					parts.push(`Q ${x1} ${y1} ${x2} ${y2}`);
					penX = x2;
					penY = y2;
					break;
				}
				case 'cubicBezTo': {
					const x1 = resolveToken(cmd.x1, vars);
					const y1 = resolveToken(cmd.y1, vars);
					const x2 = resolveToken(cmd.x2, vars);
					const y2 = resolveToken(cmd.y2, vars);
					const x3 = resolveToken(cmd.x3, vars);
					const y3 = resolveToken(cmd.y3, vars);
					parts.push(`C ${x1} ${y1} ${x2} ${y2} ${x3} ${y3}`);
					penX = x3;
					penY = y3;
					break;
				}
				case 'arcTo': {
					const wR = resolveToken(cmd.wR, vars);
					const hR = resolveToken(cmd.hR, vars);
					const stAng = resolveToken(cmd.stAng, vars);
					const swAng = resolveToken(cmd.swAng, vars);
					const result = ooxmlArcToSvg(wR, hR, stAng, swAng, penX, penY);
					if (result) {
						parts.push(result.svg);
						penX = result.endX;
						penY = result.endY;
					}
					break;
				}
				case 'close': {
					parts.push('Z');
					penX = moveX;
					penY = moveY;
					break;
				}
			}
		}

		paths.push({ d: parts.join(' ').trim(), fill: path.fill, stroke: path.stroke });
	}

	const svgPath = paths
		.map((p) => p.d)
		.filter((d) => d !== '')
		.join(' ')
		.trim();
	// Only treat the geometry as stroke-only when it has paths and they *all*
	// opt out of fill; a mixed shape keeps its fill.
	const fillNone = paths.length > 0 && paths.every((p) => p.fill === 'none');

	let textRect: PresetShapeEvaluationResult['textRect'];
	if (def.rect) {
		// rect tokens may themselves be inline formula strings (rare) or guide
		// references — handle both via parseFormula → evaluateFormula when the
		// string contains whitespace, otherwise resolveToken.
		const resolveRectToken = (token: string): number => {
			if (token.includes(' ')) {
				return evaluateFormula(parseFormula(token), vars);
			}
			return resolveToken(token, vars);
		};
		textRect = {
			l: resolveRectToken(def.rect.l),
			t: resolveRectToken(def.rect.t),
			r: resolveRectToken(def.rect.r),
			b: resolveRectToken(def.rect.b),
		};
	}

	return { svgPath, textRect, paths, fillNone };
}
