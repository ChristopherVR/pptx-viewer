/**
 * SmartArt DiagramML interpreter - pure geometry types.
 *
 * Describes the styled view-model geometry produced by the interpreter
 * (`smartart-layout-interpreter.ts` and its arrangers). No framework code, no
 * DOM. Consumed by:
 *  - the SVG-fallback preview path (re-exported from `pptx-viewer-shared` for
 *    the React/Vue/Angular/Svelte/Vanilla bindings), and
 *  - the save/decompose pipeline in this package (`smartart-decompose.ts`,
 *    `smartart-interpreter-drawing-bridge.ts`), which converts this geometry
 *    into `PptxElement[]` / `PptxSmartArtDrawingShape[]` for the fabricated
 *    cached diagram drawing.
 *
 * Moved here from `pptx-viewer-shared` so the same interpreter can be shared
 * by the save pipeline: `pptx-viewer-core` cannot import `pptx-viewer-shared`
 * (shared depends on core, not the other way around), so the single
 * interpreter now lives in core and shared re-exports it.
 */

/** Axis-aligned rectangle. */
export interface LayoutRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * Per-node label styling resolved from `PptxSmartArtNode.style` (the overrides
 * the inspector's node style bar writes).
 *
 * Every field is optional and every field has a documented binding default, so
 * a renderer that ignores them keeps its historic output:
 * `fontColor` -> `white`, `fontWeight` / `fontStyle` -> unset.
 */
export interface RenderedNodeTextStyle {
	/** Label colour. Default `white`. */
	fontColor?: string;
	/** SVG `font-weight` (`700` when the node is bold). Default unset. */
	fontWeight?: number;
	/** SVG `font-style`. Default unset. */
	fontStyle?: 'italic';
}

/**
 * Fields shared by every rendered node kind, carrying the source data-model
 * node identity and a final-transform rotation.
 *
 * `nodeId` lets a consumer (the manual `cust*`-override pass, or the
 * save-pipeline bridge that needs the node's full untruncated text) join a
 * rendered shape back to its `PptxSmartArtNode`. `rotation` is additive
 * degrees applied by a `dgm:pt/dgm:prSet/@custAng` manual override; it is
 * `undefined` (no rotation) unless such an override is present.
 */
export interface RenderedNodeIdentity {
	/** The `PptxSmartArtNode.id` this shape represents. */
	nodeId?: string;
	/** Additional rotation in degrees from a `custAng` manual override. */
	rotation?: number;
	/**
	 * Explicit DrawingML preset geometry name (`rect`, `roundRect`, ...) for
	 * the save-pipeline bridge (`smartart-interpreter-drawing-bridge.ts`) to
	 * use verbatim instead of its own kind-based default. Set by
	 * `smartart-layout-interpreter-item-roles.ts` when a per-item role
	 * template (e.g. a list layout's `childText`) declares its own `dgm:shape`
	 * distinct from the arranger's hardcoded family shape. `undefined` keeps
	 * the bridge's pre-existing behaviour.
	 */
	presetOverride?: string;
	/**
	 * Additional `PptxSmartArtNode.id`s whose text folds into THIS shape as
	 * extra paragraphs (see `projectFoldedNodeText` in the drawing bridge),
	 * pre-resolved by `smartart-layout-interpreter-item-roles.ts` for a
	 * `des`/`ch`-axis role that combines more than one descendant's text into
	 * one box. `undefined` keeps the bridge's own descendant-folding
	 * inference (nearest rendered ancestor absorbs any node without a box).
	 */
	foldedNodeIds?: string[];
	/**
	 * Pre-resolved, verbatim display text for a role bound to a TRANSITION
	 * point (`dgm:presOf ptType="sibTrans"|"parTrans"`) rather than a real
	 * data node - e.g. a numbered-badge layout's ordinal "1"/"2"/"3" text,
	 * which PowerPoint stores on the `sibTrans` point of the item's own
	 * `parOf` edge (`PptxSmartArtConnection.label`), not on any
	 * `PptxSmartArtNode` `nodeId` can resolve. Set by
	 * `smartart-layout-interpreter-item-roles.ts`. When present, the
	 * save-pipeline bridge (`smartart-interpreter-drawing-bridge.ts`) uses it
	 * verbatim instead of resolving `nodeId` against the node array (which
	 * would find nothing and render blank text).
	 */
	literalText?: string;
	/**
	 * The `dgm:layoutNode/@name` of the per-item text role this entry was
	 * split from (e.g. a pyramid's `level` vs `acctTx`), set by
	 * `smartart-layout-interpreter-item-role-shared.ts`'s `stackRoleContent`
	 * for EVERY split entry (rect or polygon), not only ones an arranger
	 * needs to distinguish. A `polygon` split (`arrangePyramid`'s
	 * parent+child pyramid accent) starts as an unchanged copy of the
	 * original geometry per role - this is the one field an arranger-specific
	 * geometry pass can key off to reposition/resize each entry by name,
	 * since `stackRoleContent` itself has no generic way to split a
	 * polygon's own `points`. `undefined` on an unsplit node.
	 */
	itemRoleName?: string;
	/**
	 * The font size (px) a FOLDED descendant paragraph (`collectFoldedDescendants`
	 * in the drawing bridge) should render at, when it differs from this
	 * shape's own `fontSize` - see `smartart-layout-item-font-tier.ts`'s
	 * module doc comment for why a folded descendant renders SMALLER than its
	 * ancestor's own top-level text. `undefined` keeps the bridge's
	 * pre-existing behaviour of reusing `fontSize` for every folded paragraph.
	 */
	descendantFontSize?: number;
}

/** A node rendered as an SVG rect (rounded or flat). */
export interface RenderedRectNode extends RenderedNodeTextStyle, RenderedNodeIdentity {
	kind: 'rect';
	key: string;
	x: number;
	y: number;
	width: number;
	height: number;
	rx: number;
	fill: string;
	stroke: string;
	strokeWidth: number;
	opacity: number;
	text: string;
	fontSize: number;
	/** Centre x for text anchor. */
	textX: number;
	/** Centre y for text anchor. */
	textY: number;
}

/** A node rendered as an SVG circle. */
export interface RenderedCircleNode extends RenderedNodeTextStyle, RenderedNodeIdentity {
	kind: 'circle';
	key: string;
	cx: number;
	cy: number;
	r: number;
	/**
	 * Optional independent horizontal/vertical radii for a genuinely elliptical
	 * node (e.g. the `cycle` arranger's "Basic Cycle" ring, whose real
	 * PowerPoint output is a non-circular ellipse - see
	 * `smartart-layout-interpreter-cycle.ts`). Additive: every existing
	 * producer that never sets these keeps rendering as the plain circle `r`
	 * always described; a consumer that does not know about `rx`/`ry` still
	 * gets a sensible circle (`r`) rather than an error. Only
	 * `smartart-interpreter-drawing-bridge.ts`'s geometry conversion currently
	 * reads them.
	 */
	rx?: number;
	ry?: number;
	fill: string;
	stroke: string;
	strokeWidth: number;
	opacity: number;
	text: string;
	fontSize: number;
	/**
	 * Label anchor x. Defaults to `cx`; set when the label sits away from the
	 * circle (target leader labels, timeline captions).
	 */
	textX?: number;
	/** Label anchor y. Defaults to `cy`. */
	textY?: number;
	/** SVG `text-anchor` for the label. Defaults to `middle`. */
	textAnchor?: 'start' | 'middle' | 'end';
	/**
	 * How the label block sits relative to `textY`: `middle` centres it (the
	 * default), `bottom` puts the last baseline on `textY` (label above the
	 * node), `top` puts the first line's top on `textY` (label below).
	 */
	textBaseline?: 'top' | 'middle' | 'bottom';
}

/** A node rendered as an SVG polygon (chevron, trapezoid, etc.). */
export interface RenderedPolygonNode extends RenderedNodeTextStyle, RenderedNodeIdentity {
	kind: 'polygon';
	key: string;
	points: string;
	fill: string;
	stroke: string;
	strokeWidth: number;
	opacity: number;
	text: string;
	fontSize: number;
	/** Centre x for text anchor. */
	textX: number;
	/** Centre y for text anchor. */
	textY: number;
}

export type RenderedNode = RenderedRectNode | RenderedCircleNode | RenderedPolygonNode;

/**
 * A connector line between two rendered nodes.
 *
 * The paint fields are optional and carry the values every binding already
 * hardcodes, so a renderer that ignores them is unchanged:
 * `stroke` -> `#94a3b8`, `strokeWidth` -> `1.5`, `opacity` -> `0.5`,
 * `dash` -> solid.
 */
export interface RenderedConnector {
	key: string;
	/** SVG path data string. */
	d: string;
	/** Stroke colour. Default `#94a3b8`. */
	stroke?: string;
	/** Stroke width. Default `1.5`. */
	strokeWidth?: number;
	/** Stroke opacity. Default `0.5`. */
	opacity?: number;
	/** SVG `stroke-dasharray`. Default solid. */
	dash?: string;
	/**
	 * Connector label text, from a `dgm:pt/@type="parTrans"` transition
	 * point's `dgm:t` (`PptxSmartArtConnection.label`). PowerPoint's own
	 * diagram editor lets a user type text directly onto an org-chart
	 * relationship connector. `undefined` when the connector carries no text
	 * (the overwhelming majority).
	 */
	text?: string;
}

/** The layout family applied to a SmartArt element. */
export type LayoutFamily =
	| 'list'
	| 'process'
	| 'cycle'
	| 'hierarchy'
	| 'matrix'
	| 'radial'
	| 'pyramid'
	| 'venn'
	| 'funnel'
	| 'target'
	| 'gear'
	| 'timeline'
	| 'bending';

/** Complete layout output for a single SmartArt family. */
export interface SmartArtLayoutResult {
	/** Rendered geometry nodes. */
	nodes: RenderedNode[];
	/** Connector lines (may be empty). */
	connectors: RenderedConnector[];
	/** SVG filter string for drop shadows, e.g. `"drop-shadow(…)"`. */
	shadowFilter: string | undefined;
	/**
	 * Suggested viewBox string `"0 0 W H"`.
	 * Callers should use the element's actual pixel dimensions.
	 */
	viewBox: string;
	/** The layout family that was applied. */
	family: LayoutFamily;
}

/** Bounding box passed to every layout function. */
export interface BoundingBox {
	width: number;
	height: number;
}
