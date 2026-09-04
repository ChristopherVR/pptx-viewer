/**
 * Table types: cell styling, cell data, rows, table data, and the parsed
 * table style map from `ppt/tableStyles.xml`.
 *
 * @module pptx-types/table
 */

// ==========================================================================
// Table types: cells, rows, data, and table style map
// ==========================================================================

/**
 * Per-cell visual style for a table cell.
 *
 * All fields are optional - unset values inherit from the table style.
 *
 * @example
 * ```ts
 * const header: PptxTableCellStyle = {
 *   bold: true,
 *   fontSize: 14,
 *   color: "#FFFFFF",
 *   backgroundColor: "#0055AA",
 *   align: "center",
 * };
 * // => satisfies PptxTableCellStyle
 * ```
 */
export interface PptxTableCellStyle {
	/** Font size in points (`a:rPr@sz / 100`). */
	fontSize?: number;
	bold?: boolean;
	italic?: boolean;
	underline?: boolean;
	color?: string;
	/**
	 * Font family from the first run's `a:rPr/a:latin@typeface` (falling back to
	 * `a:ea` / `a:cs`). Per-run families live on {@link PptxTableCellTextRun}.
	 */
	fontFamily?: string;
	/**
	 * Raw XML colour-choice node preserved from `a:tc/a:txBody/.../a:rPr/a:solidFill`
	 * for round-trip serialisation. Currently unused by the cell-level writer
	 * (cell text colour falls through `writeCellTextFormatting`), reserved for
	 * future expansion alongside the run-properties round-trip path.
	 */
	colorXml?: import('./common').XmlObject;
	backgroundColor?: string;
	/**
	 * Raw XML colour-choice node preserved from cell `a:tcPr/a:solidFill` for
	 * round-trip serialisation. Re-emitted verbatim when the resolved
	 * {@link backgroundColor} still matches the original colour.
	 */
	backgroundColorXml?: import('./common').XmlObject;
	borderColor?: string;
	/** Top border width in px. */
	borderTopWidth?: number;
	/** Bottom border width in px. */
	borderBottomWidth?: number;
	/** Left border width in px. */
	borderLeftWidth?: number;
	/** Right border width in px. */
	borderRightWidth?: number;
	/** Top border color as hex. */
	borderTopColor?: string;
	/** Bottom border color as hex. */
	borderBottomColor?: string;
	/** Left border color as hex. */
	borderLeftColor?: string;
	/** Right border color as hex. */
	borderRightColor?: string;
	align?: 'left' | 'center' | 'right' | 'justify';
	vAlign?: 'top' | 'middle' | 'bottom';
	/** Text direction from `a:tcPr/@vert` (spec values from CT_TextVerticalType). */
	textDirection?:
		| 'vert'
		| 'vert270'
		| 'eaVert'
		| 'wordArtVert'
		| 'wordArtVertRtl'
		| 'mongolianVert';
	/** Cell left margin in px (from a:tcPr > a:tcMar > a:marL). */
	marginLeft?: number;
	/** Cell right margin in px. */
	marginRight?: number;
	/** Cell top margin in px. */
	marginTop?: number;
	/** Cell bottom margin in px. */
	marginBottom?: number;
	/** Diagonal border top-left to bottom-right color. */
	borderDiagDownColor?: string;
	/** Diagonal border top-left to bottom-right width in px. */
	borderDiagDownWidth?: number;
	/** Diagonal border bottom-left to top-right color. */
	borderDiagUpColor?: string;
	/** Diagonal border bottom-left to top-right width in px. */
	borderDiagUpWidth?: number;
	/** Table cell border dash style (legacy single value). */
	borderDash?: string;
	/** Per-edge border dash styles. */
	borderTopDash?: string;
	borderBottomDash?: string;
	borderLeftDash?: string;
	borderRightDash?: string;
	/** Cell text shadow colour. */
	textShadowColor?: string;
	/** Cell text shadow blur radius in px. */
	textShadowBlur?: number;
	/** Cell text shadow horizontal offset in px. */
	textShadowOffsetX?: number;
	/** Cell text shadow vertical offset in px. */
	textShadowOffsetY?: number;
	/** Cell text shadow opacity (0-1). */
	textShadowOpacity?: number;
	/** Cell text glow colour. */
	textGlowColor?: string;
	/** Cell text glow radius in px. */
	textGlowRadius?: number;
	/** Cell text glow opacity (0-1). */
	textGlowOpacity?: number;
	/** Cell fill mode: solid, gradient, pattern, image, or none. */
	fillMode?: 'solid' | 'gradient' | 'pattern' | 'image' | 'none';
	/** Gradient fill stops (colours with positions). */
	gradientFillStops?: Array<{
		color: string;
		position: number;
		opacity?: number;
	}>;
	/** Gradient angle in degrees. */
	gradientFillAngle?: number;
	/** Gradient type: linear or radial. */
	gradientFillType?: 'linear' | 'radial';
	/** Path gradient sub-type. */
	gradientFillPathType?: 'circle' | 'rect' | 'shape';
	/** Focal point for radial gradients (0–1 fractions). */
	gradientFillFocalPoint?: { x: number; y: number };
	/** Raw fillToRect LTRB values (0–1 fractions) for gradient sizing. */
	gradientFillFillToRect?: { l: number; t: number; r: number; b: number };
	/** Pre-computed CSS gradient string for rendering. */
	gradientFillCss?: string;
	/** Pattern fill preset name (e.g. "ltDnDiag"). */
	patternFillPreset?: string;
	/** Pattern fill foreground colour. */
	patternFillForeground?: string;
	/** Pattern fill background colour. */
	patternFillBackground?: string;
	/**
	 * Image fill (`a:tcPr/a:blipFill`, CT_TableCellProperties). Resolved
	 * archive-relative path (or external `http(s):`/`data:` URL) for the
	 * cell's background image, from `a:blipFill/a:blip/@r:embed` (or
	 * `@r:link`). Present when `fillMode` is `'image'`.
	 *
	 * The parser resolves this synchronously (path only, no binary read);
	 * a viewer's load pipeline resolves it further to a displayable
	 * `data:`/`blob:` URL, written back to {@link backgroundImageFillData}.
	 */
	backgroundImageFillPath?: string;
	/**
	 * Displayable image data (`data:` or `blob:` URL) for an image cell
	 * fill, once resolved by the load pipeline. Renderers should prefer
	 * this over {@link backgroundImageFillPath} when both are present.
	 */
	backgroundImageFillData?: string;
	/**
	 * Cell 3D bevel + lighting from `a:tcPr/a:cell3D` (CT_Cell3D,
	 * ECMA-376 §21.1.3.1). Rendered as a CSS bevel treatment.
	 */
	cell3D?: PptxTableCell3D;
	/**
	 * `a:tcPr/@anchorCtr` - centre the text block in the direction
	 * perpendicular to the text flow (horizontal centring for horizontal text).
	 */
	anchorCtr?: boolean;
	/**
	 * `a:tcPr/@horzOverflow` (ST_TextHorzOverflowType): `clip` clips text at
	 * the cell edge, `overflow` (the default) lets it spill.
	 */
	horzOverflow?: 'clip' | 'overflow';
}

