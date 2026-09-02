/**
 * @fileoverview Deep merge of two parsed XML nodes, override onto base, used
 * to fold a layout placeholder onto its master counterpart.
 */
import { inheritCustomGeometryCommandOrder } from '../../geometry/custom-geometry-command-order';
import type { XmlObject } from '../../types';

/**
 * Load H1: cap recursion depth on attacker-controlled XML structures to
 * prevent stack-overflow DoS. 64 is well above any plausible placeholder
 * property nesting (typical depth < 10).
 */
const MAX_MERGE_DEPTH = 64;

/**
 * Merge `override` onto `base`, recursing into nested element nodes.
 *
 * An empty element in the override (e.g. a self-closing `<p:spPr/>` on a
 * layout placeholder, parsed as `''`) means "no explicit value at this
 * level" and must NOT clobber a populated value inherited from the base
 * (master). Keeping the base preserves inherited geometry (`a:xfrm`) so the
 * slide placeholder still resolves a position instead of being dropped.
 *
 * A merge that recurses into a `a:custGeom/a:path` node produces a brand-new
 * object, which is no longer the WeakMap key the parser annotated with the
 * path's source command order (fast-xml-parser groups a path's children by
 * tag, discarding interleaving). Every return below re-attaches that order to
 * the merged object when its command multiset still matches a source's, so a
 * custom-geometry placeholder that gets folded through master/layout
 * inheritance keeps curves and arcs in their authored order.
 */
export function mergeXmlObjects(
	base: XmlObject | undefined,
	override: XmlObject | undefined,
	depth: number = 0,
): XmlObject | undefined {
	if (!base && !override) {
		return undefined;
	}
	if (!base) {
		if (!override) {
			return undefined;
		}
		const merged = { ...override };
		inheritCustomGeometryCommandOrder(merged, override);
		return merged;
	}
	if (!override) {
		const merged = { ...base };
		inheritCustomGeometryCommandOrder(merged, base);
		return merged;
	}
	if (depth > MAX_MERGE_DEPTH) {
		// Beyond cap: shallow-merge override onto base without further
		// recursion, preserving as much data as possible while bounding
		// stack usage.
		const merged = { ...base, ...override };
		inheritCustomGeometryCommandOrder(merged, override, base);
		return merged;
	}

	const merged: XmlObject = { ...base };
	for (const [key, value] of Object.entries(override)) {
		const existing = merged[key];
		if (
			value &&
			typeof value === 'object' &&
			!Array.isArray(value) &&
			existing &&
			typeof existing === 'object' &&
			!Array.isArray(existing)
		) {
			merged[key] = mergeXmlObjects(existing as XmlObject, value as XmlObject, depth + 1);
		} else if (
			value === '' &&
			existing !== undefined &&
			existing !== '' &&
			typeof existing === 'object'
		) {
			merged[key] = existing;
		} else {
			merged[key] = value;
		}
	}
	inheritCustomGeometryCommandOrder(merged, override, base);
	return merged;
}
