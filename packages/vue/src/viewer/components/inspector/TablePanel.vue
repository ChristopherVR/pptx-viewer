<script setup lang="ts">
import type {
	PptxElement,
	PptxTableCell,
	PptxTableData,
	PptxTableRow,
	TablePptxElement,
} from 'pptx-viewer-core';
import { computed } from 'vue';

/**
 * TablePanel — inspector panel for table elements (`element.type === 'table'`).
 *
 * Vue 3 port of the React table structure controls. Provides row/column
 * insert + delete operations on the table grid.
 *
 * Uniform inspector contract:
 * - Props: `{ element: PptxElement }`.
 * - Emits `update` with a SHALLOW `Partial<PptxElement>` patch that the parent
 *   merges via `ops.updateElement(id, patch)`. For grid edits the FULL new
 *   `tableData` object is emitted under the real field name (`tableData`).
 *
 * Table model (mirrors `pptx-viewer-core` `PptxTableData`):
 * - `tableData.rows: PptxTableRow[]` — each `{ height?, cells: PptxTableCell[] }`.
 * - `tableData.columnWidths: number[]` — per-column proportion (sums to 1).
 * - Cells: `PptxTableCell` `{ text, style?, gridSpan?, rowSpan?, vMerge?, hMerge? }`.
 *
 * The core row/column helpers (`addTableRow` / `removeTableRow` /
 * `addTableColumn` / `removeTableColumn` in `core/runtime/`) are NOT part of
 * the public `pptx-viewer-core` barrel, so this panel performs the array
 * manipulation directly on a deep-cloned `tableData`, mirroring their logical
 * behaviour (blank cells matching the cell shape, width re-normalisation).
 *
 * Active-cell choice: the inspector contract passes only `{ element }` — the
 * table model does not track a selected/active cell here — so insert/delete
 * operations act on the LAST row / LAST column (inserts can target above/below
 * or left/right of that reference). Delete is disabled when only one row /
 * column remains.
 */
const props = defineProps<{
	element: PptxElement;
}>();

const emit = defineEmits<{
	update: [patch: Partial<PptxElement>];
}>();

const isTable = computed(() => props.element.type === 'table');

const tableData = computed<PptxTableData | undefined>(() =>
	props.element.type === 'table' ? (props.element as TablePptxElement).tableData : undefined,
);

const rowCount = computed(() => tableData.value?.rows.length ?? 0);
const colCount = computed(() => tableData.value?.columnWidths.length ?? 0);

const canDeleteRow = computed(() => rowCount.value > 1);
const canDeleteColumn = computed(() => colCount.value > 1);

const supportsHeaderRow = true;
const headerRow = computed(() => Boolean(tableData.value?.firstRowHeader));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cloneTableData(td: PptxTableData): PptxTableData {
	// `td` is a Vue reactive proxy; `structuredClone` rejects proxies, so deep
	// clone through a JSON round-trip (tableData is plain serialisable data).
	return JSON.parse(JSON.stringify(td)) as PptxTableData;
}

function blankCell(): PptxTableCell {
	return { text: '' };
}

function blankRow(cols: number): PptxTableRow {
	const cells: PptxTableCell[] = [];
	for (let c = 0; c < cols; c++) {
		cells.push(blankCell());
	}
	return { cells };
}

/** Emit the full new tableData as a shallow element patch. */
function emitTableData(next: PptxTableData): void {
	emit('update', { tableData: next } as Partial<PptxElement>);
}

/** Re-normalise an array of column widths so it sums to 1. */
function normalizeWidths(widths: number[]): number[] {
	const sum = widths.reduce((a, b) => a + b, 0);
	return sum > 0 ? widths.map((w) => w / sum) : widths;
}

// ---------------------------------------------------------------------------
// Row operations (operate relative to the LAST row)
// ---------------------------------------------------------------------------

function insertRowAt(index: number): void {
	const td = tableData.value;
	if (!td) {
		return;
	}
	const next = cloneTableData(td);
	const clamped = Math.max(0, Math.min(index, next.rows.length));
	next.rows.splice(clamped, 0, blankRow(next.columnWidths.length));
	emitTableData(next);
}

function insertRowAbove(): void {
	insertRowAt(rowCount.value - 1);
}

function insertRowBelow(): void {
	insertRowAt(rowCount.value);
}

function deleteRow(): void {
	const td = tableData.value;
	if (!td || td.rows.length <= 1) {
		return;
	}
	const next = cloneTableData(td);
	next.rows.splice(next.rows.length - 1, 1);
	emitTableData(next);
}

// ---------------------------------------------------------------------------
// Column operations (operate relative to the LAST column)
// ---------------------------------------------------------------------------

