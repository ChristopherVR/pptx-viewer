/**
 * slide-save-xml-order: restore OOXML document order to a slide before it is
 * serialized.
 *
 * Two orderings are lost by the object model and rebuilt here.
 *
 * 1. `p:spTree` child order. `CT_GroupShape` (S19.3.1.45) is an ordered
 *    sequence and document order IS paint order, but fast-xml-parser stores
 *    same-tag siblings in one array per tag, so the save writer's
 *    `spTree['p:sp'] = shapes; spTree['p:pic'] = pics; ...` collapses an
 *    interleaved tree (`sp,sp,grpSp,pic,sp,...`) into tag-grouped order
 *    (`sp x43, grpSp, pic, pic`). Every picture, connector and group jumps to
 *    the front of the z-order on a plain load -> save. Parsing already keeps
 *    true document order (`PptxHandlerRuntimeSpTreeParsing.extractSpTreeChildOrder`),
 *    so the writer only has to stop discarding it: elements are stamped with
 *    their position as they are emitted, and the children are re-keyed here
 *    using the `#pptx-order-N` marker trick that `orderedXmlKey` already uses
 *    for custom-geometry path commands and OMML runs (the XML builder strips
 *    the markers, so the serialized tag names are unchanged).
 *
 * 2. `p:sld` child order. `CT_Slide` is the sequence `p:cSld, p:clrMapOvr,
 *    p:transition, p:timing, p:extLst`; a key added to the parsed object lands
 *    at the end instead. An `mc:AlternateContent` envelope is ranked by what it
 *    wraps, so a slide-root envelope around `p:transition` sorts into the
 *    transition slot.
 *
 * The reordering is applied to a shallow clone of the `p:sld` / `p:cSld` /
 * `p:spTree` spine rather than to the live objects, so the marker keys exist
 * only for the duration of one `builder.build` call and never leak into the
 * cached slide map (where a second save, or any tag-keyed reader, would
 * mis-handle them).
 */
import type { XmlObject } from '../../types';
import { SHAPE_TREE_ELEMENT_TAGS } from '../../utils';
import { assignOrderedXmlChildren, setOwnXmlProperty } from './ordered-xml-children';
import type { SlideShapeCollectors } from './PptxHandlerRuntimeSaveElementWriter';

const ALTERNATE_CONTENT_TAG = 'mc:AlternateContent';
const UNRANKED = Number.MAX_SAFE_INTEGER;

/** Collector keys, in the order a single element's output is read back out. */
const COLLECTOR_KEYS = [
	'shapes',
	'pics',
	'connectors',
	'graphicFrames',
	'groups',
	'model3ds',
	'contentParts',
	'zooms',
] as const satisfies ReadonlyArray<keyof SlideShapeCollectors>;

/** `CT_Slide` sequence positions, by local name. */
const SLIDE_ROOT_RANK: Readonly<Record<string, number>> = {
	cSld: 10,
	clrMapOvr: 20,
	transition: 30,
	timing: 40,
	extLst: 60,
};
const SLIDE_ROOT_UNKNOWN_RANK = 50;

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
 * Stamps each XML node with the position of the `slide.elements` entry that
 * produced it, so the tag-grouped collectors can be re-interleaved on save.
 */
export class SpTreeChildOrderTracker {
	private readonly collectors: SlideShapeCollectors;

	private readonly consumed: number[];

	private readonly positions = new Map<XmlObject, number>();

	private next = 0;

	public constructor(collectors: SlideShapeCollectors) {
		this.collectors = collectors;
		this.consumed = COLLECTOR_KEYS.map(() => 0);
	}

	/** Stamp every node appended to a collector since the previous call. */
	public capture(): void {
		COLLECTOR_KEYS.forEach((collectorKey, index) => {
			const list = this.collectors[collectorKey];
			for (let i = this.consumed[index] ?? 0; i < list.length; i++) {
				const node = list[i];
				if (node && !this.positions.has(node)) {
					this.positions.set(node, this.next++);
				}
			}
			this.consumed[index] = list.length;
		});
	}

	/** Document position of a node, or `undefined` when it was never stamped. */
	public positionOf(node: XmlObject): number | undefined {
		return this.positions.get(node);
	}
}

/** Lowest stamped position among the shape-tree children of an MCE envelope. */
function envelopeRank(envelope: XmlObject, positionOf: (node: XmlObject) => number | undefined) {
	let rank = UNRANKED;
	for (const branchKey of Object.keys(envelope)) {
		if (branchKey.startsWith('@_')) {
			continue;
		}
		for (const branch of asObjects(envelope[branchKey])) {
			for (const tag of SHAPE_TREE_ELEMENT_TAGS) {
				for (const node of asObjects(branch[tag])) {
					rank = Math.min(rank, positionOf(node) ?? UNRANKED);
				}
			}
		}
	}
	return rank;
}

