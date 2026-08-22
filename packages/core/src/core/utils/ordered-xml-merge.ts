/**
 * Merge attribute and child-element edits into an existing `XmlObject` node
 * while keeping a fixed, schema-required child order.
 *
 * Several OOXML complex types (`CT_TextParagraphProperties`,
 * `CT_TextCharacterProperties`, `CT_CustomerDataList`, ...) require their
 * children in a specific sequence; fast-xml-parser serializes object keys in
 * insertion order, so simply assigning a brand-new key onto an existing node
 * can land it in the wrong position and produce a file PowerPoint refuses to
 * open. This rebuilds the node key-by-key in `childOrder`, taking an edited
 * value when one is supplied, otherwise carrying over whatever `source`
 * already had at that key - so callers only have to say what changed, and
 * everything else (including children this module knows nothing about)
 * survives untouched, in place.
 *
 * @module ordered-xml-merge
 */
import type { XmlObject } from '../types';

/** `null` in `childEdits` deletes the key; absent means "leave `source` as-is". */
export type OrderedChildEdits = ReadonlyMap<string, XmlObject | null>;

export function mergeOrderedXml(
	source: XmlObject | undefined,
	attrEdits: Readonly<Record<string, string | null>>,
	childEdits: OrderedChildEdits,
	childOrder: readonly string[],
): XmlObject {
	const src = source ?? {};
	const result: XmlObject = {};

	for (const [key, value] of Object.entries(src)) {
		if (key.startsWith('@_')) {
			result[key] = value;
		}
	}
	for (const [name, value] of Object.entries(attrEdits)) {
		const key = `@_${name}`;
		if (value === null) {
			delete result[key];
		} else {
			result[key] = value;
		}
	}

	const handled = new Set<string>(childOrder);
	for (const key of childOrder) {
		if (childEdits.has(key)) {
			const value = childEdits.get(key);
			if (value !== null && value !== undefined) {
				result[key] = value;
			}
		} else if (src[key] !== undefined) {
			result[key] = src[key];
		}
	}

	for (const [key, value] of Object.entries(src)) {
		if (!key.startsWith('@_') && !handled.has(key)) {
			result[key] = value;
		}
	}

	return result;
}
