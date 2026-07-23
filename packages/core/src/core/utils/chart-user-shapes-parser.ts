/**
 * Parser for a chart drawing-overlay part (`c:userShapes` drawing root).
 *
 * The chart part's `c:userShapes/@r:id` points at a separate drawing part
 * (`ppt/drawings/drawingN.xml`) whose root is a `c:userShapes` element holding
 * `cdr:relSizeAnchor` / `cdr:absSizeAnchor` wrappers around `sp` / `pic` /
 * `cxnSp` shapes. This module projects that drawing tree into the renderable
 * {@link PptxChartUserShape} model consumed by the shared chart overlay engine.
 *
 * @module chart-user-shapes-parser
 */

import type { PptxChartUserShape, PptxChartUserShapeParagraph, XmlObject } from '../types';

interface XmlLookupLike {
	getChildByLocalName(parent: XmlObject | undefined, name: string): XmlObject | undefined;
	getChildrenArrayByLocalName(parent: XmlObject | undefined, name: string): XmlObject[];
	getScalarChildByLocalName(parent: XmlObject | undefined, name: string): unknown;
}

interface ColorParserLike {
	parseColor(fillNode: XmlObject | undefined, placeholderColor?: string): string | undefined;
}

/** Parse a fractional marker coordinate (`cdr:x` / `cdr:y`, ST_MarkerCoordinate). */
function markerFraction(marker: XmlObject | undefined, axis: string, xml: XmlLookupLike): number {
	const raw = xml.getScalarChildByLocalName(marker, axis);
	const num = Number.parseFloat(String(raw ?? ''));
	return Number.isFinite(num) ? num : 0;
}

/** Extract the `txBody` paragraphs of a shape into light formatted paragraphs. */
function parseShapeParagraphs(
	shape: XmlObject,
	xml: XmlLookupLike,
	colors: ColorParserLike,
): PptxChartUserShapeParagraph[] | undefined {
	const txBody = xml.getChildByLocalName(shape, 'txBody');
	if (!txBody) {
		return undefined;
	}
	const paragraphs: PptxChartUserShapeParagraph[] = [];
	for (const p of xml.getChildrenArrayByLocalName(txBody, 'p')) {
		const runs = xml.getChildrenArrayByLocalName(p, 'r');
		const text = runs
			.map((r) => String(xml.getScalarChildByLocalName(r, 't') ?? ''))
			.join('')
			.trim();
		const pPr = xml.getChildByLocalName(p, 'pPr');
		const firstRpr = xml.getChildByLocalName(runs[0], 'rPr');
		const para: PptxChartUserShapeParagraph = { text };
		const alignRaw = pPr?.['@_algn'];
		if (alignRaw === 'l' || alignRaw === 'ctr' || alignRaw === 'r') {
			para.align = alignRaw;
		}
		const sz = Number.parseFloat(String(firstRpr?.['@_sz'] ?? ''));
		if (Number.isFinite(sz)) {
			para.fontSize = sz / 100;
		}
		if (firstRpr?.['@_b'] === '1' || firstRpr?.['@_b'] === 'true') {
			para.bold = true;
		}
		if (firstRpr?.['@_i'] === '1' || firstRpr?.['@_i'] === 'true') {
			para.italic = true;
		}
		const runColor = colors.parseColor(xml.getChildByLocalName(firstRpr, 'solidFill'));
		if (runColor) {
			para.color = runColor;
		}
		if (text.length > 0 || para.align || para.fontSize) {
			paragraphs.push(para);
		}
	}
	return paragraphs.length > 0 ? paragraphs : undefined;
}

