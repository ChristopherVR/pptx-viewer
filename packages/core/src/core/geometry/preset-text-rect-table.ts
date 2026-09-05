/**
 * Public accessor for the preset text-inset rect overrides (`a:prstGeom/a:rect`,
 * ECMA-376 `presetShapeDefinitions.xml`), aggregating the per-family tables.
 *
 * Consumed by `preset-shape-evaluator.ts`, ahead of the preset's original
 * `PresetShapeGeometryDefinition.rect` (`preset-shape-definitions-*.ts`), so
 * `evaluatePresetShape(...).textRect` reflects the ECMA-verbatim formula for
 * any preset transcribed here. See `preset-text-rect-types.ts` for why this is
 * a standalone override table.
 *
 * @module render/preset-text-rect-table
 */
import { evaluateGuides } from './guide-formula-api';
import { resolveOperand } from './guide-formula-eval';
import { normalizeStShapeType } from './preset-geometry-names';
import { ACTION_BUTTON_TEXT_RECTS } from './preset-text-rect-action-buttons';
import { ARROW_TEXT_RECTS } from './preset-text-rect-arrows';
import { BRACE_TEXT_RECTS } from './preset-text-rect-braces';
import { CALLOUT_TEXT_RECTS } from './preset-text-rect-callouts';
import { CIRCULAR_ARROW_TEXT_RECTS } from './preset-text-rect-circular-arrows';
import { FLOWCHART_TEXT_RECTS } from './preset-text-rect-flowchart';
import { MISC_TEXT_RECTS_A } from './preset-text-rect-misc-a';
import { MISC_TEXT_RECTS_B } from './preset-text-rect-misc-b';
import { POLYGON_TEXT_RECTS } from './preset-text-rect-polygons';
import { QUAD_TEXT_RECTS } from './preset-text-rect-quads';
import { RIBBON_TEXT_RECTS } from './preset-text-rect-ribbons';
import { STAR_TEXT_RECTS } from './preset-text-rect-stars';
import { TAB_TEXT_RECTS } from './preset-text-rect-tabs';
import type { PresetTextRectDefinition } from './preset-text-rect-types';

/**
 * Every preset this repo carries an ECMA `<a:rect>` transcription for via this
 * override mechanism: 93 of the ~99 presets NOT already on
 * `packages/shared/src/render/text-body-rect.ts`'s COM-verified
 * `VERIFIED_TEXT_RECT_PRESETS` allowlist (the remaining few: `line`, `lineInv`,
 * `chartPlus`, `chartStar`, `chartX` have no `<a:rect>` in the spec at all, so
 * the full bounding box is already correct for them; `sun` already has a
 * deliberate, tested, non-spec-literal `rect` in
 * `preset-shape-definitions-misc.ts` this intentionally does not override,
 * see `preset-text-rect-misc-b.ts`).
 */
const PRESET_TEXT_RECT_OVERRIDES: Record<string, PresetTextRectDefinition> = {
	...ACTION_BUTTON_TEXT_RECTS,
	...CALLOUT_TEXT_RECTS,
	...FLOWCHART_TEXT_RECTS,
	...STAR_TEXT_RECTS,
	...ARROW_TEXT_RECTS,
	...CIRCULAR_ARROW_TEXT_RECTS,
	...BRACE_TEXT_RECTS,
	...RIBBON_TEXT_RECTS,
	...TAB_TEXT_RECTS,
	...QUAD_TEXT_RECTS,
	...POLYGON_TEXT_RECTS,
	...MISC_TEXT_RECTS_A,
	...MISC_TEXT_RECTS_B,
};

/**
 * Look up a preset's text-rect override, exact name first, then normalised
 * (`oval` -> `ellipse`, a deck's own casing) - mirrors
 * `lookupPresetConnectionSites`'s own fallback order for the same reason.
 */
export function lookupPresetTextRectOverride(name: string): PresetTextRectDefinition | undefined {
	if (!name) {
		return undefined;
	}
	const direct = PRESET_TEXT_RECT_OVERRIDES[name];
	if (direct) {
		return direct;
	}
	const normalized = normalizeStShapeType(name);
	return normalized ? PRESET_TEXT_RECT_OVERRIDES[normalized] : undefined;
}

/** Resolve a `rect` edge token: a numeric literal or a guide name. */
function resolveRectToken(token: string, vars: Map<string, number>): number {
	const literal = Number(token);
	return Number.isFinite(literal) ? literal : resolveOperand(token, vars);
}

/**
 * Evaluate `prst`'s ECMA-376 `<a:rect>` override at the given box size and
 * adjustment values. Returns `undefined` when `prst` has no override here, so
 * the caller falls back to `PresetShapeGeometryDefinition.rect` exactly as
 * before.
 */
export function getPresetTextRect(
	prst: string,
	width: number,
	height: number,
	adjustments?: Record<string, number>,
): { l: number; t: number; r: number; b: number } | undefined {
	const def = lookupPresetTextRectOverride(prst);
	if (!def) {
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
	return {
		l: resolveRectToken(def.rect.l, vars),
		t: resolveRectToken(def.rect.t, vars),
		r: resolveRectToken(def.rect.r, vars),
		b: resolveRectToken(def.rect.b, vars),
	};
}
