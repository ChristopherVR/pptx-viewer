/**
 * Serializer for a chart drawing-overlay part (`c:userShapes` drawing root).
 *
 * Builds the `cdr:relSizeAnchor` / `cdr:absSizeAnchor` tree back from the
 * typed {@link PptxChartUserShape} model produced by
 * `chart-user-shapes-parser.ts`, so an edited overlay (added, moved, resized,
 * or deleted shape) can be written back to `ppt/drawings/drawingN.xml`.
 *
 * Only `sp` (preset shape / text box) and `cxnSp` (connector) are fully
 * round-tripped: those are the two kinds a user can add or edit through the
 * inspector. A `pic` / `grpSp` / `graphicFrame` entry surviving from the
 * original parse (grpSp already flattened into several `sp`/`cxnSp`/`pic`
 * entries by the parser, each losing the group's own transform) is
 * re-emitted as a plain rectangle carrying only its fill/stroke, since the
 * flattened render model has no picture reference or nested graphic content
 * to reconstruct. This only matters when a chart's overlay is edited (the
 * anchor list changed and must be regenerated); an untouched overlay is
 * never re-serialized, see `PptxHandlerRuntimeChartUserShapes.syncChartUserShapesToXml`.
 *
 * @module chart-user-shapes-serializer
 */

import type { PptxChartUserShape, PptxChartUserShapeParagraph, XmlObject } from '../types';

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

/** Build the `cdr:spPr` shared by `sp` and `cxnSp`. */
function buildShapeProps(shape: PptxChartUserShape, includeGeometry: boolean): XmlObject {
	const spPr: XmlObject = {};
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

/** Build the `cdr:sp` node for a `sp` shape, or the fallback placeholder for `pic`/`grpSp`/`graphicFrame`. */
function buildSpNode(shape: PptxChartUserShape, id: number): XmlObject {
	const node: XmlObject = {
		'cdr:nvSpPr': {
			'cdr:cNvPr': { '@_id': String(id), '@_name': `Shape ${id}` },
			'cdr:cNvSpPr': {},
		},
		'cdr:spPr': buildShapeProps(shape, true),
	};
	// pic/grpSp/graphicFrame have no reconstructable picture/nested content in
	// the flattened render model; only sp carries text.
	const txBody = shape.kind === 'sp' ? buildTxBody(shape.paragraphs) : undefined;
	if (txBody) {
		node['cdr:txBody'] = txBody;
	}
	return node;
}

/** Build the `cdr:cxnSp` node for a connector shape. */
function buildCxnSpNode(shape: PptxChartUserShape, id: number): XmlObject {
	return {
		'cdr:nvCxnSpPr': {
			'cdr:cNvPr': { '@_id': String(id), '@_name': `Connector ${id}` },
			'cdr:cNvCxnSpPr': {},
		},
		'cdr:spPr': buildShapeProps(shape, false),
	};
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
function buildAnchorNode(shape: PptxChartUserShape, id: number): XmlObject {
	const node = buildAnchorGeometry(shape);
	if (shape.kind === 'cxnSp') {
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
	let nextAutoId = 2;
	const root: XmlObject = {
		'@_xmlns:cdr': 'http://schemas.openxmlformats.org/drawingml/2006/chartDrawing',
		'@_xmlns:a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
		'@_xmlns:c': 'http://schemas.openxmlformats.org/drawingml/2006/chart',
		'@_xmlns:r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
	};
	if (relShapes.length > 0) {
		const nodes = relShapes.map((shape) => buildAnchorNode(shape, nextAutoId++));
		root['cdr:relSizeAnchor'] = nodes.length === 1 ? nodes[0] : nodes;
	}
	if (absShapes.length > 0) {
		const nodes = absShapes.map((shape) => buildAnchorNode(shape, nextAutoId++));
		root['cdr:absSizeAnchor'] = nodes.length === 1 ? nodes[0] : nodes;
	}
	return { 'c:userShapes': root };
}
