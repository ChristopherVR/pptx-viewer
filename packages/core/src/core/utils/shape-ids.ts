import type { PptxElement, XmlObject } from '../types';

/**
 * Helpers around DrawingML shape IDs (`p:cNvPr/@id`), which are UInt32
 * values (ECMA-376 `ST_DrawingElementId`), not editor UUIDs or timestamps.
 */

export const MAX_SHAPE_ID = 0xffffffff;

/** Parse a raw `@_id` attribute value as a valid DrawingML shape ID. */
export function parseShapeId(value: unknown, allowZero = false): number | undefined {
	const text = String(value ?? '').trim();
	if (!/^\d+$/.test(text)) {
		return undefined;
	}
	const id = Number(text);
	return Number.isSafeInteger(id) && id >= (allowZero ? 0 : 1) && id <= MAX_SHAPE_ID
		? id
		: undefined;
}

/** Depth-first visit of every object node in a parsed XML tree. */
export function visitXmlObjects(
	value: unknown,
	visit: (node: XmlObject, tag: string) => void,
	tag = '',
): void {
	if (Array.isArray(value)) {
		for (const item of value) {
			visitXmlObjects(item, visit, tag);
		}
	} else if (value && typeof value === 'object') {
		const node = value as XmlObject;
		visit(node, tag);
		for (const [key, child] of Object.entries(node)) {
			if (!key.startsWith('@_')) {
				visitXmlObjects(child, visit, key);
			}
		}
	}
}

/**
 * Tags whose `@_id` attribute is a shape-ID reference: a connector's bound
 * connection sites (ECMA-376 S20.1.2.2.10 / .11).
 */
const ID_REFERENCE_TAGS = new Set(['a:stCxn', 'a:endCxn']);

/**
 * Tags whose `@_spid` attribute is a shape-ID reference: animation targets
 * and build nodes inside `p:timing` (S19.5.79 `p:spTgt`, S19.5.9 `p:bldP`,
 * S19.5.7 `p:bldOleChart`, S19.5.5 `p:bldDgm`, S19.5.6 `p:bldGraphic`,
 * S19.5.36 `p:inkTgt`) and an ActiveX control's host shape (S19.3.1.2
 * `p:control`). `p:subSp/@spid` names a sub-shape inside a graphic, not a
 * `p:cNvPr/@id`, so it is deliberately absent.
 */
const SPID_REFERENCE_TAGS = new Set([
	'p:spTgt',
	'p:bldP',
	'p:bldOleChart',
	'p:bldDgm',
	'p:bldGraphic',
	'p:inkTgt',
	'p:control',
]);

/**
 * Attributes of the `pptx:animation` editor-metadata extension that hold a
 * shape ID once the save pipeline has remapped them
 * (`remapEditorAnimationsToShapeIds`).
 */
const EDITOR_ANIMATION_ID_ATTRIBUTES = ['@_elementId', '@_triggerShapeId'];

function remapAttribute(
	node: XmlObject,
	attribute: string,
	ids: ReadonlyMap<string, string>,
): void {
	const current = node[attribute];
	if (current === undefined) {
		return;
	}
	const replacement = ids.get(String(current).trim());
	if (replacement !== undefined) {
		node[attribute] = replacement;
	}
}

/**
 * Rewrite shape-ID *references* (not the `p:cNvPr/@id` declarations
 * themselves) after a repair has reassigned one or more shape IDs.
 *
 * Only attributes documented to hold a shape ID are touched: `a:stCxn` /
 * `a:endCxn` `@_id`, the `@_spid` of timing targets, build nodes and
 * `p:control`, and the `pptx:animation` extension's `@_elementId` /
 * `@_triggerShapeId`. Relationship ids, slide ids and timing-node
 * (`p:cTn/@id`) ids are never shape ids and are left alone. A reassignment
 * that updates `p:cNvPr/@id` without also updating these leaves a connector
 * or animation pointing at whichever shape happens to hold the old ID now (or
 * at nothing), which desktop PowerPoint treats as a detached endpoint or a
 * silently dropped effect.
 *
 * Idempotent: a fresh ID is never itself a key of `ids`, so replaying the map
 * over an already-rewritten tree changes nothing.
 */
export function remapShapeIdReferences(root: unknown, ids: ReadonlyMap<string, string>): void {
	if (ids.size === 0) {
		return;
	}
	visitXmlObjects(root, (node, tag) => {
		if (ID_REFERENCE_TAGS.has(tag)) {
			remapAttribute(node, '@_id', ids);
		} else if (SPID_REFERENCE_TAGS.has(tag)) {
			remapAttribute(node, '@_spid', ids);
		} else if (tag === 'pptx:animation') {
			for (const attribute of EDITOR_ANIMATION_ID_ATTRIBUTES) {
				remapAttribute(node, attribute, ids);
			}
		}
	});
}

const NV_CONTAINER_TAGS = [
	'p:nvSpPr',
	'p:nvPicPr',
	'p:nvCxnSpPr',
	'p:nvGrpSpPr',
	'p:nvGraphicFramePr',
	'p:nvContentPartPr',
	'p14:nvContentPartPr',
];

