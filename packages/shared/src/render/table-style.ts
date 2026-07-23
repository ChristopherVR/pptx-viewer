/**
 * table-style.ts — framework-agnostic table render helpers.
 *
 * A focused port of the React table render helpers that operate on the
 * structured {@link PptxTableData} model (not raw OOXML). The renderer is
 * viewer-first: it consumes the already-parsed cell styles, banding flags,
 * and column widths that `pptx-viewer-core` produces, and maps them to CSS.
 *
 * Returns plain {@link TableCellCss} objects (no framework `CSSProperties`
 * type) so React, Vue, and Angular can each apply them to their own style
 * binding.
 *
 * Ports of:
 *   - `viewer/utils/table-render-helpers.ts`  → {@link cellStyleToCss}
 *   - `viewer/utils/table-band-style.tsx`     → {@link getTableCellBandStyle}
 *
 * Pattern fills are rendered as tiled inline SVG using {@link getPatternSvg}
 * from `fill-style.ts`, which is already part of the shared barrel.
 * Scheme-colour band resolution uses the optional {@link TableStyleContext}
 * passed to {@link getTableCellBandStyle}.
 */
import type {
	ParsedTableStyleFill,
	ParsedTableStyleMap,
	PptxTableCellStyle,
	PptxTableData,
	PptxThemeColorScheme,
	PptxThemeFontScheme,
} from 'pptx-viewer-core';

import { getPatternSvg, normalizeHexColor } from './fill-style';
import type { CellBorderPosition } from './table-style-borders';
import { resolveCellBorderCss, resolveStyleDiagonalBorders } from './table-style-borders';
import {
	applyStyleFill,
	applyStyleText,
	cell3DBevelCss,
	resolveStyleFillColor,
} from './table-style-fill';

export { resolveStyleDiagonalBorders } from './table-style-borders';
export { cell3DBevelCss, resolveFontRefIdx } from './table-style-fill';

/** A framework-agnostic CSS style object: camelCased property → value. */
export type TableCellCss = Record<string, string | number>;

// ---------------------------------------------------------------------------
// Rich per-run cell text
// ---------------------------------------------------------------------------

/**
 * A single styled text run within a table cell.
 *
 * Table cells in the core data model carry only a flat `cell.text` string
 * and a cell-level `cell.style` derived from the first paragraph's first
 * run. Renderers that want finer-grained per-run formatting can attach an
 * optional array of {@link CellTextRun} objects alongside the cell (e.g.
 * as a duck-typed extension).  When present, the renderer should display
 * these runs as styled `<span>` elements instead of the plain text string.
 */
export interface CellTextRun {
	/** Text content of this run. Empty strings are valid (e.g. line breaks). */
	text: string;
	/** Whether this run marks a paragraph break (starts a new block). */
	isParagraphBreak?: boolean;
	/** Whether this run marks an in-paragraph line break. */
	isLineBreak?: boolean;
	bold?: boolean;
	italic?: boolean;
	underline?: boolean;
	strikethrough?: boolean;
	/** Hex colour string, e.g. `"#FF0000"`. */
	color?: string;
	/** Font size in points. */
	fontSize?: number;
	/** Font family name. */
	fontFamily?: string;
}

/**
 * Convert a {@link CellTextRun}'s per-run formatting to an inline CSS style
 * object suitable for a `<span>` element.
 */
export function cellRunStyle(run: CellTextRun): TableCellCss {
	const css: TableCellCss = {};
	if (run.fontFamily) {
		css.fontFamily = run.fontFamily;
	}
	if (typeof run.fontSize === 'number') {
		css.fontSize = `${run.fontSize}pt`;
	}
	if (run.color) {
		css.color = run.color;
	}
	if (run.bold) {
		css.fontWeight = 'bold';
	}
	if (run.italic) {
		css.fontStyle = 'italic';
	}
	const deco: string[] = [];
	if (run.underline) {
		deco.push('underline');
	}
	if (run.strikethrough) {
		deco.push('line-through');
	}
	if (deco.length > 0) {
		css.textDecoration = deco.join(' ');
	}
	return css;
}

