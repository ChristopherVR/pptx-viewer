/**
 * Table -> group-of-rectangles conversion for the `.ppt` writer.
 *
 * The binary PowerPoint 97-2003 format has no native table graphic frame:
 * PowerPoint 2003 itself represents a table as a plain group of bordered
 * rectangles, one per grid cell, each with its own text. This mirrors that
 * exact model rather than inventing a new one.
 *
 * @module ppt/writer/table-to-shapes
 */

import type { PptxTableData } from '../../types/table';
import type { WGroup, WParagraph, WRect } from './write-model';

const HEADER_FILL = 'D9D9D9';
const CELL_LINE = 'BFBFBF';

function cellParagraphs(text: string): WParagraph[] {
	return [{ indentLevel: 0, align: 'l', runs: [{ text, sizePt: 12 }] }];
}

/**
 * Build a group of rectangle shapes representing `tableData` positioned at
 * `bounds` (the table element's own EMU rectangle).
 */
export function tableToShapeGroup(tableData: PptxTableData, bounds: WRect): WGroup {
	const totalWidthUnits = tableData.columnWidths.reduce((sum, w) => sum + w, 0) || 1;
	const colEmuWidths = tableData.columnWidths.map((w) => (w / totalWidthUnits) * bounds.w);
	const colStartX: number[] = [];
	{
		let x = bounds.x;
		for (const w of colEmuWidths) {
			colStartX.push(x);
			x += w;
		}
	}

	const rowHeightEmu = bounds.h / Math.max(1, tableData.rows.length);
	const children: WGroup['children'] = [];
	const vMergeActive = new Array<boolean>(colEmuWidths.length).fill(false);

	tableData.rows.forEach((row, rowIndex) => {
		const y = bounds.y + rowIndex * rowHeightEmu;
		let colIndex = 0;
		for (const cell of row.cells) {
			const span = Math.max(1, cell.gridSpan ?? 1);
			if (cell.vMerge) {
				vMergeActive[colIndex] = true;
				colIndex += span;
				continue;
			}
			vMergeActive[colIndex] = false;
			if (!cell.hMerge) {
				const x = colStartX[colIndex] ?? bounds.x;
				const w = colEmuWidths.slice(colIndex, colIndex + span).reduce((s, v) => s + v, 0);
				children.push({
					kind: 'shape',
					spt: 1,
					isConnector: false,
					anchor: { x, y, w, h: rowHeightEmu },
					fill: {
						kind: 'solid',
						rgb: rowIndex === 0 && tableData.firstRowHeader ? HEADER_FILL : 'FFFFFF',
					},
					line: { kind: 'line', rgb: CELL_LINE, widthEmu: 9525 },
					text: { textType: 4, paragraphs: cellParagraphs(cell.text) },
				});
			}
			colIndex += span;
		}
	});

	return { kind: 'group', anchor: bounds, children };
}