function insertColumnAt(index: number): void {
	const td = tableData.value;
	if (!td) {
		return;
	}
	const next = cloneTableData(td);
	const cols = next.columnWidths.length;
	const clamped = Math.max(0, Math.min(index, cols));

	// Width: split the reference column's width with the new column.
	const widths = [...next.columnWidths];
	const splitSource = clamped < cols ? clamped : cols - 1;
	const original = widths[splitSource] ?? 1 / Math.max(1, cols);
	const half = original / 2;
	widths[splitSource] = half;
	widths.splice(clamped, 0, half);
	next.columnWidths = normalizeWidths(widths);

	// Insert a blank cell into every row at the same index.
	for (const row of next.rows) {
		row.cells.splice(clamped, 0, blankCell());
	}
	emitTableData(next);
}

function insertColumnLeft(): void {
	insertColumnAt(colCount.value - 1);
}

function insertColumnRight(): void {
	insertColumnAt(colCount.value);
}

function deleteColumn(): void {
	const td = tableData.value;
	if (!td || td.columnWidths.length <= 1) {
		return;
	}
	const next = cloneTableData(td);
	const index = next.columnWidths.length - 1;
	next.columnWidths = normalizeWidths(next.columnWidths.filter((_, i) => i !== index));
	for (const row of next.rows) {
		if (index < row.cells.length) {
			row.cells.splice(index, 1);
		}
	}
	emitTableData(next);
}

// ---------------------------------------------------------------------------
// Header-row toggle
// ---------------------------------------------------------------------------

function toggleHeaderRow(event: Event): void {
	const td = tableData.value;
	if (!td) {
		return;
	}
	const checked = (event.target as HTMLInputElement).checked;
	const next = cloneTableData(td);
	next.firstRowHeader = checked;
	emitTableData(next);
}
</script>

<template>
	<div class="pptx-vue-table-panel flex flex-col gap-2 text-xs">
		<p v-if="!isTable" class="pptx-vue-table-panel__muted text-[11px] text-muted-foreground">
			Select a table to edit its rows and columns.
		</p>
		<p v-else-if="!tableData" class="pptx-vue-table-panel__muted text-[11px] text-muted-foreground">
			This table has no editable cell data.
		</p>
		<template v-else>
			<div
				class="pptx-vue-table-panel__heading text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
			>
				Table
			</div>
			<div class="pptx-vue-table-panel__counts flex gap-4 text-[11px] text-muted-foreground">
				<span>Rows: {{ rowCount }}</span>
				<span>Columns: {{ colCount }}</span>
			</div>

			<div class="pptx-vue-table-panel__group flex flex-col gap-1">
				<div class="pptx-vue-table-panel__label text-[11px] font-medium">Rows</div>
				<div class="pptx-vue-table-panel__buttons flex flex-wrap gap-1">
					<button
						type="button"
						class="pptx-vue-table-panel__btn flex-1 min-w-0 rounded border border-border bg-muted hover:bg-accent px-2 py-1 text-[11px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
						@click="insertRowAbove"
					>
						Insert above
					</button>
					<button
						type="button"
						class="pptx-vue-table-panel__btn flex-1 min-w-0 rounded border border-border bg-muted hover:bg-accent px-2 py-1 text-[11px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
						@click="insertRowBelow"
					>
						Insert below
					</button>
					<button
						type="button"
						class="pptx-vue-table-panel__btn pptx-vue-table-panel__btn--danger flex-1 min-w-0 rounded border border-border bg-muted px-2 py-1 text-[11px] transition-colors hover:border-destructive hover:text-destructive disabled:opacity-50 disabled:cursor-not-allowed"
						:disabled="!canDeleteRow"
						@click="deleteRow"
					>
						Delete row
					</button>
				</div>
			</div>

			<div class="pptx-vue-table-panel__group flex flex-col gap-1">
				<div class="pptx-vue-table-panel__label text-[11px] font-medium">Columns</div>
				<div class="pptx-vue-table-panel__buttons flex flex-wrap gap-1">
					<button
						type="button"
						class="pptx-vue-table-panel__btn flex-1 min-w-0 rounded border border-border bg-muted hover:bg-accent px-2 py-1 text-[11px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
						@click="insertColumnLeft"
					>
						Insert left
					</button>
					<button
						type="button"
						class="pptx-vue-table-panel__btn flex-1 min-w-0 rounded border border-border bg-muted hover:bg-accent px-2 py-1 text-[11px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
						@click="insertColumnRight"
					>
						Insert right
					</button>
					<button
						type="button"
						class="pptx-vue-table-panel__btn pptx-vue-table-panel__btn--danger flex-1 min-w-0 rounded border border-border bg-muted px-2 py-1 text-[11px] transition-colors hover:border-destructive hover:text-destructive disabled:opacity-50 disabled:cursor-not-allowed"
						:disabled="!canDeleteColumn"
						@click="deleteColumn"
					>
						Delete column
					</button>
				</div>
			</div>

			<label
				v-if="supportsHeaderRow"
				class="pptx-vue-table-panel__toggle flex items-center gap-2 text-[11px] cursor-pointer"
			>
				<input type="checkbox" :checked="headerRow" @change="toggleHeaderRow" />
				<span>Header row</span>
			</label>
		</template>
	</div>
</template>
