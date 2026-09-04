/**
 * Guide-value write-back for `a:custGeom`: patches an already-built
 * `a:custGeom` XML object's `a:avLst/a:gd/@_val` entries from a
 * `shapeAdjustments`-style override map, so a drag on an `a:ahXY`/
 * `a:ahPolar` handle (see `pptx-viewer-shared`'s
 * `shape-adjustment-custom-geometry.ts`) round-trips into the saved file
 * instead of being silently dropped - the freeform counterpart to how a
 * PRESET's `a:avLst` is already rebuilt from `element.shapeAdjustments` on
 * save.
 *
 * Kept as its own module (rather than a new parameter threaded through
 * `customGeometryPathsToXml`) because `custom-geometry.ts` is already at this
 * repo's 300-line file budget: call this AFTER it, on its output:
 *
 * ```ts
 * const custGeom = customGeometryPathsToXml(paths, rawData, extras);
 * spPr['a:custGeom'] = applyCustomGeometryGuideOverrides(custGeom, el.shapeAdjustments);
 * ```
 *
 * @module geometry/custom-geometry-guide-writeback
 */
import type { XmlObject } from '../types';
import { ensureArrayValue } from '../utils';

/**
 * Return `custGeom` with its `a:avLst/a:gd` entries patched from `overrides`
 * (each `{name: value}` becomes `<a:gd name="name" fmla="val <value>"/>`),
 * adding a new entry when `overrides` names a guide `a:avLst` did not already
 * declare (an `a:ahXY`/`a:ahPolar` handle's `gdRef` is conventionally an
 * `a:avLst` guide, but nothing enforces that). A no-op that returns
 * `custGeom` unchanged when `overrides` is empty, so a shape with no drag
 * history re-emits its original `a:avLst` byte-for-byte.
 */
export function applyCustomGeometryGuideOverrides(
	custGeom: XmlObject,
	overrides: Record<string, number> | undefined,
): XmlObject {
	const entries = Object.entries(overrides ?? {}).filter(([, value]) => Number.isFinite(value));
	if (entries.length === 0) {
		return custGeom;
	}
	const avLst = (custGeom['a:avLst'] as XmlObject | undefined) ?? {};
	const existing = ensureArrayValue(avLst['a:gd']) as XmlObject[];
	const byName = new Map(existing.map((node) => [String(node['@_name'] ?? ''), node]));
	for (const [name, value] of entries) {
		byName.set(name, { '@_name': name, '@_fmla': `val ${Math.round(value)}` });
	}
	const merged = Array.from(byName.values());
	return {
		...custGeom,
		'a:avLst': { ...avLst, 'a:gd': merged.length === 1 ? merged[0] : merged },
	};
}