// ---------------------------------------------------------------------------
// Pattern fill helpers
// ---------------------------------------------------------------------------

/**
 * Result of resolving an OOXML preset pattern fill to CSS background
 * properties.  When `backgroundImage` is set it is a `url("data:image/svg+xml,…")`
 * string representing the tiled pattern; `backgroundColor` provides the
 * solid background colour behind the pattern.
 */
export interface CellPatternFillCss {
	backgroundImage?: string;
	backgroundColor?: string;
}

/**
 * Resolve a preset pattern fill from a {@link PptxTableCellStyle} to CSS
 * background properties.  Mirrors the pattern-fill branch of the React
 * `cellStyleToCss` but returns the two properties separately so callers
 * can apply them individually (e.g. Vue's `:style` binding).
 *
 * Returns `null` when the cell style carries no pattern fill.
 */
export function cellPatternFillCss(style: PptxTableCellStyle): CellPatternFillCss | null {
	if (style.fillMode !== 'pattern' || !style.patternFillPreset) {
		return null;
	}
	const fg = normalizeHexColor(style.patternFillForeground, '#000000');
	const bg = normalizeHexColor(style.patternFillBackground, '#ffffff');
	const svgMarkup = getPatternSvg(style.patternFillPreset, fg, bg);
	if (svgMarkup) {
		const encoded = encodeURIComponent(svgMarkup);
		return {
			backgroundImage: `url("data:image/svg+xml,${encoded}")`,
			backgroundColor: bg,
		};
	}
	// Unknown preset — fall back to solid background colour.
	const fallback = style.patternFillBackground ?? style.backgroundColor;
	return fallback ? { backgroundColor: fallback } : null;
}

// ---------------------------------------------------------------------------
// Theme-aware band / header style resolution
// ---------------------------------------------------------------------------

/**
 * Context for resolving table style section fills and text properties from
 * the PPTX theme's colour scheme.
 *
 * Both fields are optional so callers that don't have the theme wired in yet
 * can omit the context and the function falls back to hardcoded colours.
 */
export interface TableStyleContext {
	/** Parsed table style map (from `ppt/tableStyles.xml`). */
	tableStyleMap?: ParsedTableStyleMap;
	/** Theme colour scheme from the active PPTX theme. */
	colorScheme?: PptxThemeColorScheme;
	/**
	 * Theme font scheme from the active PPTX theme. Supplied so a table
	 * style's `a:fontRef@idx` (`minor`/`major`) can resolve to a concrete
	 * font family. Optional: when absent, `fontRefIdx` is left unresolved.
	 */
	fontScheme?: PptxThemeFontScheme;
}

/**
 * Look up the table style entry for a style GUID, trying both the raw value
 * and the braced-upper-case normalisation that OOXML uses.
 */
function resolveTableStyleEntry(
	tableStyleId: string | undefined,
	tableStyleMap: ParsedTableStyleMap | undefined,
) {
	if (!tableStyleId || !tableStyleMap) {
		return undefined;
	}
	const direct = tableStyleMap[tableStyleId];
	if (direct) {
		return direct;
	}
	const normalised = tableStyleId.trim().toUpperCase();
	const withBraces = normalised.startsWith('{') ? normalised : `{${normalised}}`;
	return tableStyleMap[withBraces];
}

/** Map an OOXML `a:prstDash/@val` value to a CSS `border-style` keyword. */
export function ooxmlDashToCssBorderStyle(dashVal: string | undefined): string {
	if (!dashVal) {
		return 'solid';
	}
	switch (dashVal) {
		case 'dot':
		case 'sysDot':
			return 'dotted';
		case 'dash':
		case 'sysDash':
		case 'lgDash':
		case 'dashDot':
		case 'lgDashDot':
		case 'sysDashDot':
		case 'lgDashDotDot':
		case 'sysDashDotDot':
			return 'dashed';
		default:
			return 'solid';
	}
}

/**
 * Convert a structured {@link PptxTableCellStyle} to CSS properties.
 *
 * Mirrors the React `cellStyleToCss`, minus the SVG pattern-fill branch
 * (approximated by its background colour here).
 */
