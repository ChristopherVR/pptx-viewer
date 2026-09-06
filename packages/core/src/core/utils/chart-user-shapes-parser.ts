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

/**
 * Parse an `a:xfrm`'s own `rot`/`flipH`/`flipV` attributes (ECMA-376
 * `CT_Transform2D`), present on a leaf's `spPr/a:xfrm` or a group's
 * `grpSpPr/a:xfrm` independently of any `off`/`ext` it also carries. `rot` is
 * stored in 60,000ths of a degree; verified against real PowerPoint (COM),
 * which writes `flipH="1"`/`flipV="1"` (never `"true"`), but both spellings
 * are schema-legal (`xsd:boolean`) and accepted here.
 */
function parseXfrmRotFlip(
	xfrm: XmlObject | undefined,
): Pick<PptxChartUserShape, 'rotation' | 'flipH' | 'flipV'> {
	if (!xfrm) {
		return {};
	}
	const result: Pick<PptxChartUserShape, 'rotation' | 'flipH' | 'flipV'> = {};
	const rot = Number.parseFloat(String(xfrm['@_rot'] ?? ''));
	if (Number.isFinite(rot) && rot !== 0) {
		result.rotation = rot / 60000;
	}
	const flipH = xfrm['@_flipH'];
	if (flipH === '1' || flipH === 'true') {
		result.flipH = true;
	}
	const flipV = xfrm['@_flipV'];
	if (flipV === '1' || flipV === 'true') {
		result.flipV = true;
	}
	return result;
}

/** Parse the shape properties (geometry, fill, line, rotation/flip) shared by sp / cxnSp / pic. */
function parseShapeVisuals(
	shape: XmlObject,
	kind: PptxChartUserShape['kind'],
	xml: XmlLookupLike,
	colors: ColorParserLike,
): Pick<
	PptxChartUserShape,
	'prst' | 'fill' | 'stroke' | 'strokeWidth' | 'rotation' | 'flipH' | 'flipV'
> {
	const spPr = xml.getChildByLocalName(shape, 'spPr');
	const result: Pick<
		PptxChartUserShape,
		'prst' | 'fill' | 'stroke' | 'strokeWidth' | 'rotation' | 'flipH' | 'flipV'
	> = {};

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
	Object.assign(result, parseXfrmRotFlip(xml.getChildByLocalName(spPr, 'xfrm')));
	return result;
}

const DIRECT_KINDS: Array<'sp' | 'cxnSp' | 'pic'> = ['sp', 'cxnSp', 'pic'];

/** Extract a `pic` node's alt text (`cdr:nvPicPr/cdr:cNvPr/@descr`), when present. */
function parsePicAltText(shape: XmlObject, xml: XmlLookupLike): string | undefined {
	const nvPicPr = xml.getChildByLocalName(shape, 'nvPicPr');
	const cNvPr = xml.getChildByLocalName(nvPicPr, 'cNvPr');
	const descr = cNvPr?.['@_descr'];
	return typeof descr === 'string' && descr.length > 0 ? descr : undefined;
}

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
	const altText = kind === 'pic' ? parsePicAltText(shape, xml) : undefined;
	return {
		kind,
		...base,
		...visuals,
		...(paragraphs ? { paragraphs } : {}),
		...(altText ? { altText } : {}),
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
	return { off, ext, chOff, chExt, ...parseXfrmRotFlip(xfrm) };
}

/**
 * Parse a group child's own `a:xfrm` (position within the parent group's
 * child coordinate space, plus its own rotation/flip). Direct shapes
 * (`sp`/`cxnSp`/`pic`) carry it under their `spPr`; a `graphicFrame` carries
 * it directly.
 */
function parseChildOffExt(
	shape: XmlObject,
	xml: XmlLookupLike,
): { off: { x: number; y: number }; ext: { cx: number; cy: number } } & Pick<
	PptxChartUserShape,
	'rotation' | 'flipH' | 'flipV'
