import type { PptxTableCell, PptxTableData } from 'pptx-viewer-core';
import type {
	CellTextRun,
	CssStyleMap,
	DiagonalBorderInfo,
	TableCellCss,
	TableStyleContext,
} from 'pptx-viewer-shared';
import {
	cellPatternFillCss,
	cellRunStyle,
	DEFAULT_FONT_FAMILY,
	getCellDiagonalBorders,
	getContainerStyle,
	tableCellCss,
	tableContainerCss,
} from 'pptx-viewer-shared';

import { applyStyleMap, createEl, createSvgEl } from '../dom';
import type { ElementRenderer } from '../types';

/**
 * Renderer for `table` elements: a real HTML `<table>` built from the
 * structured `PptxTableData` model, mirroring Vue's `TableRenderer.vue`
 * (read-only path; the editing affordances stay in the editor bindings).
 *
 * Covered: `<colgroup>` proportional column widths, per-row heights,
 * rowspan/colspan (cells absorbed by an `hMerge`/`vMerge` are skipped),
 * banded-row / header-row / first-last emphasis plus per-cell fills / borders /
 * alignment / text effects, all through the shared `tableCellCss`
 * cascade, tiled-SVG pattern fills via
 * `cellPatternFillCss`, diagonal cell borders as an SVG overlay, and rich
 * per-run cell text (`CellTextRun[]`) via `cellRunStyle`.
 *
 * Theme colour scheme and parsed table style map values are consumed from the
 * element render context, with shared hardcoded fallbacks when absent.
 */
export const renderTableElement: ElementRenderer = (element, zIndex, context) => {
	if (element.type !== 'table') {
		return null;
	}
	const tableData = element.tableData;
	if (!tableData || tableData.rows.length === 0) {
		return null;
	}
	const doc = context.document;

	const container = createEl(doc, 'div', 'pptxv-element pptxv-table', {
		...getContainerStyle(element, zIndex),
		overflow: 'hidden',
	});
	container.dataset.elementId = element.id;

	const table = createEl(doc, 'table', 'pptxv-table-grid', {
		width: '100%',
		height: '100%',
		borderCollapse: 'collapse',
		tableLayout: 'fixed',
		// Load-bearing: an unstyled cell otherwise inherits the HOST chrome's
		// font stack; all five bindings declare the same shared default here.
		fontFamily: DEFAULT_FONT_FAMILY,
		// `a:tblPr@rtl`: mirrors the column order for right-to-left decks.
		...tableContainerCss(tableData),
	});

	appendColgroup(doc, table, tableData.columnWidths);

	const tbody = doc.createElement('tbody');
	const rowCount = tableData.rows.length;
	const columnCount = tableData.columnWidths.length;

	tableData.rows.forEach((row, rowIndex) => {
		const tr = doc.createElement('tr');
		if (row.height && row.height > 0) {
			tr.style.height = `${row.height}px`;
		}
		row.cells.forEach((cell, cellIndex) => {
			// Cells absorbed by a horizontal or vertical merge are not rendered;
			// the originating cell carries the span.
			if (cell.hMerge || cell.vMerge) {
				return;
			}
			tr.appendChild(
				renderCell(doc, tableData, cell, rowIndex, cellIndex, rowCount, columnCount, {
					colorScheme: context.colorScheme,
					tableStyleMap: context.tableStyleMap,
					fontScheme: context.fontScheme,
				}),
			);
		});
		tbody.appendChild(tr);
	});

	table.appendChild(tbody);
	container.appendChild(table);
	return container;
};

/** Base `<td>` style (Vue keeps this in scoped CSS; inlined here). */
const CELL_BASE_STYLE: CssStyleMap = {
	position: 'relative',
	padding: '1px 4px',
	verticalAlign: 'top',
	border: '1px solid rgba(255, 255, 255, 0.3)',
	whiteSpace: 'pre-wrap',
	wordBreak: 'break-word',
	overflowWrap: 'break-word',
};

/** Proportional column widths as a `<colgroup>` of percentage `<col>`s. */
function appendColgroup(doc: Document, table: HTMLTableElement, widths: number[]): void {
	if (widths.length === 0) {
		return;
	}
	const colgroup = doc.createElement('colgroup');
	for (const width of widths) {
		const col = doc.createElement('col');
		col.style.width = `${(width * 100).toFixed(2)}%`;
		colgroup.appendChild(col);
	}
	table.appendChild(colgroup);
}

