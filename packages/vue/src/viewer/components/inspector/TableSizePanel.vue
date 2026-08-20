<script setup lang="ts">
import type { PptxTableData } from 'pptx-viewer-core';
import { evenColumnWidths, evenRowHeights, redistributeColumnWidth } from 'pptx-viewer-shared';
import { useI18n } from 'vue-i18n';

/**
 * TableSizePanel: Vue port of the column-width and row-height numeric controls
 * from React's inspector `TablePropertiesPanel.tsx`. Column widths are edited as
 * proportions (renormalised to sum to 1 via `pptx-viewer-shared`'s
 * `redistributeColumnWidth`); row heights as pixels. Emits a
 * `Partial<PptxTableData>` patch for the parent to merge.
 */
const props = defineProps<{
	tableData: PptxTableData;
	canEdit: boolean;
}>();

const emit = defineEmits<{
	update: [patch: Partial<PptxTableData>];
}>();

const { t } = useI18n();

function setColumnWidth(index: number, percent: number): void {
	emit('update', {
		columnWidths: redistributeColumnWidth(props.tableData.columnWidths, index, percent / 100),
	});
}

function evenColumns(): void {
	emit('update', { columnWidths: evenColumnWidths(props.tableData.columnWidths.length) });
}

function setRowHeight(index: number, height: number): void {
	const rows = props.tableData.rows.map((r, i) => (i === index ? { ...r, height } : r));
	emit('update', { rows });
}

function evenRows(): void {
	emit('update', { rows: evenRowHeights(props.tableData.rows) });
}
</script>

<template>
	<div class="flex flex-col gap-2">
		<div class="flex flex-col gap-1">
			<div class="flex items-center justify-between">
				<span class="text-[11px] font-medium">{{ t('pptx.table.columnWidths') }}</span>
				<button
					type="button"
					class="rounded border border-border bg-muted px-2 py-0.5 text-[11px] hover:bg-accent disabled:opacity-50"
					:disabled="!canEdit"
					@click="evenColumns"
				>
					{{ t('pptx.table.even') }}
				</button>
			</div>
			<label
				v-for="(w, ci) in tableData.columnWidths"
				:key="ci"
				class="flex items-center gap-2 text-[11px]"
			>
				<span class="w-6 shrink-0 text-muted-foreground">{{ ci + 1 }}</span>
				<input
					type="range"
					class="flex-1 accent-primary"
					:disabled="!canEdit"
					min="5"
					max="80"
					:value="Math.round(w * 100)"
					@input="setColumnWidth(ci, Number(($event.target as HTMLInputElement).value))"
				/>
				<span class="w-10 text-right text-muted-foreground">{{ Math.round(w * 100) }}%</span>
			</label>
		</div>

		<div class="flex flex-col gap-1">
			<div class="flex items-center justify-between">
				<span class="text-[11px] font-medium">{{ t('pptx.table.rowHeights') }}</span>
				<button
					type="button"
					class="rounded border border-border bg-muted px-2 py-0.5 text-[11px] hover:bg-accent disabled:opacity-50"
					:disabled="!canEdit"
					@click="evenRows"
				>
					{{ t('pptx.table.even') }}
				</button>
			</div>
			<label
				v-for="(row, ri) in tableData.rows"
				:key="ri"
				class="flex items-center gap-2 text-[11px]"
			>
				<span class="w-6 shrink-0 text-muted-foreground">{{ ri + 1 }}</span>
				<input
					type="number"
					class="flex-1 rounded border border-border bg-muted px-1.5 py-0.5 text-[11px]"
					:disabled="!canEdit"
					min="16"
					max="500"
					:value="row.height ?? 32"
					@input="setRowHeight(ri, Number(($event.target as HTMLInputElement).value))"
				/>
				<span class="w-6 text-muted-foreground">px</span>
			</label>
		</div>
	</div>
</template>
