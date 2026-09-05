/**
 * Shared vocabulary for the preset text-rect override tables
 * (`preset-text-rect-*.ts`).
 *
 * `PresetShapeGeometryDefinition.rect` (`preset-shape-definitions-*.ts`) is the
 * ORIGINAL per-preset `a:rect` transcription, and most of it predates any COM
 * verification (see gap G1: 117/194 were found wrong, some catastrophically).
 * `packages/shared/src/render/text-body-rect.ts`'s `VERIFIED_TEXT_RECT_PRESETS`
 * allowlist now gates rendering to the entries a COM measurement pass has
 * actually confirmed (181 as of wave 2, i.e. every ECMA-transcribed preset in
 * this table except `sun`, which keeps its own considered-but-unverified
 * rect); everything else still falls back to the full bounding box there
 * rather than trust an unverified formula.
 *
 * This module is the other half of closing that gap for the presets ECMA-376
 * itself gives an unambiguous `<rect>` for (verbatim `l`/`t`/`r`/`b` formulas,
 * not re-derived): `getPresetTextRect` (`preset-text-rect-table.ts`) is
 * consulted by `preset-shape-evaluator.ts` ahead of the original
 * `PresetShapeGeometryDefinition.rect`, so `evaluatePresetShape(...).textRect`
 * reflects the corrected value immediately. The shared allowlist is a
 * SEPARATE, deliberately conservative gate (COM-verified only) that a
 * different owner extends per preset; this table's evidence is the ECMA spec
 * text itself, not a COM measurement, which is why it lands as an
 * independent, additive override rather than editing that allowlist.
 *
 * @module render/preset-text-rect-types
 */

/** One preset's `avLst`/`gdLst`/`rect` slice, transcribed only as far as
 * evaluating its `<a:rect>` formula requires. */
export interface PresetTextRectDefinition {
	/** `avLst` defaults (`adj`, `adj1`, ...), overridable at call time. */
	avLst?: Record<string, number>;
	/** `gdLst` guides the `rect` formula references, in order. */
	gdLst?: Array<{ name: string; formula: string }>;
	/** The preset's `<a:rect l="..." t="..." r="..." b="..."/>`, verbatim. */
	rect: { l: string; t: string; r: string; b: string };
}