> {
	const spPr = xml.getChildByLocalName(shape, 'spPr');
	const xfrm = xml.getChildByLocalName(spPr, 'xfrm') ?? xml.getChildByLocalName(shape, 'xfrm');
	return {
		...parseOffExt(xml.getChildByLocalName(xfrm, 'off'), xml.getChildByLocalName(xfrm, 'ext')),
		...parseXfrmRotFlip(xfrm),
	};
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
	const altText = kind === 'pic' ? parsePicAltText(shape, xml) : undefined;
	const { off, ext } = parseChildOffExt(shape, xml);
	return {
		kind,
		off,
		ext,
		...visuals,
		...(paragraphs ? { paragraphs } : {}),
		...(altText ? { altText } : {}),
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
		const { off, ext, rotation, flipH, flipV } = parseChildOffExt(graphicFrame, xml);
		children.push({
			kind: 'graphicFrame',
			off,
			ext,
			...(rotation !== undefined ? { rotation } : {}),
			...(flipH ? { flipH } : {}),
			...(flipV ? { flipV } : {}),
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
		const rotFlip = parseXfrmRotFlip(xml.getChildByLocalName(graphicFrame, 'xfrm'));
		return [{ kind: 'graphicFrame', ...base, ...rotFlip, ...(rawXml ? { rawXml } : {}) }];
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
	/**
	 * Set only for a leaf that came from a group nested inside an
	 * `absSizeAnchor` WHEN {@link flattenChartUserShapes} was not given a
	 * `chartBox`: an additional position offset in EMU to add (after dividing
	 * by a pixel's EMU size) to the pixel position computed from {@link
	 * PptxChartUserShape.from}. An `absSizeAnchor`'s `from` is a chart-relative
	 * fraction but its `ext` is an absolute EMU size (ECMA-376 21.4.2.1), so a
	 * group child's offset within that box (itself a fraction of the group's
	 * own EMU-scaled extent, see {@link childFraction}) composes as an EMU
	 * delta. Without knowing the chart's own EMU size that delta cannot be
	 * re-expressed as a further fraction of `from`, so it is carried
	 * separately instead; see `chart-user-shape-overlay.ts`'s `shapeBox` for
	 * where this is applied. When `chartBox` IS given, this delta is folded
	 * directly into `from` instead (see {@link flattenChartUserShapes}'s doc),
	 * and this field is left unset.
	 */
	absGroupOffsetEmu?: { x: number; y: number };
};

/**
 * The chart's own rendered box: the same box a `relSizeAnchor`'s `from`/`to`
 * (0..1) fractions span. Passing it to {@link flattenChartUserShapes} lets it
 * resolve two group-composition values exactly instead of approximating them:
 *
 * 1. A top-level `relSizeAnchor` group's own rotation composes around its
 *    REAL aspect ratio, `(to.x - from.x) * width : (to.y - from.y) * height`,
 *    instead of isotropically (1:1). Only the `width`:`height` RATIO is used
 *    for this, so any consistent unit works (chart pixels, EMU, points, ...).
 * 2. A leaf nested inside an `absSizeAnchor` group has its own EMU offset
 *    within the group folded into `from` as a further chart-fraction,
 *    instead of being carried separately as `absGroupOffsetEmu`. THIS case
 *    divides that EMU offset by `width`/`height` directly, so they must be in
 *    EMU here: pass the chart's real EMU size when known (e.g. the chart
 *    element's own `width`/`height`), or a pixel size multiplied by
 *    `EMU_PER_PIXEL` (9525) when only that is available.
 *
 * Omitting this parameter keeps the previous, chart-size-agnostic
 * approximation for both cases unchanged (isotropic top-level rotation;
 * `absGroupOffsetEmu` carried as a separate field).
 */
export interface ChartUserShapesChartBox {
	width: number;
	height: number;
}

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

/** Normalize a rotation in degrees to `[0, 360)`. */
function normalizeRotationDeg(deg: number): number {
	const mod = deg % 360;
	return mod < 0 ? mod + 360 : mod;
}

/**
 * Apply ONE group level's own rigid-body flip/rotation to a child's box,
 * expressed as a fraction of that group's own box (so the group's own centre
 * is always exactly `(0.5, 0.5)`): mirror the box around that centre on each
 * flipped axis, THEN rotate the box's CENTRE around the same point (matching
 * the "mirror, then rotate, both about own centre" order ECMA-376 uses for an
 * ordinary shape's `a:xfrm`, see `element-style-transform.ts`'s
 * `getElementTransform` doc). Width/height are left unchanged: this model
 * flattens groups to axis-aligned boxes, so only the box's CENTRE moves under
 * rotation; the visual spin itself is carried separately as the leaf's own
 * composed {@link PptxChartUserShape.rotation} and applied at render time
 * (`chart-user-shape-overlay.ts`) as a CSS/SVG transform about the leaf's own
 * centre.
 *
 * `aspect` is the group's own REAL box size (only its cx:cy RATIO matters,
 * any consistent unit works: EMU is used throughout by both call sites). The
 * centre offset is converted into that real aspect before rotating, then
 * back, rather than rotating the raw 0-1 fraction directly: a naive fraction
 * rotation implicitly treats the group as square, which distorts the result
 * whenever the group's own box is not (verified against real PowerPoint via
 * COM, `Chart.Shapes` / `GroupItems` reporting absolute Left/Top/Width/
 * Height: a 10deg-rotated group with a 2:1 real box places an off-centre
 * child at a measurably different point than the fraction-only maths
 * predicts; see `chart-user-shapes-parser.test.ts`'s "anisotropic group"
 * cases). Which value IS that real box, per COM, differs by level:
 *
 * - A NESTED `grpSp` child's own declared `a:xfrm`
 *   ({@link PptxChartUserShapeGroupChild.ext}, identical to its
 *   {@link PptxChartUserShapeGroupTransform.ext}) is its real box: COM's
 *   `GroupItems` placed a nested group's own off-centre child exactly where
 *   this ext's aspect predicts.
 * - The OUTERMOST group's real box comes from its ANCHOR instead, exactly
 *   like its position (see `flattenChartUserShapes`'s doc): an `absSizeAnchor`
 *   shape's OWN {@link PptxChartUserShape.ext}, NOT the group's `grpSpPr`
 *   `a:xfrm`'s `ext` (COM's reported group Width/Height matched the anchor's
 *   `ext`, not a deliberately-different `grpSpPr` `ext`, when the two were
 *   set to different aspects). A `relSizeAnchor`'s real aspect depends on the
 *   chart's actual rendered box instead: `(to.x - from.x) : (to.y - from.y)`
 *   scaled by the chart's own width:height. When {@link flattenChartUserShapes}
 *   is given a `chartBox`, that is exactly what is passed as `aspect` here
 *   (COM-verified: a 20deg-rotated `relSizeAnchor` group with a 2:1 real box
 *   places an off-centre child exactly where this aspect predicts, matching
 *   the same "anisotropic group" technique used for the `absSizeAnchor`
 *   cases above). Without a `chartBox`, this case falls back to the previous
 *   isotropic (1:1) approximation, since the real aspect cannot be known.
 *
 * A degenerate (zero or negative) aspect axis also falls back to isotropic
 * (1:1), matching the previous fraction-only behaviour, since a real ratio
 * cannot be formed from it.
 */
function applyGroupRigidTransform(
	box: { x: number; y: number; w: number; h: number },
	rotationDeg: number,
	flipH: boolean,
	flipV: boolean,
	aspect: { w: number; h: number },
): { x: number; y: number; w: number; h: number } {
	let { x, y } = box;
	const { w, h } = box;
	if (flipH) {
		x = 1 - x - w;
	}
	if (flipV) {
		y = 1 - y - h;
	}
	const normalized = normalizeRotationDeg(rotationDeg);
	if (normalized === 0) {
		return { x, y, w, h };
	}
	const aspectW = aspect.w > 0 ? aspect.w : 1;
	const aspectH = aspect.h > 0 ? aspect.h : 1;
	const rad = (normalized * Math.PI) / 180;
	const cos = Math.cos(rad);
	const sin = Math.sin(rad);
	const dx = (x + w / 2 - 0.5) * aspectW;
	const dy = (y + h / 2 - 0.5) * aspectH;
	const rx = dx * cos - dy * sin;
	const ry = dx * sin + dy * cos;
	const cx = 0.5 + rx / aspectW;
	const cy = 0.5 + ry / aspectH;
	return { x: cx - w / 2, y: cy - h / 2, w, h };
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
 * onto `from`/`to`. For an `absSizeAnchor` the fraction maps exactly onto the
 * anchor's absolute EMU `ext` (size); shifting the anchor's own `from` (a
 * fraction of the whole chart) by a group child's EMU offset needs the
 * chart's own size, so it is exact when `chartBox` is given (folded directly
 * into `from`) and otherwise an approximation (the anchor's own `from` is
 * left unshifted, with the shift instead carried on the leaf as
 * `absGroupOffsetEmu` for a caller that can apply it itself, e.g. by
 * converting an EMU delta straight to pixels without needing the chart's
 * size at all).
 *
 * @param shapes - The chart's `userShapes` list, as parsed/edited.
 * @param chartBox - The chart's own rendered box, when known; see {@link
 *   ChartUserShapesChartBox}'s doc for the two approximations it resolves and
 *   the unit each one needs.
 * @returns A flat list of leaf shapes (never `kind: 'grpSp'`), in the same
 *   relative order as `shapes`.
 */
export function flattenChartUserShapes(
	shapes: ReadonlyArray<PptxChartUserShape> | undefined,
	chartBox?: ChartUserShapesChartBox,
): FlattenedChartUserShape[] {
	if (!shapes) {
		return [];
	}

	/** One leaf's box (fraction of the OWN group's box being walked) plus its composed rotation/flip so far. */
	interface LeafPlacement {
		box: { x: number; y: number; w: number; h: number };
		rotation: number;
		flipH: boolean;
		flipV: boolean;
		child: PptxChartUserShapeGroupChild;
	}

	/**
	 * Walk a group's children, returning each leaf's box as a fraction of the
	 * group's OWN box, and its rotation/flip composed from everything AT OR
	 * BELOW this level (a nested `grpSp` child's OWN rotation/flip is folded
	 * in here via {@link applyGroupRigidTransform}; the CALLER is responsible
	 * for folding in the rotation/flip of the group whose `chOff`/`chExt` was
	 * passed in, exactly once, since that group's own box is not visible from
	 * inside this function).
	 */
	function resolveGroupLeaves(
		children: readonly PptxChartUserShapeGroupChild[],
		chOff: { x: number; y: number },
		chExt: { cx: number; cy: number },
	): LeafPlacement[] {
		return children.flatMap((child) => {
			const frac = childFraction(child.off, child.ext, chOff, chExt);
			if (child.kind === 'grpSp') {
				const childTransform = child.transform;
				if (!childTransform || !child.children) {
					return [];
				}
				const nested = resolveGroupLeaves(
					child.children,
					childTransform.chOff,
					childTransform.chExt,
				);
				const groupRotation = childTransform.rotation ?? 0;
				const groupFlipH = Boolean(childTransform.flipH);
				const groupFlipV = Boolean(childTransform.flipV);
				// A nested group's own declared `a:xfrm` ext IS its real box (see
				// `applyGroupRigidTransform`'s doc): unlike the OUTERMOST anchor,
				// there is no separate anchor overriding it here.
				const nestedAspect = { w: childTransform.ext.cx, h: childTransform.ext.cy };
				return nested.map((entry): LeafPlacement => {
					const selfBox = applyGroupRigidTransform(
						entry.box,
						groupRotation,
						groupFlipH,
						groupFlipV,
						nestedAspect,
					);
					return {
						box: {
							x: frac.x + selfBox.x * frac.w,
							y: frac.y + selfBox.y * frac.h,
							w: selfBox.w * frac.w,
							h: selfBox.h * frac.h,
						},
						rotation: normalizeRotationDeg(entry.rotation + groupRotation),
						flipH: entry.flipH !== groupFlipH,
						flipV: entry.flipV !== groupFlipV,
						child: entry.child,
					};
				});
			}
			return [
				{
					box: frac,
					rotation: normalizeRotationDeg(child.rotation ?? 0),
					flipH: Boolean(child.flipH),
					flipV: Boolean(child.flipV),
					child,
				},
			];
		});
	}

	return shapes.flatMap((shape) => {
		if (shape.kind !== 'grpSp') {
			return [shape as FlattenedChartUserShape];
		}
		if (!shape.transform || !shape.children) {
			return [];
		}
		const rawLeaves = resolveGroupLeaves(
			shape.children,
			shape.transform.chOff,
			shape.transform.chExt,
		);
		// Fold in the OUTERMOST group's own rotation/flip, exactly once, the
		// same way each nested `grpSp` level already folded in its own above.
		const topRotation = shape.transform.rotation ?? 0;
		const topFlipH = Boolean(shape.transform.flipH);
		const topFlipV = Boolean(shape.transform.flipV);
		// The OUTERMOST group's real box comes from its own ANCHOR, not its
		// `grpSpPr` xfrm's `ext` (see `applyGroupRigidTransform`'s doc): an
		// `absSizeAnchor`'s own `ext` is a real EMU size; a `relSizeAnchor`'s
		// real aspect is `(to - from) * chartBox` when `chartBox` is known,
		// otherwise it falls back to isotropic (1:1), unchanged from before.
		const relAspect = (): { w: number; h: number } => {
			if (!chartBox) {
				return { w: 1, h: 1 };
			}
			const to = shape.to ?? shape.from;
			return {
				w: (to.x - shape.from.x) * chartBox.width,
				h: (to.y - shape.from.y) * chartBox.height,
			};
		};
		const topAspect =
			shape.anchor === 'abs' && shape.ext ? { w: shape.ext.cx, h: shape.ext.cy } : relAspect();
		const leaves = rawLeaves.map((entry): LeafPlacement => ({
			box: applyGroupRigidTransform(entry.box, topRotation, topFlipH, topFlipV, topAspect),
			rotation: normalizeRotationDeg(entry.rotation + topRotation),
			flipH: entry.flipH !== topFlipH,
			flipV: entry.flipV !== topFlipV,
			child: entry.child,
		}));
		return leaves.map(({ box, rotation, flipH, flipV, child }) => {
			const {
				kind,
				off: _off,
				ext: _ext,
				rawXml,
				transform: _transform,
				children: _children,
				rotation: _childRotation,
				flipH: _childFlipH,
				flipV: _childFlipV,
				...visuals
			} = child;
			const rotFlip = {
				...(rotation !== 0 ? { rotation } : {}),
				...(flipH ? { flipH } : {}),
				...(flipV ? { flipV } : {}),
			};
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
					...rotFlip,
				} as FlattenedChartUserShape;
			}
			const ext = shape.ext ?? { cx: 0, cy: 0 };
			// The group's own box is scaled to the anchor's absolute EMU `ext`
			// (the same assumption the size line below already makes), so the
			// child's fractional offset within that box converts to an exact
			// EMU position delta the same way its fractional size converts to
			// an exact EMU extent.
			const offsetEmu = { x: box.x * ext.cx, y: box.y * ext.cy };
			// When the chart's own box is known (in the SAME unit as `ext`, i.e.
			// EMU), that EMU delta converts to an exact further fraction of the
			// whole chart and is folded straight into `from`; otherwise it is
			// carried separately as `absGroupOffsetEmu` for a caller that can
			// apply it itself (see `ChartUserShapesChartBox`'s and
			// `absGroupOffsetEmu`'s docs).
			const validChartBox =
				chartBox && chartBox.width > 0 && chartBox.height > 0 ? chartBox : undefined;
			const from = validChartBox
				? {
						x: shape.from.x + offsetEmu.x / validChartBox.width,
						y: shape.from.y + offsetEmu.y / validChartBox.height,
					}
				: shape.from;
			return {
				kind,
				anchor: 'abs',
				from,
				ext: { cx: box.w * ext.cx, cy: box.h * ext.cy },
				...(validChartBox ? {} : { absGroupOffsetEmu: offsetEmu }),
				...(rawXml ? { rawXml } : {}),
				...visuals,
				...rotFlip,
			} as FlattenedChartUserShape;
		});
	});
}
