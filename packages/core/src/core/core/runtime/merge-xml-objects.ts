/**
 * @fileoverview Deep merge of two parsed XML nodes, override onto base, used
 * to fold a layout placeholder onto its master counterpart.
 */
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
		return override ? { ...override } : undefined;
	}
	if (!override) {
		return { ...base };
	}
	if (depth > MAX_MERGE_DEPTH) {
		// Beyond cap: shallow-merge override onto base without further
		// recursion, preserving as much data as possible while bounding
		// stack usage.
		return { ...base, ...override };
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
	return merged;
}
