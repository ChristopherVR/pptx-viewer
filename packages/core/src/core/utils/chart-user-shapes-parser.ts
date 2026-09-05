/**
 * Parser for a chart drawing-overlay part (`c:userShapes` drawing root).
 *
 * The chart part's `c:userShapes/@r:id` points at a separate drawing part
 * (`ppt/drawings/drawingN.xml`) whose root is a `c:userShapes` element holding
 * `cdr:relSizeAnchor` / `cdr:absSizeAnchor` wrappers around `sp` / `pic` /
 * `cxnSp` / `grpSp` shapes. This module projects that drawing tree into the
 * renderable {@link PptxChartUserShape} model consumed by the shared chart
 * overlay engine. A `grpSp` anchor keeps its nested structure (its own
 * transform plus children, arbitrarily nested); {@link flattenChartUserShapes}
 * projects that structure into a flat, render-ready leaf list for consumers
 * that only want positioned shapes.
 *
 * @module chart-user-shapes-parser
 */

import type {
	PptxChartUserShape,
	PptxChartUserShapeGroupChild,
	PptxChartUserShapeGroupTransform,
	PptxChartUserShapeParagraph,
	XmlObject,
} from '../types';
import { cloneXmlObject } from './clone-utils';

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

/**
 * Resolve a shape's fill to a single representative hex colour: a solid fill
 * directly, otherwise a gradient's first stop or a pattern's foreground as an
 * approximation (this overlay model has no gradient/pattern fill fields of
 * its own, so a single colour is the closest fit).
 */
