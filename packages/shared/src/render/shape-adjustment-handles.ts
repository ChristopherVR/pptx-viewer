/**
 * `shape-adjustment-handles`: PowerPoint's yellow `a:ahLst` handles, for every
 * preset, derived from the preset geometry the renderer already evaluates.
 *
 * ## Why derived rather than transcribed
 *
 * `a:ahLst` is the part of `presetShapeDefinitions.xml` this repository never
 * transcribed: `PresetShapeGeometryDefinition` carries `avLst` / `gdLst` /
 * `rect` / `pathLst` and nothing else. Hand-copying ~60 more `<ahXY>` blocks
 * would add a second, independent description of the same geometry, and the
 * two would drift the first time a preset's `gdLst` was corrected: the handle
 * would then point at a feature the renderer no longer draws.
 *
 * So the handle is measured off the geometry instead. For each `adjN` guide we
 * evaluate the preset twice, once at the current value and once a hair away,
 * and take the path vertex that moved most. That vertex IS the feature the
 * adjustment controls, which is exactly where PowerPoint puts the handle, and
 * the displacement per unit of guide value is the drag's own scale factor. A
 * preset therefore gains a correct handle the moment its geometry lands, with
 * no second table to update.
 *
 * ## Guide space, not a 0-1 fraction
 *
 * Adjustment values are OOXML guide units (`<a:gd name="adj" fmla="val 16667"/>`),
 * typically 0..50000 or 0..100000, and NEVER normalised. React once clamped
 * them with `Math.min(1, ...)`, which collapsed a 16667 corner radius to a
 * square corner. Every number in this module is guide-space; the only division
 * that happens is by the measured px-per-unit rate.
 *
 * ## Where the rest lives
 *
 * `shape-adjustment-probe` owns the measuring instruments (which guides are
 * ANGLES, what range each is pinned to, where the geometry moves) and
 * `shape-adjustment-solver` owns the pointer arithmetic a drag then runs. This
 * module is the derivation that joins them, and the three are split only for
 * the repo's 300-LOC file budget.
 *
 * @module render/shape-adjustment-handles
 */
import { evaluateGuides, lookupPresetShape, normalizeStShapeType } from 'pptx-viewer-core';
import type { PresetShapeGeometryDefinition } from 'pptx-viewer-core';

import { mergeCoincidentHandles } from './shape-adjustment-model';
import type { DerivedAdjustmentHandle } from './shape-adjustment-model';
import {
	adjustmentRange,
	angularAdjustmentKeys,
	coordinatesAt,
	dominantDisplacement,
} from './shape-adjustment-probe';

/** `avLst` keys that are adjustment HANDLES. `vf` / `hf` are shape factors. */
const ADJUSTMENT_KEY = /^adj\d*$/u;

// ---------------------------------------------------------------------------
// Public derivation
// ---------------------------------------------------------------------------

/**
 * The preset definition whose geometry a shape actually draws.
 *
 * Resolution order matters and is deliberately the RENDERER's, not the
 * writer's. `evaluatePresetShape` (which the shape cascade calls with the raw
 * `shapeType`) does an exact lookup first, and seven names in the table are not
 * `ST_ShapeType` values yet have their own entries: `cylinder`, `pentArrow`,
 * `flowChartStoredData`, `bentArrowCallout`, `bentUpArrowCallout`,
 * `diamondTabs`, `mathFunction`. Normalising FIRST would fold `cylinder` onto
 * `can` and measure the handle off a geometry the canvas is not painting, so
 * the exact hit wins and `normalizeStShapeType` is only the fallback (which is
 * what catches `oval` -> `ellipse`, `rtArrow` -> `rightArrow`, and a deck's
 * casing).
 *
 * Nothing here writes `a:prstGeom/@prst`: a drag writes `a:gd` values into
 * `shapeAdjustments`, so the non-spec names cannot reach a saved package
 * through this path. Authoring still goes through `normalizePresetGeometry`.
 */
function resolveHandlePreset(presetName: string | undefined) {
	if (!presetName) {
		return undefined;
	}
	return lookupPresetShape(presetName) ?? lookupPresetShape(normalizeStShapeType(presetName) ?? '');
}

/** Presets whose `adj` PowerPoint exposes no handle for. */
function presetHasHandles(preset: string): boolean {
	// Action buttons adjust only their bevel depth and PowerPoint offers no
	// handle for it; bent/curved connectors are routed by `connector-geometry`,
	// not by this preset table, so a handle derived here would sit off the line.
	return !preset.startsWith('actionButton') && !preset.toLowerCase().includes('connector');
}

