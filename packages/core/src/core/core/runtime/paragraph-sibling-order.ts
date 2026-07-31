/**
 * paragraph-sibling-order: restore the authored order of an `a:p`'s content
 * children (`a:r`, `a:fld`, `a:br`, inline math, `mc:AlternateContent`).
 *
 * WHY: fast-xml-parser's collapsed shape stores same-tag siblings as an array
 * under one key, and distinct tags under separate keys ordered by FIRST
 * occurrence. A paragraph authored as
 *
 * ```xml
 * <a:p><a:r>Slide </a:r><a:fld type="slidenum"/><a:r> - </a:r><a:fld type="slidetitle"/></a:p>
 * ```
 *
 * therefore parses to `{ 'a:r': [ 'Slide ', ' - ' ], 'a:fld': [ num, title ] }`,
 * and any walker over `Object.keys` re-emits it as both literal runs followed
 * by both fields: "Slide - 1Alpha" instead of "Slide 1 - Alpha". Every deck
 * with an inline field ("Page X of Y", a date inside a sentence, a footer with
 * text either side of the field) rendered wrong in all five bindings, and the
 * same collapse also flattened a soft line break's position among its runs.
 *
 * The fix mirrors the `#pptx-order` convention core already uses for OMML and
 * custom geometry: re-read the source XML for the one fact the parsed object
 * cannot carry, the document order. Unlike OMML this records the order in a
 * WeakMap side-channel rather than renaming keys, because a paragraph's parsed
 * object is read by a dozen unrelated call sites (`paragraph['a:r']` in the
 * table parsers, placeholder defaults, text editing, save-side table styles).
 * Renaming its keys would silently hide runs from all of them, whereas the
 * order is only ever needed during the load pass that immediately follows the
 * parse, where the object identity is still the parser's own. The SAVE
 * direction does use the key markers: see `assembleParagraphXml`.
 *
 * Only paragraphs whose children are NOT already grouped by tag are recorded.
 * The grouped case (the overwhelming majority) needs no correction, so leaving
 * it unrecorded keeps the map small and keeps the consumer on its existing,
 * well-tested key iteration.
 *
 * @module paragraph-sibling-order
 */

import type { XmlObject } from '../../types';
import {
	ensureItems,
	extractElementInnerXml,
	isGroupedByTag,
	isXmlObject,
	localName,
	scanDirectChildren,
} from './xml-child-scan';

/** Authored direct-child tag sequence, keyed by the parsed `a:p` object. */
const childOrder = new WeakMap<XmlObject, readonly string[]>();

/**
 * Cheap prefilter: a paragraph can only lose information to the collapse when
 * it mixes child element types. A part whose paragraphs are pure `a:r`
 * sequences is already in document order, so skip the scan entirely rather
 * than walking every slide's XML twice.
 */
const MIXED_CONTENT_MARKERS = ['<a:fld', '<a:br', 'm:oMath', 'a14:m', 'mc:AlternateContent'];

/** Order-independent signature of a raw child sequence. */
function tagSequenceSignature(tags: readonly string[]): string {
	const counts = new Map<string, number>();
	for (const tag of tags) {
		counts.set(tag, (counts.get(tag) ?? 0) + 1);
	}
	return signatureOf(counts);
}

/** Order-independent signature of a parsed paragraph's element children. */
function parsedParagraphSignature(paragraph: XmlObject): string {
	const counts = new Map<string, number>();
	for (const [key, value] of Object.entries(paragraph)) {
		if (key.startsWith('@_') || key === '#text') {
			continue;
		}
		counts.set(key, (counts.get(key) ?? 0) + ensureItems(value).length);
	}
	return signatureOf(counts);
}

function signatureOf(counts: Map<string, number>): string {
	return [...counts.entries()]
		.sort((a, b) => (a[0] < b[0] ? -1 : 1))
		.map(([name, count]) => `${name}:${count}`)
		.join(',');
}