function resolveShapeFill(
	spPr: XmlObject | undefined,
	xml: XmlLookupLike,
	colors: ColorParserLike,
): string | undefined {
	const solid = colors.parseColor(xml.getChildByLocalName(spPr, 'solidFill'));
	if (solid) {
		return solid;
	}
	const gradFill = xml.getChildByLocalName(spPr, 'gradFill');
	if (gradFill) {
		const gsLst = xml.getChildByLocalName(gradFill, 'gsLst');
		const firstStop = xml.getChildrenArrayByLocalName(gsLst, 'gs')[0];
		const gradColor = firstStop ? colors.parseColor(firstStop) : undefined;
		if (gradColor) {
			return gradColor;
		}
	}
	const pattFill = xml.getChildByLocalName(spPr, 'pattFill');
	if (pattFill) {
		return colors.parseColor(xml.getChildByLocalName(pattFill, 'fgClr'));
	}
	return undefined;
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
	const fill = resolveShapeFill(spPr, xml, colors);
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

const DIRECT_KINDS: Array<'sp' | 'cxnSp' | 'pic'> = ['sp', 'cxnSp', 'pic'];

/** Build one flattened overlay shape from a direct sp / cxnSp / pic node. */
function buildUserShape(
	shape: XmlObject,
	kind: 'sp' | 'cxnSp' | 'pic',
	base: Pick<PptxChartUserShape, 'anchor' | 'from' | 'to' | 'ext'>,
	xml: XmlLookupLike,
	colors: ColorParserLike,
): PptxChartUserShape {
	const visuals = parseShapeVisuals(shape, kind, xml, colors);
	const paragraphs = kind === 'pic' ? undefined : parseShapeParagraphs(shape, xml, colors);
	// A `pic` has no reconstructable typed representation (its blip
	// reference), so the raw node is kept for verbatim re-emission; see
	// `PptxChartUserShape.rawXml`'s doc.
	const rawXml = kind === 'pic' ? cloneXmlObject(shape) : undefined;
	return {
		kind,
		...base,
		...visuals,
		...(paragraphs ? { paragraphs } : {}),
		...(rawXml ? { rawXml } : {}),
	};
}

/** Parse one `a:off`/`a:ext`-shaped pair of nodes into EMU numbers. */
function parseOffExt(
	offNode: XmlObject | undefined,
	extNode: XmlObject | undefined,
): { off: { x: number; y: number }; ext: { cx: number; cy: number } } {
	const num = (node: XmlObject | undefined, attr: string): number => {
		const raw = Number.parseFloat(String(node?.[attr] ?? ''));
		return Number.isFinite(raw) ? raw : 0;
	};
	return {
		off: { x: num(offNode, '@_x'), y: num(offNode, '@_y') },
		ext: { cx: num(extNode, '@_cx'), cy: num(extNode, '@_cy') },
	};
}

/**
 * Parse a `grpSp`'s own `cdr:grpSpPr/a:xfrm`: its position/size in its
 * parent's coordinate space ({@link PptxChartUserShapeGroupTransform.off}/
 * `ext`) and the coordinate space its children are expressed in
 * (`chOff`/`chExt`).
 */
function parseGroupTransform(
	group: XmlObject,
	xml: XmlLookupLike,
): PptxChartUserShapeGroupTransform {
	const grpSpPr = xml.getChildByLocalName(group, 'grpSpPr');
	const xfrm = xml.getChildByLocalName(grpSpPr, 'xfrm');
	const { off, ext } = parseOffExt(
		xml.getChildByLocalName(xfrm, 'off'),
		xml.getChildByLocalName(xfrm, 'ext'),
	);
	const { off: chOff, ext: chExt } = parseOffExt(
		xml.getChildByLocalName(xfrm, 'chOff'),
		xml.getChildByLocalName(xfrm, 'chExt'),
	);
	return { off, ext, chOff, chExt };
}

/**
 * Parse a group child's own `a:xfrm` (position within the parent group's
 * child coordinate space). Direct shapes (`sp`/`cxnSp`/`pic`) carry it under
 * their `spPr`; a `graphicFrame` carries it directly.
 */
function parseChildOffExt(
	shape: XmlObject,
	xml: XmlLookupLike,
): { off: { x: number; y: number }; ext: { cx: number; cy: number } } {
	const spPr = xml.getChildByLocalName(shape, 'spPr');
	const xfrm = xml.getChildByLocalName(spPr, 'xfrm') ?? xml.getChildByLocalName(shape, 'xfrm');
	return parseOffExt(xml.getChildByLocalName(xfrm, 'off'), xml.getChildByLocalName(xfrm, 'ext'));
}

/** Build one grouped `sp`/`cxnSp`/`pic` child, positioned in its parent's child coordinate space. */
function buildGroupChild(
	shape: XmlObject,
	kind: 'sp' | 'cxnSp' | 'pic',
	xml: XmlLookupLike,
	colors: ColorParserLike,
): PptxChartUserShapeGroupChild {
	const visuals = parseShapeVisuals(shape, kind, xml, colors);
	const paragraphs = kind === 'pic' ? undefined : parseShapeParagraphs(shape, xml, colors);
	const rawXml = kind === 'pic' ? cloneXmlObject(shape) : undefined;
	const { off, ext } = parseChildOffExt(shape, xml);
	return {
		kind,
		off,
		ext,
		...visuals,
		...(paragraphs ? { paragraphs } : {}),
		...(rawXml ? { rawXml } : {}),
	};
}

/** Build a nested `grpSp` child, recursing into its own children. */
function buildNestedGroupChild(
	group: XmlObject,
	xml: XmlLookupLike,
	colors: ColorParserLike,
): PptxChartUserShapeGroupChild {
	const transform = parseGroupTransform(group, xml);
	return {
		kind: 'grpSp',
		off: transform.off,
		ext: transform.ext,
		transform,
		children: parseGroupChildren(group, xml, colors),
		// Verbatim source for byte-identical re-emission while untouched; see
		// `PptxChartUserShape.rawXml`'s doc (same contract one level up).
		rawXml: cloneXmlObject(group),
	};
}

/** Parse every child of a `grpSp` (`sp`/`cxnSp`/`pic`/nested `grpSp`/`graphicFrame`), in kind order. */
function parseGroupChildren(
	group: XmlObject,
	xml: XmlLookupLike,
	colors: ColorParserLike,
): PptxChartUserShapeGroupChild[] {
	const children: PptxChartUserShapeGroupChild[] = [];
	for (const kind of DIRECT_KINDS) {
		for (const child of xml.getChildrenArrayByLocalName(group, kind)) {
			children.push(buildGroupChild(child, kind, xml, colors));
		}
	}
	for (const nested of xml.getChildrenArrayByLocalName(group, 'grpSp')) {
		children.push(buildNestedGroupChild(nested, xml, colors));
	}
	for (const graphicFrame of xml.getChildrenArrayByLocalName(group, 'graphicFrame')) {
		const { off, ext } = parseChildOffExt(graphicFrame, xml);
		children.push({
			kind: 'graphicFrame',
			off,
			ext,
			rawXml: cloneXmlObject(graphicFrame),
		});
	}
	return children;
}

/**
 * Parse the shape child(ren) inside an anchor into overlay shape records.
 *
 * A direct `sp`/`cxnSp`/`pic` child yields exactly one shape. A `grpSp`
 * (grouped annotation shapes, e.g. a callout built from several drawn
 * shapes) yields one `grpSp` entry carrying the group's own transform and
 * its (arbitrarily nested) children; use {@link flattenChartUserShapes} to
 * project that into a flat, positioned leaf list. A `graphicFrame` (e.g. a
 * nested chart or table drawn as an annotation) is out of scope for real
 * content; it registers a single bare placeholder so the overlay's space is
 * accounted for instead of the whole anchor silently disappearing.
 */
function parseAnchorShape(
	anchor: XmlObject,
	base: Pick<PptxChartUserShape, 'anchor' | 'from' | 'to' | 'ext'>,
	xml: XmlLookupLike,
	colors: ColorParserLike,
): PptxChartUserShape[] {
	for (const kind of DIRECT_KINDS) {
		const shape = xml.getChildByLocalName(anchor, kind);
		if (shape) {
			return [buildUserShape(shape, kind, base, xml, colors)];
		}
	}

	const group = xml.getChildByLocalName(anchor, 'grpSp');
	if (group) {
		const transform = parseGroupTransform(group, xml);
		return [
			{
				kind: 'grpSp',
				...base,
				transform,
				children: parseGroupChildren(group, xml, colors),
				// Verbatim source for byte-identical re-emission while untouched;
				// see `PptxChartUserShape.rawXml`'s doc.
				rawXml: cloneXmlObject(group),
			},
		];
	}

	const graphicFrame = xml.getChildByLocalName(anchor, 'graphicFrame');
	if (graphicFrame) {
		// Deep content (a nested chart or table) is out of scope for the typed
		// model, but the raw node is kept so the serializer can re-emit it
		// verbatim instead of dropping it to a bare placeholder; see
		// `PptxChartUserShape.rawXml`'s doc.
		const rawXml = cloneXmlObject(graphicFrame);
		return [{ kind: 'graphicFrame', ...base, ...(rawXml ? { rawXml } : {}) }];
	}

	return [];
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
		shapes.push(
			...parseAnchorShape(
				anchor,
				{
					anchor: 'rel',
					from: { x: markerFraction(from, 'x', xml), y: markerFraction(from, 'y', xml) },
					to: { x: markerFraction(to, 'x', xml), y: markerFraction(to, 'y', xml) },
				},
				xml,
				colors,
			),
		);
	}

	for (const anchor of xml.getChildrenArrayByLocalName(root, 'absSizeAnchor')) {
		const from = xml.getChildByLocalName(anchor, 'from');
		const ext = xml.getChildByLocalName(anchor, 'ext');
		const cx = Number.parseFloat(String(ext?.['@_cx'] ?? ''));
		const cy = Number.parseFloat(String(ext?.['@_cy'] ?? ''));
		shapes.push(
			...parseAnchorShape(
				anchor,
				{
					anchor: 'abs',
					from: { x: markerFraction(from, 'x', xml), y: markerFraction(from, 'y', xml) },
					ext: { cx: Number.isFinite(cx) ? cx : 0, cy: Number.isFinite(cy) ? cy : 0 },
				},
				xml,
				colors,
			),
		);
	}

	return shapes.length > 0 ? shapes : undefined;
}

