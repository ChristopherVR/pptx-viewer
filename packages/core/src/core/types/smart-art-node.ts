/**
 * SmartArt node types: per-run text, per-node visual override, and the
 * data-model node itself. Split out of `smart-art.ts` to keep each type file
 * within the project's per-file line budget. Re-exported from `smart-art.ts`
 * (and thus the `types` barrel) for backward compatibility, so existing
 * imports of these symbols continue to work unchanged.
 *
 * @module pptx-types/smart-art-node
 */

import type { TextStyle } from './text';

/**
 * A single run of text inside a SmartArt node, capturing the run text and the
 * raw `a:rPr` run-properties object verbatim so per-run formatting (bold,
 * colour, size, etc.) survives a load -> edit -> save round-trip instead of
 * collapsing to a single unstyled run.
 *
 * @example
 * ```ts
 * const run: PptxSmartArtTextRun = {
 *   text: "Bold",
 *   rPr: { "@_b": "1", "@_lang": "en-US" },
 * };
 * // => satisfies PptxSmartArtTextRun
 * ```
 */
export interface PptxSmartArtTextRun {
	/** Run text content. */
	text: string;
	/**
	 * Raw parsed `a:rPr` run-properties object, preserved verbatim for
	 * round-trip. Untyped XML, hence the loose record shape.
	 */
	rPr?: Record<string, unknown>;
	/** Resolved standard shape-text style derived from {@link rPr}. */
	style?: TextStyle;
	/** Raw run XML used to retain unmodelled extension children on save. */
	rawXml?: Record<string, unknown>;
	/** Original direct-child order, including unmodelled extension children. */
	childOrder?: string[];
}

/** An ordered item within a SmartArt text paragraph. */
export type PptxSmartArtTextParagraphItem =
	| { kind: 'run'; run: PptxSmartArtTextRun }
	| {
			kind: 'break';
			rPr?: Record<string, unknown>;
			style?: TextStyle;
			rawXml?: Record<string, unknown>;
			childOrder?: string[];
	  }
	| {
			kind: 'field';
			id?: string;
			fieldType?: string;
			text: string;
			rPr?: Record<string, unknown>;
			style?: TextStyle;
			pPr?: Record<string, unknown>;
			rawXml?: Record<string, unknown>;
			childOrder?: string[];
	  }
	| { kind: 'tab'; rawXml?: Record<string, unknown>; childOrder?: string[] }
	| { kind: 'raw'; name: string; value: unknown };

/** A complete `a:p` paragraph in a SmartArt data-model text body. */
export interface PptxSmartArtTextParagraph {
	/** Paragraph properties (`a:pPr`) preserved verbatim. */
	pPr?: Record<string, unknown>;
	/** Text children in source order. */
	items: PptxSmartArtTextParagraphItem[];
	/** End-paragraph run properties (`a:endParaRPr`) preserved verbatim. */
	endParaRPr?: Record<string, unknown>;
	/** Resolved style for the paragraph terminator. */
	endParaStyle?: TextStyle;
	/** Raw paragraph XML used to retain unmodelled extension children on save. */
	rawXml?: Record<string, unknown>;
}

/**
 * Per-node visual override for a SmartArt node.
 *
 * Captures the individual fill / line / font colour and the bold / italic
 * emphasis a user has set on one specific node, independent of the diagram's
 * colour scheme and quick style. All colours are hex strings (e.g. "#FF0000").
 * Every field is optional: only the overridden aspects are carried, so an
 * empty object means "no per-node override".
 *
 * The parser reads these from the data point's `spPr` solid fill / line colour
 * and the first run's `rPr` (b / i / solidFill) when present, and the save path
 * writes them back so the override survives a load -> edit -> save round-trip.
 *
 * @example
 * ```ts
 * const style: PptxSmartArtNodeStyle = {
 *   fillColor: "#FF0000",
 *   fontColor: "#FFFFFF",
 *   bold: true,
 * };
 * // => satisfies PptxSmartArtNodeStyle
 * ```
 */
export interface PptxSmartArtNodeStyle {
	/** Solid fill colour override (hex, e.g. "#4F81BD"). */
	fillColor?: string;
	/** Outline / line colour override (hex). */
	lineColor?: string;
	/** Text (font) colour override (hex). */
	fontColor?: string;
	/** Bold emphasis override for the node's runs. */
	bold?: boolean;
	/** Italic emphasis override for the node's runs. */
	italic?: boolean;
}

/**
 * Manual layout override for a `type="pres"` presentation point, read from its
 * `dgm:prSet` attributes. PowerPoint writes these when the user drags, resizes,
 * rotates, or flips a SmartArt node by hand in its own diagram editor; without
 * them the node silently reverts to its algorithmic position whenever there is
 * no cached `dsp:` drawing part to fall back on.
 *
 * Every field is optional: only the attributes actually present on `prSet` are
 * populated. Angle and scale/factor units are already normalised to degrees and
 * plain ratios (a `custScaleX="150000"` becomes `scaleX: 1.5`), so a consumer
 * never has to know the raw `60000ths-of-a-degree` / `100000ths-of-a-percent`
 * XML encodings.
 *
 * @example
 * ```ts
 * const custom: SmartArtNodeCustomLayout = { angle: 15, scaleX: 1.2 };
 * // => a node manually rotated 15 degrees and widened 20% in PowerPoint
 * ```
 */
