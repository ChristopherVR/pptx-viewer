import type {
	ParsedTableStyleMap,
	PptxTableCellStyle,
	PptxTableData,
	PptxTheme,
} from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import { getCellDiagonalBorders } from './table-diagonal-borders';

const POS = { rowIndex: 0, cellIndex: 0, rowCount: 2, columnCount: 2 };

function makeTableData(overrides: Partial<PptxTableData> = {}): PptxTableData {
	return { rows: [], columnWidths: [0.5, 0.5], ...overrides };
}

describe('getCellDiagonalBorders', () => {
	it('returns null when neither the cell nor the style defines a diagonal', () => {
		expect(getCellDiagonalBorders(undefined, makeTableData(), POS)).toBeNull();
		expect(getCellDiagonalBorders({ bold: true }, makeTableData(), POS)).toBeNull();
	});

	it('reads a per-cell explicit down diagonal (tl2br)', () => {
		const style: PptxTableCellStyle = {
			borderDiagDownColor: '#ff0000',
			borderDiagDownWidth: 2,
		};
		const info = getCellDiagonalBorders(style, makeTableData(), POS);
		expect(info).not.toBeNull();
		expect(info!.diagDownColor).toBe('#ff0000');
		expect(info!.diagDownWidth).toBe(2);
	});

	it('resolves a style-inherited diagonal from wholeTblBorders', () => {
		const tableStyleMap = {
			'{DIAG}': {
				wholeTblBorders: { tl2br: { width: 3, color: '#0000ff' } },
			},
		} as unknown as ParsedTableStyleMap;
		const info = getCellDiagonalBorders(undefined, makeTableData({ tableStyleId: '{DIAG}' }), POS, {
			tableStyleMap,
			theme: { colorScheme: {} } as unknown as PptxTheme,
		});
		expect(info).not.toBeNull();
		expect(info!.diagDownColor).toBe('#0000ff');
		expect(info!.diagDownWidth).toBe(3);
	});

	it('lets the per-cell diagonal win over the style-inherited one', () => {
		const tableStyleMap = {
			'{DIAG}': {
				wholeTblBorders: { tl2br: { width: 3, color: '#0000ff' } },
			},
		} as unknown as ParsedTableStyleMap;
		const style: PptxTableCellStyle = {
			borderDiagDownColor: '#ff0000',
			borderDiagDownWidth: 5,
		};
		const info = getCellDiagonalBorders(style, makeTableData({ tableStyleId: '{DIAG}' }), POS, {
			tableStyleMap,
			theme: { colorScheme: {} } as unknown as PptxTheme,
		});
		expect(info).not.toBeNull();
		expect(info!.diagDownColor).toBe('#ff0000');
		expect(info!.diagDownWidth).toBe(5);
	});

	it('resolves an up diagonal (bl2tr) from the table style', () => {
		const tableStyleMap = {
			'{DIAG}': {
				wholeTblBorders: { bl2tr: { width: 2, color: '#00ff00' } },
			},
		} as unknown as ParsedTableStyleMap;
		const info = getCellDiagonalBorders(undefined, makeTableData({ tableStyleId: '{DIAG}' }), POS, {
			tableStyleMap,
			theme: { colorScheme: {} } as unknown as PptxTheme,
		});
		expect(info).not.toBeNull();
		expect(info!.diagUpColor).toBe('#00ff00');
		expect(info!.diagUpWidth).toBe(2);
	});
});
