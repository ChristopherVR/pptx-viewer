/**
 * Locate the `<p:oleObj>` node inside a `<a:graphicData>` XML object,
 * whether it sits there directly or (as real PowerPoint always writes it,
 * verified via COM-authored fixtures) inside an `mc:AlternateContent`
 * wrapper: an `mc:Choice Requires="v"` branch carrying only a VML preview,
 * and the actual `<p:oleObj>` (with its `p:pic` PNG/EMF fallback preview)
 * inside `mc:Fallback`. A handful of producers may also put it inside an
 * `mc:Choice` instead of `mc:Fallback`, so both are checked.
 *
 * Returns the LIVE object reference (not a clone), so a caller that mutates
 * the returned node (renaming `@name`, swapping the blip `r:embed`, etc.)
 * writes directly into the tree that gets serialized. Both the load-time
 * parser (`PptxGraphicFrameParser.ts`) and the save-time writers
 * (`save-shape-xml-ole.ts`, `PptxHandlerRuntimeSaveOleContent.ts`) use this
 * single implementation so an AlternateContent-wrapped OLE object (the
 * common case for a real, non-SDK-authored deck) is found identically on
 * both sides; before this was unified, the save-time writers only checked
 * the "direct" position, so a rename or content edit made against a real
 * PowerPoint-authored deck silently applied to a copy of the node the
 * parser had already stopped looking at, and the change never reached the
 * saved file.
 *
 * @module ole-alternate-content
 */
import type { XmlObject } from '../types/common';

function ensureArrayLike<T>(value: T | T[] | undefined): T[] {
	if (value === undefined || value === null) {
		return [];
	}
	return Array.isArray(value) ? value : [value];
}

export function findOleObjNode(graphicData: XmlObject | undefined): XmlObject | undefined {
	return findAllOleObjNodes(graphicData)[0];
}

/**
 * Every `<p:oleObj>` node reachable from `graphicData`: the "direct" one, or
 * (for an `mc:AlternateContent`-wrapped object) both the `mc:Fallback` one
 * AND every `mc:Choice` one. Real PowerPoint's `mc:Choice Requires="v"`
 * branch carries its OWN copy of `@name`/`@progId`/`@classid`/`@showAsIcon`
 * (just without the `p:pic` a `mc:Fallback` OOXML-picture reader needs), so
 * a metadata edit (rename, progId) that only touched the Fallback copy
 * would leave the Choice copy stale - and a real PowerPoint, which DOES
 * support the "v" (VML) requirement, may read the Choice branch back and
 * show the stale value. Callers that mutate simple attributes should apply
 * the same change to every node this returns; callers that need the ONE
 * node carrying the actual payload (`p:pic`/`p:embed`/`p:link`) should keep
 * using {@link findOleObjNode} (Fallback-preferring), since a VML Choice
 * branch never carries a modern OOXML picture to swap.
 */
export function findAllOleObjNodes(graphicData: XmlObject | undefined): XmlObject[] {
	if (!graphicData) {
		return [];
	}
	const direct = graphicData['p:oleObj'] as XmlObject | undefined;
	if (direct) {
		return [direct];
	}
	const altContent = graphicData['mc:AlternateContent'] as XmlObject | undefined;
	if (!altContent) {
		return [];
	}
	const nodes: XmlObject[] = [];
	const fallback = altContent['mc:Fallback'] as XmlObject | undefined;
	const fallbackOleObj = fallback?.['p:oleObj'] as XmlObject | undefined;
	if (fallbackOleObj) {
		nodes.push(fallbackOleObj);
	}
	const choices = ensureArrayLike(altContent['mc:Choice'] as XmlObject | XmlObject[] | undefined);
	for (const choice of choices) {
		const node = choice?.['p:oleObj'] as XmlObject | undefined;
		if (node) {
			nodes.push(node);
		}
	}
	return nodes;
}
