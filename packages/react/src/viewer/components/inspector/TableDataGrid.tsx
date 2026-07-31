/**
 * TableDataGrid.tsx: Inspector-resident spreadsheet editor for table cell TEXT.
 *
 * WHY this exists: every binding already ships a `ChartDataGrid` so chart values
 * can be edited from the sidebar without entering an on-canvas edit mode. Tables
 * had no equivalent, so the only way to retype a cell was to double-click it on
 * the slide. This is the table analogue: a compact grid of one text input per
 * cell, plus row/column add and remove controls.
 *
 * All mutations go through the pure element-level helpers in
 * `pptx-viewer-shared` (`render/table-data-grid`), which are merge-aware, and
 * are committed via `onUpdateElement` so they land on the viewer's real edit
 * path as a single history entry (and therefore survive save/reload).
 *
 * @module react/inspector/TableDataGrid
 */
import type { PptxElement, TablePptxElement } from 'pptx-viewer-core';
import {
	appendTableElementColumn,
	appendTableElementRow,
	buildTableDataGrid,
	removeLastTableElementColumn,
	removeLastTableElementRow,
	removeTableElementColumn,
	removeTableElementRow,
	setTableElementCellText,
} from 'pptx-viewer-shared';
import type React from 'react';
import { useTranslation } from 'react-i18next';

import { BTN, CARD, HEADING } from './inspector-pane-constants';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TableDataGridProps {
	/** The table element being edited. */
	tableElement: TablePptxElement;
	/** Whether editing is enabled (inputs are read-only when false). */
	canEdit: boolean;
	/** Commits a partial element update on the viewer's real edit path. */
	onUpdateElement: (updates: Partial<PptxElement>) => void;
}

// ---------------------------------------------------------------------------
// Local class-name tokens
// ---------------------------------------------------------------------------

const HEADER_CELL =
	'flex items-center justify-center gap-0.5 bg-muted text-muted-foreground border border-border -m-px px-1 py-0.5 whitespace-nowrap';
const CELL_INPUT =
	'w-full box-border bg-muted px-1 py-0.5 text-[11px] border-0 outline-none focus:bg-accent disabled:opacity-60';
const REMOVE_BTN = 'px-0.5 leading-none text-destructive hover:opacity-80';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Render the table data grid, or nothing when the element carries no table data.
 */
export function TableDataGrid({
	tableElement,
	canEdit,
	onUpdateElement,
}: TableDataGridProps): React.ReactElement | null {
	const { t } = useTranslation();
	const grid = buildTableDataGrid(tableElement);

	if (grid.rowCount === 0 || grid.colCount === 0) {
		return null;
	}

	/**
	 * Commit a whole replacement element as a partial update.
	 *
	 * `rawXml` is forwarded alongside `tableData` and is NOT optional: a table
	 * parsed from a real deck renders (and saves) from its graphic-frame markup,
	 * with `tableData` used only for tables created via Insert > Table. Sending
	 * `tableData` alone leaves the canvas painting the old text and the edit is
	 * dropped on save, which is exactly the failure this panel is meant to avoid.
	 */
	const commit = (next: TablePptxElement): void => {
		if (next === tableElement) {
			return;
		}
		onUpdateElement({ tableData: next.tableData, rawXml: next.rawXml } as Partial<PptxElement>);
	};

	return (
		<div className={CARD}>
			<section aria-label={t('pptx.tableDataEditor.ariaLabel')}>
				<div className='flex items-center justify-between gap-1 mb-1.5'>
					<div className={HEADING}>{t('pptx.inspector.tableData')}</div>
					{canEdit && (
						<div className='flex flex-wrap gap-0.5'>
							<button
								type='button'
								className={BTN}
								title={t('pptx.tableDataEditor.addRowTitle')}
								onClick={() => commit(appendTableElementRow(tableElement))}
							>
								{t('pptx.tableDataEditor.addRowLabel')}
							</button>
							<button
								type='button'
								className={BTN}
								disabled={!grid.canRemoveRow}
								title={t('pptx.tableDataEditor.removeRowTitle')}
								onClick={() => commit(removeLastTableElementRow(tableElement))}
							>
								{t('pptx.tableDataEditor.removeRowLabel')}
							</button>
							<button
								type='button'
								className={BTN}
								title={t('pptx.tableDataEditor.addColumnTitle')}
								onClick={() => commit(appendTableElementColumn(tableElement))}
							>
								{t('pptx.tableDataEditor.addColumnLabel')}
							</button>
							<button
								type='button'
								className={BTN}
								disabled={!grid.canRemoveColumn}
								title={t('pptx.tableDataEditor.removeColumnTitle')}
								onClick={() => commit(removeLastTableElementColumn(tableElement))}
							>
								{t('pptx.tableDataEditor.removeColumnLabel')}
							</button>
						</div>
					)}
				</div>

				{/*
				 * Deliberately NOT a <table>: the framework-neutral e2e contract drives
				 * the in-slide cell editor with a `td input` selector, so putting these
				 * inputs inside real td cells collides under Playwright strict mode.
				 */}
				<div className='overflow-x-auto'>
					<div className='flex flex-col text-[11px] w-max min-w-full' role='grid'>
						<div className='flex' role='row'>
							{/*
							 * The corner spacer above the row-number gutter. It carries no role
							 * and is hidden from assistive tech: it is a purely visual filler,
							 * and an empty columnheader would announce a nameless header.
							 */}
							<div className={`${HEADER_CELL} flex-none w-10`} aria-hidden='true' />
							{grid.colIndices.map((colIndex) => (
								<div
									key={colIndex}
									className={`${HEADER_CELL} flex-1 basis-16`}
									role='columnheader'
								>
									<span>{colIndex + 1}</span>
									{canEdit && grid.canRemoveColumn && (
										<button
											type='button'
											className={REMOVE_BTN}
											aria-label={t('pptx.tableDataEditor.removeColumnN', {
												number: colIndex + 1,
											})}
											title={t('pptx.tableDataEditor.removeColumnN', { number: colIndex + 1 })}
											onClick={() => commit(removeTableElementColumn(tableElement, colIndex))}
										>
											&times;
										</button>
									)}
								</div>
							))}
						</div>

						{grid.rows.map((row) => (
							<div key={row.rowIndex} className='flex' role='row'>
								<div className={`${HEADER_CELL} flex-none w-10`} role='rowheader'>
									<span>{row.rowIndex + 1}</span>
									{canEdit && grid.canRemoveRow && (
										<button
											type='button'
											className={REMOVE_BTN}
											aria-label={t('pptx.tableDataEditor.removeRowN', {
												number: row.rowIndex + 1,
											})}
											title={t('pptx.tableDataEditor.removeRowN', { number: row.rowIndex + 1 })}
											onClick={() => commit(removeTableElementRow(tableElement, row.rowIndex))}
										>
											&times;
										</button>
									)}
								</div>
								{row.cells.map((cell) => (
									<div
										key={cell.colIndex}
										className='flex flex-1 basis-16 p-px border border-border -m-px'
										role='gridcell'
									>
										<input
											type='text'
											className={CELL_INPUT}
											disabled={!canEdit}
											aria-label={t('pptx.tableDataEditor.cellAriaLabel', {
												row: cell.rowIndex + 1,
												column: cell.colIndex + 1,
											})}
											value={cell.text}
											onChange={(event) =>
												commit(
													setTableElementCellText(
														tableElement,
														cell.rowIndex,
														cell.colIndex,
														event.target.value,
													),
												)
											}
										/>
									</div>
								))}
							</div>
						))}
					</div>
				</div>
			</section>
		</div>
	);
}
