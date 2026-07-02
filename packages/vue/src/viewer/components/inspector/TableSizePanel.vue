<script setup lang="ts">
import type { PptxTableData } from 'pptx-viewer-core';

/**
 * TableSizePanel: Vue port of the column-width and row-height numeric controls
 * from React's inspector `TablePropertiesPanel.tsx`. Column widths are edited as
 * proportions (renormalised to sum to 1); row heights as pixels. Emits a
 * `Partial<PptxTableData>` patch for the parent to merge.
 */
const props = defineProps<{
	tableData: PptxTableData;
	canEdit: boolean;
}>();

const emit = defineEmits<{
	update: [patch: Partial<PptxTableData>];
}>();

function setColumnWidth(index: number, percent: number): void {
	const td = props.tableData;
	const newPct = percent / 100;
	const oldPct = td.columnWidths[index];
	const diff = newPct - oldPct;
	const newWidths = [...td.columnWidths];
	newWidths[index] = newPct;
	const othersTotal = 1 - oldPct;
	if (othersTotal > 0) {
		for (let j = 0; j < newWidths.length; j++) {
			if (j !== index) {
				newWidths[j] = Math.max(
					0.05,
					td.columnWidths[j] - diff * (td.columnWidths[j] / othersTotal),
				);
			}
		}
	}
	const sum = newWidths.reduce((a, b) => a + b, 0);
	emit('update', { columnWidths: newWidths.map((w) => w / sum) });
}

function evenColumns(): void {
	const count = props.tableData.columnWidths.length;
	emit('update', { columnWidths: Array<number>(count).fill(1 / count) });
}

function setRowHeight(index: number, height: number): void {
	const rows = props.tableData.rows.map((r, i) => (i === index ? { ...r, height } : r));
	emit('update', { rows });
}

function evenRows(): void {
	const rows = props.tableData.rows;
	const avg = Math.round(rows.reduce((s, r) => s + (r.height ?? 32), 0) / Math.max(1, rows.length));
	emit('update', { rows: rows.map((r) => ({ ...r, height: avg })) });
}
</script>

<template>
	<div class="flex flex-col gap-2">
		<div class="flex flex-col gap-1">
			<div class="flex items-center justify-between">
				<span class="text-[11px] font-medium">Column widths</span>
				<button
					type="button"
					class="rounded border border-border bg-muted px-2 py-0.5 text-[11px] hover:bg-accent disabled:opacity-50"
					:disabled="!canEdit"
					@click="evenColumns"
				>
					Even
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
				<span class="text-[11px] font-medium">Row heights</span>
				<button
					type="button"
					class="rounded border border-border bg-muted px-2 py-0.5 text-[11px] hover:bg-accent disabled:opacity-50"
					:disabled="!canEdit"
					@click="evenRows"
				>
					Even
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
