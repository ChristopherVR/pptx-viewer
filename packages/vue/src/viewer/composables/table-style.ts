/**
 * table-style.ts — framework-agnostic helpers for the Vue `TableRenderer`.
 *
 * A focused port of the React table render helpers that operate on the
 * structured {@link PptxTableData} model (not raw OOXML). The renderer is
 * viewer-first: it consumes the already-parsed cell styles, banding flags,
 * and column widths that `pptx-viewer-core` produces, and maps them to CSS.
 *
 * Ports of:
 *   - `viewer/utils/table-render-helpers.ts`  → {@link cellStyleToCss}
 *   - `viewer/utils/table-band-style.tsx`     → {@link getTableCellBandStyle}
 *
 * Pattern fills are approximated by their background colour rather than the
 * full SVG pattern (`getPatternSvg` lives in the React viewer layer and is
 * not exported from core). See PORTING.md.
 */
import type { PptxTableCellStyle, PptxTableData } from 'pptx-viewer-core';
import type { CSSProperties } from 'vue';

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
export function cellStyleToCss(style?: PptxTableCellStyle): CSSProperties {
	if (!style) {
		return {};
	}
	const css: CSSProperties = {};

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

	// Cell background fill — gradient takes precedence, then pattern (approximated
	// by its background colour), then a solid colour.
	if (style.gradientFillCss) {
		css.background = style.gradientFillCss;
	} else if (style.fillMode === 'pattern') {
		css.backgroundColor = style.patternFillBackground ?? style.backgroundColor;
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
			(css as Record<string, string>)[edge.prefix] = `${w}px ${s} ${c}`;
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
 * style map + theme colour scheme (not threaded into the Vue viewer yet) it
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
): CSSProperties | undefined {
	if (!tableData) {
		return undefined;
	}

	const style: CSSProperties = {};
	let applied = false;

	// ── Banded rows (skip the header row when present). ──
	const bandStartRow = tableData.firstRowHeader ? 1 : 0;
	const bandEndRow = tableData.lastRow ? rowCount - 1 : rowCount;
	if (tableData.bandedRows && rowIndex >= bandStartRow && rowIndex < bandEndRow) {
		const bandIndex = rowIndex - bandStartRow;
		const rowCycle = Math.max(tableData.bandRowCycle ?? 1, 1);
		const bandGroup = Math.floor(bandIndex / rowCycle) % 2;
		if (bandGroup === 0) {
			style.backgroundColor = 'rgba(217, 226, 243, 0.5)';
			applied = true;
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
			if (colBandGroup === 0 && (!style.backgroundColor || !tableData.bandedRows)) {
				style.backgroundColor = 'rgba(217, 226, 243, 0.35)';
				applied = true;
			}
		}
	}

	// ── Header row (first row). ──
	if (tableData.firstRowHeader && rowIndex === 0) {
		style.fontWeight = 700;
		style.backgroundColor = 'rgba(68, 114, 196, 0.85)';
		style.color = '#ffffff';
		applied = true;
	}

	// ── Total / last row emphasis. ──
	if (tableData.lastRow && rowIndex === rowCount - 1) {
		style.fontWeight = 700;
		style.borderTop = '2px solid rgba(68, 114, 196, 0.7)';
		applied = true;
	}

	// ── First column emphasis. ──
	if (tableData.firstCol && cellIndex === 0) {
		style.fontWeight = 700;
		applied = true;
	}

	// ── Last column emphasis. ──
	if (tableData.lastCol && cellIndex === columnCount - 1) {
		style.fontWeight = 700;
		applied = true;
	}

	return applied ? style : undefined;
}
