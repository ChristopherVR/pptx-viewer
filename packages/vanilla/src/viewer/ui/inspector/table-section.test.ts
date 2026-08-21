import type { TablePptxElement } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../i18n';
import { createTableSection } from './table-section';
import type { InspectorHandlers, InspectorState } from './types';

function sectionFactory() {
	return (): HTMLElement => document.createElement('div');
}

function tableElement(): TablePptxElement {
	return {
		type: 'table',
		id: 't1',
		x: 0,
		y: 0,
		width: 200,
		height: 100,
		tableData: {
			rows: [{ cells: [{ text: 'A' }, { text: 'B' }] }, { cells: [{ text: 'C' }, { text: 'D' }] }],
			columnWidths: [0.5, 0.5],
		},
	} as TablePptxElement;
}

function state(overrides: Partial<InspectorState> = {}): InspectorState {
	return {
		hasSelection: true,
		isTable: true,
		tableHeaderRow: false,
		tableBandedRows: false,
		tableBandedColumns: false,
		tableLastRow: false,
		tableFirstCol: false,
		tableLastCol: false,
		tableRtl: false,
		tableStyleId: '',
		tableCellBackground: '#ffffff',
		tableCellBorder: '#000000',
		tableCellPadding: 4,
		tableElement: tableElement(),
		selectedTableCell: null,
		selectedTableCells: [],
		tableCellStyle: undefined,
		tableColumnWidths: [0.5, 0.5],
		tableRowHeights: [],
		...overrides,
	} as InspectorState;
}

describe('table style presets gallery', () => {
	it('renders one swatch per shared preset', async () => {
		const { TABLE_STYLE_PRESETS } = await import('pptx-viewer-shared');
		const section = createTableSection(document, createTranslator(), sectionFactory(), {
			setTableOptions: vi.fn(),
		} as unknown as InspectorHandlers);
		section.update(state());
		const swatches = section.el.querySelectorAll('.pptxv-table-preset-swatch');
		expect(swatches).toHaveLength(TABLE_STYLE_PRESETS.length);
	});

	it('applies the clicked preset to the current table data via setTableOptions', () => {
		const setTableOptions = vi.fn();
		const section = createTableSection(document, createTranslator(), sectionFactory(), {
			setTableOptions,
		} as unknown as InspectorHandlers);
		section.update(state());

		const swatch = section.el.querySelector<HTMLButtonElement>('.pptxv-table-preset-swatch');
		if (!swatch) {
			throw new Error('preset swatch not found');
		}
		swatch.click();

		expect(setTableOptions).toHaveBeenCalledOnce();
		const [patch] = setTableOptions.mock.calls[0] as [{ rows?: unknown }];
		expect(Array.isArray(patch.rows)).toBeTruthy();
	});

	it('does not apply a preset when there is no table selected', () => {
		const setTableOptions = vi.fn();
		const section = createTableSection(document, createTranslator(), sectionFactory(), {
			setTableOptions,
		} as unknown as InspectorHandlers);
		section.update(state({ isTable: false, tableElement: undefined }));

		const swatch = section.el.querySelector<HTMLButtonElement>('.pptxv-table-preset-swatch');
		swatch?.click();

		expect(setTableOptions).not.toHaveBeenCalled();
	});
});
