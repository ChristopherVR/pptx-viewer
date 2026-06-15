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
	ParsedTableStyleText,
	PptxTableCellStyle,
	PptxTableData,
	PptxThemeColorScheme,
} from 'pptx-viewer-core';

import { getPatternSvg, normalizeHexColor } from './fill-style';

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
// Theme colour helpers (tint / shade)  — mirrors React viewer/utils/theme.ts
// ---------------------------------------------------------------------------

/** Parse a 6-digit hex colour (`#RRGGBB` or `RRGGBB`) into RGB components. */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
	const clean = hex.replace(/^#/u, '');
	return {
		r: parseInt(clean.substring(0, 2), 16),
		g: parseInt(clean.substring(2, 4), 16),
		b: parseInt(clean.substring(4, 6), 16),
	};
}

/** Convert RGB components back to a `#RRGGBB` string. */
function rgbToHex(r: number, g: number, b: number): string {
	const clamp = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));
	return `#${clamp(r).toString(16).padStart(2, '0').toUpperCase()}${clamp(g).toString(16).padStart(2, '0').toUpperCase()}${clamp(b).toString(16).padStart(2, '0').toUpperCase()}`;
}

/**
 * Compute a tinted (lighter) version of a colour.
 * `tintFactor` is 0–1 where 1 = white and 0 = original.
 */
function tintColor(hex: string, tintFactor: number): string {
	const { r, g, b } = hexToRgb(hex);
	return rgbToHex(
		r + (255 - r) * tintFactor,
		g + (255 - g) * tintFactor,
		b + (255 - b) * tintFactor,
	);
}

/**
 * Compute a shaded (darker) version of a colour.
 * `shadeFactor` is 0–1 where 1 = black and 0 = original.
 */
function shadeColor(hex: string, shadeFactor: number): string {
	const { r, g, b } = hexToRgb(hex);
	return rgbToHex(r * (1 - shadeFactor), g * (1 - shadeFactor), b * (1 - shadeFactor));
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
}

/**
 * Resolve a {@link ParsedTableStyleFill} to a CSS hex colour using the
 * supplied colour scheme.  Returns `undefined` when the scheme colour key
 * cannot be found.
 */
function resolveStyleFillColor(
	fill: ParsedTableStyleFill | undefined,
	colorScheme: PptxThemeColorScheme | undefined,
): string | undefined {
	if (!fill) {
		return undefined;
	}
	if (!colorScheme) {
		return undefined;
	}
	const base = (colorScheme as unknown as Record<string, string | undefined>)[fill.schemeColor];
	if (!base) {
		return undefined;
	}
	let color = base;
	if (fill.tint !== undefined && fill.tint > 0) {
		color = tintColor(color, fill.tint / 100_000);
	}
	if (fill.shade !== undefined && fill.shade > 0) {
		color = shadeColor(color, 1 - fill.shade / 100_000);
	}
	return color;
}

/**
 * Apply text properties from a {@link ParsedTableStyleText} entry into a
 * {@link TableCellCss} object.  Returns `true` when any property was set.
 */
