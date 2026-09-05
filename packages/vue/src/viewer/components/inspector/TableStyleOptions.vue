<script setup lang="ts">
import type { ParsedTableStyleMap, PptxTableData } from 'pptx-viewer-core';
import type { TableInspectorChanges } from 'pptx-viewer-shared';
import {
	applyTableStylePreset,
	TABLE_STYLE_PRESETS,
	tableStyleAssignmentUpdate,
} from 'pptx-viewer-shared';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import TableStyleEditor from './TableStyleEditor.vue';

/**
 * TableStyleOptions: Vue port of the structure/style toggles + quick-style
 * preset grid from React's inspector `TablePropertiesPanel.tsx`. Emits a
 * `Partial<PptxTableData>` patch (banding flags, band cycle counts, or a full
 * re-styled `rows` array) that the parent merges into the element's tableData.
 *
 * `tableStyleMap` is optional/absent when the host has not yet wired the
 * table-style-DEFINITION-editor feature through (see `TableStyleEditor.vue`'s
 * docblock); the "Edit style..." button then simply does not render.
 */
const props = defineProps<{
	tableData: PptxTableData;
	canEdit: boolean;
	tableStyleMap?: ParsedTableStyleMap;
}>();

const emit = defineEmits<{
	update: [patch: Partial<PptxTableData>];
	tableStyleMapChange: [nextMap: ParsedTableStyleMap];
	deleteTableStyle: [styleId: string];
}>();

const showStyleEditor = ref(false);

const { t } = useI18n();

// Keyed to `TableInspectorChanges` (shared `table-inspector.ts`): the
// authoritative set of table-level style flags the inspector may toggle, so an
// addition/removal there is a type error here instead of a silent drift.
const TOGGLES: Array<[keyof TableInspectorChanges, string]> = [
	['bandedRows', 'pptx.table.bandedRows'],
	['firstRowHeader', 'pptx.table.headerRow'],
	['bandedColumns', 'pptx.table.bandedColumns'],
	['firstCol', 'pptx.table.firstColumn'],
	['lastCol', 'pptx.table.lastColumn'],
	['lastRow', 'pptx.table.lastRow'],
];

function toggle(key: keyof TableInspectorChanges, event: Event): void {
	emit('update', { [key]: (event.target as HTMLInputElement).checked });
}

function setCycle(key: 'bandRowCycle' | 'bandColCycle', event: Event): void {
	const value = Math.max(1, parseInt((event.target as HTMLInputElement).value, 10) || 1);
	emit('update', { [key]: value });
}

function applyPreset(preset: (typeof TABLE_STYLE_PRESETS)[number]): void {
	emit('update', { rows: applyTableStylePreset(props.tableData, preset) });
}

/** A newly-created style (from "Edit style...") becomes this table's style. */
function assignStyle(styleId: string): void {
	emit('update', tableStyleAssignmentUpdate(styleId));
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
			<button
				v-if="tableStyleMap !== undefined"
				type="button"
				class="mt-1.5 self-start rounded bg-muted hover:bg-accent px-2 py-1 text-[11px] transition-colors"
				:disabled="!canEdit"
				@click="showStyleEditor = !showStyleEditor"
			>
				{{ t('pptx.tableStyleEditor.editButton') }}
			</button>
		</div>

		<TableStyleEditor
			v-if="showStyleEditor && tableStyleMap !== undefined"
			:style-map="tableStyleMap"
			:style-id="tableData.tableStyleId"
			:can-edit="canEdit"
			@style-map-change="(m) => emit('tableStyleMapChange', m)"
			@delete-style="(id) => emit('deleteTableStyle', id)"
			@assign-style="assignStyle"
			@close="showStyleEditor = false"
		/>
	</div>
</template>
