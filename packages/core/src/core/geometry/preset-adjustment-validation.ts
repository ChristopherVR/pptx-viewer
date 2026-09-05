/**
 * Validates `shapeAdjustments` entries against a preset's real ECMA-376
 * adjustment-guide names before they are serialized into `<a:avLst>`.
 *
 * COM-verified 2026-09-05: PowerPoint tolerates an `<a:avLst>` on a preset
 * with NO real adjustment handles (e.g. `rect`, whose spec `avLst` is empty)
 * - the whole block, and any `<a:gd>` inside it, is silently ignored. But for
 * a preset that DOES define adjustment guides (e.g. `homePlate`'s single
 * `adj`), an `<a:gd>` whose `@name` is not one of that preset's real guides
 * makes PowerPoint refuse to open the file outright ("The file or directory
 * is corrupted and unreadable", 0x80070570), even though the emitted XML is
 * otherwise schema-valid, byte-clean ASCII, and the ZIP is independently
 * intact. Repro: a lone `homePlate` shape saved with `shapeAdjustments:
 * { adj1: 30000 }` (its real avLst has only `adj`, not `adj1`) corrupts;
 * the same shape with `{ adj: 30000 }` opens fine; `rect` with any bogus
 * name never corrupts because it has zero real guides to begin with.
 *
 * The SDK (`ShapeBuilder.adjustments()` / `createShapeElement`) accepts an
 * arbitrary `Record<string, number>` from the caller with no guardrails, so
 * a typo'd or wrong guide name reaches the save layer unchecked. This module
 * is the single point that filters it back down to names PowerPoint actually
 * recognises for the shape's resolved preset, using the same 187/187
 * ECMA-376 `avLst` table the geometry evaluator and text-rect engine use, so
 * the "known guide names" list can never drift from the shapes this repo
 * actually renders.
 *
 * @module preset-adjustment-validation
 */
import { lookupPresetShape } from './preset-shape-evaluator';

/**
 * Filter a `shapeAdjustments` record down to `[name, value]` entries that are
 * safe to serialize as `<a:gd>` children of a given preset's `<a:avLst>`.
 *
 * - Drops empty/whitespace names and non-finite values (pre-existing rule).
 * - When `presetGeometry` resolves to a known ECMA-376 preset (the common
 *   case: the table has 187/187 spec coverage), also drops any name that is
 *   not one of that preset's real guide names - including every name when
 *   the preset defines none (e.g. `rect`).
 * - When the preset does not resolve (e.g. a connector geometry, or a name
 *   outside the closed `ST_ShapeType` enumeration that normalisation could
 *   not fix), no guide-name filtering is applied: there is nothing to
 *   validate against, so entries pass through unchanged (pre-existing,
 *   permissive behaviour).
 *
 * @param presetGeometry - The normalised `a:prstGeom/@prst` value the shape
 *   will be saved with (post `normalizePresetGeometry`/`normalizeStShapeType`).
 * @param adjustments - The element's `shapeAdjustments` record, if any.
 * @returns Entries safe to map straight into `<a:gd name="…" fmla="val …"/>`.
 */
export function filterValidShapeAdjustmentEntries(
	presetGeometry: string,
	adjustments: Record<string, number> | undefined,
): Array<[string, number]> {
	if (!adjustments) {
		return [];
	}
	const def = lookupPresetShape(presetGeometry);
	const validNames = def ? new Set(Object.keys(def.avLst ?? {})) : undefined;
	return Object.entries(adjustments).filter(
		([name, value]) =>
			name.trim().length > 0 && Number.isFinite(value) && (!validNames || validNames.has(name)),
	);
}