export function cellStyleToCss(style?: PptxTableCellStyle): TableCellCss {
	if (!style) {
		return {};
	}
	const css: TableCellCss = {};

	if (style.fontSize) {
		css.fontSize = `${style.fontSize}px`;
	}
	if (style.bold) {
		css.fontWeight = 'bold';
	}
	if (style.italic) {
		css.fontStyle = 'italic';
	}
	if (style.underline) {
		css.textDecorationLine = 'underline';
	}
	if (style.color) {
		css.color = style.color;
	}

	// Cell background fill — gradient takes precedence, then pattern, then solid.
	if (style.gradientFillCss) {
		css.background = style.gradientFillCss;
	} else if (style.fillMode === 'pattern') {
		// Render the real SVG pattern tile when the preset is known;
		// fall back to the background colour for unrecognised presets.
		const patternResult = cellPatternFillCss(style);
		if (patternResult) {
			if (patternResult.backgroundImage) {
				css.backgroundImage = patternResult.backgroundImage;
			}
			if (patternResult.backgroundColor) {
				css.backgroundColor = patternResult.backgroundColor;
			}
		} else {
			const fallback = style.patternFillBackground ?? style.backgroundColor;
			if (fallback) {
				css.backgroundColor = fallback;
			}
		}
	} else if (style.backgroundColor) {
		css.backgroundColor = style.backgroundColor;
	}

	if (style.align) {
		css.textAlign = style.align;
	} else if (style.anchorCtr) {
		// `anchorCtr` centres the text block perpendicular to the text flow.
		// For horizontal text this is horizontal centring; an explicit
		// paragraph `align` takes precedence when present.
		css.textAlign = 'center';
	}
	if (style.vAlign) {
		css.verticalAlign = style.vAlign;
	}

	// `horzOverflow` = clip clips text at the cell edge; overflow (default)
	// lets it spill horizontally.
	if (style.horzOverflow === 'clip') {
		css.overflowX = 'hidden';
	} else if (style.horzOverflow === 'overflow') {
		css.overflowX = 'visible';
	}

	// Vertical text direction — map all variants to CSS writing-mode + orientation.
	if (style.textDirection) {
		switch (style.textDirection) {
			case 'vert':
			case 'eaVert':
			case 'wordArtVert':
			case 'wordArtVertRtl':
				css.writingMode = 'vertical-rl';
				break;
			case 'vert270':
			case 'mongolianVert':
				css.writingMode = 'vertical-lr';
				break;
		}
		if (style.textDirection === 'wordArtVert') {
			css.textOrientation = 'upright';
		} else if (css.writingMode) {
			css.textOrientation = 'mixed';
		}
		if (style.textDirection === 'wordArtVertRtl') {
			css.direction = 'rtl';
		}
	}

	// Per-edge borders (width, color, dash style).
	const borderEdges = [
		{
			prefix: 'borderTop',
			width: style.borderTopWidth,
			color: style.borderTopColor,
			dash: style.borderTopDash,
		},
		{
			prefix: 'borderBottom',
			width: style.borderBottomWidth,
			color: style.borderBottomColor,
			dash: style.borderBottomDash,
		},
		{
			prefix: 'borderLeft',
			width: style.borderLeftWidth,
			color: style.borderLeftColor,
			dash: style.borderLeftDash,
		},
		{
			prefix: 'borderRight',
			width: style.borderRightWidth,
			color: style.borderRightColor,
			dash: style.borderRightDash,
		},
	] as const;
	for (const edge of borderEdges) {
		if (edge.width || edge.color) {
			const w = edge.width ?? 1;
			const c = edge.color ?? style.borderColor ?? '#000000';
			const s = ooxmlDashToCssBorderStyle(edge.dash);
			css[edge.prefix] = `${w}px ${s} ${c}`;
		}
	}

	// Cell margins → padding.
	if (style.marginLeft) {
		css.paddingLeft = `${style.marginLeft}px`;
	}
	if (style.marginRight) {
		css.paddingRight = `${style.marginRight}px`;
	}
	if (style.marginTop) {
		css.paddingTop = `${style.marginTop}px`;
	}
	if (style.marginBottom) {
		css.paddingBottom = `${style.marginBottom}px`;
	}

	// Text effects (shadow / glow) via CSS text-shadow.
	const textShadowParts: string[] = [];
	if (style.textShadowColor) {
		const offX = style.textShadowOffsetX ?? 1;
		const offY = style.textShadowOffsetY ?? 1;
		const blur = style.textShadowBlur ?? 0;
		textShadowParts.push(`${offX}px ${offY}px ${blur}px ${style.textShadowColor}`);
	}
	if (style.textGlowColor) {
		const radius = style.textGlowRadius ?? 2;
		textShadowParts.push(`0px 0px ${radius}px ${style.textGlowColor}`);
	}
	if (textShadowParts.length > 0) {
		css.textShadow = textShadowParts.join(', ');
	}

	// Cell 3D bevel treatment (a:cell3D).
	if (style.cell3D) {
		Object.assign(css, cell3DBevelCss(style.cell3D));
	}

	return css;
}