/**
 * Cell 3D bevel + lighting parsed from `a:tcPr/a:cell3D` (CT_Cell3D).
 *
 * Only the fields needed to render a plausible bevel treatment are captured;
 * verbatim round-trip of the full node is handled separately by the save path.
 *
 * @example
 * ```ts
 * const c3d: PptxTableCell3D = {
 *   bevelWidth: 8,
 *   bevelHeight: 8,
 *   bevelPreset: 'circle',
 *   material: 'plastic',
 * };
 * // => satisfies PptxTableCell3D
 * ```
 */
export interface PptxTableCell3D {
	/** Bevel width in px (from `a:bevel@w`, EMU converted). */
	bevelWidth?: number;
	/** Bevel height in px (from `a:bevel@h`, EMU converted). */
	bevelHeight?: number;
	/** Bevel preset name (`a:bevel@prst`, e.g. `circle`, `relaxedInset`). */
	bevelPreset?: string;
	/** Preset material (`a:cell3D@prstMaterial`, e.g. `plastic`, `metal`). */
	material?: string;
	/** Light rig type (`a:lightRig@rig`, e.g. `threePt`, `soft`). */
	lightRig?: string;
	/** Light rig direction (`a:lightRig@dir`, e.g. `tl`, `t`, `tr`). */
	lightRigDirection?: string;
}

