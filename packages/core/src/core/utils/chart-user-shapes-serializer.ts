/**
 * Serializer for a chart drawing-overlay part (`c:userShapes` drawing root).
 *
 * Builds the `cdr:relSizeAnchor` / `cdr:absSizeAnchor` tree back from the
 * typed {@link PptxChartUserShape} model produced by
 * `chart-user-shapes-parser.ts`, so an edited overlay (added, moved, resized,
 * or deleted shape) can be written back to `ppt/drawings/drawingN.xml`.
 *
 * `sp` (preset shape / text box) and `cxnSp` (connector) are fully
 * round-tripped through their typed fields: those are the two kinds a user
 * can add or edit through the inspector. A `pic` / `graphicFrame` entry
 * carries no reconstructable typed representation (a picture's blip
 * reference, a nested chart/table's graphic content), so it is re-emitted
 * from `rawXml`, the verbatim `cdr:pic` / `cdr:graphicFrame` node captured at
 * parse time, instead of a lossy rectangle placeholder. A `grpSp` anchor
 * re-emits its own `cdr:grpSp` node verbatim from `rawXml` while untouched
 * (byte-identical), or rebuilds it from its typed `transform`/`children`
 * once any shape inside it (at any nesting depth) has been edited through
 * the SDK's path-based overlay operations, which clear `rawXml` on every
 * group ancestor along the edited path; see `chart-user-shape-operations.ts`.
 * This only matters when a chart's overlay is edited (the anchor list
 * changed and must be regenerated); an untouched overlay is never
 * re-serialized, see `PptxHandlerRuntimeChartUserShapes.syncChartUserShapesToXml`.
 *
 * @module chart-user-shapes-serializer
 */

import type {
	PptxChartUserShape,
	PptxChartUserShapeGroupChild,
	PptxChartUserShapeGroupTransform,
	PptxChartUserShapeParagraph,
	XmlObject,
} from '../types';
import {
	applyChildXfrmToRawNode,
	applyPicAltText,
	applyRotationFlipToRawNode,
} from './chart-user-shapes-raw-patch';
import { cloneXmlObject } from './clone-utils';

/** The shared visual fields `buildShapeProps`/`buildSpNode`/`buildCxnSpNode` need, common to a top-level shape and a group child. */
type ShapeVisualsLike = Pick<
	PptxChartUserShape,
	| 'kind'
	| 'prst'
	| 'fill'
	| 'stroke'
	| 'strokeWidth'
	| 'paragraphs'
	| 'rotation'
	| 'flipH'
	| 'flipV'
>;

/** A group's own transform plus children, common to a top-level `grpSp` shape and a nested `grpSp` child. */
interface GroupLike {
	transform?: PptxChartUserShapeGroupTransform;
	children?: PptxChartUserShapeGroupChild[];
}

/** Monotonic id counter threaded through the whole drawing tree (anchors, groups, and their children). */
interface IdState {
	next: number;
}

const DEFAULT_GROUP_TRANSFORM: PptxChartUserShapeGroupTransform = {
	off: { x: 0, y: 0 },
	ext: { cx: 0, cy: 0 },
	chOff: { x: 0, y: 0 },
	chExt: { cx: 0, cy: 0 },
};

/** Strip a leading `#` so a hex colour can be written as `a:srgbClr/@_val`. */
function hexVal(hex: string): string {
	return hex.startsWith('#') ? hex.slice(1) : hex;
}

/** Build the `a:rPr` for one paragraph's (single, flattened) run, when any formatting is set. */
function buildRunProps(para: PptxChartUserShapeParagraph): XmlObject | undefined {
	const rPr: XmlObject = {};
	let hasAny = false;
	if (para.fontSize !== undefined) {
		rPr['@_sz'] = String(Math.round(para.fontSize * 100));
		hasAny = true;
	}
	if (para.bold) {
		rPr['@_b'] = '1';
		hasAny = true;
	}
	if (para.italic) {
		rPr['@_i'] = '1';
		hasAny = true;
	}
	if (para.color) {
		rPr['a:solidFill'] = { 'a:srgbClr': { '@_val': hexVal(para.color) } };
		hasAny = true;
	}
	return hasAny ? rPr : undefined;
}

/** Build one `a:p` paragraph node from a flattened overlay paragraph. */
function buildParagraphNode(para: PptxChartUserShapeParagraph): XmlObject {
	const node: XmlObject = {};
	if (para.align) {
		node['a:pPr'] = { '@_algn': para.align };
	}
	const rPr = buildRunProps(para);
	node['a:r'] = {
		...(rPr ? { 'a:rPr': rPr } : {}),
		'a:t': para.text,
	};
	return node;
}

