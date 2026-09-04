/**
 * Guide-value evaluation for a custom geometry's OWN `a:avLst`/`a:gdLst`,
 * kept separate from `custom-geometry.ts` (structured-path <-> SVG / XML
 * conversion) and `custom-geometry-parser.ts` (one-shot parse-time path
 * resolution).
 *
 * The on-canvas adjustment-handle system (`shape-adjustment-handles.ts` in
 * `pptx-viewer-shared`) needs to re-evaluate a custom geometry's `a:ahXY`/
 * `a:ahPolar` `pos`/`min*`/`max*` formulas at guide values OTHER than the
 * ones already baked into the parsed `customGeometryPaths` (whose segments
 * are frozen numbers, resolved once at parse time by
 * `parseStructuredCustomGeometry`). This module rebuilds the guide variable
 * context from the RAW `a:avLst`/`a:gdLst` XML preserved on
 * `CustomGeometryRawData` (kept there for exactly this kind of
 * re-evaluation, alongside round-trip), so a handle's position, its drag
 * bounds, and a probe of how far it travels per guide unit can all be
 * recomputed without re-parsing the whole shape.
 *
 * @module geometry/custom-geometry-guides
 */
import type { CustomGeometryRawData } from '../types';
import { ensureArrayValue } from '../utils';
import { evaluateGuides, parseAdjustmentValues, parseGuideDefinitions } from './guide-formula-api';
import { evaluateFormula, parseFormula, resolveOperand } from './guide-formula-eval';

/** The `a:gd` node array under a raw `a:avLst`/`a:gdLst` XML blob (or none). */
function gdNodesOf(listXml: unknown): Array<Record<string, unknown>> {
	if (!listXml || typeof listXml !== 'object') {
		return [];
	}
	const nodes = (listXml as Record<string, unknown>)['a:gd'];
	return ensureArrayValue(nodes) as Array<Record<string, unknown>>;
}

/**
 * Rebuild the guide variable map a custom geometry's `a:avLst`/`a:gdLst`
 * evaluate to, at the given box size, with `overrides` (a live drag's
 * `shapeAdjustments`-style patch) taking precedence over the `avLst`
 * defaults - the same override order `evaluatePresetShape` uses for a preset.
 */
export function resolveCustomGeometryGuideContext(
	rawData: CustomGeometryRawData | undefined,
	width: number,
	height: number,
	overrides?: Record<string, number>,
): Map<string, number> {
	const adjustments = parseAdjustmentValues(gdNodesOf(rawData?.avLstXml));
	if (overrides) {
		for (const [name, value] of Object.entries(overrides)) {
			if (Number.isFinite(value)) {
				adjustments.set(name, value);
			}
		}
	}
	const guides = parseGuideDefinitions(gdNodesOf(rawData?.gdLstXml));
	return evaluateGuides(guides, { w: width, h: height }, adjustments);
}

/**
 * Resolve one `a:ahXY`/`a:ahPolar` formula token (a numeric literal, a guide
 * name, or - rarely - a full inline formula with its own operator) against a
 * guide context, falling back to `fallback` when the token is absent.
 */
export function resolveCustomGeometryToken(
	token: string | undefined,
	vars: Map<string, number>,
	fallback: number,
): number {
	if (token === undefined || token.trim() === '') {
		return fallback;
	}
	const trimmed = token.trim();
	if (trimmed.includes(' ')) {
		return evaluateFormula(parseFormula(trimmed), vars);
	}
	const literal = Number(trimmed);
	return Number.isFinite(literal) ? literal : resolveOperand(trimmed, vars);
}