/**
 * One styled text run inside a table cell's `a:txBody`.
 *
 * `PptxTableCell.text` is a flat string and `PptxTableCell.style` describes
 * only the FIRST run, so a cell mixing formats ("Revenue **grew 42%** last
 * year") cannot be represented by those two alone. {@link PptxTableCell.runs}
 * carries the full sequence, with paragraph and line breaks as marker entries
 * so a renderer can walk it linearly.
 *
 * Structurally identical to `pptx-viewer-shared`'s `CellTextRun`, which every
 * binding's table renderer already consumes.
 *
 * @example
 * ```ts
 * const runs: PptxTableCellTextRun[] = [
 *   { text: "Revenue " },
 *   { text: "grew 42%", bold: true, color: "#C00000" },
 * ];
 * // => satisfies PptxTableCellTextRun[]
 * ```
 */
export interface PptxTableCellTextRun {
	/** Run text. Empty for the break markers below. */
	text: string;
	/** This entry starts a new paragraph (`a:p` boundary) rather than carrying text. */
	isParagraphBreak?: boolean;
	/** This entry is a soft line break (`a:br`) rather than carrying text. */
	isLineBreak?: boolean;
	bold?: boolean;
	italic?: boolean;
	underline?: boolean;
	strikethrough?: boolean;
	/** Resolved run colour as a CSS colour string. */
	color?: string;
	/** Run font size in points (`a:rPr@sz` / 100). */
	fontSize?: number;
	/** Run font family from `a:rPr/a:latin@typeface` (or `a:ea` / `a:cs`). */
	fontFamily?: string;
}

/**
 * A single table cell with text content, optional style, and merge info.
 *
 * @example
 * ```ts
 * const cell: PptxTableCell = {
 *   text: "$1.5M",
 *   style: { bold: true, align: "right" },
 *   gridSpan: 1,
 * };
 * // => satisfies PptxTableCell
 * ```
 */
export interface PptxTableCell {
	text: string;
	style?: PptxTableCellStyle;
	/**
	 * Per-run formatting for the cell's text, when it has any beyond what
	 * {@link style} can express. Present only for cells whose `a:txBody`
	 * actually carries runs; renderers fall back to {@link text} when absent.
	 *
	 * Editing a cell's text invalidates these (the editor produces a plain
	 * string), so an edit path must clear them alongside setting `text`.
	 */
	textRuns?: PptxTableCellTextRun[];
	/** Column span (defaults to 1). */
	gridSpan?: number;
	/** Row span (defaults to 1). */
	rowSpan?: number;
	/** Whether this cell is merged vertically with the cell above. */
	vMerge?: boolean;
	/** Whether this cell is horizontally merged with the cell to the left (gridSpan continuation). */
	hMerge?: boolean;
	/**
	 * Opaque round-trip storage for `a:tcPr` attributes that don't yet have
	 * typed equivalents on {@link PptxTableCellStyle} (e.g. `horzOverflow`,
	 * `anchorCtr`, `headers`, `hideSlicers`, `slicerCacheId`). Keys are the
	 * raw XML attribute names without the `@_` prefix used by
	 * fast-xml-parser. Re-emitted verbatim by the save writer when present.
	 */
	extraAttributes?: Record<string, string>;
}

