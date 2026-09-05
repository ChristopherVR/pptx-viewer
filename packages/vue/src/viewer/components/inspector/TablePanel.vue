<script setup lang="ts">
import type {
	ParsedTableStyleMap,
	PptxElement,
	PptxTableData,
	TablePptxElement,
} from 'pptx-viewer-core';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import {
	applyDeleteColumn,
	applyDeleteRow,
	applyInsertColumn,
	applyInsertRow,
	applyMergeSelected,
} from '../../composables/table-mutations';
import { injectTableSelection } from '../../composables/table-selection';
import TableCellFormattingPanel from './TableCellFormattingPanel.vue';
import TableSizePanel from './TableSizePanel.vue';
import TableStyleOptions from './TableStyleOptions.vue';

/**
 * TablePanel: inspector panel for table elements (`element.type === 'table'`).
 *
 * Vue port of React's inspector `TablePropertiesPanel` + `TableCellFormatting`.
 * Structural operations (insert / delete row / column, merge selected cells) are
 * merge-span aware and driven by `pptx-viewer-shared` transforms, keyed to the
 * cell selected on the canvas (injected via the table selection context; falls
 * back to the first cell when nothing is selected). Cell-level formatting, table
 * style toggles / presets, and column-width / row-height controls are delegated
 * to focused sub-components.
 *
 * Contract: emits `update` with a shallow `Partial<PptxElement>`; grid edits are
 * emitted as the full new `tableData` object under the `tableData` field.
 */
const props = defineProps<{
	element: PptxElement;
	/**
	 * The deck's parsed `ppt/tableStyles.xml` map, needed by "Edit style...".
	 * See `TableStyleOptions.vue`'s docblock for why this is optional.
	 */
	tableStyleMap?: ParsedTableStyleMap;
}>();

const emit = defineEmits<{
	update: [patch: Partial<PptxElement>];
	tableStyleMapChange: [nextMap: ParsedTableStyleMap];
	deleteTableStyle: [styleId: string];
}>();

const { t } = useI18n();

const isTable = computed(() => props.element.type === 'table');

const tableData = computed<PptxTableData | undefined>(() =>
	props.element.type === 'table' ? (props.element as TablePptxElement).tableData : undefined,
);

const rowCount = computed(() => tableData.value?.rows.length ?? 0);
const colCount = computed(() => tableData.value?.columnWidths.length ?? 0);

const canDeleteRow = computed(() => rowCount.value > 1);
const canDeleteColumn = computed(() => colCount.value > 1);

// Canvas cell selection (shared provide/inject). The active cell keys the
// structural ops; a multi-cell selection enables merge.
const selectionCtx = injectTableSelection();
const activeCell = computed(() => {
	const s = selectionCtx?.selection.value;
	return s && s.elementId === props.element.id ? s : null;
});
const activeRow = computed(() => activeCell.value?.rowIndex ?? 0);
const activeColumn = computed(() => activeCell.value?.columnIndex ?? 0);
const multiSelection = computed(() => activeCell.value?.selectedCells);
const canMergeSelected = computed(
	() => Array.isArray(multiSelection.value) && multiSelection.value.length >= 2,
);

/** Merge a `Partial<PptxTableData>` patch into the element's tableData and emit. */
function patchTableData(patch: Partial<PptxTableData>): void {
	const td = tableData.value;
	if (!td) {
		return;
	}
	emit('update', { tableData: { ...td, ...patch } } as Partial<PptxElement>);
}

/** Emit a full replacement tableData (structural ops build a whole new object). */
function emitTableData(next: PptxTableData): void {
	emit('update', { tableData: next } as Partial<PptxElement>);
}

function insertRow(position: 'above' | 'below'): void {
	const td = tableData.value;
	if (td) {
		emitTableData(applyInsertRow(td, activeRow.value, position));
	}
}

function deleteRow(): void {
	const td = tableData.value;
	if (!td) {
		return;
	}
	const next = applyDeleteRow(td, activeRow.value);
	if (next) {
		emitTableData(next);
	}
}

function insertColumn(position: 'left' | 'right'): void {
	const td = tableData.value;
	if (td) {
		emitTableData(applyInsertColumn(td, activeColumn.value, position));
	}
}

