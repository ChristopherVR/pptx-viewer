/**
 * template-sp-tree-order: restore OOXML document order to a slide LAYOUT or
 * slide MASTER shape tree before the save pipeline flushes it.
 *
 * `slide-save-xml-order.ts` fixed this for slides. It could not fix it for the
 * template parts, because those reach the ZIP by a different route: a layout
 * or master is not rebuilt from the typed model on an ordinary save, it is
 * re-serialized straight out of `layoutXmlMap` / `masterXmlMap`. That is
 * usually a virtue (every unmodelled attribute survives verbatim), but it
 * inherits fast-xml-parser's one-array-per-tag storage: a tree authored
 * `pic,grpSp,sp,sp,pic,grpSp,sp` comes back `pic,pic,grpSp,grpSp,sp,sp,sp`,
 * because the object's key order is the order each tag FIRST appeared and
 * every later sibling of that tag joins the earlier bucket.
 *
 * `CT_GroupShape` (S19.3.1.45) is a painter's-algorithm list, so that is a
 * silent restack of the deck's furniture: a connector authored behind a
 * layout's text comes back in front of it, on every slide using that layout,
 * from a no-edit open-and-save. It was measured on 31 template parts across
 * seven corpus decks.
 *
 * Two order sources, one application point (the flush):
 *
 * - **Passthrough.** The parsed nodes are the ones the loader read, so the
 *   original part XML still describes them: `scanSpTreeDocumentOrder` reads
 *   the authored sequence back off it, groups included, and the refs resolve
 *   against the cached object by array position.
 * - **Rewritten.** When the Slide Master view actually edited a part,
 *   `PptxHandlerRuntimeSaveMasterElements` rebuilds the tree from
 *   `PptxElement[]`; those nodes are new, so it stamps them through
 *   `SpTreeChildOrderTracker` and records the positions here instead. Its
 *   groups are already emitted in order by `appendGroupChildren`, so only the
 *   top level needs re-interleaving on that route.
 *
 * The ordering is applied to a shallow CLONE of the spine, exactly as the
 * slide side does, so the `#pptx-order-N` marker keys live only for the
 * duration of one `builder.build` call and never leak into the cached part
 * map, where a second save or any tag-keyed reader would mis-handle them.
 */
import type { XmlObject } from '../../types';
import { SHAPE_TREE_ELEMENT_TAGS } from '../../utils';
import type { MasterPartRootTag } from './master-part-tags';
import { setOwnXmlProperty } from './ordered-xml-children';
import { orderShapeTreeChildren } from './slide-save-xml-order';
import { scanSpTreeDocumentOrder } from './sp-tree-document-order-scan';
import type { SpTreeChildPlan } from './sp-tree-document-order-scan';

const ALTERNATE_CONTENT_TAG = 'mc:AlternateContent';

/** Positions recorded for a rewritten part, keyed by runtime then part path. */
const positionsByRuntime = new WeakMap<object, Map<string, Map<XmlObject, number>>>();

function isXmlObject(value: unknown): value is XmlObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asObjects(value: unknown): XmlObject[] {
	if (Array.isArray(value)) {
		return value.filter(isXmlObject);
	}
	return isXmlObject(value) ? [value] : [];
}

/**
 * Record the document position of every shape-tree child of a part the save
 * pipeline REBUILT from the typed model, so the flush can re-interleave the
 * tag-bucketed collectors it produced.
 */
export function rememberTemplateSpTreePositions(
	runtime: object,
	partPath: string,
	spTree: XmlObject,
	positionOf: (node: XmlObject) => number | undefined,
): void {
	const positions = new Map<XmlObject, number>();
	for (const [key, value] of Object.entries(spTree)) {
		if (!SHAPE_TREE_ELEMENT_TAGS.has(key) && key !== ALTERNATE_CONTENT_TAG) {
			continue;
		}
		for (const node of asObjects(value)) {
			const position = positionOf(node);
			if (position !== undefined) {
				positions.set(node, position);
			}
		}
	}
	let byPart = positionsByRuntime.get(runtime);
	if (!byPart) {
		byPart = new Map();
		positionsByRuntime.set(runtime, byPart);
	}
	byPart.set(partPath, positions);
}

/**
 * Replace one entry of `container[tag]` without touching the input.
 *
 * Returns a shallow clone of the container holding a shallow clone of that
 * tag's array. The originals stay intact because they are the loader's cached
 * objects and a later save reads them again.
 */
function withReplacedChild(
	container: XmlObject,
	tag: string,
	indexInType: number,
	replacement: XmlObject,
): XmlObject {
	const existing = container[tag];
	const next: XmlObject = { ...container };
	if (Array.isArray(existing)) {
		const siblings = [...existing];
		siblings[indexInType] = replacement;
		setOwnXmlProperty(next, tag, siblings);
	} else {
		setOwnXmlProperty(next, tag, replacement);
	}
	return next;
}

/**
 * A container (`p:spTree` or `p:grpSp`) whose children, and whose groups'
 * children, are back in `plan` order. Returns the input unchanged when nothing
 * moves.
 */
function orderContainer(
	container: XmlObject,
	plan: readonly SpTreeChildPlan[],
	getLocalName: (key: string) => string,
): XmlObject {
	let working = container;
	for (const entry of plan) {
		if (entry.children.length === 0) {
			continue;
		}
		const group = asObjects(working[entry.tag])[entry.indexInType];
		if (!group) {
			continue;
		}
		const ordered = orderContainer(group, entry.children, getLocalName);
		if (ordered !== group) {
			working = withReplacedChild(working, entry.tag, entry.indexInType, ordered);
		}
	}

	const positions = new Map<XmlObject, number>();
	plan.forEach((entry, position) => {
		const node = asObjects(working[entry.tag])[entry.indexInType];
		if (node && !positions.has(node)) {
			positions.set(node, position);
		}
	});
	if (positions.size === 0) {
		return working;
	}
	return orderShapeTreeChildren(working, (node) => positions.get(node), getLocalName);
}

/**
 * A shallow clone of a layout or master part whose shape tree is back in
 * document order, or the input untouched when the order cannot be recovered
 * (in which case the caller keeps today's tag-bucketed output).
 */
export function orderedTemplatePartXml(options: {
	runtime: object;
	partPath: string;
	xmlObj: XmlObject;
	rootTag: MasterPartRootTag;
	/** The part as it was loaded, used when the tree was not rebuilt. */
	sourceXml: string | undefined;
	getLocalName: (key: string) => string;
}): XmlObject {
	const { runtime, partPath, xmlObj, rootTag, sourceXml, getLocalName } = options;
	const root = xmlObj[rootTag];
	if (!isXmlObject(root)) {
		return xmlObj;
	}
	const commonSlideData = root['p:cSld'];
	if (!isXmlObject(commonSlideData)) {
		return xmlObj;
	}
	const spTree = commonSlideData['p:spTree'];
	if (!isXmlObject(spTree)) {
		return xmlObj;
	}

	const rebuilt = positionsByRuntime.get(runtime)?.get(partPath);
	const ordered = rebuilt
		? orderShapeTreeChildren(spTree, (node) => rebuilt.get(node), getLocalName)
		: orderContainer(spTree, sourceXml ? scanSpTreeDocumentOrder(sourceXml) : [], getLocalName);
	if (ordered === spTree) {
		return xmlObj;
	}
	const nextRoot: XmlObject = { ...root, 'p:cSld': { ...commonSlideData, 'p:spTree': ordered } };
	const nextPart: XmlObject = { ...xmlObj };
	setOwnXmlProperty(nextPart, rootTag, nextRoot);
	return nextPart;
}