/**
 * A single table row with an optional height and an array of cells.
 *
 * @example
 * ```ts
 * const row: PptxTableRow = {
 *   height: 40,
 *   cells: [
 *     { text: "Name" },
 *     { text: "Score" },
 *   ],
 * };
 * // => satisfies PptxTableRow
 * ```
 */
export interface PptxTableRow {
	/** Row height in px. */
	height?: number;
	cells: PptxTableCell[];
}

/**
 * Complete parsed table data for a {@link TablePptxElement}.
 *
 * Includes row/cell data, column widths, banding flags, and the applied
 * table style ID.
 *
 * @example
 * ```ts
 * const data: PptxTableData = {
 *   rows: [
 *     { cells: [{ text: "Product" }, { text: "Revenue" }] },
 *     { cells: [{ text: "Widget A" }, { text: "$3.4M" }] },
 *   ],
 *   columnWidths: [0.6, 0.4],
 *   firstRowHeader: true,
 *   bandedRows: true,
 * };
 * // => satisfies PptxTableData
 * ```
 */
export interface PptxTableData {
	rows: PptxTableRow[];
	/** Column widths as proportion of total (summing to 1). */
	columnWidths: number[];
	/** Whether the table has banded rows. */
	bandedRows?: boolean;
	/** Whether the first row is a header. */
	firstRowHeader?: boolean;
	/** Whether banded columns are enabled. */
	bandedColumns?: boolean;
	/** Whether the last row is styled as a total row. */
	lastRow?: boolean;
	/** Whether the first column is styled as a header column. */
	firstCol?: boolean;
	/** Whether the last column is styled specially. */
	lastCol?: boolean;
	/** Table style ID from `a:tblPr/a:tblStyle@val` or `a:tblPr@tblStyle`. */
	tableStyleId?: string;
	/** Number of rows per banding group (default 1). */
	bandRowCycle?: number;
	/** Number of columns per banding group (default 1). */
	bandColCycle?: number;
	/** Right-to-left table layout from `a:tblPr/@rtl`. */
	rtl?: boolean;
	/**
	 * `a:tblPr`'s OWN fill (`CT_TableProperties` §21.1.3.15's
	 * `EG_FillProperties`), independent of any `a:tblStyleLst`-referenced style
	 * or that style's `a:tblBg`. Applied as the lowest-priority fill layer,
	 * beneath the table style's `wholeTbl` fill. Real PowerPoint decks route
	 * table appearance through `tableStyleId` instead, so this mainly matters
	 * for non-PowerPoint authoring tools (issue G6).
	 */
	tableFill?: ParsedTableStyleFill;
	/**
	 * Whether `a:tblPr` carries its own `a:effectLst`/`a:effectDag`,
	 * independent of the referenced table style. Presence-only: the concrete
	 * effect is not yet rendered, and the raw XML round-trips separately via
	 * whatever preserves `a:tblPr`'s unrecognised children (issue G6).
	 */
	tableEffects?: boolean;
}

// ==========================================================================
// Table style map (parsed from ppt/tableStyles.xml)
// ==========================================================================

/**
 * A single fill reference within a table style section.
 *
 * @example
 * ```ts
 * const fill: ParsedTableStyleFill = {
 *   schemeColor: "accent1",
 *   tint: 40000,   // 40% tint
 * };
 * // => satisfies ParsedTableStyleFill
 * ```
 */
