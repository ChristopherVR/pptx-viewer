/**
 * @fileoverview `p:cSld/@name` on a slide part, in both directions.
 *
 * The attribute is the author-facing slide name (Selection Pane, Outline
 * view, VBA `Slide.Name`). Layouts and notes slides already read and write
 * theirs; slides carried `PptxSlide.name` on the model without ever loading
 * it from, or saving it to, the part.
 */
import type { XmlObject } from '../types';

function asNode(value: unknown): XmlObject | undefined {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as XmlObject)
		: undefined;
}

/**
 * Read the slide name off a parsed slide part.
 *
 * @param slideXml the parsed `p:sld` document
 * @returns the trimmed name, or `undefined` when the part has none (or an
 *   empty one, which PowerPoint treats as unnamed)
 */
export function readCommonSlideDataName(slideXml: XmlObject | undefined): string | undefined {
	const cSld = asNode(asNode(slideXml?.['p:sld'])?.['p:cSld']);
	const raw = cSld?.['@_name'];
	if (raw === undefined || raw === null) {
		return undefined;
	}
	const trimmed = String(raw).trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Write (or clear) the slide name on a `p:cSld` node.
 *
 * Mirrors the layout writer: an `undefined` model value leaves the attribute
 * untouched (nothing was loaded or edited), while an empty string deletes it.
 */
export function writeCommonSlideDataName(
	cSld: XmlObject | undefined,
	name: string | undefined,
): void {
	if (!cSld || name === undefined) {
		return;
	}
	const trimmed = name.trim();
	if (trimmed.length > 0) {
		cSld['@_name'] = trimmed;
	} else {
		delete cSld['@_name'];
	}
}
