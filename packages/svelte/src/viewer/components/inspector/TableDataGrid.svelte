<script lang="ts">
	/**
	 * TableDataGrid: inspector-resident spreadsheet editor for table cell TEXT,
	 * mirroring React's `inspector/TableDataGrid.tsx`.
	 *
	 * WHY this exists: every binding already ships a `ChartDataGrid` so chart
	 * values can be retyped from the sidebar without entering an on-canvas edit
	 * mode. Tables had no equivalent, so the ONLY way to change a cell's text was
	 * to double-click it on the slide, which is slow, easy to miss on a small
	 * cell, and impossible while another tool is active. This is the table
	 * analogue: one text input per cell plus row/column add and remove controls.
	 *
	 * All mutations go through the pure element-level helpers in
	 * `pptx-viewer-shared` (`render/table-data-grid`), which own the awkward bits
	 * (ragged rows normalised to the column count, merge-aware insert/delete, the
	 * never-empty-the-table floor). They return a whole replacement element, and
	 * the new `tableData` is committed via `editor.applyElementPatch` so edits
	 * land on the viewer's real undo/redo edit path and survive save/reload.
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

	import { useTranslator } from '../../../i18n/context';
	import type { EditorState } from '../../editor/editor-state.svelte';

	const { editor, el }: { editor: EditorState; el: PptxElement } = $props();
	const t = useTranslator();

	const tableElement = $derived(el.type === 'table' ? (el as TablePptxElement) : undefined);
	const grid = $derived(tableElement ? buildTableDataGrid(tableElement) : undefined);
	const canEdit = $derived(editor.editable);

	/**
	 * Commit a replacement element as a `tableData` patch.
	 *
	 * The shared helpers hand back a complete element, but the Svelte editor's
	 * edit path takes a partial patch keyed by element id (the same call
	 * `TableSection` uses); only `tableData` ever changes here. A helper that
	 * refused the edit returns the same reference, which must not push a
	 * pointless history entry.
	 */
	function commit(next: TablePptxElement): void {
		if (!tableElement || next === tableElement) {
			return;
		}
		// `rawXml` travels with `tableData`: a table from a real deck renders and
		// saves from its graphic-frame markup, so a tableData-only patch is invisible.
		editor.applyElementPatch(tableElement.id, {
			tableData: next.tableData,
			rawXml: next.rawXml,
		});
	}
</script>