export interface ParsedTableStyleFill {
	/**
	 * Theme colour key (e.g. `accent1`, `dk1`). Empty string when the fill is a
	 * non-scheme fill (explicit sRGB, gradient, pattern, or none) that carries
	 * no theme colour reference; the renderer then resolves {@link color},
	 * {@link gradient}, {@link pattern}, or {@link noFill} instead.
	 */
	schemeColor: string;
	/** Tint value (0-100 000). */
	tint?: number;
	/** Shade value (0-100 000). */
	shade?: number;
	/** Explicit sRGB hex colour (e.g. `#FF8800`) from `a:srgbClr`. */
	color?: string;
	/** The fill was `a:noFill`: renders transparent and clears lower layers. */
	noFill?: boolean;
	/** Gradient fill parsed from `a:gradFill`. */
	gradient?: ParsedTableStyleGradient;
	/** Preset pattern fill parsed from `a:pattFill`. */
	pattern?: ParsedTableStylePattern;
	/** Image texture fill parsed from `a:blipFill`. */
	image?: ParsedTableStyleImage;
}

/**
 * An image texture fill parsed from a table style section's `a:blipFill`.
 *
 * `ppt/tableStyles.xml` is a presentation-level part parsed once (not
 * per-slide), so this mirrors the per-CELL `a:tcPr/a:blipFill` two-field lazy
 * pattern (`PptxTableCellStyle.backgroundImageFillPath` /
 * `backgroundImageFillData`): `path` starts out as a raw archive-relative
 * path (or an already-external `http(s):`/`data:` URL), and a load pipeline
 * patches it to a displayable URL in `data` once resolved.
 */
export interface ParsedTableStyleImage {
	/** Archive-relative path, or an already-displayable external/data URL. */
	path?: string;
	/** Displayable URL once a load pipeline has resolved `path`. */
	data?: string;
}

/** A single colour stop within a {@link ParsedTableStyleGradient}. */
export interface ParsedTableStyleGradientStop {
	/** Stop position as a percentage (0-100). */
	position: number;
	/** Stop colour (scheme or explicit sRGB). */
	fill: ParsedTableStyleFill;
}

/** A gradient fill parsed from a table style section's `a:gradFill`. */
export interface ParsedTableStyleGradient {
	/** Ordered colour stops. */
	stops: ParsedTableStyleGradientStop[];
	/** Linear gradient angle in degrees (from `a:lin@ang`, 60000ths -> deg). */
	angle?: number;
	/** Gradient family: linear (`a:lin`) or radial (`a:path`). */
	type: 'linear' | 'radial';
}

/** A preset pattern fill parsed from a table style section's `a:pattFill`. */
export interface ParsedTableStylePattern {
	/** OOXML preset name (e.g. `ltDnDiag`) from `a:pattFill@prst`. */
	preset: string;
	/** Foreground colour (`a:fgClr`). */
	foreground?: ParsedTableStyleFill;
	/** Background colour (`a:bgClr`). */
	background?: ParsedTableStyleFill;
}

/**
 * A single entry in the parsed table style map.
 *
 * Contains fill colours for whole-table, banded rows/columns, first/last
 * row, and first/last column sections.
 *
 * @example
 * ```ts
 * const entry: ParsedTableStyleEntry = {
 *   styleId: "{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}",
 *   styleName: "Medium Style 2 - Accent 1",
 *   accentKey: "accent1",
 *   wholeTblFill: { schemeColor: "accent1", tint: 20000 },
 *   band1HFill:   { schemeColor: "accent1", tint: 40000 },
 *   firstRowFill: { schemeColor: "accent1" },
 * };
 * // => satisfies ParsedTableStyleEntry
 * ```
 */
/** Text properties from a:tcTxStyle in a table style section. */
export interface ParsedTableStyleText {
	/** Font bold. */
	bold?: boolean;
	/** Font italic. */
	italic?: boolean;
	/** Font underline (from `a:tcTxStyle@u`, any value other than `none`). */
	underline?: boolean;
	/** Font colour as theme scheme key. */
	fontSchemeColor?: string;
	/** Font colour tint (0-100 000). */
	fontTint?: number;
	/** Font colour shade (0-100 000). */
	fontShade?: number;
	/** Explicit sRGB hex font colour (e.g. `#FF0000`) from `a:srgbClr`. */
	fontColor?: string;
	/** Typeface from `a:font@typeface` (latin font). */
	fontFace?: string;
	/** Font-collection index from `a:fontRef@idx` (`minor`, `major`, `none`). */
	fontRefIdx?: string;
}

