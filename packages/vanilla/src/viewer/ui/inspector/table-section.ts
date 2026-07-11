import type { Translator } from '../../i18n';
import type { NumberFieldHandle } from '../controls';
import { makeNumberField } from '../controls';
import type { CheckboxFieldHandle } from './controls-extra';
import { makeCheckboxField } from './controls-extra';
import type { InspectorHandlers, InspectorState } from './types';

export interface TableSection {
	el: HTMLElement;
	update(state: InspectorState): void;
}

/**
 * The Table section: table-level flags (header row / banded rows) and a
 * uniform default cell padding. This binding has no per-cell selection model,
 * so per-cell background/border editing is out of scope here; see the module
 * docs on `pptx-viewer-shared/table-inspector` for the rationale.
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
	el.append(headerRow.el, bandedRows.el);

	const cellPadding = makeNumberField(doc, {
		label: t('pptx.table.cellPadding'),
		min: 0,
		onCommit: handlers.setTableCellPadding,
	});
	el.appendChild(cellPadding.el);

	const toggles: CheckboxFieldHandle[] = [headerRow, bandedRows];
	const numberFields: NumberFieldHandle[] = [cellPadding];

	return {
		el,
		update(state) {
			el.hidden = !state.hasSelection || !state.isTable;
			headerRow.setValue(state.tableHeaderRow);
			bandedRows.setValue(state.tableBandedRows);
			cellPadding.setValue(state.tableCellPadding);
			for (const c of toggles) {
				c.setDisabled(!state.isTable);
			}
			for (const c of numberFields) {
				c.setDisabled(!state.isTable);
			}
		},
	};
}