/**
 * Diagonal border info derived from a {@link PptxTableCellStyle}, for the SVG
 * overlay drawn inside a cell. Mirrors the React `DiagonalBorderInfo`.
 */
export interface DiagonalBorderInfo {
	diagDownColor?: string;
	diagDownWidth?: number;
	diagUpColor?: string;
	diagUpWidth?: number;
}

/**
 * Extract diagonal-border info from a cell style, or `null` when none.
 *
 * When `styleDiagonals` (diagonals inherited from the table style, e.g. via
 * {@link resolveStyleDiagonalBorders}) is supplied, the two are merged with the
 * per-cell explicit diagonal winning on each axis.
 */
export function getDiagonalBorders(
	style?: PptxTableCellStyle,
	styleDiagonals?: DiagonalBorderInfo | null,
): DiagonalBorderInfo | null {
	const cellHasDown = Boolean(style?.borderDiagDownColor && style?.borderDiagDownWidth);
	const cellHasUp = Boolean(style?.borderDiagUpColor && style?.borderDiagUpWidth);
	const styleHasDown = Boolean(styleDiagonals?.diagDownColor && styleDiagonals?.diagDownWidth);
	const styleHasUp = Boolean(styleDiagonals?.diagUpColor && styleDiagonals?.diagUpWidth);

	if (!cellHasDown && !cellHasUp && !styleHasDown && !styleHasUp) {
		return null;
	}

	const info: DiagonalBorderInfo = {};
	if (cellHasDown) {
		info.diagDownColor = style?.borderDiagDownColor;
		info.diagDownWidth = style?.borderDiagDownWidth;
	} else if (styleHasDown) {
		info.diagDownColor = styleDiagonals?.diagDownColor;
		info.diagDownWidth = styleDiagonals?.diagDownWidth;
	}
	if (cellHasUp) {
		info.diagUpColor = style?.borderDiagUpColor;
		info.diagUpWidth = style?.borderDiagUpWidth;
	} else if (styleHasUp) {
		info.diagUpColor = styleDiagonals?.diagUpColor;
		info.diagUpWidth = styleDiagonals?.diagUpWidth;
	}
	return info;
}

/**
 * Resolve a cell's diagonal borders combining the per-cell explicit diagonals
 * with any inherited from the applicable table-style sections. A one-call
 * convenience for renderers: pass the same {@link TableStyleContext} and cell
 * position used for banding, and per-cell diagonals still take precedence.
 */
export function getCellDiagonalBorders(
	style: PptxTableCellStyle | undefined,
	tableData: PptxTableData | undefined,
	pos: CellBorderPosition,
	styleCtx?: TableStyleContext,
): DiagonalBorderInfo | null {
	let styleDiagonals: DiagonalBorderInfo | undefined;
	if (tableData) {
		const entry = resolveTableStyleEntry(tableData.tableStyleId, styleCtx?.tableStyleMap);
		styleDiagonals = resolveStyleDiagonalBorders(entry, tableData, pos, (fill) =>
			resolveStyleFillColor(fill, styleCtx?.colorScheme),
		);
	}
	return getDiagonalBorders(style, styleDiagonals);
}