/** Build the `cdr:txBody` for a shape's paragraphs, or `undefined` when there are none. */
function buildTxBody(paragraphs: PptxChartUserShapeParagraph[] | undefined): XmlObject | undefined {
	if (!paragraphs || paragraphs.length === 0) {
		return undefined;
	}
	const p = paragraphs.map(buildParagraphNode);
	return {
		'a:bodyPr': {},
		'a:lstStyle': {},
		'a:p': p.length === 1 ? p[0] : p,
	};
}

/**
 * Merge a shape's own `rotation`/`flipH`/`flipV` onto its `a:xfrm` as `@_rot`
 * (60,000ths of a degree, matching `PptxElementTransformUpdater.ts`'s
 * convention) / `@_flipH` / `@_flipV`, creating a bare `a:xfrm` (no `off`/
 * `ext`) when `base` is `undefined` but rotation/flip is set: verified
 * against real PowerPoint (COM), a TOP-LEVEL anchor shape's `spPr/a:xfrm` can
 * carry `rot`/`flipH`/`flipV` with no `off`/`ext` of its own, independent of
 * the anchor's `cdr:from`/`cdr:to` markers that actually govern its position.
 * Returns `undefined` when there is nothing to write (no base, no
 * rotation/flip): the caller then omits `a:xfrm` entirely, matching a plain
 * unrotated shape's original markup.
 */
function mergeRotationFlipXfrm(
	shape: Pick<PptxChartUserShape, 'rotation' | 'flipH' | 'flipV'>,
	base?: XmlObject,
): XmlObject | undefined {
	const xfrm: XmlObject = base ? { ...base } : {};
	if (shape.rotation) {
		xfrm['@_rot'] = String(Math.round(shape.rotation * 60000));
	}
	if (shape.flipH) {
		xfrm['@_flipH'] = '1';
	}
	if (shape.flipV) {
		xfrm['@_flipV'] = '1';
	}
	return Object.keys(xfrm).length > 0 ? xfrm : undefined;
}

/**
 * Build the `cdr:spPr` shared by `sp` and `cxnSp`. `a:xfrm` (a group child's
 * own position within its parent's child coordinate space, or a top-level
 * shape's own rotation/flip) must sequence FIRST per `CT_ShapeProperties`, so
 * it is threaded in as a constructor argument rather than assigned after the
 * fact.
 */
function buildShapeProps(
	shape: ShapeVisualsLike,
	includeGeometry: boolean,
	xfrm?: XmlObject,
): XmlObject {
	const spPr: XmlObject = {};
	const finalXfrm = mergeRotationFlipXfrm(shape, xfrm);
	if (finalXfrm) {
		spPr['a:xfrm'] = finalXfrm;
	}
	if (includeGeometry) {
		spPr['a:prstGeom'] = { '@_prst': shape.prst ?? 'rect', 'a:avLst': {} };
	}
	if (shape.fill) {
		spPr['a:solidFill'] = { 'a:srgbClr': { '@_val': hexVal(shape.fill) } };
	}
	if (shape.stroke) {
		const ln: XmlObject = { 'a:solidFill': { 'a:srgbClr': { '@_val': hexVal(shape.stroke) } } };
		if (shape.strokeWidth !== undefined) {
			ln['@_w'] = String(Math.round(shape.strokeWidth * 12700));
		}
		spPr['a:ln'] = ln;
	}
	return spPr;
}

/**
 * Build the `cdr:sp` node for a `sp` shape, or the fallback placeholder for a
 * `pic`/`graphicFrame` entry that carries no `rawXml` (an SDK-authored shape
 * with no source markup to fall back to).
 */
function buildSpNode(shape: ShapeVisualsLike, id: number, xfrm?: XmlObject): XmlObject {
	const node: XmlObject = {
		'cdr:nvSpPr': {
			'cdr:cNvPr': { '@_id': String(id), '@_name': `Shape ${id}` },
			'cdr:cNvSpPr': {},
		},
		'cdr:spPr': buildShapeProps(shape, true, xfrm),
	};
	// A rawXml-less pic/graphicFrame has no reconstructable picture/nested
	// content; only sp carries text.
	const txBody = shape.kind === 'sp' ? buildTxBody(shape.paragraphs) : undefined;
	if (txBody) {
		node['cdr:txBody'] = txBody;
	}
	return node;
}

/** Build the `cdr:cxnSp` node for a connector shape. */
function buildCxnSpNode(shape: ShapeVisualsLike, id: number, xfrm?: XmlObject): XmlObject {
	return {
		'cdr:nvCxnSpPr': {
			'cdr:cNvPr': { '@_id': String(id), '@_name': `Connector ${id}` },
			'cdr:cNvCxnSpPr': {},
		},
		'cdr:spPr': buildShapeProps(shape, false, xfrm),
	};
}

