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
 * All fields are optional — unset values inherit from the table style.
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
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  backgroundColor?: string;
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
  align?: "left" | "center" | "right" | "justify";
  vAlign?: "top" | "middle" | "bottom";
  /** Text direction from `a:tcPr/@vert`. */
  textDirection?: "vertical" | "vertical270" | "eaVert" | "wordArtVert" | "wordArtVertRtl" | "mongolianVert";
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
  /** Cell fill mode: solid, gradient, pattern, or none. */
  fillMode?: "solid" | "gradient" | "pattern" | "none";
  /** Gradient fill stops (colours with positions). */
  gradientFillStops?: Array<{
    color: string;
    position: number;
    opacity?: number;
  }>;
  /** Gradient angle in degrees. */
  gradientFillAngle?: number;
  /** Gradient type: linear or radial. */
  gradientFillType?: "linear" | "radial";
  /** Path gradient sub-type. */
  gradientFillPathType?: "circle" | "rect" | "shape";
  /** Focal point for radial gradients (0–1 fractions). */
  gradientFillFocalPoint?: { x: number; y: number };
  /** Pre-computed CSS gradient string for rendering. */
  gradientFillCss?: string;
  /** Pattern fill preset name (e.g. "ltDnDiag"). */
  patternFillPreset?: string;
  /** Pattern fill foreground colour. */
  patternFillForeground?: string;
  /** Pattern fill background colour. */
  patternFillBackground?: string;
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
  /** Column span (defaults to 1). */
  gridSpan?: number;
  /** Row span (defaults to 1). */
  rowSpan?: number;
  /** Whether this cell is merged vertically with the cell above. */
  vMerge?: boolean;
  /** Whether this cell is horizontally merged with the cell to the left (gridSpan continuation). */
  hMerge?: boolean;
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
  /** Theme colour key (e.g. `accent1`, `dk1`). */
  schemeColor: string;
  /** Tint value (0-100 000). */
  tint?: number;
  /** Shade value (0-100 000). */
  shade?: number;
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
	/** Font colour as theme scheme key. */
	fontSchemeColor?: string;
	/** Font colour tint (0-100 000). */
	fontTint?: number;
	/** Font colour shade (0-100 000). */
	fontShade?: number;
}

export interface ParsedTableStyleEntry {
  styleId: string;
  styleName?: string;
  /** Dominant accent key derived from fills (e.g. `accent1`). */
  accentKey?: string;
  wholeTblFill?: ParsedTableStyleFill;
  band1HFill?: ParsedTableStyleFill;
  band2HFill?: ParsedTableStyleFill;
  band1VFill?: ParsedTableStyleFill;
  band2VFill?: ParsedTableStyleFill;
  firstRowFill?: ParsedTableStyleFill;
  lastRowFill?: ParsedTableStyleFill;
  firstColFill?: ParsedTableStyleFill;
  lastColFill?: ParsedTableStyleFill;
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