/** A leaf overlay shape produced by {@link flattenChartUserShapes}: never `grpSp`. */
type FlattenedChartUserShape = Omit<PptxChartUserShape, 'kind' | 'transform' | 'children'> & {
	kind: Exclude<PptxChartUserShape['kind'], 'grpSp'>;
};

/**
 * Map a child's position (in its parent group's `chOff`/`chExt` coordinate
 * space) into a fraction of the group's own box: `(childOff - chOff) /
 * chExt`. The group's own box, in turn, is defined to span the FULL bounding
 * box of whatever anchored it (the enclosing `relSizeAnchor`/`absSizeAnchor`,
 * or an enclosing group's own box), so this fraction composes directly with
 * an ancestor fraction by multiplication, regardless of how many `off`/`ext`
 * unit choices the original authoring tool used at each nesting level (they
 * cancel out; only the `chOff`/`chExt` ratio at each level matters).
 */
function childFraction(
	childOff: { x: number; y: number },
	childExt: { cx: number; cy: number },
	chOff: { x: number; y: number },
	chExt: { cx: number; cy: number },
): { x: number; y: number; w: number; h: number } {
	const safeDiv = (num: number, den: number): number => (den !== 0 ? num / den : 0);
	return {
		x: safeDiv(childOff.x - chOff.x, chExt.cx),
		y: safeDiv(childOff.y - chOff.y, chExt.cy),
		w: safeDiv(childExt.cx, chExt.cx),
		h: safeDiv(childExt.cy, chExt.cy),
	};
}

