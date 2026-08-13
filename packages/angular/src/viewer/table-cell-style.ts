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
import { cellStyleToCss, ooxmlDashToCssBorderStyle } from '../internal/shared';
import type { StyleMap } from './element-style';

export { ooxmlDashToCssBorderStyle };

// ==========================================================================
// camelCase CSS → kebab-case StyleMap
// ==========================================================================

/**
 * Convert a shared `TableCellCss` object (camelCase keys, e.g. from
 * `cellStyleToCss` or `getTableCellBandStyle`) into an `[ngStyle]`-compatible
 * kebab-case {@link StyleMap}. Values are stringified so numbers (e.g.
 * `fontWeight: 700`) apply correctly.
 */
export function cssObjectToStyleMap(css: Record<string, string | number>): StyleMap {
	const map: StyleMap = {};
	for (const [key, value] of Object.entries(css)) {
		const kebab = key.replace(/[A-Z]/gu, (m) => `-${m.toLowerCase()}`);
		map[kebab] = String(value);
	}
	return map;
}

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
 * Convert a `PptxTableCellStyle` to an `[ngStyle]`-compatible map.
 *
 * A thin adapter over the shared `cellStyleToCss`, which React, Vue, Svelte
 * and Vanilla all render tables from; only the key spelling (kebab-case, for
 * this binding's `StyleMap`) differs, so nothing but the conversion lives
 * here.
 *
 * This used to be a hand-ported copy of that function, and the copy had
 * silently lost four of its features: preset PATTERN fills (a hatched cell
 * painted a flat colour instead of the tile), `a:tcPr/@anchorCtr`
 * block-centring, `a:tcPr/@horzOverflow="clip"`, and the `a:cell3D` bevel.
 * All four render in the other four bindings and now render here too.
 *
 * One deliberate behaviour change comes with the swap: shared treats a ZERO
 * cell margin as "nothing authored" (`if (style.marginLeft)`) where the copy
 * tested `!== undefined`, so a cell authored `marL="0"` now keeps the
 * renderer's default 4px padding instead of collapsing to 0. That is what the
 * other four bindings already did.
 */
export function cellStyleToStyleMap(style: PptxTableCellStyle | undefined): StyleMap {
	if (!style) {
		return {};
	}
	return cssObjectToStyleMap(cellStyleToCss(style));
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