/** Build the `a:off`/`a:ext` pair (EMU) for one `a:xfrm`-shaped position/size. */
function buildOffExt(off: { x: number; y: number }, ext: { cx: number; cy: number }): XmlObject {
	return {
		'a:off': { '@_x': String(Math.round(off.x)), '@_y': String(Math.round(off.y)) },
		'a:ext': { '@_cx': String(Math.round(ext.cx)), '@_cy': String(Math.round(ext.cy)) },
	};
}

/** Build a group child's own `a:xfrm` (its `off`/`ext` within the parent group's child space). */
function buildChildXfrm(child: Pick<PptxChartUserShapeGroupChild, 'off' | 'ext'>): XmlObject {
	return buildOffExt(child.off, child.ext);
}

/** Build a group's own `a:xfrm` (its `off`/`ext`/`chOff`/`chExt`, plus its own rotation/flip). */
function buildGroupTransformXfrm(transform: PptxChartUserShapeGroupTransform): XmlObject {
	const xfrm: XmlObject = {
		...buildOffExt(transform.off, transform.ext),
		'a:chOff': {
			'@_x': String(Math.round(transform.chOff.x)),
			'@_y': String(Math.round(transform.chOff.y)),
		},
		'a:chExt': {
			'@_cx': String(Math.round(transform.chExt.cx)),
			'@_cy': String(Math.round(transform.chExt.cy)),
		},
	};
	if (transform.rotation) {
		xfrm['@_rot'] = String(Math.round(transform.rotation * 60000));
	}
	if (transform.flipH) {
		xfrm['@_flipH'] = '1';
	}
	if (transform.flipV) {
		xfrm['@_flipV'] = '1';
	}
	return xfrm;
}

/** Build one grouped child's node, keyed by the `cdr:*` element name it belongs under. */
function buildGroupChildNode(
	child: PptxChartUserShapeGroupChild,
	id: number,
	idState: IdState,
): { key: 'sp' | 'cxnSp' | 'pic' | 'graphicFrame' | 'grpSp'; node: XmlObject } {
	if (child.kind === 'grpSp') {
		if (child.rawXml) {
			return { key: 'grpSp', node: cloneXmlObject(child.rawXml) ?? {} };
		}
		return { key: 'grpSp', node: buildGroupNode(child, id, idState) };
	}
	const rawShapeKey =
		(child.kind === 'pic' || child.kind === 'graphicFrame') && child.rawXml
			? child.kind
			: undefined;
	if (rawShapeKey) {
		// Verbatim source content, except the two fields the inspector's
		// minimal editor can change: position/size (baked into the node's own
		// `a:xfrm`, unlike a top-level anchor) and, for a `pic`, alt text. See
		// `PptxChartUserShape.rawXml`'s doc and `applyChildXfrmToRawNode`'s.
		const rawNode = cloneXmlObject(child.rawXml) ?? {};
		applyChildXfrmToRawNode(rawNode, child.off, child.ext);
		applyRotationFlipToRawNode(rawNode, child.rotation, child.flipH, child.flipV);
		if (rawShapeKey === 'pic') {
			applyPicAltText(rawNode, child.altText);
		}
		return { key: rawShapeKey, node: rawNode };
	}
	if (child.kind === 'cxnSp') {
		return { key: 'cxnSp', node: buildCxnSpNode(child, id, buildChildXfrm(child)) };
	}
	return { key: 'sp', node: buildSpNode(child, id, buildChildXfrm(child)) };
}

/** Append `group.children`, bucketed by `cdr:*` element name (grouped like siblings of the same kind must be). */
function appendGroupChildren(
	node: XmlObject,
	children: readonly PptxChartUserShapeGroupChild[],
	idState: IdState,
): void {
	const buckets: Record<'sp' | 'cxnSp' | 'pic' | 'grpSp' | 'graphicFrame', XmlObject[]> = {
		sp: [],
		cxnSp: [],
		pic: [],
		grpSp: [],
		graphicFrame: [],
	};
	for (const child of children) {
		const id = idState.next++;
		const { key, node: childNode } = buildGroupChildNode(child, id, idState);
		buckets[key].push(childNode);
	}
	for (const key of ['sp', 'cxnSp', 'pic', 'grpSp', 'graphicFrame'] as const) {
		if (buckets[key].length > 0) {
			node[`cdr:${key}`] = buckets[key].length === 1 ? buckets[key][0] : buckets[key];
		}
	}
}

/** Build the `cdr:grpSp` node's body (`cdr:nvGrpSpPr` + `cdr:grpSpPr/a:xfrm` + children) from the typed model. */
function buildGroupNode(group: GroupLike, id: number, idState: IdState): XmlObject {
	const transform = group.transform ?? DEFAULT_GROUP_TRANSFORM;
	const node: XmlObject = {
		'cdr:nvGrpSpPr': {
			'cdr:cNvPr': { '@_id': String(id), '@_name': `Group ${id}` },
			'cdr:cNvGrpSpPr': {},
		},
		'cdr:grpSpPr': {
			'a:xfrm': buildGroupTransformXfrm(transform),
		},
	};
	appendGroupChildren(node, group.children ?? [], idState);
	return node;
}