/** Build one `<td>`: spans, band + explicit style, pattern fill, diagonals, text. */
function renderCell(
	doc: Document,
	tableData: PptxTableData,
	cell: PptxTableCell,
	rowIndex: number,
	cellIndex: number,
	rowCount: number,
	columnCount: number,
	styleContext: TableStyleContext | undefined,
): HTMLTableCellElement {
	const td = doc.createElement('td');
	td.className = 'pptxv-table-cell';
	td.dataset.rowIndex = String(rowIndex);
	td.dataset.cellIndex = String(cellIndex);
	if (cell.gridSpan && cell.gridSpan > 1) {
		td.colSpan = cell.gridSpan;
	}
	if (cell.rowSpan && cell.rowSpan > 1) {
		td.rowSpan = cell.rowSpan;
	}

	// Band beneath the explicit cell style, then the dark-text floor for a cell
	// nothing gave a colour (it would otherwise inherit the host page's near-white
	// chrome `foreground` and vanish on a light table). All three layers are
	// decided once, in shared, so the five bindings cannot drift apart again.
	const style: TableCellCss = tableCellCss(
		tableData,
		cell,
		{ rowIndex, cellIndex, rowCount, columnCount },
		styleContext,
	);

	// Pattern fill replaces the flat backgroundColor with a tiled SVG image
	// plus the solid background colour behind it.
	const patternFill = cell.style ? cellPatternFillCss(cell.style) : null;
	if (patternFill) {
		delete style['backgroundColor'];
		delete style['background'];
		if (patternFill.backgroundImage) {
			style['backgroundImage'] = patternFill.backgroundImage;
		}
		if (patternFill.backgroundColor) {
			style['backgroundColor'] = patternFill.backgroundColor;
		}
	}

	applyStyleMap(td, CELL_BASE_STYLE);
	applyStyleMap(td, style);

	// Diagonals combine the per-cell explicit borders with any inherited from
	// the applicable table-style sections (per-cell wins on each axis).
	const diagonals = getCellDiagonalBorders(
		cell.style,
		tableData,
		{ rowIndex, cellIndex, rowCount, columnCount },
		styleContext,
	);
	if (diagonals) {
		td.appendChild(renderDiagonalOverlay(doc, diagonals));
	}

	appendCellText(doc, td, cell);
	return td;
}

/** Diagonal cell borders as an absolutely positioned SVG overlay. */
function renderDiagonalOverlay(doc: Document, diagonals: DiagonalBorderInfo): SVGSVGElement {
	const svg = createSvgEl(doc, 'svg', {
		class: 'pptxv-table-diag',
		'aria-hidden': 'true',
		preserveAspectRatio: 'none',
	});
	applyStyleMap(svg, {
		position: 'absolute',
		inset: 0,
		width: '100%',
		height: '100%',
		pointerEvents: 'none',
		overflow: 'visible',
	});
	if (diagonals.diagDownColor && diagonals.diagDownWidth) {
		svg.appendChild(
			createSvgEl(doc, 'line', {
				x1: 0,
				y1: 0,
				x2: '100%',
				y2: '100%',
				stroke: diagonals.diagDownColor,
				'stroke-width': diagonals.diagDownWidth,
			}),
		);
	}
	if (diagonals.diagUpColor && diagonals.diagUpWidth) {
		svg.appendChild(
			createSvgEl(doc, 'line', {
				x1: 0,
				y1: '100%',
				x2: '100%',
				y2: 0,
				stroke: diagonals.diagUpColor,
				'stroke-width': diagonals.diagUpWidth,
			}),
		);
	}
	return svg;
}

/**
 * Cell text: rich per-run spans when the cell carries `CellTextRun[]`
 * (duck-typed extension, matching the other bindings), with paragraph breaks
 * as block `<div>`s and line breaks as `<br>`; otherwise the plain string.
 */
function appendCellText(doc: Document, td: HTMLTableCellElement, cell: PptxTableCell): void {
	const richCell = cell as PptxTableCell & { textRuns?: CellTextRun[] };
	const textRuns = richCell.textRuns && richCell.textRuns.length > 0 ? richCell.textRuns : null;
	if (!textRuns) {
		const span = createEl(doc, 'span', 'pptxv-table-text', { position: 'relative' });
		span.textContent = cell.text || ' ';
		td.appendChild(span);
		return;
	}
	for (const run of textRuns) {
		if (run.isParagraphBreak) {
			td.appendChild(
				createEl(doc, 'div', 'pptxv-table-para-break', { display: 'block', height: 0 }),
			);
			continue;
		}
		if (run.isLineBreak) {
			td.appendChild(doc.createElement('br'));
			continue;
		}
		const span = createEl(doc, 'span', 'pptxv-table-run', {
			position: 'relative',
			...cellRunStyle(run),
		});
		span.textContent = run.text;
		td.appendChild(span);
	}
}
