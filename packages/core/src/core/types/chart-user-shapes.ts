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
 * A parsed chart-overlay shape positioned by a drawing anchor.
 *
 * Position is expressed as chart-relative fractions in {@link from}. For a
 * `relSizeAnchor` the opposite corner is {@link to} (also fractional); for an
 * `absSizeAnchor` the extent is {@link ext} in EMU.
 */
export interface PptxChartUserShape {
	/** Shape kind: text/preset shape, connector, or picture. */
	kind: 'sp' | 'cxnSp' | 'pic';
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
}
