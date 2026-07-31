<script setup lang="ts">
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
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

/**
 * TableDataGrid: inspector-resident spreadsheet editor for table cell TEXT.
 *
 * WHY this exists: every binding already ships a `ChartDataGrid` so chart values
 * can be edited from the sidebar without entering an on-canvas edit mode. Tables
 * had no equivalent, so the only way to retype a cell was to double-click it on
 * the slide. This is the table analogue: a compact grid of one text input per
 * cell, plus row/column add and remove controls.
 *
 * All mutations go through the pure element-level helpers in
 * `pptx-viewer-shared` (`render/table-data-grid`), which are merge-aware, so the
 * SFC stays a thin view. Each edit is emitted as a `tableData` patch on the same
 * `update` contract every other inspector panel uses, which the host applies via
 * `useEditorOperations.updateElement`; that is what makes edits reach the canvas
 * and survive a save/reload round trip.
 */
const props = defineProps<{
	element: PptxElement;
	canEdit?: boolean;
}>();

const emit = defineEmits<{
	update: [patch: Partial<PptxElement>];
}>();

const { t } = useI18n();

const tableElement = computed<TablePptxElement | null>(() =>
	props.element.type === 'table' ? (props.element as TablePptxElement) : null,
);

const grid = computed(() =>
	tableElement.value
		? buildTableDataGrid(tableElement.value)
		: {
				rowCount: 0,
				colCount: 0,
				colIndices: [] as number[],
				rows: [],
				canRemoveRow: false,
				canRemoveColumn: false,
			},
);

const visible = computed(() => grid.value.rowCount > 0 && grid.value.colCount > 0);

/**
 * Commit a whole replacement element as a `tableData` patch.
 *
 * The shared helpers return complete elements, but the inspector's edit path
 * takes partial updates; only `tableData` ever changes here. A helper that
 * refused the edit returns the same reference, which must not push history.
 */
function commit(next: TablePptxElement): void {
	if (!tableElement.value || next === tableElement.value) {
		return;
	}
	// `rawXml` travels with `tableData`: a table from a real deck renders and
	// saves from its graphic-frame markup, so a tableData-only patch is invisible.
	emit('update', { tableData: next.tableData, rawXml: next.rawXml } as Partial<PptxElement>);
}

/** Apply one of the shared element transforms to the current table element. */
function apply(transform: (element: TablePptxElement) => TablePptxElement): void {
	const el = tableElement.value;
	if (el) {
		commit(transform(el));
	}
}

function onCellInput(event: Event, rowIndex: number, colIndex: number): void {
	const value = (event.target as HTMLInputElement).value;
	apply((el) => setTableElementCellText(el, rowIndex, colIndex, value));
}

const HEADER_CELL =
	'flex items-center justify-center gap-0.5 bg-muted text-muted-foreground border border-border -m-px px-1 py-0.5 whitespace-nowrap';
const CELL_INPUT =
	'w-full box-border bg-muted px-1 py-0.5 text-[11px] border-0 outline-none focus:bg-accent disabled:opacity-60';
const REMOVE_BTN = 'px-0.5 leading-none text-destructive hover:opacity-80';
const BTN =
	'rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50';
</script>

<template>
	<div
		v-if="visible"
		class="pptx-vue-table-data-grid mb-2 rounded border border-border bg-card p-2"
	>
		<section :aria-label="t('pptx.tableDataEditor.ariaLabel')">
			<div class="flex items-center justify-between gap-1 mb-1.5">
				<div class="text-[11px] uppercase tracking-wide text-muted-foreground">
					{{ t('pptx.inspector.tableData') }}
				</div>
				<div v-if="props.canEdit" class="flex flex-wrap gap-0.5">
					<button
						type="button"
						:class="BTN"
						:title="t('pptx.tableDataEditor.addRowTitle')"
						@click="apply(appendTableElementRow)"
					>
						{{ t('pptx.tableDataEditor.addRowLabel') }}
					</button>
					<button
						type="button"
						:class="BTN"
						:disabled="!grid.canRemoveRow"
						:title="t('pptx.tableDataEditor.removeRowTitle')"
						@click="apply(removeLastTableElementRow)"
					>
						{{ t('pptx.tableDataEditor.removeRowLabel') }}
					</button>
					<button
						type="button"
						:class="BTN"
						:title="t('pptx.tableDataEditor.addColumnTitle')"
						@click="apply(appendTableElementColumn)"
					>
						{{ t('pptx.tableDataEditor.addColumnLabel') }}
					</button>
					<button
						type="button"
						:class="BTN"
						:disabled="!grid.canRemoveColumn"
						:title="t('pptx.tableDataEditor.removeColumnTitle')"
						@click="apply(removeLastTableElementColumn)"
					>
						{{ t('pptx.tableDataEditor.removeColumnLabel') }}
					</button>
				</div>
			</div>

			<!--
				Deliberately NOT a <table>: the framework-neutral e2e contract drives
				the in-slide cell editor with a `td input` selector, so putting these
				inputs inside real td cells collides under Playwright strict mode.
			-->
			<div class="overflow-x-auto">
				<div class="flex flex-col text-[11px] w-max min-w-full" role="grid">
					<div class="flex" role="row">
						<div :class="`${HEADER_CELL} flex-none w-10`" role="columnheader"></div>
						<div
							v-for="colIndex in grid.colIndices"
							:key="colIndex"
							:class="`${HEADER_CELL} flex-1 basis-16`"
							role="columnheader"
						>
							<span>{{ colIndex + 1 }}</span>
							<button
								v-if="props.canEdit && grid.canRemoveColumn"
								type="button"
								:class="REMOVE_BTN"
								:aria-label="t('pptx.tableDataEditor.removeColumnN', { number: colIndex + 1 })"
								:title="t('pptx.tableDataEditor.removeColumnN', { number: colIndex + 1 })"
								@click="apply((el) => removeTableElementColumn(el, colIndex))"
							>
								&times;
							</button>
						</div>
					</div>

					<div v-for="row in grid.rows" :key="row.rowIndex" class="flex" role="row">
						<div :class="`${HEADER_CELL} flex-none w-10`" role="rowheader">
							<span>{{ row.rowIndex + 1 }}</span>
							<button
								v-if="props.canEdit && grid.canRemoveRow"
								type="button"
								:class="REMOVE_BTN"
								:aria-label="t('pptx.tableDataEditor.removeRowN', { number: row.rowIndex + 1 })"
								:title="t('pptx.tableDataEditor.removeRowN', { number: row.rowIndex + 1 })"
								@click="apply((el) => removeTableElementRow(el, row.rowIndex))"
							>
								&times;
							</button>
						</div>
						<div
							v-for="cell in row.cells"
							:key="cell.colIndex"
							class="flex flex-1 basis-16 p-px border border-border -m-px"
							role="gridcell"
						>
							<input
								type="text"
								:class="CELL_INPUT"
								:disabled="!props.canEdit"
								:aria-label="
									t('pptx.tableDataEditor.cellAriaLabel', {
										row: cell.rowIndex + 1,
										column: cell.colIndex + 1,
									})
								"
								:value="cell.text"
								@input="onCellInput($event, cell.rowIndex, cell.colIndex)"
							/>
						</div>
					</div>
				</div>
			</div>
		</section>
	</div>
</template>