/** Rebuild `spTree` with its element children back in document order. */
export function orderShapeTreeChildren(
	spTree: XmlObject,
	positionOf: (node: XmlObject) => number | undefined,
	getLocalName: (key: string) => string,
): XmlObject {
	const leading: Array<[string, unknown]> = [];
	const trailing: Array<[string, unknown]> = [];
	const entries: Array<{ key: string; node: XmlObject; rank: number; seq: number }> = [];
	for (const [key, value] of Object.entries(spTree)) {
		if (SHAPE_TREE_ELEMENT_TAGS.has(key) || key === ALTERNATE_CONTENT_TAG) {
			for (const node of asObjects(value)) {
				const rank =
					key === ALTERNATE_CONTENT_TAG
						? envelopeRank(node, positionOf)
						: (positionOf(node) ?? UNRANKED);
				entries.push({ key, node, rank, seq: entries.length });
			}
			continue;
		}
		if (!key.startsWith('@_') && getLocalName(key) === 'extLst') {
			trailing.push([key, value]);
			continue;
		}
		leading.push([key, value]);
	}
	if (entries.length === 0) {
		return spTree;
	}
	entries.sort((a, b) => a.rank - b.rank || a.seq - b.seq);

	const result: XmlObject = {};
	for (const [key, value] of leading) {
		setOwnXmlProperty(result, key, value);
	}
	assignOrderedXmlChildren(
		result,
		entries.map((entry) => ({ tag: entry.key, node: entry.node })),
	);
	for (const [key, value] of trailing) {
		setOwnXmlProperty(result, key, value);
	}
	return result;
}

/** `CT_Slide` sequence rank of one `p:sld` child. */
function slideRootRank(key: string, node: unknown, getLocalName: (key: string) => string): number {
	const local = getLocalName(key);
	if (local !== 'AlternateContent' || !isXmlObject(node)) {
		return SLIDE_ROOT_RANK[local] ?? SLIDE_ROOT_UNKNOWN_RANK;
	}
	let rank = SLIDE_ROOT_UNKNOWN_RANK;
	for (const branchKey of Object.keys(node)) {
		if (branchKey.startsWith('@_')) {
			continue;
		}
		for (const branch of asObjects(node[branchKey])) {
			for (const childKey of Object.keys(branch)) {
				const childLocal = getLocalName(childKey);
				if (childLocal === 'transition' || childLocal === 'timing') {
					rank = Math.min(rank, SLIDE_ROOT_RANK[childLocal] ?? SLIDE_ROOT_UNKNOWN_RANK);
				}
			}
		}
	}
	return rank;
}

/** Rebuild a `p:sld` node with its children in `CT_Slide` sequence order. */
export function orderSlideRootChildren(
	slideNode: XmlObject,
	getLocalName: (key: string) => string,
): XmlObject {
	const attributes: Array<[string, unknown]> = [];
	const entries: Array<{ key: string; value: unknown; rank: number; seq: number }> = [];
	for (const [key, value] of Object.entries(slideNode)) {
		if (key.startsWith('@_')) {
			attributes.push([key, value]);
			continue;
		}
		const nodes = asObjects(value);
		if (nodes.length === 0) {
			entries.push({
				key,
				value,
				rank: slideRootRank(key, value, getLocalName),
				seq: entries.length,
			});
			continue;
		}
		for (const node of nodes) {
			entries.push({
				key,
				value: node,
				rank: slideRootRank(key, node, getLocalName),
				seq: entries.length,
			});
		}
	}
	entries.sort((a, b) => a.rank - b.rank || a.seq - b.seq);

	const result: XmlObject = {};
	for (const [key, value] of attributes) {
		setOwnXmlProperty(result, key, value);
	}
	assignOrderedXmlChildren(
		result,
		entries.map((entry) => ({ tag: entry.key, node: entry.value })),
	);
	return result;
}

/**
 * Shallow-clone the `p:sld` / `p:cSld` / `p:spTree` spine of a parsed slide,
 * with the shape tree back in document order and the slide root back in
 * `CT_Slide` sequence order. Node objects are shared with the input, so this
 * is cheap and safe to call immediately before serialization.
 */
export function buildOrderedSlideXml(options: {
	xmlObj: XmlObject;
	positionOf: (node: XmlObject) => number | undefined;
	getLocalName: (key: string) => string;
}): XmlObject {
	const { xmlObj, positionOf, getLocalName } = options;
	const slideNode = xmlObj['p:sld'];
	if (!isXmlObject(slideNode)) {
		return xmlObj;
	}
	let nextSlide: XmlObject = { ...slideNode };
	const commonSlideData = nextSlide['p:cSld'];
	if (isXmlObject(commonSlideData)) {
		const spTree = commonSlideData['p:spTree'];
		if (isXmlObject(spTree)) {
			nextSlide['p:cSld'] = {
				...commonSlideData,
				'p:spTree': orderShapeTreeChildren(spTree, positionOf, getLocalName),
			};
		}
	}
	nextSlide = orderSlideRootChildren(nextSlide, getLocalName);
	return { ...xmlObj, 'p:sld': nextSlide };
}