/** Parsed `a:p` objects reachable from a parsed part, depth-first. */
function collectParsedParagraphs(root: unknown): XmlObject[] {
	const result: XmlObject[] = [];
	const stack: unknown[] = [root];
	while (stack.length > 0) {
		const current = stack.pop();
		if (!current || typeof current !== 'object') {
			continue;
		}
		if (Array.isArray(current)) {
			for (let index = current.length - 1; index >= 0; index--) {
				stack.push(current[index]);
			}
			continue;
		}
		for (const [key, value] of Object.entries(current as XmlObject).reverse()) {
			if (key.startsWith('@_')) {
				continue;
			}
			if (localName(key) === 'p') {
				for (const item of ensureItems(value)) {
					if (isXmlObject(item)) {
						result.push(item);
					}
				}
			} else {
				stack.push(value);
			}
		}
	}
	return result;
}

/**
 * Record the authored child order of every interleaved paragraph in a part.
 *
 * Paragraphs are paired to source orders by SIGNATURE bucket rather than by
 * index, because the parsed tree cannot be walked in document order: a group
 * shape's children collapse by type too, so `<p:sp/><p:grpSp/><p:sp/>` walks
 * as both plain shapes and only then the group's contents. Matching on the
 * child multiset means a mis-walk can only ever hand a paragraph an order that
 * is applicable to it.
 */
export function annotateParagraphSiblingOrder(xml: string, parsed: unknown): void {
	if (!MIXED_CONTENT_MARKERS.some((marker) => xml.includes(marker))) {
		return;
	}
	const orders = extractElementInnerXml(xml, 'p')
		.map((inner) => scanDirectChildren(inner).map((child) => child.tag))
		.filter((order) => order.length > 0);
	if (orders.length === 0) {
		return;
	}

	// Bucket EVERY paragraph's order, not just the interleaved ones: consuming
	// a bucket in walk order only stays aligned when the grouped paragraphs
	// that share a signature take their own entry out of it as well.
	const bySignature = new Map<string, string[][]>();
	for (const order of orders) {
		const signature = tagSequenceSignature(order);
		const bucket = bySignature.get(signature);
		if (bucket) {
			bucket.push(order);
		} else {
			bySignature.set(signature, [order]);
		}
	}

	for (const paragraph of collectParsedParagraphs(parsed)) {
		const order = bySignature.get(parsedParagraphSignature(paragraph))?.shift();
		if (order && !isGroupedByTag(order)) {
			childOrder.set(paragraph, order);
		}
	}
}

/** `[tag, item]` pairs for a paragraph's content children. */
export interface ParagraphContentEntries {
	/** The paragraph's content children, in the order they should be consumed. */
	entries: Array<[string, unknown]>;
	/**
	 * True when the order was recovered from the source XML. Callers use this
	 * to switch off the heuristics that only exist because the order was
	 * previously unknowable (see the collapsed line-break repair in
	 * `collectShapeParagraphContent`).
	 */
	authored: boolean;
}

/**
 * A paragraph's content children in the order they were authored, falling back
 * to fast-xml-parser's key order when nothing was recorded for it (either the
 * paragraph was already grouped by tag, or it was built by the SDK rather than
 * parsed and so never went past the annotator).
 */
export function paragraphContentEntries(
	paragraph: XmlObject,
	contentTags: ReadonlySet<string>,
	ensureArray: (value: unknown) => unknown[],
): ParagraphContentEntries {
	const order = childOrder.get(paragraph);
	if (!order) {
		const entries = Object.keys(paragraph).flatMap((key) =>
			contentTags.has(key)
				? ensureArray(paragraph[key]).map((item) => [key, item] as [string, unknown])
				: [],
		);
		return { entries, authored: false };
	}

	const consumed = new Map<string, number>();
	const entries: Array<[string, unknown]> = [];
	for (const tag of order) {
		const index = consumed.get(tag) ?? 0;
		consumed.set(tag, index + 1);
		if (!contentTags.has(tag)) {
			continue;
		}
		const item = ensureArray(paragraph[tag])[index];
		if (item !== undefined) {
			entries.push([tag, item]);
		}
	}
	return { entries, authored: true };
}