/** Cache key for {@link derivePresetAdjustmentHandles}. */
function cacheKey(
	preset: string,
	width: number,
	height: number,
	adjustments: Record<string, number>,
): string {
	const entries = Object.keys(adjustments)
		.sort()
		.map((key) => `${key}=${adjustments[key]}`)
		.join(',');
	return `${preset}|${Math.round(width * 100)}|${Math.round(height * 100)}|${entries}`;
}

/** Bounded memo: the descriptor is recomputed on every render of a selection. */
const handleCache = new Map<string, DerivedAdjustmentHandle[]>();
const HANDLE_CACHE_LIMIT = 96;

/**
 * The adjust handles for a preset at the given box and adjustment values, in
 * `avLst` declaration order (`adj`/`adj1` first, as PowerPoint lists them).
 *
 * Returns an empty array for a preset with no adjustable parameter, and skips
 * any single key whose value moves no vertex at all.
 */
export function derivePresetAdjustmentHandles(
	presetName: string | undefined,
	width: number,
	height: number,
	adjustments: Record<string, number> = {},
): DerivedAdjustmentHandle[] {
	const def = resolveHandlePreset(presetName);
	if (!def?.avLst || !presetHasHandles(def.name)) {
		return [];
	}
	// Probe under the definition's OWN name, so the handles are measured off the
	// exact geometry the renderer paints.
	const preset = def.name;
	const keys = Object.keys(def.avLst).filter((key) => ADJUSTMENT_KEY.test(key));
	if (keys.length === 0) {
		return [];
	}
	const w = Number.isFinite(width) && width > 0 ? width : 0;
	const h = Number.isFinite(height) && height > 0 ? height : 0;
	if (w <= 0 || h <= 0) {
		return [];
	}

	const key = cacheKey(preset, w, h, adjustments);
	const cached = handleCache.get(key);
	if (cached) {
		return cached;
	}

	const handles = computeHandles(def, preset, w, h, adjustments, keys);
	if (handleCache.size >= HANDLE_CACHE_LIMIT) {
		handleCache.clear();
	}
	handleCache.set(key, handles);
	return handles;
}

function computeHandles(
	def: PresetShapeGeometryDefinition,
	preset: string,
	w: number,
	h: number,
	adjustments: Record<string, number>,
	keys: string[],
): DerivedAdjustmentHandle[] {
	const base = coordinatesAt(preset, w, h, adjustments);
	if (!base) {
		return [];
	}
	const angular = angularAdjustmentKeys(def);
	const seed = new Map<string, number>();
	for (const [name, value] of Object.entries({ ...def.avLst, ...adjustments })) {
		if (Number.isFinite(value)) {
			seed.set(name, value);
		}
	}
	const vars = evaluateGuides(
		(def.gdLst ?? []).map((guide) => ({ name: guide.name, formula: guide.formula })),
		{ w, h },
		seed,
	);

	const handles: DerivedAdjustmentHandle[] = [];
	for (const key of keys) {
		const isAngular = angular.has(key);
		const value = seed.get(key) ?? 0;
		const { min, max } = adjustmentRange(def, key, vars, isAngular);
		// A hair of the range, signed away from whichever bound the value sits on
		// so the probe never lands outside the preset's own `pin` clamp (which
		// would flatten the displacement to zero and lose the handle).
		const span = Math.max(Math.abs(max - min), 1);
		const magnitude = Math.max(span * 1e-4, 1e-3);
		const step = value + magnitude > max ? -magnitude : magnitude;
		const probe = coordinatesAt(preset, w, h, { ...adjustments, [key]: value + step });
		if (!probe) {
			continue;
		}
		const moved = dominantDisplacement(base, probe);
		if (!moved) {
			continue;
		}
		const anchorX = base[moved.index * 2];
		const anchorY = base[moved.index * 2 + 1];
		const dirX = moved.dx / step;
		const dirY = moved.dy / step;
		handles.push({
			key,
			x: anchorX,
			y: anchorY,
			value,
			cursor: isAngular
				? 'crosshair'
				: Math.abs(dirX) >= Math.abs(dirY)
					? 'ew-resize'
					: 'ns-resize',
			solvers: [
				{
					key,
					solver: {
						kind: isAngular ? 'angular' : 'linear',
						anchorX,
						anchorY,
						dirX,
						dirY,
						centerX: w / 2,
						centerY: h / 2,
						startValue: value,
						min,
						max,
					},
				},
			],
		});
	}
	return mergeCoincidentHandles(handles);
}