/**
 * Flatten a chart's overlay shapes into a leaf list ready for rendering: a
 * `grpSp` entry is expanded into its grouped children with the group's
 * transform (`chOff`/`chExt` vs. each child's own `off`/`ext`) already
 * applied to their position, so a consumer that only draws positioned shapes
 * never needs to know about groups at all. Non-group entries pass through
 * unchanged.
 *
 * The cumulative position/size is resolved as a fraction of the outermost
 * anchor's own box (see {@link childFraction}), which composes correctly
 * across arbitrary nesting depth. For a `relSizeAnchor` this maps exactly
 * onto `from`/`to`. For an `absSizeAnchor` it is a documented approximation:
 * the fraction maps exactly onto the anchor's absolute EMU `ext` (size), but
 * the anchor's `from` (a fraction of the whole chart) cannot be shifted by a
 * group child's offset without knowing the chart's live pixel size, which
 * this pure function does not have; such a leaf keeps the anchor's own
 * `from` unshifted; only its size is corrected.
 *
 * @param shapes - The chart's `userShapes` list, as parsed/edited.
 * @returns A flat list of leaf shapes (never `kind: 'grpSp'`), in the same
 *   relative order as `shapes`.
 */
export function flattenChartUserShapes(
	shapes: ReadonlyArray<PptxChartUserShape> | undefined,
): FlattenedChartUserShape[] {
	if (!shapes) {
		return [];
	}

	/** Walk a group's children, returning each leaf's box as a fraction of the group's OWN box. */
	function resolveGroupLeaves(
		children: readonly PptxChartUserShapeGroupChild[],
		chOff: { x: number; y: number },
		chExt: { cx: number; cy: number },
	): Array<{
		box: { x: number; y: number; w: number; h: number };
		child: PptxChartUserShapeGroupChild;
	}> {
		return children.flatMap((child) => {
			const frac = childFraction(child.off, child.ext, chOff, chExt);
			if (child.kind === 'grpSp') {
				if (!child.transform || !child.children) {
					return [];
				}
				const nested = resolveGroupLeaves(
					child.children,
					child.transform.chOff,
					child.transform.chExt,
				);
				return nested.map(({ box, child: leaf }) => ({
					box: {
						x: frac.x + box.x * frac.w,
						y: frac.y + box.y * frac.h,
						w: box.w * frac.w,
						h: box.h * frac.h,
					},
					child: leaf,
				}));
			}
			return [{ box: frac, child }];
		});
	}

	return shapes.flatMap((shape) => {
		if (shape.kind !== 'grpSp') {
			return [shape as FlattenedChartUserShape];
		}
		if (!shape.transform || !shape.children) {
			return [];
		}
		const leaves = resolveGroupLeaves(shape.children, shape.transform.chOff, shape.transform.chExt);
		return leaves.map(({ box, child }) => {
			const {
				kind,
				off: _off,
				ext: _ext,
				rawXml,
				transform: _transform,
				children: _children,
				...visuals
			} = child;
			if (shape.anchor === 'rel') {
				const width = (shape.to?.x ?? shape.from.x) - shape.from.x;
				const height = (shape.to?.y ?? shape.from.y) - shape.from.y;
				const from = { x: shape.from.x + box.x * width, y: shape.from.y + box.y * height };
				const to = { x: from.x + box.w * width, y: from.y + box.h * height };
				return {
					kind,
					anchor: 'rel',
					from,
					to,
					...(rawXml ? { rawXml } : {}),
					...visuals,
				} as FlattenedChartUserShape;
			}
			const ext = shape.ext ?? { cx: 0, cy: 0 };
			return {
				kind,
				anchor: 'abs',
				from: shape.from,
				ext: { cx: box.w * ext.cx, cy: box.h * ext.cy },
				...(rawXml ? { rawXml } : {}),
				...visuals,
			} as FlattenedChartUserShape;
		});
	});
}