/**
 * A single border side within a table style's `a:tcStyle/a:tcBdr`.
 *
 * Corresponds to one of `a:left`, `a:right`, `a:top`, `a:bottom`,
 * `a:insideH`, `a:insideV`, `a:tl2br`, `a:tr2bl` (each a
 * `CT_ThemeableLineStyle` wrapping an `a:ln`).
 *
 * @example
 * ```ts
 * const side: ParsedTableStyleBorder = {
 *   width: 1,
 *   dash: 'solid',
 *   fill: { schemeColor: 'lt1' },
 * };
 * // => satisfies ParsedTableStyleBorder
 * ```
 */
export interface ParsedTableStyleBorder {
	/** Line width in px (converted from the `a:ln@w` EMU value). */
	width?: number;
	/** OOXML `a:prstDash@val` (e.g. `solid`, `dash`, `sysDot`). */
	dash?: string;
	/** Border colour as a theme scheme fill (from `a:ln/a:solidFill/a:schemeClr`). */
	fill?: ParsedTableStyleFill;
	/** Explicit hex colour when the line used `a:srgbClr` (e.g. `#808080`). */
	color?: string;
	/** The line was `a:noFill` - an explicit "no border" that clears lower layers. */
	noFill?: boolean;
}

/**
 * The set of border sides parsed from a table style section's
 * `a:tcStyle/a:tcBdr` element.
 */
export interface ParsedTableStyleBorders {
	left?: ParsedTableStyleBorder;
	right?: ParsedTableStyleBorder;
	top?: ParsedTableStyleBorder;
	bottom?: ParsedTableStyleBorder;
	/** Interior horizontal borders between rows in the region. */
	insideH?: ParsedTableStyleBorder;
	/** Interior vertical borders between columns in the region. */
	insideV?: ParsedTableStyleBorder;
	/** Top-left to bottom-right diagonal. */
	tl2br?: ParsedTableStyleBorder;
	/**
	 * Top-right to bottom-left diagonal (`a:tr2bl`, ECMA-376's
	 * `CT_TableCellBorderStyle` sequence: left/right/top/bottom/insideH/
	 * insideV/tl2br/tr2bl). The field keeps its historical `bl2tr` spelling
	 * only in the sense that it names the same geometric anti-diagonal line
	 * (top-right-to-bottom-left and bottom-left-to-top-right describe one
	 * undirected diagonal); the parser accepts the real `a:tr2bl` element and,
	 * leniently, a legacy `a:bl2tr` this app previously wrote (issue G4).
	 */
	tr2bl?: ParsedTableStyleBorder;
}

/**
 * Table background style (CT_TableBackgroundStyle, ECMA-376 §21.1.3.7).
 *
 * Corresponds to the `<a:tblBg>` child of `<a:tblStyle>`. Currently
 * captures only the resolved scheme-fill colour (verbatim XML for fill
 * / effect references is preserved separately by the save path).
 */
export interface ParsedTableBackground {
	/** Solid fill (resolved from `a:fill > a:solidFill > a:schemeClr`). */
	fill?: ParsedTableStyleFill;
	/** Has an `a:effectLst` child that should be round-tripped. */
	hasEffectLst?: boolean;
}

