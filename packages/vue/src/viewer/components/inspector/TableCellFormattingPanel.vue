<script setup lang="ts">
import type { PptxTableCellStyle, PptxTableData } from 'pptx-viewer-core';
import { computeMergeCellDown, computeMergeCellRight, computeSplitCell } from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import DebouncedColorInput from './DebouncedColorInput.vue';
import TableCellAdvancedFill from './TableCellAdvancedFill.vue';

/**
 * TableCellFormattingPanel: Vue port of React's inspector
 * `TableCellFormattingPanel.tsx`. Formats the currently-selected table cell:
 * font size, text / background colour, bold / italic / underline, horizontal
 * and vertical alignment, per-edge and diagonal borders, advanced fill
 * (gradient / pattern) + margins, and cursor-anchored merge / split. All edits
 * emit a full `Partial<PptxTableData>` (rows) patch that the parent forwards to
 * the editor operations, so undo / redo and dirty-marking flow uniformly.
 */
const props = defineProps<{
	tableData: PptxTableData;
	rowIndex: number;
	columnIndex: number;
	canEdit: boolean;
}>();

const emit = defineEmits<{
	update: [patch: Partial<PptxTableData>];
}>();

const { t } = useI18n();

const cell = computed(() => props.tableData.rows[props.rowIndex]?.cells[props.columnIndex]);
const cs = computed<PptxTableCellStyle>(() => cell.value?.style ?? {});

const TOGGLES: Array<[keyof PptxTableCellStyle, string]> = [
	['bold', 'B'],
	['italic', 'I'],
	['underline', 'U'],
];
const H_ALIGN: Array<['left' | 'center' | 'right', string]> = [
	['left', 'L'],
	['center', 'C'],
	['right', 'R'],
];
const V_ALIGN: Array<['top' | 'middle' | 'bottom', string]> = [
	['top', 'T'],
	['middle', 'M'],
	['bottom', 'B'],
];
const EDGE_BORDERS: Array<[string, keyof PptxTableCellStyle, keyof PptxTableCellStyle]> = [
	['pptx.table.borderTop', 'borderTopColor', 'borderTopWidth'],
	['pptx.table.borderBottom', 'borderBottomColor', 'borderBottomWidth'],
	['pptx.table.borderLeft', 'borderLeftColor', 'borderLeftWidth'],
	['pptx.table.borderRight', 'borderRightColor', 'borderRightWidth'],
];
const DIAG_BORDERS: Array<[string, keyof PptxTableCellStyle, keyof PptxTableCellStyle]> = [
	['pptx.table.borderDiagDown', 'borderDiagDownColor', 'borderDiagDownWidth'],
	['pptx.table.borderDiagUp', 'borderDiagUpColor', 'borderDiagUpWidth'],
];

/** Fallback a possibly-missing hex to a default so the colour swatch shows. */
function hex(value: string | undefined, fallback: string): string {
	return typeof value === 'string' && /^#(?<hex>[0-9a-f]{3}|[0-9a-f]{6})$/iu.test(value)
		? value
		: fallback;
}

function updateCellStyle(updates: Partial<PptxTableCellStyle>): void {
	const newRows = props.tableData.rows.map((row, ri) => {
		if (ri !== props.rowIndex) {
			return row;
		}
		return {
			...row,
			cells: row.cells.map((c, ci) =>
				ci !== props.columnIndex ? c : { ...c, style: { ...cs.value, ...updates } },
			),
		};
	});
	emit('update', { rows: newRows });
}

function mergeRight(): void {
	const rows = computeMergeCellRight(props.tableData, props.rowIndex, props.columnIndex);
	if (rows) {
		emit('update', { rows });
	}
}

function mergeDown(): void {
	const rows = computeMergeCellDown(props.tableData, props.rowIndex, props.columnIndex);
	if (rows) {
		emit('update', { rows });
	}
}

function split(): void {
	const rows = computeSplitCell(props.tableData, props.rowIndex, props.columnIndex);
	if (rows) {
		emit('update', { rows });
	}
}
</script>

