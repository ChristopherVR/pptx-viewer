/**
 * Types for chart drawing-overlay shapes (`c:userShapes`).
 *
 * A chart's `c:userShapes` element carries an `r:id` that references a
 * separate drawing part (`ppt/drawings/drawingN.xml`) whose root is a
 * `c:userShapes` element populated with `cdr:relSizeAnchor` /
 * `cdr:absSizeAnchor` wrappers around `sp` / `pic` / `cxnSp` shapes drawn on
 * top of the chart plot. These interfaces describe the parsed, renderable
 * overlay model. The raw reference is preserved separately on
 * {@link PptxChartData.userShapesXml} for verbatim round-trip save; this model
 * is render-only.
 *
 * @module pptx-types/chart-user-shapes
 */

import type { XmlObject } from './common';

/** A single paragraph of overlay-shape text with light formatting. */
export interface PptxChartUserShapeParagraph {
	/** Joined run text of the paragraph. */
	text: string;
	/** Font size in points (`a:rPr/@sz` divided by 100), when present. */
	fontSize?: number;
	/** Whether the first run is bold (`a:rPr/@b`). */
	bold?: boolean;
	/** Whether the first run is italic (`a:rPr/@i`). */
	italic?: boolean;
	/** Resolved run colour hex (e.g. `"#FF0000"`), when present. */
	color?: string;
	/** Paragraph alignment (`a:pPr/@algn`): left / centre / right. */
	align?: 'l' | 'ctr' | 'r';
}

/**
 * The DrawingML 2D group transform (`a:xfrm` inside `cdr:grpSpPr`) that
 * anchors a `grpSp`'s own box ({@link off}/{@link ext}) and establishes the
 * coordinate space its children are expressed in ({@link chOff}/{@link
 * chExt}), all in EMU. A child's position within the group is mapped into
 * the group's own box via
 * `frac = (child.off - chOff) / chExt`, then applied to the enclosing
 * anchor's box; see `flattenChartUserShapes` in
 * `chart-user-shapes-parser.ts`.
 */
export interface PptxChartUserShapeGroupTransform {
	/** The group's own position in its parent's coordinate space, in EMU. */
	off: { x: number; y: number };
	/** The group's own size in its parent's coordinate space, in EMU. */
	ext: { cx: number; cy: number };
	/** Origin of the child coordinate space (`a:chOff`), in EMU. */
	chOff: { x: number; y: number };
	/** Size of the child coordinate space (`a:chExt`), in EMU. */
	chExt: { cx: number; cy: number };
}

/**
 * One shape grouped inside a `cdr:grpSp` (or a nested `cdr:grpSp` itself).
 * Unlike a top-level {@link PptxChartUserShape}, a group child has no
 * drawing anchor of its own: its position is expressed in its parent
 * group's child coordinate space via {@link off}/{@link ext} (EMU, read
 * from the child's own `a:xfrm`), not as a chart-relative fraction.
 */
export interface PptxChartUserShapeGroupChild {
	/** Shape kind, same vocabulary as {@link PptxChartUserShape.kind}. */
	kind: 'sp' | 'cxnSp' | 'pic' | 'grpSp' | 'graphicFrame';
	/** Position within the parent group's child coordinate space, in EMU. */
	off: { x: number; y: number };
	/** Size within the parent group's child coordinate space, in EMU. */
	ext: { cx: number; cy: number };
	/** Preset geometry name (`a:prstGeom/@prst`), defaulting to `"rect"`. */
	prst?: string;
	/** Resolved solid-fill hex colour, when present. */
	fill?: string;
	/** Resolved line/stroke hex colour, when present. */
	stroke?: string;
	/** Line width in points (`a:ln/@w` divided by 12700), when present. */
	strokeWidth?: number;
	/** Text paragraphs of the shape's `txBody`, when present. */
	paragraphs?: PptxChartUserShapeParagraph[];
	/**
	 * Verbatim source XML of a `pic`/`graphicFrame` child, or of this node
	 * itself when `kind === 'grpSp'` and the nested group is untouched since
	 * parse. See {@link PptxChartUserShape.rawXml}'s doc for the same
	 * contract one level up.
	 */
	rawXml?: XmlObject;
	/** Present when `kind === 'grpSp'`: this nested group's own transform. */
	transform?: PptxChartUserShapeGroupTransform;
	/** Present when `kind === 'grpSp'`: this nested group's own children. */
	children?: PptxChartUserShapeGroupChild[];
}

/**
 * A parsed chart-overlay shape positioned by a drawing anchor.
 *
 * Position is expressed as chart-relative fractions in {@link from}. For a
 * `relSizeAnchor` the opposite corner is {@link to} (also fractional); for an
 * `absSizeAnchor` the extent is {@link ext} in EMU.
 */
export interface PptxChartUserShape {
	/**
	 * Shape kind: text/preset shape, connector, picture, a group of the
	 * above (`grpSp`, with its own {@link transform} and {@link children},
	 * nested arbitrarily; use `flattenChartUserShapes` from
	 * `chart-user-shapes-parser.ts` to get a flat, render-ready leaf list
	 * with the group transform already applied), or a bare placeholder for
	 * a `graphicFrame` anchor child (deep content such as a nested chart or
	 * table is out of scope; it only keeps the anchor's space accounted for
	 * instead of the whole overlay disappearing).
	 */
	kind: 'sp' | 'cxnSp' | 'pic' | 'grpSp' | 'graphicFrame';
	/** Anchor kind that positioned the shape. */
	anchor: 'rel' | 'abs';
	/** Top-left corner as chart-relative fractions (0-1). */
	from: { x: number; y: number };
	/** Bottom-right corner as chart-relative fractions (0-1); relSizeAnchor only. */
	to?: { x: number; y: number };
	/** Extent in EMU (cx, cy); absSizeAnchor only. */
	ext?: { cx: number; cy: number };
	/** Preset geometry name (`a:prstGeom/@prst`), defaulting to `"rect"`. */
	prst?: string;
	/** Resolved solid-fill hex colour, when present. */
	fill?: string;
	/** Resolved line/stroke hex colour, when present. */
	stroke?: string;
	/** Line width in points (`a:ln/@w` divided by 12700), when present. */
	strokeWidth?: number;
	/** Text paragraphs of the shape's `txBody`, when present. */
	paragraphs?: PptxChartUserShapeParagraph[];
	/**
	 * Verbatim source XML of a `pic` or `graphicFrame` anchor child (the
	 * `cdr:pic` / `cdr:graphicFrame` node itself, not the enclosing anchor),
	 * or of the `cdr:grpSp` node itself when `kind === 'grpSp'` and the
	 * group is untouched since parse (byte-identical passthrough). None of
	 * these three kinds have a reconstructable typed representation that is
	 * guaranteed lossless (a picture's blip reference, a nested chart/table's
	 * graphic content, or a group's exact child ordering/ids), so the
	 * serializer re-emits this verbatim when present instead of a lossy
	 * rebuild. Editing a shape inside a group (via the SDK's path-based
	 * overlay operations) clears the group's `rawXml` so the serializer
	 * regenerates it from {@link transform}/{@link children} instead. Absent
	 * for `sp`/`cxnSp`, which round-trip losslessly through their typed
	 * fields above.
	 */
	rawXml?: XmlObject;
	/** Present when `kind === 'grpSp'`: the group's own transform. */
	transform?: PptxChartUserShapeGroupTransform;
	/** Present when `kind === 'grpSp'`: the grouped children, nested arbitrarily. */
	children?: PptxChartUserShapeGroupChild[];
}