{#if tableElement && grid && grid.rowCount > 0 && grid.colCount > 0}
	<section class="pptx-svelte-table-grid" aria-label={t('pptx.tableDataEditor.ariaLabel')}>
		<div class="pptx-svelte-table-grid-head">
			<h5>{t('pptx.inspector.tableData')}</h5>
			{#if canEdit}
				<div class="pptx-svelte-table-grid-actions">
					<button
						type="button"
						title={t('pptx.tableDataEditor.addRowTitle')}
						onclick={() => commit(appendTableElementRow(tableElement))}
					>
						{t('pptx.tableDataEditor.addRowLabel')}
					</button>
					<button
						type="button"
						disabled={!grid.canRemoveRow}
						title={t('pptx.tableDataEditor.removeRowTitle')}
						onclick={() => commit(removeLastTableElementRow(tableElement))}
					>
						{t('pptx.tableDataEditor.removeRowLabel')}
					</button>
					<button
						type="button"
						title={t('pptx.tableDataEditor.addColumnTitle')}
						onclick={() => commit(appendTableElementColumn(tableElement))}
					>
						{t('pptx.tableDataEditor.addColumnLabel')}
					</button>
					<button
						type="button"
						disabled={!grid.canRemoveColumn}
						title={t('pptx.tableDataEditor.removeColumnTitle')}
						onclick={() => commit(removeLastTableElementColumn(tableElement))}
					>
						{t('pptx.tableDataEditor.removeColumnLabel')}
					</button>
				</div>
			{/if}
		</div>

		<!--
			Deliberately NOT a <table>/<td>: the framework-neutral e2e contract drives
			the in-slide cell editor with a `td input` selector, so putting these
			inputs inside real td cells collides under Playwright strict mode. ARIA
			grid roles carry the same semantics to assistive tech.
		-->
		<div class="pptx-svelte-table-grid-scroll">
			<div class="pptx-svelte-table-grid-body" role="grid">
				<div class="pptx-svelte-table-grid-row" role="row">
					<div class="pptx-svelte-table-grid-header pptx-svelte-table-grid-corner" role="columnheader"></div>
					{#each grid.colIndices as colIndex (colIndex)}
						<div class="pptx-svelte-table-grid-header" role="columnheader">
							<span>{colIndex + 1}</span>
							{#if canEdit && grid.canRemoveColumn}
								<button
									type="button"
									class="pptx-svelte-table-grid-remove"
									aria-label={t('pptx.tableDataEditor.removeColumnN', { number: colIndex + 1 })}
									title={t('pptx.tableDataEditor.removeColumnN', { number: colIndex + 1 })}
									onclick={() => commit(removeTableElementColumn(tableElement, colIndex))}
								>
									&times;
								</button>
							{/if}
						</div>
					{/each}
				</div>

				{#each grid.rows as row (row.rowIndex)}
					<div class="pptx-svelte-table-grid-row" role="row">
						<div
							class="pptx-svelte-table-grid-header pptx-svelte-table-grid-corner"
							role="rowheader"
						>
							<span>{row.rowIndex + 1}</span>
							{#if canEdit && grid.canRemoveRow}
								<button
									type="button"
									class="pptx-svelte-table-grid-remove"
									aria-label={t('pptx.tableDataEditor.removeRowN', { number: row.rowIndex + 1 })}
									title={t('pptx.tableDataEditor.removeRowN', { number: row.rowIndex + 1 })}
									onclick={() => commit(removeTableElementRow(tableElement, row.rowIndex))}
								>
									&times;
								</button>
							{/if}
						</div>
						{#each row.cells as cell (cell.colIndex)}
							<div class="pptx-svelte-table-grid-cell" role="gridcell">
								<input
									type="text"
									disabled={!canEdit}
									aria-label={t('pptx.tableDataEditor.cellAriaLabel', {
										row: cell.rowIndex + 1,
										column: cell.colIndex + 1,
									})}
									value={cell.text}
									oninput={(event) =>
										commit(
											setTableElementCellText(
												tableElement,
												cell.rowIndex,
												cell.colIndex,
												event.currentTarget.value,
											),
										)}
								/>
							</div>
						{/each}
					</div>
				{/each}
			</div>
		</div>
	</section>
{/if}

<style>
	.pptx-svelte-table-grid {
		display: grid;
		gap: 6px;
	}

	.pptx-svelte-table-grid-head {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.pptx-svelte-table-grid-head h5 {
		margin: 0;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-table-grid-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-left: auto;
	}

	.pptx-svelte-table-grid-actions button {
		padding: 2px 6px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 5px;
		background: var(--pptx-muted, #2a2a3d);
		color: inherit;
		font: inherit;
		font-size: 10px;
		cursor: pointer;
	}

	.pptx-svelte-table-grid-actions button:disabled {
		opacity: 0.5;
		cursor: default;
	}

	/* Wide grids scroll inside the card; the inspector must never scroll sideways. */
	.pptx-svelte-table-grid-scroll {
		overflow-x: auto;
	}

	.pptx-svelte-table-grid-body {
		display: flex;
		flex-direction: column;
		min-width: 100%;
		width: max-content;
		font-size: 11px;
	}

	.pptx-svelte-table-grid-row {
		display: flex;
	}

	.pptx-svelte-table-grid-header {
		display: flex;
		flex: 1 1 64px;
		align-items: center;
		justify-content: center;
		gap: 2px;
		margin: -1px;
		padding: 1px 4px;
		border: 1px solid var(--pptx-border, #33334d);
		background: var(--pptx-muted, #2a2a3d);
		color: var(--pptx-muted-foreground, #94a3b8);
		white-space: nowrap;
	}

	.pptx-svelte-table-grid-corner {
		flex: none;
		width: 40px;
	}

	.pptx-svelte-table-grid-cell {
		display: flex;
		flex: 1 1 64px;
		margin: -1px;
		padding: 1px;
		border: 1px solid var(--pptx-border, #33334d);
	}

	.pptx-svelte-table-grid-cell input {
		width: 100%;
		min-width: 0;
		box-sizing: border-box;
		padding: 1px 4px;
		border: none;
		outline: none;
		background: var(--pptx-muted, #2a2a3d);
		color: inherit;
		font: inherit;
		font-size: 11px;
	}

	.pptx-svelte-table-grid-cell input:disabled {
		opacity: 0.6;
	}

	.pptx-svelte-table-grid-remove {
		flex: none;
		width: 14px;
		padding: 0;
		border: none;
		background: transparent;
		color: var(--pptx-muted-foreground, #94a3b8);
		line-height: 1;
		cursor: pointer;
	}

	.pptx-svelte-table-grid-remove:hover {
		color: #f87171;
	}
</style>