/** Parse the shape properties (geometry, fill, line) shared by sp / cxnSp / pic. */
function parseShapeVisuals(
	shape: XmlObject,
	kind: PptxChartUserShape['kind'],
	xml: XmlLookupLike,
	colors: ColorParserLike,
): Pick<PptxChartUserShape, 'prst' | 'fill' | 'stroke' | 'strokeWidth'> {
	const spPr = xml.getChildByLocalName(shape, 'spPr');
	const result: Pick<PptxChartUserShape, 'prst' | 'fill' | 'stroke' | 'strokeWidth'> = {};

	const prst = xml.getChildByLocalName(spPr, 'prstGeom')?.['@_prst'];
	if (prst) {
		result.prst = String(prst);
	}
	const fill = colors.parseColor(xml.getChildByLocalName(spPr, 'solidFill'));
	if (fill) {
		result.fill = fill;
	}
	const ln = xml.getChildByLocalName(spPr, 'ln');
	const stroke = colors.parseColor(xml.getChildByLocalName(ln, 'solidFill'));
	if (stroke) {
		result.stroke = stroke;
	} else if (kind === 'cxnSp' && ln) {
		// A connector with a line but no explicit fill still draws; use a default.
		result.stroke = '#000000';
	}
	const w = Number.parseFloat(String(ln?.['@_w'] ?? ''));
	if (Number.isFinite(w)) {
		result.strokeWidth = w / 12700;
	}
	return result;
}

/** Parse the single sp / cxnSp / pic child inside an anchor into a shape record. */
function parseAnchorShape(
	anchor: XmlObject,
	base: Pick<PptxChartUserShape, 'anchor' | 'from' | 'to' | 'ext'>,
	xml: XmlLookupLike,
	colors: ColorParserLike,
): PptxChartUserShape | undefined {
	const kinds: PptxChartUserShape['kind'][] = ['sp', 'cxnSp', 'pic'];
	for (const kind of kinds) {
		const shape = xml.getChildByLocalName(anchor, kind);
		if (!shape) {
			continue;
		}
		const visuals = parseShapeVisuals(shape, kind, xml, colors);
		const paragraphs = kind === 'pic' ? undefined : parseShapeParagraphs(shape, xml, colors);
		return {
			kind,
			...base,
			...visuals,
			...(paragraphs ? { paragraphs } : {}),
		};
	}
	return undefined;
}

/**
 * Parse a chart-drawing overlay part into renderable shapes.
 *
 * @param drawingRoot - The parsed XML root of the drawing part (`c:userShapes`).
 * @param xml - XML lookup helpers (local-name aware).
 * @param colors - Colour resolver bridging the runtime `parseColor`.
 * @returns The overlay shapes in document order, or `undefined` when none parse.
 */
export function parseChartUserShapesDrawing(
	drawingRoot: XmlObject | undefined,
	xml: XmlLookupLike,
	colors: ColorParserLike,
): PptxChartUserShape[] | undefined {
	if (!drawingRoot) {
		return undefined;
	}
	const root = xml.getChildByLocalName(drawingRoot, 'userShapes') ?? drawingRoot;
	const shapes: PptxChartUserShape[] = [];

	for (const anchor of xml.getChildrenArrayByLocalName(root, 'relSizeAnchor')) {
		const from = xml.getChildByLocalName(anchor, 'from');
		const to = xml.getChildByLocalName(anchor, 'to');
		const shape = parseAnchorShape(
			anchor,
			{
				anchor: 'rel',
				from: { x: markerFraction(from, 'x', xml), y: markerFraction(from, 'y', xml) },
				to: { x: markerFraction(to, 'x', xml), y: markerFraction(to, 'y', xml) },
			},
			xml,
			colors,
		);
		if (shape) {
			shapes.push(shape);
		}
	}

	for (const anchor of xml.getChildrenArrayByLocalName(root, 'absSizeAnchor')) {
		const from = xml.getChildByLocalName(anchor, 'from');
		const ext = xml.getChildByLocalName(anchor, 'ext');
		const cx = Number.parseFloat(String(ext?.['@_cx'] ?? ''));
		const cy = Number.parseFloat(String(ext?.['@_cy'] ?? ''));
		const shape = parseAnchorShape(
			anchor,
			{
				anchor: 'abs',
				from: { x: markerFraction(from, 'x', xml), y: markerFraction(from, 'y', xml) },
				ext: { cx: Number.isFinite(cx) ? cx : 0, cy: Number.isFinite(cy) ? cy : 0 },
			},
			xml,
			colors,
		);
		if (shape) {
			shapes.push(shape);
		}
	}

	return shapes.length > 0 ? shapes : undefined;
}