/**
 * Banding / header / total-row / first-last-column emphasis for a cell.
 *
 * A port of the React `getTableCellBandStyle` that operates purely on the
 * structured {@link PptxTableData} banding flags. Without the parsed table
 * style map + theme colour scheme (not threaded into the viewer yet) it
 * uses the same hardcoded fallback colours the React renderer falls back to.
 *
 * Returns `undefined` when no banding applies, so callers can treat the
 * result as a lower-priority style layer beneath explicit cell styles.
 */
export function getTableCellBandStyle(
	tableData: PptxTableData | undefined,
	rowIndex: number,
	cellIndex: number,
	rowCount: number,
	columnCount: number,
	styleCtx?: TableStyleContext,
): TableCellCss | undefined {
	if (!tableData) {
		return undefined;
	}

	const styleEntry = resolveTableStyleEntry(tableData.tableStyleId, styleCtx?.tableStyleMap);
	const colorScheme = styleCtx?.colorScheme;
	const fontScheme = styleCtx?.fontScheme;

	/**
	 * Resolve a section fill to a concrete CSS colour string, falling back
	 * to `fallback` when the scheme colour key is absent in the theme.
	 */
	const resolveFill = (fill: ParsedTableStyleFill | undefined, fallback: string): string =>
		resolveStyleFillColor(fill, colorScheme) ?? fallback;

	const style: TableCellCss = {};
	let applied = false;

	// ── Whole-table fill (lowest priority layer). ──
	if (styleEntry?.wholeTblFill) {
		if (applyStyleFill(styleEntry.wholeTblFill, colorScheme, style, '')) {
			applied = true;
		}
	}
	if (applyStyleText(styleEntry?.wholeTblText, colorScheme, style, fontScheme)) {
		applied = true;
	}

	// ── Banded rows (skip the header row when present). ──
	const bandStartRow = tableData.firstRowHeader ? 1 : 0;
	const bandEndRow = tableData.lastRow ? rowCount - 1 : rowCount;
	if (tableData.bandedRows && rowIndex >= bandStartRow && rowIndex < bandEndRow) {
		const bandIndex = rowIndex - bandStartRow;
		const rowCycle = Math.max(tableData.bandRowCycle ?? 1, 1);
		const bandGroup = Math.floor(bandIndex / rowCycle) % 2;
		if (bandGroup === 0) {
			applyStyleFill(styleEntry?.band1HFill, colorScheme, style, 'rgba(217, 226, 243, 0.5)');
			applyStyleText(styleEntry?.band1HText, colorScheme, style, fontScheme);
			applied = true;
		} else if (styleEntry?.band2HFill) {
			if (applyStyleFill(styleEntry.band2HFill, colorScheme, style, '')) {
				applyStyleText(styleEntry.band2HText, colorScheme, style, fontScheme);
				applied = true;
			}
		}
	}

	// ── Banded columns. ──
	if (tableData.bandedColumns) {
		const isFirstCol = tableData.firstCol;
		const isLastCol = tableData.lastCol;
		const colBandIndex = isFirstCol && cellIndex > 0 ? cellIndex - 1 : cellIndex;
		const skipCol = (isFirstCol && cellIndex === 0) || (isLastCol && cellIndex === columnCount - 1);
		if (!skipCol) {
			const colCycle = Math.max(tableData.bandColCycle ?? 1, 1);
			const colBandGroup = Math.floor(colBandIndex / colCycle) % 2;
			// Column banding yields to row banding when both apply to this cell.
			const canOverride = !style.backgroundColor || !tableData.bandedRows;
			if (colBandGroup === 0) {
				if (canOverride) {
					applyStyleFill(styleEntry?.band1VFill, colorScheme, style, 'rgba(217, 226, 243, 0.35)');
					applyStyleText(styleEntry?.band1VText, colorScheme, style, fontScheme);
					applied = true;
				}
			} else if (styleEntry?.band2VFill && canOverride) {
				if (applyStyleFill(styleEntry.band2VFill, colorScheme, style, '')) {
					applyStyleText(styleEntry.band2VText, colorScheme, style, fontScheme);
					applied = true;
				}
			}
		}
	}

	// ── Header row (first row). ──
	if (tableData.firstRowHeader && rowIndex === 0) {
		style.fontWeight = 700;
		applyStyleFill(styleEntry?.firstRowFill, colorScheme, style, 'rgba(68, 114, 196, 0.85)');
		style.color = '#ffffff';
		applyStyleText(styleEntry?.firstRowText, colorScheme, style, fontScheme);
		applied = true;
	}

	// ── Total / last row emphasis. ──
	if (tableData.lastRow && rowIndex === rowCount - 1) {
		style.fontWeight = 700;
		if (styleEntry?.lastRowFill) {
			applyStyleFill(styleEntry.lastRowFill, colorScheme, style, '');
		}
		const borderColor = resolveFill(styleEntry?.firstRowFill, 'rgba(68, 114, 196, 0.7)');
		style.borderTop = `2px solid ${borderColor}`;
		applyStyleText(styleEntry?.lastRowText, colorScheme, style, fontScheme);
		applied = true;
	}

	// ── First column emphasis. ──
	if (tableData.firstCol && cellIndex === 0) {
		style.fontWeight = 700;
		if (styleEntry?.firstColFill) {
			applyStyleFill(styleEntry.firstColFill, colorScheme, style, '');
		}
		applyStyleText(styleEntry?.firstColText, colorScheme, style, fontScheme);
		applied = true;
	}

	// ── Last column emphasis. ──
	if (tableData.lastCol && cellIndex === columnCount - 1) {
		style.fontWeight = 700;
		if (styleEntry?.lastColFill) {
			applyStyleFill(styleEntry.lastColFill, colorScheme, style, '');
		}
		applyStyleText(styleEntry?.lastColText, colorScheme, style, fontScheme);
		applied = true;
	}

	// ── Corner cells (highest fill/text precedence, issue #95). ──
	// Each corner overrides the intersection of a first/last row with a
	// first/last column (CT_TableStyle, ECMA-376 §21.1.3.16): nw = top-left,
	// ne = top-right, sw = bottom-left, se = bottom-right. Only applies when
	// both the row and column emphasis are active for this cell.
	if (styleEntry) {
		const atTop = Boolean(tableData.firstRowHeader) && rowIndex === 0;
		const atBottom = Boolean(tableData.lastRow) && rowIndex === rowCount - 1;
		const atLeft = Boolean(tableData.firstCol) && cellIndex === 0;
		const atRight = Boolean(tableData.lastCol) && cellIndex === columnCount - 1;
		let cornerFill: ParsedTableStyleFill | undefined;
		let cornerText = undefined as (typeof styleEntry)['nwCellText'];
		if (atTop && atLeft) {
			cornerFill = styleEntry.nwCellFill;
			cornerText = styleEntry.nwCellText;
		} else if (atTop && atRight) {
			cornerFill = styleEntry.neCellFill;
			cornerText = styleEntry.neCellText;
		} else if (atBottom && atLeft) {
			cornerFill = styleEntry.swCellFill;
			cornerText = styleEntry.swCellText;
		} else if (atBottom && atRight) {
			cornerFill = styleEntry.seCellFill;
			cornerText = styleEntry.seCellText;
		}
		if (cornerFill && applyStyleFill(cornerFill, colorScheme, style, '')) {
			applied = true;
		}
		if (applyStyleText(cornerText, colorScheme, style, fontScheme)) {
			applied = true;
		}
	}

	// ── Table-style borders (issue #71). ──
	// Resolve gridlines/edges the cell inherits from the table style and let
	// them supersede the hardcoded total-row line above. Per-cell explicit
	// `a:lnX` borders (parsed into the cell style) are applied on top of this
	// layer by the renderer, so they still win.
	const borderCss = resolveCellBorderCss(
		styleEntry,
		tableData,
		{ rowIndex, cellIndex, rowCount, columnCount },
		(fill) => resolveStyleFillColor(fill, colorScheme),
	);
	if (borderCss) {
		Object.assign(style, borderCss);
		applied = true;
	}

	return applied ? style : undefined;
}