export interface SmartArtNodeCustomLayout {
	/** `custAng`: additional rotation in degrees. */
	angle?: number;
	/** `custScaleX`: horizontal scale ratio (1 = no change). */
	scaleX?: number;
	/** `custScaleY`: vertical scale ratio (1 = no change). */
	scaleY?: number;
	/** `custSzX`: horizontal size ratio, layered on top of {@link scaleX}. */
	sizeX?: number;
	/** `custSzY`: vertical size ratio, layered on top of {@link scaleY}. */
	sizeY?: number;
	/** `custFlipHor`: the node was manually mirrored horizontally. */
	flipHorizontal?: boolean;
	/** `custFlipVert`: the node was manually mirrored vertically. */
	flipVertical?: boolean;
	/** `custLinFactX`: manual position nudge along X, as a fraction of the container width. */
	linearFactorX?: number;
	/** `custLinFactY`: manual position nudge along Y, as a fraction of the container height. */
	linearFactorY?: number;
	/**
	 * `custLinFactNeighborX`: spacing compensation applied to a NEIGHBOURING
	 * node when this one is resized. Parsed for round-trip completeness; not
	 * applied by the per-node final transform (it has no effect on this node's
	 * own geometry; folding it into a neighbour's geometry would require
	 * whole-layout awareness the final transform pass does not have).
	 */
	linearFactorNeighborX?: number;
	/** `custLinFactNeighborY`: see {@link linearFactorNeighborX} (Y axis). */
	linearFactorNeighborY?: number;
	/** `custRadScaleRad`: manual radius scale ratio for a radial/cycle node. */
	radialScaleRadius?: number;
	/** `custRadScaleInc`: manual angular-position nudge for a radial/cycle node. */
	radialScaleIncrement?: number;
	/** `custT`: whether `prSet` declares a custom transform is present at all. */
	hasCustomTransform?: boolean;
}

/**
 * A single node in the SmartArt data model.
 *
 * @example
 * ```ts
 * const node: PptxSmartArtNode = {
 *   id: "1",
 *   text: "CEO",
 *   children: [
 *     { id: "2", text: "VP Marketing", parentId: "1" },
 *     { id: "3", text: "VP Engineering", parentId: "1" },
 *   ],
 * };
 * // => satisfies PptxSmartArtNode
 * ```
 */
export interface PptxSmartArtNode {
	id: string;
	text: string;
	/** CT_Pt connection identifier, when the point references a connection. */
	connectionId?: string | null;
	parentId?: string;
	children?: PptxSmartArtNode[];
	/** Node type from `@_type` attribute (e.g. "doc", "node", "asst", "pres"). */
	nodeType?: string;
	/**
	 * The node's own quick-style role (`dgm:prSet/@presStyleLbl` from its
	 * paired `type="pres"` presentation point, resolved via a `presOf`
	 * connection back to this content point). Structural names like `node1`,
	 * `asst2`, `bgShp`, `revTx`; distinct from {@link nodeType}, which is the
	 * data-model `@_type` ("node"/"asst"/...). Used to pick this node's own
	 * colour list from a colour transform's per-role palettes instead of the
	 * generic cycled palette (see `applySmartArtRoleColors`).
	 */
	styleRole?: string;
	/**
	 * Per-run text + run-properties for the node's first paragraph, captured at
	 * parse time. When the joined run text still equals {@link text} (the node
	 * was not edited, or was edited only in ways that preserve the run split),
	 * the save path rebuilds the paragraph from these runs so per-run rich text
	 * is not flattened. When {@link text} diverges, the runs are ignored.
	 */
	runs?: PptxSmartArtTextRun[];
	/**
	 * Complete typed paragraph model. Unlike {@link runs}, this retains every
	 * paragraph and the ordered run, field, break, and tab children within it.
	 */
	paragraphs?: PptxSmartArtTextParagraph[];
	/**
	 * Optional per-node visual override (fill / line / font colour, bold /
	 * italic). Read at parse time from the point's `spPr` / first-run `rPr`, set
	 * by the editing op, honoured by the render path, and written back on save so
	 * it round-trips.
	 */
	style?: PptxSmartArtNodeStyle;
	/**
	 * Manual layout override read from the node's `dgm:prSet` `cust*`
	 * attributes (drag/resize/rotate/flip performed in PowerPoint's own diagram
	 * editor). Applied as a final transform after algorithmic layout by
	 * {@link module:smartart-layout-interpreter-custom} so it survives even
	 * when there is no cached `dsp:` drawing to fall back on.
	 */
	customLayout?: SmartArtNodeCustomLayout;
}
