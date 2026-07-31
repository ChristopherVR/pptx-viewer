/**
 * `element-hidden-flag`: round-trip PowerPoint's Selection Pane hide toggle.
 *
 * The eye icon in PowerPoint's Selection Pane sets `@hidden="1"` on the shape's
 * non-visual drawing properties (`p:cNvPr`, `CT_NonVisualDrawingProps/@hidden`
 * in DrawingML). A hidden shape stays in the file, keeps its z-order and stays
 * listed in the Selection Pane; it is simply never drawn.
 *
 * The per-type element parsers each read their own `p:cNvPr` for name / actions
 * / locks, so rather than teaching six parsers about one attribute the load
 * pipeline calls {@link applyHiddenFlagFromRawXml} once over the finished
 * element tree. Every parser stores the whole shape node on `element.rawXml`,
 * which is where the attribute lives.
 *
 * Without this the flag was viewer-local state: toggling an element hidden and
 * saving produced a deck that reopened with the element visible again, in this
 * viewer and in PowerPoint alike.
 *
 * @module element-hidden-flag
 */

import type { PptxElement, XmlObject } from '../../types';

/**
 * Non-visual property containers that hold a `p:cNvPr`, one per shape flavour
 * (`p:sp`, `p:pic`, `p:cxnSp`, `p:graphicFrame`, `p:grpSp`, `p:contentPart`).
 * Mirrors the same list on the save writer.
 */
const NV_CONTAINERS = [
	'p:nvSpPr',
	'p:nvPicPr',
	'p:nvCxnSpPr',
	'p:nvGraphicFramePr',
	'p:nvGrpSpPr',
	'p:nvContentPartPr',
] as const;

/**
 * Locate the `p:cNvPr` node inside a serialized shape, whichever non-visual
 * container the shape flavour uses.
 *
 * @param shape - A shape node (`p:sp`, `p:pic`, …) as parsed XML.
 * @returns The `p:cNvPr` node, or `undefined` when the shape has none.
 */
export function findCNvPr(shape: XmlObject | undefined): XmlObject | undefined {
	if (!shape) {
		return undefined;
	}
	for (const key of NV_CONTAINERS) {
		const container = shape[key] as XmlObject | undefined;
		const cNvPr = container?.['p:cNvPr'] as XmlObject | undefined;
		if (cNvPr) {
			return cNvPr;
		}
	}
	return undefined;
}

/**
 * Read `p:cNvPr/@hidden`. OOXML booleans accept `1`/`0` and `true`/`false`, and
 * fast-xml-parser may hand back a real boolean or number when attribute value
 * parsing is on, so all three shapes are accepted.
 *
 * @param shape - A shape node as parsed XML.
 * @returns `true` when the shape is explicitly hidden, otherwise `undefined`
 *   (absent, rather than `false`, so the flag stays off the model unless set).
 */
export function readHiddenAttribute(shape: XmlObject | undefined): true | undefined {
	const raw = findCNvPr(shape)?.['@_hidden'];
	if (raw === undefined || raw === null) {
		return undefined;
	}
	const value = String(raw).trim().toLowerCase();
	return value === '1' || value === 'true' ? true : undefined;
}

/**
 * Stamp `element.hidden` from each element's captured shape XML, recursing into
 * groups. Mutates in place and leaves the flag absent for the overwhelmingly
 * common visible shape, so nothing downstream sees a new `hidden: false`.
 *
 * @param elements - The parsed elements of one slide (or one group's children).
 */
export function applyHiddenFlagFromRawXml(elements: PptxElement[]): void {
	for (const element of elements) {
		if (element.type === 'group' && Array.isArray(element.children)) {
			applyHiddenFlagFromRawXml(element.children);
		}
		const hidden = readHiddenAttribute(element.rawXml);
		if (hidden) {
			element.hidden = true;
		}
	}
}
