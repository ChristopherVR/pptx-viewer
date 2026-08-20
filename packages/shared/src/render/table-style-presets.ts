/**
 * table-style-presets.ts - framework-agnostic table style preset catalogue.
 *
 * Pure data: the quick-style swatches (light / medium / dark families) shown in
 * every binding's table properties panel. Each preset carries the header fill /
 * foreground, banded-row background, and border colour applied when the user
 * picks it. Ported from the React viewer's `constants/table-styles.ts` so React,
 * Vue, and Angular consume one copy.
 *
 * `applyTableStylePreset` below is the assignment logic that decides which
 * cells get the header/band/border treatment from a chosen preset; it was
 * previously hand-ported into React, Vue, and Angular independently (Angular's
 * copy, in `table-properties-helpers.ts`, was the reference implementation).
 */
/* oxlint-disable eslint/one-var -- independent, unrelated locals inside
   applyTableStylePreset's map callback; merging them would hurt readability. */
import type { PptxTableCellStyle, PptxTableData, PptxTableRow } from 'pptx-viewer-core';

/** A single table quick-style swatch. */
export interface TableStylePreset {
	id: string;
	label: string;
	headerBg: string;
	headerFg: string;
	bandBg: string;
	borderColor: string;
}

export const TABLE_STYLE_PRESETS: TableStylePreset[] = [
	// Light styles
	{
		id: 'light-1',
		label: 'Light 1',
		headerBg: '#4472C4',
		headerFg: '#FFFFFF',
		bandBg: 'rgba(217, 226, 243, 0.5)',
		borderColor: '#B4C6E7',
	},
	{
		id: 'light-2',
		label: 'Light 2',
		headerBg: '#ED7D31',
		headerFg: '#FFFFFF',
		bandBg: 'rgba(252, 228, 214, 0.5)',
		borderColor: '#F4B084',
	},
	{
		id: 'light-3',
		label: 'Light 3',
		headerBg: '#70AD47',
		headerFg: '#FFFFFF',
		bandBg: 'rgba(226, 239, 218, 0.5)',
		borderColor: '#A9D18E',
	},
	// Medium styles
	{
		id: 'medium-1',
		label: 'Medium 1',
		headerBg: '#2F5597',
		headerFg: '#FFFFFF',
		bandBg: 'rgba(180, 198, 231, 0.4)',
		borderColor: '#8FAADC',
	},
	{
		id: 'medium-2',
		label: 'Medium 2',
		headerBg: '#C55A11',
		headerFg: '#FFFFFF',
		bandBg: 'rgba(244, 176, 132, 0.4)',
		borderColor: '#F4B084',
	},
	{
		id: 'medium-3',
		label: 'Medium 3',
		headerBg: '#548235',
		headerFg: '#FFFFFF',
		bandBg: 'rgba(169, 209, 142, 0.4)',
		borderColor: '#A9D18E',
	},
	// Dark styles
	{
		id: 'dark-1',
		label: 'Dark 1',
		headerBg: '#1F3864',
		headerFg: '#FFFFFF',
		bandBg: 'rgba(31, 56, 100, 0.15)',
		borderColor: '#2F5597',
	},
	{
		id: 'dark-2',
		label: 'Dark 2',
		headerBg: '#843C0C',
		headerFg: '#FFFFFF',
		bandBg: 'rgba(132, 60, 12, 0.15)',
		borderColor: '#C55A11',
	},
	{
		id: 'dark-3',
		label: 'Dark 3',
		headerBg: '#375623',
		headerFg: '#FFFFFF',
		bandBg: 'rgba(55, 86, 35, 0.15)',
		borderColor: '#548235',
	},
];

/**
 * Apply a table quick-style preset to every cell's style. Header cells (the
 * first row, when `firstRowHeader` is set) get the header fill / foreground
 * + bold; banded body rows get the band background; every cell gets the
 * preset border colour. Returns a new rows array; does not mutate `td`.
 */
export function applyTableStylePreset(td: PptxTableData, preset: TableStylePreset): PptxTableRow[] {
	return td.rows.map((row, ri) => ({
		...row,
		cells: row.cells.map((cell) => {
			const isHeader = ri === 0 && Boolean(td.firstRowHeader);
			const isBand = Boolean(td.bandedRows) && (ri - (td.firstRowHeader ? 1 : 0)) % 2 === 0;
			const style: PptxTableCellStyle = {
				...cell.style,
				backgroundColor: isHeader ? preset.headerBg : isBand ? preset.bandBg : undefined,
				color: isHeader ? preset.headerFg : cell.style?.color,
				bold: isHeader ? true : cell.style?.bold,
				borderColor: preset.borderColor,
			};
			return { ...cell, style };
		}),
	}));
}