/** Build the `cdr:from`/`cdr:to`/`cdr:ext` marker nodes for one anchor. */
function buildAnchorGeometry(shape: PptxChartUserShape): XmlObject {
	const geometry: XmlObject = {
		'cdr:from': { 'cdr:x': String(shape.from.x), 'cdr:y': String(shape.from.y) },
	};
	if (shape.anchor === 'rel') {
		const to = shape.to ?? shape.from;
		geometry['cdr:to'] = { 'cdr:x': String(to.x), 'cdr:y': String(to.y) };
	} else {
		const ext = shape.ext ?? { cx: 0, cy: 0 };
		geometry['cdr:ext'] = {
			'@_cx': String(Math.round(ext.cx)),
			'@_cy': String(Math.round(ext.cy)),
		};
	}
	return geometry;
}

/** Build one `cdr:relSizeAnchor` / `cdr:absSizeAnchor` node for `shape`. */
function buildAnchorNode(shape: PptxChartUserShape, idState: IdState): XmlObject {
	const node = buildAnchorGeometry(shape);
	const id = idState.next++;
	if (shape.kind === 'grpSp') {
		// Verbatim source content while untouched, or a full rebuild from the
		// typed transform/children once an edit clears it. See
		// `PptxChartUserShape.rawXml`'s doc.
		node['cdr:grpSp'] = shape.rawXml
			? (cloneXmlObject(shape.rawXml) ?? {})
			: buildGroupNode(shape, id, idState);
		node['cdr:clientData'] = {};
		return node;
	}
	const rawShapeKey =
		(shape.kind === 'pic' || shape.kind === 'graphicFrame') && shape.rawXml
			? (`cdr:${shape.kind}` as const)
			: undefined;
	if (rawShapeKey) {
		// Verbatim source content, except a `pic`'s alt text: re-emit as-is
		// instead of a lossy rectangle placeholder. Position/size need no
		// patch here (a top-level anchor's `cdr:from`/`cdr:to`/`cdr:ext`
		// markers, written above, already govern them independently of any
		// `a:xfrm` the picture node itself might carry). See
		// `PptxChartUserShape.rawXml`'s doc.
		const rawNode = cloneXmlObject(shape.rawXml) ?? {};
		applyRotationFlipToRawNode(rawNode, shape.rotation, shape.flipH, shape.flipV);
		if (shape.kind === 'pic') {
			applyPicAltText(rawNode, shape.altText);
		}
		node[rawShapeKey] = rawNode;
	} else if (shape.kind === 'cxnSp') {
		node['cdr:cxnSp'] = buildCxnSpNode(shape, id);
	} else {
		node['cdr:sp'] = buildSpNode(shape, id);
	}
	// CT_RelSizeAnchor / CT_AbsSizeAnchor both require a trailing clientData
	// child (EG_ObjectChoices' sibling); PowerPoint writes it empty when the
	// shape carries no print/select flags worth preserving.
	node['cdr:clientData'] = {};
	return node;
}

/**
 * Build a complete chart drawing-overlay part (`c:userShapes` root) from the
 * typed overlay model.
 *
 * @param shapes - The chart's current overlay shapes, in the order they
 *   should render (rel-anchored shapes are grouped before abs-anchored ones,
 *   since `CT_Drawing` sequences `relSizeAnchor*` before `absSizeAnchor*`).
 * @returns The parsed-XML-shaped drawing document, ready for `builder.build`.
 */
export function buildChartUserShapesDrawingXml(shapes: readonly PptxChartUserShape[]): XmlObject {
	const relShapes = shapes.filter((s) => s.anchor === 'rel');
	const absShapes = shapes.filter((s) => s.anchor === 'abs');
	const idState: IdState = { next: 2 };
	const root: XmlObject = {
		'@_xmlns:cdr': 'http://schemas.openxmlformats.org/drawingml/2006/chartDrawing',
		'@_xmlns:a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
		'@_xmlns:c': 'http://schemas.openxmlformats.org/drawingml/2006/chart',
		'@_xmlns:r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
	};
	if (relShapes.length > 0) {
		const nodes = relShapes.map((shape) => buildAnchorNode(shape, idState));
		root['cdr:relSizeAnchor'] = nodes.length === 1 ? nodes[0] : nodes;
	}
	if (absShapes.length > 0) {
		const nodes = absShapes.map((shape) => buildAnchorNode(shape, idState));
		root['cdr:absSizeAnchor'] = nodes.length === 1 ? nodes[0] : nodes;
	}
	return { 'c:userShapes': root };
}