export interface ParsedTableStyleEntry {
	styleId: string;
	styleName?: string;
	/** Dominant accent key derived from fills (e.g. `accent1`). */
	accentKey?: string;
	/** Table-level background (`<a:tblBg>`). */
	tableBackground?: ParsedTableBackground;
	wholeTblFill?: ParsedTableStyleFill;
	band1HFill?: ParsedTableStyleFill;
	band2HFill?: ParsedTableStyleFill;
	band1VFill?: ParsedTableStyleFill;
	band2VFill?: ParsedTableStyleFill;
	firstRowFill?: ParsedTableStyleFill;
	lastRowFill?: ParsedTableStyleFill;
	firstColFill?: ParsedTableStyleFill;
	lastColFill?: ParsedTableStyleFill;
	/** Corner cell fills (`<a:seCell>`, `<a:swCell>`, `<a:neCell>`, `<a:nwCell>`). */
	seCellFill?: ParsedTableStyleFill;
	swCellFill?: ParsedTableStyleFill;
	neCellFill?: ParsedTableStyleFill;
	nwCellFill?: ParsedTableStyleFill;
	/**
	 * Per-role border styling from `a:tcStyle/a:tcBdr`. These supply the
	 * gridlines/edges a styled table inherits from its table style when the
	 * cells carry no explicit per-cell `a:lnX` overrides.
	 */
	wholeTblBorders?: ParsedTableStyleBorders;
	firstRowBorders?: ParsedTableStyleBorders;
	lastRowBorders?: ParsedTableStyleBorders;
	firstColBorders?: ParsedTableStyleBorders;
	lastColBorders?: ParsedTableStyleBorders;
	band1HBorders?: ParsedTableStyleBorders;
	band2HBorders?: ParsedTableStyleBorders;
	band1VBorders?: ParsedTableStyleBorders;
	band2VBorders?: ParsedTableStyleBorders;
	seCellBorders?: ParsedTableStyleBorders;
	swCellBorders?: ParsedTableStyleBorders;
	neCellBorders?: ParsedTableStyleBorders;
	nwCellBorders?: ParsedTableStyleBorders;
	/** Per-role text styling from a:tcTxStyle. */
	wholeTblText?: ParsedTableStyleText;
	firstRowText?: ParsedTableStyleText;
	lastRowText?: ParsedTableStyleText;
	firstColText?: ParsedTableStyleText;
	lastColText?: ParsedTableStyleText;
	band1HText?: ParsedTableStyleText;
	band2HText?: ParsedTableStyleText;
	band1VText?: ParsedTableStyleText;
	band2VText?: ParsedTableStyleText;
	seCellText?: ParsedTableStyleText;
	swCellText?: ParsedTableStyleText;
	neCellText?: ParsedTableStyleText;
	nwCellText?: ParsedTableStyleText;
	/**
	 * Per-role 3D bevel + lighting from `a:tcStyle/a:cell3D` (CT_Cell3D),
	 * distinct from the per-cell `a:tcPr/a:cell3D` {@link PptxTableCellStyle}
	 * already supports. None of PowerPoint's 74 built-in gallery styles use
	 * this (0 hits in the built-in catalogue), so it only matters for a
	 * hand-authored or third-party table style.
	 */
	wholeTblCell3D?: PptxTableCell3D;
	firstRowCell3D?: PptxTableCell3D;
	lastRowCell3D?: PptxTableCell3D;
	firstColCell3D?: PptxTableCell3D;
	lastColCell3D?: PptxTableCell3D;
	band1HCell3D?: PptxTableCell3D;
	band2HCell3D?: PptxTableCell3D;
	band1VCell3D?: PptxTableCell3D;
	band2VCell3D?: PptxTableCell3D;
	seCellCell3D?: PptxTableCell3D;
	swCellCell3D?: PptxTableCell3D;
	neCellCell3D?: PptxTableCell3D;
	nwCellCell3D?: PptxTableCell3D;
}

/**
 * Map of GUID → table style entry.
 *
 * Parsed from `ppt/tableStyles.xml` and indexed by the style GUID
 * referenced in `a:tblPr@tblStyle`.
 *
 * @example
 * ```ts
 * const styles: ParsedTableStyleMap = {
 *   "{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}": {
 *     styleId: "{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}",
 *     styleName: "Medium Style 2 - Accent 1",
 *     accentKey: "accent1",
 *   },
 * };
 * // => satisfies ParsedTableStyleMap
 * ```
 */
export type ParsedTableStyleMap = Record<string, ParsedTableStyleEntry>;
