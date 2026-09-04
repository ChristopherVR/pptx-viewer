/**
 * Public accessor for preset connection sites (`a:prstGeom/a:cxnLst`,
 * ECMA-376 `presetShapeDefinitions.xml`), aggregating the per-family tables.
 *
 * Consumed by `packages/shared/src/render/connector-sites.ts` so a
 * `stCxn`/`endCxn/@idx` on a preset shape (not just an authored
 * `a:custGeom/a:cxnLst`) resolves to the real ECMA site instead of always
 * falling back to the 4 cardinal edge midpoints.
 *
 * @module render/preset-connection-sites-table
 */
import { evaluateGuides } from './guide-formula-api';
import { resolveOperand } from './guide-formula-eval';
import { ARROW_CONNECTION_SITES } from './preset-connection-sites-arrows';
import { FLOWCHART_CONNECTION_SITES } from './preset-connection-sites-flowchart';
import { POLYGON_CONNECTION_SITES } from './preset-connection-sites-polygons';
import { QUAD_CONNECTION_SITES } from './preset-connection-sites-quads';
import type { PresetConnectionSiteDefinition } from './preset-connection-sites-types';
import { normalizeStShapeType } from './preset-geometry-names';

/** Every preset this repo carries an ECMA `cxnLst` transcription for. */
const PRESET_CONNECTION_SITES: Record<string, PresetConnectionSiteDefinition> = {
	...QUAD_CONNECTION_SITES,
	...POLYGON_CONNECTION_SITES,
	...ARROW_CONNECTION_SITES,
	...FLOWCHART_CONNECTION_SITES,
};

/** A preset connection site evaluated to pixel coordinates in the shape's own box. */
export interface EvaluatedPresetConnectionSite {
	x: number;
	y: number;
}

/**
 * Look up a preset's `cxnLst` definition, exact name first, then normalised
 * (`oval` -> `ellipse`, `rtArrow` -> `rightArrow`, a deck's own casing) -
 * mirrors `lookupPresetShape`'s own fallback order for the same reason.
 */
export function lookupPresetConnectionSites(
	name: string,
): PresetConnectionSiteDefinition | undefined {
	if (!name) {
		return undefined;
	}
	const direct = PRESET_CONNECTION_SITES[name];
	if (direct) {
		return direct;
	}
	const normalized = normalizeStShapeType(name);
	return normalized ? PRESET_CONNECTION_SITES[normalized] : undefined;
}

/** Resolve a `cxnLst` position token: a numeric literal or a guide name. */
function resolveSiteToken(token: string, vars: Map<string, number>): number {
	const literal = Number(token);
	return Number.isFinite(literal) ? literal : resolveOperand(token, vars);
}

/**
 * Evaluate `prst`'s ECMA-376 connection sites at the given box size and
 * adjustment values, in the shape's own (unrotated, unflipped) local pixel
 * space - the same space `getUnrotatedShapeConnectionSites` (shared) already
 * works in for an authored `a:custGeom/a:cxnLst`.
 *
 * Returns `undefined` when `prst` has no transcribed `cxnLst`, so the caller
 * can fall back to the 4 cardinal edge midpoints exactly as before.
 */
export function getPresetConnectionSites(
	prst: string,
	width: number,
	height: number,
	adjustments?: Record<string, number>,
): EvaluatedPresetConnectionSite[] | undefined {
	const def = lookupPresetConnectionSites(prst);
	if (!def || def.sites.length === 0) {
		return undefined;
	}

	const w = Number.isFinite(width) && width > 0 ? width : 0;
	const h = Number.isFinite(height) && height > 0 ? height : 0;

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

	const vars = evaluateGuides(def.gdLst ?? [], { w, h }, adj);
	return def.sites.map((site) => ({
		x: resolveSiteToken(site.x, vars),
		y: resolveSiteToken(site.y, vars),
	}));
}
