/**
 * paragraph-child-assembly: turn the save-side run list into `a:p` children
 * that serialise in the order the runs were authored.
 *
 * `createParagraphsFromTextContent` hands `assembleParagraphXml` one flat list
 * of run nodes, already in text-segment order and tagged with internal routing
 * markers (`__isField`, `__isLineBreak`, `__isEquation`). This module decides
 * which `a:p` child element each of those becomes and how to write them onto
 * the paragraph object so fast-xml-parser emits them in that same order.
 *
 * WHY it is not simply "one array per tag": an object key can hold only one
 * array, so grouping `"Slide " fld " - " fld` by tag writes both literal runs
 * and only then both fields. That is exactly the defect the load side now
 * fixes (an inline field jumping to the end of its paragraph), and grouping on
 * save would write the corruption straight back into the file.
 *
 * @module paragraph-child-assembly
 */

import { orderedXmlKey } from '../../geometry';
import type { XmlObject } from '../../types';

/** Strip an internal routing marker from a run before it is serialised. */
function stripMarker(run: XmlObject, marker: string): XmlObject {
	const { [marker]: _drop, ...rest } = run as Record<string, unknown>;
	return rest as XmlObject;
}

/** The `a:p` child tag a save-side run node serialises under, plus its value. */
export interface ParagraphChild {
	tag: string;
	value: XmlObject;
}

/**
 * Route one save-side run node to the `a:p` child element it serialises as.
 * Returns `undefined` for an equation marker that carries no captured XML.
 */
export function classifyParagraphChild(run: XmlObject): ParagraphChild | undefined {
	const marked = run as Record<string, unknown>;
	if (marked.__isField) {
		return { tag: 'a:fld', value: stripMarker(run, '__isField') };
	}
	if (marked.__isLineBreak) {
		return { tag: 'a:br', value: stripMarker(run, '__isLineBreak') };
	}
	if (!marked.__isEquation) {
		return { tag: 'a:r', value: stripMarker(run, '__isField') };
	}
	const eqXml = marked.__equationXml as Record<string, unknown> | undefined;
	if (!eqXml) {
		return undefined;
	}
	if (eqXml['m:oMathPara']) {
		return { tag: 'm:oMathPara', value: eqXml['m:oMathPara'] as XmlObject };
	}
	if (eqXml['m:oMath']) {
		return { tag: 'm:oMath', value: eqXml['m:oMath'] as XmlObject };
	}
	if (eqXml['mc:AlternateContent']) {
		return { tag: 'mc:AlternateContent', value: eqXml['mc:AlternateContent'] as XmlObject };
	}
	if (eqXml['a14:m']) {
		// a14:m wraps an inline math element; re-emit verbatim.
		return { tag: 'mc:AlternateContent', value: { ...(eqXml as XmlObject) } };
	}
	// Fallback: assume the captured object is itself the math node.
	return { tag: 'm:oMath', value: eqXml as XmlObject };
}

/** True while every tag's occurrences are contiguous (safe to collapse to arrays). */
function isGroupedByTag(children: readonly ParagraphChild[]): boolean {
	const seen = new Set<string>();
	let previous = '';
	for (const { tag } of children) {
		if (tag !== previous && seen.has(tag)) {
			return false;
		}
		seen.add(tag);
		previous = tag;
	}
	return true;
}

/**
 * Write a paragraph's children onto `paragraph` so they serialise in order.
 *
 * A grouped sequence collapses to one array per tag, which is both what the
 * parser produced in the first place and what every hand-read of the object
 * expects. An INTERLEAVED sequence gets core's `#pptx-order-N` key markers
 * instead, giving each occurrence its own key in insertion order;
 * `PptxRuntimeDependencyFactory.createBuilder` strips the markers from the
 * serialised tag names, so the file itself is ordinary OOXML.
 *
 * Note that even the grouped branch writes its keys in the order the groups
 * FIRST appear rather than a fixed `a:r`, `a:br`, `a:fld` sequence: a footer
 * authored as `<a:fld/>" of 10"` is grouped, and hard-coding runs-first would
 * silently reverse it.
 */
export function writeParagraphChildren(
	paragraph: XmlObject,
	children: readonly ParagraphChild[],
): void {
	if (isGroupedByTag(children)) {
		const grouped = new Map<string, XmlObject[]>();
		for (const { tag, value } of children) {
			const bucket = grouped.get(tag);
			if (bucket) {
				bucket.push(value);
			} else {
				grouped.set(tag, [value]);
			}
		}
		for (const [tag, values] of grouped) {
			paragraph[tag] = values.length > 1 ? values : values[0]!;
		}
		return;
	}
	const totals = new Map<string, number>();
	for (const { tag } of children) {
		totals.set(tag, (totals.get(tag) ?? 0) + 1);
	}
	for (const [position, { tag, value }] of children.entries()) {
		paragraph[(totals.get(tag) ?? 0) > 1 ? orderedXmlKey(tag, position) : tag] = value;
	}
}