function applyStyleText(
	text: ParsedTableStyleText | undefined,
	colorScheme: PptxThemeColorScheme | undefined,
	css: TableCellCss,
): boolean {
	if (!text) {
		return false;
	}
	let applied = false;
	if (text.bold) {
		css.fontWeight = 700;
		applied = true;
	}
	if (text.italic) {
		css.fontStyle = 'italic';
		applied = true;
	}
	if (text.fontSchemeColor && colorScheme) {
		const base = (colorScheme as unknown as Record<string, string | undefined>)[
			text.fontSchemeColor
		];
		if (base) {
			let color = base;
			if (text.fontTint !== undefined && text.fontTint > 0) {
				color = tintColor(color, text.fontTint / 100_000);
			}
			if (text.fontShade !== undefined && text.fontShade > 0) {
				color = shadeColor(color, 1 - text.fontShade / 100_000);
			}
			css.color = color;
			applied = true;
		}
	}
	return applied;
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
	}
	if (style.vAlign) {
		css.verticalAlign = style.vAlign;
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

/** Extract diagonal-border info from a cell style, or `null` when none. */
export function getDiagonalBorders(style?: PptxTableCellStyle): DiagonalBorderInfo | null {
	if (!style) {
		return null;
	}
	const hasDown = Boolean(style.borderDiagDownColor && style.borderDiagDownWidth);
	const hasUp = Boolean(style.borderDiagUpColor && style.borderDiagUpWidth);
	if (!hasDown && !hasUp) {
		return null;
	}
	return {
		diagDownColor: style.borderDiagDownColor,
		diagDownWidth: style.borderDiagDownWidth,
		diagUpColor: style.borderDiagUpColor,
		diagUpWidth: style.borderDiagUpWidth,
	};
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
		const wholeBg = resolveFill(styleEntry.wholeTblFill, '');
		if (wholeBg) {
			style.backgroundColor = wholeBg;
			applied = true;
		}
	}
	if (applyStyleText(styleEntry?.wholeTblText, colorScheme, style)) {
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
			style.backgroundColor = resolveFill(styleEntry?.band1HFill, 'rgba(217, 226, 243, 0.5)');
			if (applyStyleText(styleEntry?.band1HText, colorScheme, style)) {
				applied = true;
			}
			applied = true;
		} else if (styleEntry?.band2HFill) {
			const band2Bg = resolveFill(styleEntry.band2HFill, '');
			if (band2Bg) {
				style.backgroundColor = band2Bg;
				applyStyleText(styleEntry.band2HText, colorScheme, style);
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
			if (colBandGroup === 0) {
				if (!style.backgroundColor || !tableData.bandedRows) {
					style.backgroundColor = resolveFill(styleEntry?.band1VFill, 'rgba(217, 226, 243, 0.35)');
					applyStyleText(styleEntry?.band1VText, colorScheme, style);
					applied = true;
				}
			} else if (styleEntry?.band2VFill) {
				if (!style.backgroundColor || !tableData.bandedRows) {
					const band2Bg = resolveFill(styleEntry.band2VFill, '');
					if (band2Bg) {
						style.backgroundColor = band2Bg;
						applyStyleText(styleEntry.band2VText, colorScheme, style);
						applied = true;
					}
				}
			}
		}
	}

	// ── Header row (first row). ──
	if (tableData.firstRowHeader && rowIndex === 0) {
		style.fontWeight = 700;
		style.backgroundColor = resolveFill(styleEntry?.firstRowFill, 'rgba(68, 114, 196, 0.85)');
		style.color = '#ffffff';
		applyStyleText(styleEntry?.firstRowText, colorScheme, style);
		applied = true;
	}

	// ── Total / last row emphasis. ──
	if (tableData.lastRow && rowIndex === rowCount - 1) {
		style.fontWeight = 700;
		if (styleEntry?.lastRowFill) {
			const lastRowBg = resolveFill(styleEntry.lastRowFill, '');
			if (lastRowBg) {
				style.backgroundColor = lastRowBg;
			}
		}
		const borderColor = resolveFill(styleEntry?.firstRowFill, 'rgba(68, 114, 196, 0.7)');
		style.borderTop = `2px solid ${borderColor}`;
		applyStyleText(styleEntry?.lastRowText, colorScheme, style);
		applied = true;
	}

	// ── First column emphasis. ──
	if (tableData.firstCol && cellIndex === 0) {
		style.fontWeight = 700;
		if (styleEntry?.firstColFill) {
			const firstColBg = resolveFill(styleEntry.firstColFill, '');
			if (firstColBg) {
				style.backgroundColor = firstColBg;
			}
		}
		applyStyleText(styleEntry?.firstColText, colorScheme, style);
		applied = true;
	}

	// ── Last column emphasis. ──
	if (tableData.lastCol && cellIndex === columnCount - 1) {
		style.fontWeight = 700;
		if (styleEntry?.lastColFill) {
			const lastColBg = resolveFill(styleEntry.lastColFill, '');
			if (lastColBg) {
				style.backgroundColor = lastColBg;
			}
		}
		applyStyleText(styleEntry?.lastColText, colorScheme, style);
		applied = true;
	}

	return applied ? style : undefined;
}
