<script setup lang="ts">
import type { PptxTableCellStyle, PptxTableData } from 'pptx-viewer-core';
import { TABLE_STYLE_PRESETS } from 'pptx-viewer-shared';
import { useI18n } from 'vue-i18n';

/**
 * TableStyleOptions: Vue port of the structure/style toggles + quick-style
 * preset grid from React's inspector `TablePropertiesPanel.tsx`. Emits a
 * `Partial<PptxTableData>` patch (banding flags, band cycle counts, or a full
 * re-styled `rows` array) that the parent merges into the element's tableData.
 */
const props = defineProps<{
	tableData: PptxTableData;
	canEdit: boolean;
}>();

const emit = defineEmits<{
	update: [patch: Partial<PptxTableData>];
}>();

const { t } = useI18n();

const TOGGLES: Array<[keyof PptxTableData, string]> = [
	['bandedRows', 'pptx.table.bandedRows'],
	['firstRowHeader', 'pptx.table.headerRow'],
	['bandedColumns', 'pptx.table.bandedColumns'],
	['firstCol', 'pptx.table.firstColumn'],
	['lastCol', 'pptx.table.lastColumn'],
	['lastRow', 'pptx.table.lastRow'],
];

function toggle(key: keyof PptxTableData, event: Event): void {
	emit('update', { [key]: (event.target as HTMLInputElement).checked });
}

function setCycle(key: 'bandRowCycle' | 'bandColCycle', event: Event): void {
	const value = Math.max(1, parseInt((event.target as HTMLInputElement).value, 10) || 1);
	emit('update', { [key]: value });
}

function applyPreset(preset: (typeof TABLE_STYLE_PRESETS)[number]): void {
	const td = props.tableData;
	const headerRow = Boolean(td.firstRowHeader);
	const banded = Boolean(td.bandedRows);
	const rows = td.rows.map((row, ri) => ({
		...row,
		cells: row.cells.map((cell) => {
			const isHeader = ri === 0 && headerRow;
			const bodyOffset = ri - (headerRow ? 1 : 0);
			const style: PptxTableCellStyle = {
				...cell.style,
				backgroundColor: isHeader
					? preset.headerBg
					: banded && bodyOffset % 2 === 0
						? preset.bandBg
						: undefined,
				color: isHeader ? preset.headerFg : cell.style?.color,
				bold: isHeader ? true : cell.style?.bold,
				borderColor: preset.borderColor,
			};
			return { ...cell, style };
		}),
	}));
	emit('update', { rows });
}
</script>

<template>
	<div class="flex flex-col gap-2">
		<div class="flex flex-col gap-1">
			<label
				v-for="[key, label] in TOGGLES"
				:key="key"
				class="flex cursor-pointer items-center gap-2 text-[11px]"
			>
				<input
					type="checkbox"
					class="accent-primary"
					:disabled="!canEdit"
					:checked="Boolean(tableData[key])"
					@change="toggle(key, $event)"
				/>
				<span>{{ t(label) }}</span>
			</label>
			<label v-if="tableData.bandedRows" class="mt-1 flex items-center gap-2 text-[11px]">
				<span class="text-muted-foreground">{{ t('pptx.table.bandRowCycle') }}</span>
				<input
					type="number"
					class="w-14 rounded border border-border bg-background px-1 py-0.5 text-[11px]"
					:disabled="!canEdit"
					min="1"
					max="99"
					:value="tableData.bandRowCycle ?? 1"
					@input="setCycle('bandRowCycle', $event)"
				/>
			</label>
			<label v-if="tableData.bandedColumns" class="mt-1 flex items-center gap-2 text-[11px]">
				<span class="text-muted-foreground">{{ t('pptx.table.bandColCycle') }}</span>
				<input
					type="number"
					class="w-14 rounded border border-border bg-background px-1 py-0.5 text-[11px]"
					:disabled="!canEdit"
					min="1"
					max="99"
					:value="tableData.bandColCycle ?? 1"
					@input="setCycle('bandColCycle', $event)"
				/>
			</label>
		</div>

		<div class="flex flex-col gap-1">
			<span class="text-[11px] font-medium">{{ t('pptx.table.stylePresets') }}</span>
			<div class="grid grid-cols-3 gap-1.5">
				<button
					v-for="preset in TABLE_STYLE_PRESETS"
					:key="preset.id"
					type="button"
					class="h-10 overflow-hidden rounded border border-border transition-colors hover:border-primary disabled:opacity-50"
					:disabled="!canEdit"
					:title="preset.label"
					@click="applyPreset(preset)"
				>
					<div class="flex h-full flex-col">
						<div class="flex-1" :style="{ backgroundColor: preset.headerBg }" />
						<div class="flex-1" :style="{ backgroundColor: preset.bandBg }" />
						<div class="flex-1 border-t" :style="{ borderColor: preset.borderColor }" />
					</div>
				</button>
			</div>
		</div>
	</div>
</template>
