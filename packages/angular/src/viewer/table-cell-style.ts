/**
 * table-cell-style.ts: pure cell/run style projection for table rendering.
 *
 * Extracted from `table-renderer-helpers.ts` (which now re-exports these for a
 * stable public surface) to keep each module focused and under the repo's
 * per-file line budget.
 *
 * Ported from:
 *   - packages/react/src/viewer/utils/table-render-helpers.ts  (cellStyleToCss,
 *     ooxmlDashToCssBorderStyle)
 *
 * All functions are pure (no Angular dependencies) so they can be unit-tested
 * with plain vitest without TestBed or the Angular compiler.
 */
import type { PptxTableCell, PptxTableCellStyle, PptxTableRow } from 'pptx-viewer-core';

// The OOXML-dash → CSS-border-style map is framework-agnostic and lives in
// `pptx-viewer-shared`; re-exported here so this module's public surface
// (and colocated tests) keep importing `ooxmlDashToCssBorderStyle` unchanged.
import { ooxmlDashToCssBorderStyle } from '../internal/shared';
import type { StyleMap } from './element-style';

export { ooxmlDashToCssBorderStyle };

// ==========================================================================
// Rich-text cell paragraph / run types
// ==========================================================================

/** A single styled text run inside a cell paragraph. */
export interface CellTextRun {
	text: string;
	style: StyleMap;
	isLineBreak?: true;
}

/** A single paragraph inside a table cell, made up of one or more `CellTextRun`s. */
export type CellParagraph = CellTextRun[];

// ==========================================================================
// Cell style → StyleMap
// ==========================================================================

/**
 * Convert a `PptxTableCellStyle` object to an `[ngStyle]`-compatible map.
 *
 * Viewer-first subset: fill (solid + gradient via prebuilt CSS string),
 * text styling, per-edge borders, cell margins, vertical alignment, and
 * vertical text direction. Mirrors `cellStyleToCss` in table-render-helpers.ts.
 */
export function cellStyleToStyleMap(style: PptxTableCellStyle | undefined): StyleMap {
	if (!style) {
		return {};
	}
	const map: StyleMap = {};

	// --- Text formatting ---
	if (style.fontSize) {
		map['font-size'] = `${style.fontSize}px`;
	}
	if (style.bold) {
		map['font-weight'] = 'bold';
	}
	if (style.italic) {
		map['font-style'] = 'italic';
	}
	if (style.underline) {
		map['text-decoration'] = 'underline';
	}
	if (style.color) {
		map['color'] = style.color;
	}

	// --- Background fill: gradient (prebuilt CSS) → solid backgroundColor. ---
	if (style.gradientFillCss) {
		map['background'] = style.gradientFillCss;
	} else if (style.backgroundColor) {
		map['background-color'] = style.backgroundColor;
	}

	// --- Text alignment ---
	if (style.align) {
		map['text-align'] = style.align;
	}
	if (style.vAlign) {
		map['vertical-align'] = style.vAlign;
	}

	// --- Vertical text direction (a:tcPr/@vert) ---
	if (style.textDirection) {
		switch (style.textDirection) {
			case 'vert':
			case 'eaVert':
			case 'wordArtVert':
			case 'wordArtVertRtl':
				map['writing-mode'] = 'vertical-rl';
				break;
			case 'vert270':
			case 'mongolianVert':
				map['writing-mode'] = 'vertical-lr';
				break;
		}
		if (map['writing-mode']) {
			map['text-orientation'] = style.textDirection === 'wordArtVert' ? 'upright' : 'mixed';
		}
		if (style.textDirection === 'wordArtVertRtl') {
			map['direction'] = 'rtl';
		}
	}

	// --- Per-edge borders ---
	type EdgeKey = 'border-top' | 'border-bottom' | 'border-left' | 'border-right';
	const borderEdges: ReadonlyArray<{
		cssProp: EdgeKey;
		width: number | undefined;
		color: string | undefined;
		dash: string | undefined;
	}> = [
		{
			cssProp: 'border-top',
			width: style.borderTopWidth,
			color: style.borderTopColor,
			dash: style.borderTopDash,
		},
		{
			cssProp: 'border-bottom',
			width: style.borderBottomWidth,
			color: style.borderBottomColor,
			dash: style.borderBottomDash,
		},
		{
			cssProp: 'border-left',
			width: style.borderLeftWidth,
			color: style.borderLeftColor,
			dash: style.borderLeftDash,
		},
		{
			cssProp: 'border-right',
			width: style.borderRightWidth,
			color: style.borderRightColor,
			dash: style.borderRightDash,
		},
	];
	for (const edge of borderEdges) {
		if (edge.width !== undefined || edge.color !== undefined) {
			const w = edge.width ?? 1;
			const c = edge.color ?? style.borderColor ?? '#000000';
			const s = ooxmlDashToCssBorderStyle(edge.dash);
			map[edge.cssProp] = `${w}px ${s} ${c}`;
		}
	}

	// --- Cell margins (mapped to padding on the <td>) ---
	if (style.marginLeft !== undefined) {
		map['padding-left'] = `${style.marginLeft}px`;
	}
	if (style.marginRight !== undefined) {
		map['padding-right'] = `${style.marginRight}px`;
	}
	if (style.marginTop !== undefined) {
		map['padding-top'] = `${style.marginTop}px`;
	}
	if (style.marginBottom !== undefined) {
		map['padding-bottom'] = `${style.marginBottom}px`;
	}

	// --- Text shadow / glow ---
	const shadowParts: string[] = [];
	if (style.textShadowColor) {
		const offX = style.textShadowOffsetX ?? 1;
		const offY = style.textShadowOffsetY ?? 1;
		const blur = style.textShadowBlur ?? 0;
		shadowParts.push(`${offX}px ${offY}px ${blur}px ${style.textShadowColor}`);
	}
	if (style.textGlowColor) {
		const radius = style.textGlowRadius ?? 2;
		shadowParts.push(`0px 0px ${radius}px ${style.textGlowColor}`);
	}
	if (shadowParts.length > 0) {
		map['text-shadow'] = shadowParts.join(', ');
	}

	return map;
}

