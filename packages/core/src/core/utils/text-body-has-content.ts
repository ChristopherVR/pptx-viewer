/**
 * Cheap "does this `a:txBody` carry user text?" probe.
 *
 * The shape parser has to decide whether an unpositionable shape is worth
 * keeping *before* it has run the full paragraph pipeline, because the geometry
 * bail-out happens first. A shape whose transform cannot be resolved at all is
 * normally uninteresting (an empty layout stub), but one that carries typed
 * text is user content, and discarding it loses that text permanently: the
 * element never reaches the model, so the save pipeline has nothing to re-emit.
 *
 * This probe deliberately walks the raw parsed XML rather than the typed model
 * so it stays usable at that point in the parse.
 *
 * @module text-body-has-content
 */

import type { XmlObject } from '../types';

/** Depth cap mirroring the parser's other recursion guards. */
const MAX_SCAN_DEPTH = 32;

function isXmlObject(value: unknown): value is XmlObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Collect the text of every `a:t` (plain run) and `a:fld` (field) descendant.
 *
 * `a:t` is the only element that carries literal run text in DrawingML, and it
 * appears under `a:r` and under `a:fld`. Scanning for the key by name rather
 * than by path keeps the probe indifferent to the run type.
 */
function scanForText(node: unknown, depth: number): boolean {
	if (depth > MAX_SCAN_DEPTH) {
		return false;
	}
	if (Array.isArray(node)) {
		return node.some((child) => scanForText(child, depth + 1));
	}
	if (!isXmlObject(node)) {
		return false;
	}
	for (const [key, value] of Object.entries(node)) {
		if (key.startsWith('@_') || key === '#text') {
			continue;
		}
		if (key === 'a:t') {
			const texts = Array.isArray(value) ? value : [value];
			if (texts.some((t) => String(t ?? '').trim().length > 0)) {
				return true;
			}
			continue;
		}
		if (scanForText(value, depth + 1)) {
			return true;
		}
	}
	return false;
}

/**
 * @param txBody - A parsed `p:txBody` / `a:txBody` node, or `undefined`.
 * @returns `true` when the body contains at least one run with non-whitespace
 *   text.
 */
export function textBodyHasContent(txBody: unknown): boolean {
	return scanForText(txBody, 0);
}