/** The `p:cNvPr` (or `p14:cNvPr`) declaration node of a raw shape, if any. */
export function findCnvPrNode(rawXml: XmlObject | undefined): XmlObject | undefined {
	if (!rawXml) {
		return undefined;
	}
	for (const nvTag of NV_CONTAINER_TAGS) {
		const nv = rawXml[nvTag] as XmlObject | undefined;
		const cNvPr = (nv?.['p:cNvPr'] ?? nv?.['p14:cNvPr']) as XmlObject | undefined;
		if (cNvPr) {
			return cNvPr;
		}
	}
	return undefined;
}

function flattenElements(elements: readonly PptxElement[], out: PptxElement[]): void {
	for (const element of elements) {
		out.push(element);
		if (element.type === 'group' && Array.isArray(element.children)) {
			flattenElements(element.children, out);
		}
	}
}

/**
 * Keep the LIVE element model consistent with a shape-ID reassignment so the
 * next save of the same handler (no reload) re-emits the repaired ids rather
 * than the stale ones: `element.shapeId`, the `p:cNvPr/@id` inside
 * `element.rawXml`, every reference inside `rawXml`, and a connector's
 * `connectorStartConnection` / `connectorEndConnection` `shapeId`. Group
 * children are visited recursively.
 *
 * `rawXml` normally IS the node the validator just renumbered in place (the
 * parser stores the parsed node itself on the element, and the writer emits
 * that same node), in which case its declaration already carries the fresh id
 * and only `shapeId` needs to follow it. When the two are detached (a cloned
 * `rawXml`, or an SDK element with no `rawXml` at all) a lone holder of a
 * remapped id is renumbered, and among several holders of one duplicated id
 * the first keeps it, exactly as the validator did, and the rest take the
 * fresh one.
 *
 * @returns The number of elements whose `shapeId` or raw declaration changed.
 */
export function remapElementShapeIds(
	elements: readonly PptxElement[],
	ids: ReadonlyMap<string, string>,
): number {
	if (ids.size === 0) {
		return 0;
	}
	const flat: PptxElement[] = [];
	flattenElements(elements, flat);

	/** The id an element currently DECLARES: its raw `p:cNvPr/@id`, else `shapeId`. */
	const declaredId = (element: PptxElement): string | undefined => {
		const cNvPr = findCnvPrNode(element.rawXml as XmlObject | undefined);
		if (cNvPr?.['@_id'] !== undefined) {
			return String(cNvPr['@_id']).trim();
		}
		return element.shapeId;
	};
	const holders = new Map<string, number>();
	for (const element of flat) {
		const declared = declaredId(element);
		if (declared !== undefined && ids.has(declared)) {
			holders.set(declared, (holders.get(declared) ?? 0) + 1);
		}
	}

	const keptKeys = new Set<string>();
	// A live element commonly shares its raw XML node with the parsed tree that
	// the structural-id gate repaired. When one duplicate has already changed
	// in place, its sibling that still declares the old id is the retained
	// declaration, not a detached stale holder to rewrite as well.
	const inPlaceRepairedIds = new Set<string>();
	for (const element of flat) {
		const rawId = findCnvPrNode(element.rawXml as XmlObject | undefined)?.['@_id'];
		if (rawId !== undefined) {
			inPlaceRepairedIds.add(String(rawId).trim());
		}
	}
	let changed = 0;
	for (const element of flat) {
		const rawXml = element.rawXml as XmlObject | undefined;
		const cNvPr = findCnvPrNode(rawXml);
		const rawId = cNvPr?.['@_id'] === undefined ? undefined : String(cNvPr['@_id']).trim();
		const declared = rawId ?? element.shapeId;
		let touched = false;

		if (declared !== undefined && ids.has(declared)) {
			// Detached declaration still carrying an old id: a lone holder is
			// renumbered, the first of several keeps it, the rest are renumbered.
			const fresh = ids.get(declared) as string;
			const retainsOldId = inPlaceRepairedIds.has(fresh);
			if (!retainsOldId && ((holders.get(declared) ?? 0) === 1 || keptKeys.has(declared))) {
				if (cNvPr && rawId !== undefined) {
					cNvPr['@_id'] = fresh;
				}
				if (element.shapeId !== undefined) {
					element.shapeId = fresh;
				}
				touched = true;
			} else if (!retainsOldId) {
				keptKeys.add(declared);
			}
		} else if (rawId !== undefined && element.shapeId !== undefined && element.shapeId !== rawId) {
			// The declaration was renumbered in place; `shapeId` still holds the
			// old value.
			if (ids.get(element.shapeId) === rawId) {
				element.shapeId = rawId;
				touched = true;
			}
		}

		if (rawXml) {
			remapShapeIdReferences(rawXml, ids);
		}
		const style = 'shapeStyle' in element ? element.shapeStyle : undefined;
		for (const connection of [style?.connectorStartConnection, style?.connectorEndConnection]) {
			const replacement =
				connection?.shapeId === undefined ? undefined : ids.get(connection.shapeId.trim());
			if (connection && replacement !== undefined) {
				connection.shapeId = replacement;
				touched = true;
			}
		}
		if (touched) {
			changed += 1;
		}
	}
	return changed;
}