// ==========================================================================
// Row / column style helpers
// ==========================================================================

/** Compute the `[ngStyle]` map for a `<col>` from its width fraction (0-1). */
export function columnWidthStyle(widthFraction: number): StyleMap {
	return { width: `${(widthFraction * 100).toFixed(2)}%` };
}

/** Compute the `[ngStyle]` map for a `<tr>`; empty when the row has no height. */
export function rowStyle(row: PptxTableRow): StyleMap {
	return row.height !== undefined ? { height: `${row.height}px` } : {};
}

/**
 * Build the combined `[ngStyle]` for a `<td>` cell element: default padding
 * (mirroring the React `px-1 py-0.5` classes) merged with the per-cell style.
 */
export function cellTdStyle(cell: PptxTableCell): StyleMap {
	return {
		'padding-left': '4px',
		'padding-right': '4px',
		'padding-top': '2px',
		'padding-bottom': '2px',
		'vertical-align': 'top',
		...cellStyleToStyleMap(cell.style),
	};
}

// ==========================================================================
// Rich-text run style + paragraph builder
// ==========================================================================

/**
 * Convert cell-level style properties (bold, italic, underline, color,
 * fontSize) into an `[ngStyle]`-compatible map for a text run.
 */
export function cellRunStyle(style: PptxTableCellStyle | undefined): StyleMap {
	if (!style) {
		return {};
	}
	const map: StyleMap = {};
	if (style.fontSize) {
		// PptxTableCellStyle.fontSize is already in px (converted from EMU).
		map['font-size'] = `${style.fontSize}px`;
	}
	if (style.bold) {
		map['font-weight'] = 'bold';
	}
	if (style.italic) {
		map['font-style'] = 'italic';
	}
	if (style.color) {
		map['color'] = style.color;
	}
	if (style.underline) {
		map['text-decoration'] = 'underline';
	}
	return map;
}

/**
 * Build a list of `CellParagraph` arrays from a `PptxTableCell`.
 *
 * Splits `cell.text` on `\n` (the parser joins paragraphs with newlines) so each
 * paragraph becomes one styled run. Returns an empty array when the cell is
 * completely empty AND unstyled, signalling the template to fall back to the
 * non-breaking-space placeholder (which keeps the row height).
 */
export function buildCellParagraphs(cell: PptxTableCell): CellParagraph[] {
	const runStyle = cellRunStyle(cell.style);
	const text = cell.text ?? '';
	if (!text && Object.keys(runStyle).length === 0) {
		return [];
	}
	const lines = text.split('\n');
	return lines.map((line): CellParagraph => [{ text: line, style: runStyle }]);
}
