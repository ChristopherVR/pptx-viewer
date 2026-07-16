import type { Translator } from '../../i18n';
import type { InspectorHandlers, InspectorState } from './types';

export interface TableStructureControls {
	el: HTMLElement;
	update(state: InspectorState): void;
}

export function createTableStructureControls(
	doc: Document,
	t: Translator,
	handlers: InspectorHandlers,
): TableStructureControls {
	const el = doc.createElement('div');
	el.className = 'pptxv-inspector-table-structure';
	let state: InspectorState | null = null;
	const button = (label: string, run: (current: InspectorState) => void): HTMLButtonElement => {
		const control = doc.createElement('button');
		control.type = 'button';
		control.textContent = label;
		control.addEventListener('click', () => state && run(state));
		el.appendChild(control);
		return control;
	};
	const active = (current: InspectorState) => current.selectedTableCell;
	const structure =
		(action: Parameters<InspectorHandlers['mutateTableStructure']>[1]) =>
		(current: InspectorState): void => {
			const cell = active(current);
			if (cell) {
				handlers.mutateTableStructure(cell, action);
			}
		};
	const controls = [
		button(t('pptx.table.insertRowAbove'), structure('insertRowAbove')),
		button(t('pptx.table.insertRowBelow'), structure('insertRowBelow')),
		button(t('pptx.table.deleteRow'), structure('deleteRow')),
		button(t('pptx.table.insertColumnLeft'), structure('insertColumnLeft')),
		button(t('pptx.table.insertColumnRight'), structure('insertColumnRight')),
		button(t('pptx.table.deleteColumn'), structure('deleteColumn')),
		button(t('pptx.table.mergeCells'), (current) =>
			handlers.mergeTableCells(current.selectedTableCells),
		),
		button(t('pptx.table.split'), (current) => {
			const cell = active(current);
			if (cell) {
				handlers.splitTableCell(cell);
			}
		}),
	];
	const columnWidth = doc.createElement('input');
	columnWidth.type = 'number';
	columnWidth.min = '5';
	columnWidth.max = '95';
	columnWidth.title = t('pptx.table.columnWidths');
	columnWidth.addEventListener('change', () => {
		const cell = state && active(state);
		if (cell) {
			handlers.setTableColumnWidth(cell.column, Number(columnWidth.value));
		}
	});
	const rowHeight = doc.createElement('input');
	rowHeight.type = 'number';
	rowHeight.min = '1';
	rowHeight.title = t('pptx.table.rowHeights');
	rowHeight.addEventListener('change', () => {
		const cell = state && active(state);
		if (cell) {
			handlers.setTableRowHeight(cell.row, Number(rowHeight.value));
		}
	});
	el.append(columnWidth, rowHeight);

	return {
		el,
		update(next) {
			state = next;
			const cell = active(next);
			el.hidden = !cell;
			columnWidth.value = cell
				? String(Math.round((next.tableColumnWidths[cell.column] ?? 0) * 100))
				: '';
			rowHeight.value = cell ? String(next.tableRowHeights[cell.row] ?? 32) : '';
			for (const control of controls) {
				control.disabled = !cell;
			}
			controls[6].disabled = next.selectedTableCells.length < 2;
			columnWidth.disabled = !cell;
			rowHeight.disabled = !cell;
		},
	};
}
