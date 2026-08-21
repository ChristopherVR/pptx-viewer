import type { PptxTableData } from 'pptx-viewer-core';
import { applyTableStylePreset, TABLE_STYLE_PRESETS } from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import { createEl } from '../../render';
import type { NumberFieldHandle } from '../controls';
import { makeNumberField } from '../controls';
import type { CheckboxFieldHandle } from './controls-extra';
import { makeCheckboxField } from './controls-extra';
import { createTableCellFillControls } from './table-cell-fill-controls';
import { createTableCellFormatting } from './table-cell-formatting';
import { createTableStructureControls } from './table-structure-controls';
import type { InspectorHandlers, InspectorState } from './types';

export interface TableSection {
	el: HTMLElement;
	update(state: InspectorState): void;
}

/**
 * The Table section: table-level flags (header row / banded rows) and a
 * uniform cell styling, and formatting for the active table cell.
 */
export function createTableSection(
	doc: Document,
	t: Translator,
	section: (label: string) => HTMLElement,
	handlers: InspectorHandlers,
): TableSection {
	const el = section(t('pptx.inspector.table'));

	const headerRow = makeCheckboxField(doc, {
		label: t('pptx.table.headerRow'),
		onChange: handlers.setTableHeaderRow,
	});
	const bandedRows = makeCheckboxField(doc, {
		label: t('pptx.table.bandedRows'),
		onChange: handlers.setTableBandedRows,
	});
	const bandedColumns = makeCheckboxField(doc, {
		label: t('pptx.table.bandedColumns'),
		onChange: (enabled) => handlers.setTableOptions({ bandedColumns: enabled }),
	});
	const lastRow = makeCheckboxField(doc, {
		label: t('pptx.table.totalRow'),
		onChange: (enabled) => handlers.setTableOptions({ lastRow: enabled }),
	});
	const firstCol = makeCheckboxField(doc, {
		label: t('pptx.table.firstColumn'),
		onChange: (enabled) => handlers.setTableOptions({ firstCol: enabled }),
	});
	const lastCol = makeCheckboxField(doc, {
		label: t('pptx.table.lastColumn'),
		onChange: (enabled) => handlers.setTableOptions({ lastCol: enabled }),
	});
	const rtl = makeCheckboxField(doc, {
		label: t('pptx.textAdvanced.rtl'),
		onChange: (enabled) => handlers.setTableOptions({ rtl: enabled }),
	});
	el.append(
		headerRow.el,
		bandedRows.el,
		bandedColumns.el,
		lastRow.el,
		firstCol.el,
		lastCol.el,
		rtl.el,
	);

	// Shared decides which cell fills/borders each preset writes, so the
	// gallery here can never drift from React/Vue/Angular's version.
	let latestTableData: PptxTableData | undefined;
	const presetsLabel = createEl(doc, 'span', 'pptxv-table-presets-label');
	presetsLabel.textContent = t('pptx.table.stylePresets');
	const applyPreset = (preset: (typeof TABLE_STYLE_PRESETS)[number]): void => {
		if (latestTableData) {
			handlers.setTableOptions({ rows: applyTableStylePreset(latestTableData, preset) });
		}
	};
	const presetsGrid = createEl(doc, 'div', 'pptxv-table-presets-grid');
	presetsGrid.append(
		...TABLE_STYLE_PRESETS.map((preset) => {
			const swatch = createEl(doc, 'button', 'pptxv-table-preset-swatch');
			swatch.type = 'button';
			swatch.title = preset.label;
			swatch.setAttribute('aria-label', preset.label);
			const header = createEl(doc, 'span');
			header.style.background = preset.headerBg;
			const band = createEl(doc, 'span');
			band.style.background = preset.bandBg;
			const border = createEl(doc, 'span');
			border.style.borderTopColor = preset.borderColor;
			swatch.append(header, band, border);
			swatch.addEventListener('click', () => applyPreset(preset));
			return swatch;
		}),
	);
	el.append(presetsLabel, presetsGrid);

	const cellPadding = makeNumberField(doc, {
		label: t('pptx.table.cellPadding'),
		min: 0,
		onCommit: handlers.setTableCellPadding,
	});
	el.appendChild(cellPadding.el);
	const styleId = doc.createElement('input');
	styleId.placeholder = t('pptx.table.styleId');
	styleId.addEventListener('change', () =>
		handlers.setTableOptions({ tableStyleId: styleId.value }),
	);
	const background = doc.createElement('input');
	background.type = 'color';
	background.addEventListener('input', () =>
		handlers.setTableOptions({}, { backgroundColor: background.value }),
	);
	const border = doc.createElement('input');
	border.type = 'color';
	border.addEventListener('input', () =>
		handlers.setTableOptions({}, { borderColor: border.value }),
	);
	el.append(styleId, background, border);
	const cellFormatting = createTableCellFormatting(doc, t, handlers);
	const cellFill = createTableCellFillControls(doc, t, handlers);
	const structure = createTableStructureControls(doc, t, handlers);
	el.append(cellFormatting.el, cellFill.el, structure.el);

	const toggles: CheckboxFieldHandle[] = [
		headerRow,
		bandedRows,
		bandedColumns,
		lastRow,
		firstCol,
		lastCol,
		rtl,
	];
	const numberFields: NumberFieldHandle[] = [cellPadding];

	return {
		el,
		update(state) {
			el.hidden = !state.hasSelection || !state.isTable;
			latestTableData = state.tableElement?.tableData;
			for (const swatch of presetsGrid.children) {
				(swatch as HTMLButtonElement).disabled = !state.isTable;
			}
			headerRow.setValue(state.tableHeaderRow);
			bandedRows.setValue(state.tableBandedRows);
			bandedColumns.setValue(state.tableBandedColumns);
			lastRow.setValue(state.tableLastRow);
			firstCol.setValue(state.tableFirstCol);
			lastCol.setValue(state.tableLastCol);
			rtl.setValue(state.tableRtl);
			cellPadding.setValue(state.tableCellPadding);
			styleId.value = state.tableStyleId;
			background.value = state.tableCellBackground;
			border.value = state.tableCellBorder;
			cellFormatting.update(state);
			cellFill.update(state);
			structure.update(state);
			for (const c of toggles) {
				c.setDisabled(!state.isTable);
			}
			styleId.disabled = !state.isTable;
			background.disabled = !state.isTable;
			border.disabled = !state.isTable;
			for (const c of numberFields) {
				c.setDisabled(!state.isTable);
			}
		},
	};
}
