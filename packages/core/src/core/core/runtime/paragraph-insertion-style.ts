import type { TextStyle, XmlObject } from '../../types';
import { mergeOrderedXml } from '../../utils/ordered-xml-merge';
import { DEF_RPR_CHILD_ORDER } from '../../utils/placeholder-level-style-serializer';

/** Merge only edited insertion properties, preserving untouched native end XML. */
export function updateEndParagraphProperties(
	existing: XmlObject | undefined,
	style: TextStyle | undefined,
	serialize: (style: TextStyle) => XmlObject,
): XmlObject | undefined {
	if (!style?.inheritedRunStyle) {
		return existing;
	}
	const baseline = serialize({ ...style, ...style.inheritedRunStyle, ...style.authoredRunStyle });
	const current = serialize(style);
	const attributes: Record<string, string | null> = {};
	const children = new Map<string, XmlObject | null>();
	for (const key of new Set([...Object.keys(baseline), ...Object.keys(current)])) {
		if (JSON.stringify(baseline[key]) === JSON.stringify(current[key])) {
			continue;
		}
		if (key.startsWith('@_')) {
			attributes[key.slice(2)] = current[key] === undefined ? null : String(current[key]);
		} else {
			children.set(key, (current[key] as XmlObject | undefined) ?? null);
		}
	}
	if (Object.keys(attributes).length === 0 && children.size === 0) {
		return existing;
	}
	const fillKeys = [
		'a:noFill',
		'a:solidFill',
		'a:gradFill',
		'a:blipFill',
		'a:pattFill',
		'a:grpFill',
	];
	const changedFill = fillKeys.find((key) => children.get(key));
	if (changedFill) {
		for (const key of fillKeys) {
			if (key !== changedFill) {
				children.set(key, null);
			}
		}
	}
	return mergeOrderedXml(existing, attributes, children, DEF_RPR_CHILD_ORDER);
}