function deleteColumn(): void {
	const td = tableData.value;
	if (!td) {
		return;
	}
	const next = applyDeleteColumn(td, activeColumn.value);
	if (next) {
		emitTableData(next);
	}
}

function mergeSelected(): void {
	const td = tableData.value;
	if (!td) {
		return;
	}
	const next = applyMergeSelected(td, multiSelection.value);
	if (next) {
		emitTableData(next);
	}
}
</script>

<template>
	<div class="pptx-vue-table-panel flex flex-col gap-3 text-xs">
		<p v-if="!isTable" class="text-[11px] text-muted-foreground">
			{{ t('pptx.table.selectTablePrompt') }}
		</p>
		<p v-else-if="!tableData" class="text-[11px] text-muted-foreground">
			{{ t('pptx.table.noEditableData') }}
		</p>
		<template v-else>
			<div class="flex gap-4 text-[11px] text-muted-foreground">
				<span>{{ t('pptx.table.rowsCount', { count: rowCount }) }}</span>
				<span>{{ t('pptx.table.columnsCount', { count: colCount }) }}</span>
			</div>

			<div class="flex flex-col gap-1">
				<div class="text-[11px] font-medium">{{ t('pptx.table.rows') }}</div>
				<div class="flex flex-wrap gap-1">
					<button
						type="button"
						class="min-w-0 flex-1 rounded border border-border bg-muted px-2 py-1 text-[11px] transition-colors hover:bg-accent"
						@click="insertRow('above')"
					>
						{{ t('pptx.table.insertAbove') }}
					</button>
					<button
						type="button"
						class="min-w-0 flex-1 rounded border border-border bg-muted px-2 py-1 text-[11px] transition-colors hover:bg-accent"
						@click="insertRow('below')"
					>
						{{ t('pptx.table.insertBelow') }}
					</button>
					<button
						type="button"
						class="min-w-0 flex-1 rounded border border-border bg-muted px-2 py-1 text-[11px] transition-colors hover:border-destructive hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
						:disabled="!canDeleteRow"
						@click="deleteRow"
					>
						{{ t('pptx.table.deleteRow') }}
					</button>
				</div>
			</div>

			<div class="flex flex-col gap-1">
				<div class="text-[11px] font-medium">{{ t('pptx.table.columns') }}</div>
				<div class="flex flex-wrap gap-1">
					<button
						type="button"
						class="min-w-0 flex-1 rounded border border-border bg-muted px-2 py-1 text-[11px] transition-colors hover:bg-accent"
						@click="insertColumn('left')"
					>
						{{ t('pptx.table.insertLeft') }}
					</button>
					<button
						type="button"
						class="min-w-0 flex-1 rounded border border-border bg-muted px-2 py-1 text-[11px] transition-colors hover:bg-accent"
						@click="insertColumn('right')"
					>
						{{ t('pptx.table.insertRight') }}
					</button>
					<button
						type="button"
						class="min-w-0 flex-1 rounded border border-border bg-muted px-2 py-1 text-[11px] transition-colors hover:border-destructive hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
						:disabled="!canDeleteColumn"
						@click="deleteColumn"
					>
						{{ t('pptx.table.deleteColumn') }}
					</button>
				</div>
			</div>

			<button
				v-if="canMergeSelected"
				type="button"
				class="rounded border border-border bg-muted px-2 py-1 text-[11px] transition-colors hover:bg-accent"
				@click="mergeSelected"
			>
				{{ t('pptx.table.mergeSelected') }}
			</button>

			<TableStyleOptions
				:table-data="tableData"
				:can-edit="true"
				:table-style-map="tableStyleMap"
				@update="patchTableData"
				@table-style-map-change="(m) => emit('tableStyleMapChange', m)"
				@delete-table-style="(id) => emit('deleteTableStyle', id)"
			/>

			<TableCellFormattingPanel
				v-if="activeCell"
				:table-data="tableData"
				:row-index="activeRow"
				:column-index="activeColumn"
				:can-edit="true"
				@update="patchTableData"
			/>

			<TableSizePanel :table-data="tableData" :can-edit="true" @update="patchTableData" />
		</template>
	</div>
</template>
