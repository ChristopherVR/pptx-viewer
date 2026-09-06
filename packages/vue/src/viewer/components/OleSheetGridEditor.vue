<script setup lang="ts">
/**
 * Editable spreadsheet grid for `OleEditorDialog`'s "sheet" content tab.
 * Vue port of React's `OleSheetGridEditor` (`OleEditorDialogTabs.tsx`).
 */
import type { OleSheetGrid } from 'pptx-viewer-core';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
	grid: OleSheetGrid | undefined;
}>();

const emit = defineEmits<{
	(e: 'cellEdit', row: number, col: number, value: string): void;
}>();

const { t } = useI18n();

function onCellBlur(rowIndex: number, colIndex: number, originalValue: string, event: Event): void {
	const value = (event.target as HTMLInputElement).value;
	if (value !== originalValue) {
		emit('cellEdit', rowIndex, colIndex, value);
	}
}
</script>

<template>
	<p v-if="!props.grid || props.grid.rows.length === 0" class="text-xs text-muted-foreground">
		{{ t('pptx.ole.editDialog.emptySheet') }}
	</p>
	<div v-else class="max-h-[50vh] overflow-auto rounded border border-border">
		<table class="w-full border-collapse text-xs">
			<tbody>
				<tr v-for="(row, rowIndex) in props.grid.rows" :key="rowIndex">
					<td
						v-for="(cell, colIndex) in row.cells"
						:key="colIndex"
						class="border border-border p-0"
					>
						<input
							type="text"
							:value="cell.value"
							:aria-label="t('pptx.ole.editDialog.cellEditLabel')"
							class="w-full bg-transparent px-1.5 py-1 focus:bg-accent/40 focus:outline-none"
							@blur="onCellBlur(rowIndex, colIndex, cell.value, $event)"
						/>
					</td>
				</tr>
			</tbody>
		</table>
	</div>
</template>