<template>
	<div v-if="cell" class="flex flex-col gap-2">
		<div class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
			{{ t('pptx.table.cell', { row: rowIndex + 1, col: columnIndex + 1 }) }}
		</div>

		<label class="flex items-center gap-2 text-[11px]">
			<span class="w-14 text-muted-foreground">{{ t('pptx.table.fontSize') }}</span>
			<input
				type="number"
				class="flex-1 rounded border border-border bg-muted px-1.5 py-0.5 text-[11px]"
				:disabled="!canEdit"
				min="6"
				max="200"
				:value="cs.fontSize ?? 14"
				@input="updateCellStyle({ fontSize: Number(($event.target as HTMLInputElement).value) })"
			/>
		</label>

		<div class="grid grid-cols-2 gap-1.5">
			<label class="flex flex-col gap-1">
				<span class="text-[11px] text-muted-foreground">{{ t('pptx.table.color') }}</span>
				<DebouncedColorInput
					:value="hex(cs.color, '#000000')"
					:disabled="!canEdit"
					:aria-label="t('pptx.tableCell.textColorAria')"
					@commit="updateCellStyle({ color: $event })"
				/>
			</label>
			<label class="flex flex-col gap-1">
				<span class="text-[11px] text-muted-foreground">{{ t('pptx.table.background') }}</span>
				<DebouncedColorInput
					:value="hex(cs.backgroundColor, '#ffffff')"
					:disabled="!canEdit"
					:aria-label="t('pptx.tableCell.backgroundColorAria')"
					@commit="updateCellStyle({ backgroundColor: $event })"
				/>
			</label>
		</div>

		<TableCellAdvancedFill :cell-style="cs" :can-edit="canEdit" @update="updateCellStyle" />

		<div class="flex gap-1">
			<button
				v-for="[key, label] in TOGGLES"
				:key="key"
				type="button"
				class="rounded px-2 py-1 text-[11px] transition-colors disabled:opacity-50"
				:class="cs[key] ? 'bg-primary text-white' : 'bg-muted hover:bg-accent'"
				:disabled="!canEdit"
				@click="updateCellStyle({ [key]: !cs[key] })"
			>
				{{ label }}
			</button>
		</div>

		<div class="flex gap-1">
			<button
				v-for="[val, label] in H_ALIGN"
				:key="val"
				type="button"
				class="rounded px-2 py-1 text-[11px] transition-colors disabled:opacity-50"
				:class="cs.align === val ? 'bg-primary text-white' : 'bg-muted hover:bg-accent'"
				:disabled="!canEdit"
				@click="updateCellStyle({ align: val })"
			>
				{{ label }}
			</button>
		</div>

		<div class="flex gap-1">
			<button
				v-for="[val, label] in V_ALIGN"
				:key="val"
				type="button"
				class="rounded px-2 py-1 text-[11px] transition-colors disabled:opacity-50"
				:class="cs.vAlign === val ? 'bg-primary text-white' : 'bg-muted hover:bg-accent'"
				:disabled="!canEdit"
				@click="updateCellStyle({ vAlign: val })"
			>
				{{ label }}
			</button>
		</div>

		<div class="flex flex-col gap-1.5">
			<span class="text-[11px] text-muted-foreground">{{ t('pptx.table.cellBorders') }}</span>
			<div class="grid grid-cols-2 gap-1.5">
				<div
					v-for="[edge, colorKey, widthKey] in [...EDGE_BORDERS, ...DIAG_BORDERS]"
					:key="edge"
					class="flex flex-col gap-0.5"
				>
					<span class="text-[10px] text-muted-foreground">{{ t(edge) }}</span>
					<div class="flex items-center gap-1">
						<DebouncedColorInput
							:value="hex(cs[colorKey] as string | undefined, '#374151')"
							:disabled="!canEdit"
							:aria-label="t('pptx.tableCell.edgeBorderColorAria', { edge: t(edge) })"
							@commit="updateCellStyle({ [colorKey]: $event })"
						/>
						<input
							type="number"
							class="w-14 rounded border border-border bg-muted px-1.5 py-0.5 text-[11px]"
							:disabled="!canEdit"
							min="0"
							max="10"
							:value="(cs[widthKey] as number | undefined) ?? 1"
							@input="
								updateCellStyle({ [widthKey]: Number(($event.target as HTMLInputElement).value) })
							"
						/>
					</div>
				</div>
			</div>
		</div>

		<div class="grid grid-cols-3 gap-1">
			<button
				type="button"
				class="rounded border border-border bg-muted px-2 py-1 text-center text-[11px] hover:bg-accent disabled:opacity-50"
				:disabled="!canEdit"
				@click="mergeRight"
			>
				{{ t('pptx.table.mergeRight') }}
			</button>
			<button
				type="button"
				class="rounded border border-border bg-muted px-2 py-1 text-center text-[11px] hover:bg-accent disabled:opacity-50"
				:disabled="!canEdit"
				@click="mergeDown"
			>
				{{ t('pptx.table.mergeDown') }}
			</button>
			<button
				type="button"
				class="rounded border border-border bg-muted px-2 py-1 text-center text-[11px] hover:bg-accent disabled:opacity-50"
				:disabled="!canEdit"
				@click="split"
			>
				{{ t('pptx.table.split') }}
			</button>
		</div>
	</div>
</template>
