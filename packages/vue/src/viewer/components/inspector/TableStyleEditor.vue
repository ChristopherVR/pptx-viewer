<script setup lang="ts">
import type { ParsedTableStyleMap } from 'pptx-viewer-core';
import {
	addTableStyleToMap,
	createTableStyleEntry,
	deleteTableStyleFromMap,
	normalizeTableStyleGuid,
} from 'pptx-viewer-core';
import type { TableStyleEditorFieldEdit, TableStyleEditorPartId } from 'pptx-viewer-shared';
import {
	applyTableStyleFieldEdit,
	describeTableStyleEditor,
	TABLE_STYLE_EDITOR_PARTS,
} from 'pptx-viewer-shared';
import { computed, ref, toRaw } from 'vue';
import { useI18n } from 'vue-i18n';

import { injectThemeColorMap } from '../../composables/theme-color-map-context';
import TableStyleEditorFields from './TableStyleEditorFields.vue';

/**
 * "Edit style..." panel for a table style's own DEFINITION (`a:tblStyleLst`
 * section fill/text/borders/cell3D), distinct from `TableStyleOptions.vue`'s
 * "which style does this table use" picker. Vue port of React's
 * `TableStyleEditor.tsx`.
 */
const props = defineProps<{
	styleMap: ParsedTableStyleMap | undefined;
	/** The style currently assigned to the table being edited. */
	styleId: string | undefined;
	canEdit: boolean;
}>();

const emit = defineEmits<{
	/** Commit a full replacement style map (section edit, create, or delete already applied). */
	styleMapChange: [nextMap: ParsedTableStyleMap];
	/** Record a styleId for save-time removal from `ppt/tableStyles.xml`. */
	deleteStyle: [styleId: string];
	/** A newly-created style, for a parent that wants to assign it to the table. */
	assignStyle: [styleId: string];
	close: [];
}>();

const { t } = useI18n();
const themeColorMap = injectThemeColorMap();

const activeStyleId = ref(props.styleId ? normalizeTableStyleGuid(props.styleId) : '');
const selectedPart = ref<TableStyleEditorPartId>('wholeTbl');

/**
 * `toRaw` on the (Vue-reactive) prop map: `createTableStyleEntry` deep-clones
 * `basedOn` with `structuredClone`, which throws on a Vue reactive Proxy
 * (`DataCloneError`). Reading through the raw map also returns raw, unproxied
 * entries, so every downstream core/shared call below gets plain objects.
 */
const rawStyleMap = computed(() => (props.styleMap ? toRaw(props.styleMap) : undefined));
const entry = computed(() =>
	activeStyleId.value ? rawStyleMap.value?.[activeStyleId.value] : undefined,
);
const descriptor = computed(() =>
	describeTableStyleEditor(entry.value, selectedPart.value, themeColorMap?.value),
);

function onFieldEdit(fieldEdit: TableStyleEditorFieldEdit): void {
	if (!entry.value || !rawStyleMap.value) {
		return;
	}
	const { entry: nextEntry } = applyTableStyleFieldEdit(entry.value, selectedPart.value, fieldEdit);
	emit('styleMapChange', { ...rawStyleMap.value, [nextEntry.styleId]: nextEntry });
}

function createFromCurrent(): void {
	const name = window.prompt(
		t('pptx.tableStyleEditor.newStyleNamePrompt'),
		entry.value ? `${entry.value.styleName ?? ''} Copy`.trim() : '',
	);
	if (!name) {
		return;
	}
	const nextMap: ParsedTableStyleMap = { ...(rawStyleMap.value ?? {}) };
	const created = createTableStyleEntry(nextMap, { styleName: name, basedOn: entry.value });
	addTableStyleToMap(nextMap, created);
	emit('styleMapChange', nextMap);
	activeStyleId.value = created.styleId;
	emit('assignStyle', created.styleId);
}

function handleDelete(): void {
	if (
		!entry.value ||
		!rawStyleMap.value ||
		!window.confirm(t('pptx.tableStyleEditor.deleteConfirm'))
	) {
		return;
	}
	const nextMap: ParsedTableStyleMap = { ...rawStyleMap.value };
	deleteTableStyleFromMap(nextMap, entry.value.styleId);
	emit('styleMapChange', nextMap);
	emit('deleteStyle', entry.value.styleId);
	emit('close');
}
</script>

<template>
	<div class="rounded border border-border bg-card p-2 space-y-2" data-testid="table-style-editor">
		<div class="flex items-center justify-between">
			<div class="text-[11px] uppercase tracking-wide text-muted-foreground">
				{{ t('pptx.tableStyleEditor.title') }}
			</div>
			<button
				type="button"
				class="rounded bg-muted hover:bg-accent px-2 py-1 text-[11px] transition-colors"
				@click="emit('close')"
			>
				{{ t('pptx.tableStyleEditor.close') }}
			</button>
		</div>

		<div v-if="!entry" class="text-[11px] text-muted-foreground">
			{{ t('pptx.tableStyleEditor.noStyleSelected') }}
		</div>

		<div v-if="entry" class="flex flex-wrap gap-1">
			<button
				v-for="part in TABLE_STYLE_EDITOR_PARTS"
				:key="part.id"
				type="button"
				:disabled="!canEdit"
				class="rounded px-2 py-1 text-[11px] transition-colors"
				:class="selectedPart === part.id ? 'bg-accent' : 'bg-muted hover:bg-accent'"
				@click="selectedPart = part.id"
			>
				{{ t(part.labelKey) }}
			</button>
		</div>

		<TableStyleEditorFields
			v-if="descriptor"
			:descriptor="descriptor"
			:can-edit="canEdit"
			@edit="onFieldEdit"
		/>

		<div class="flex gap-1.5 pt-1 border-t border-border">
			<button
				type="button"
				class="rounded bg-muted hover:bg-accent px-2 py-1 text-[11px] transition-colors"
				:disabled="!canEdit"
				@click="createFromCurrent"
			>
				{{
					entry ? t('pptx.tableStyleEditor.newFromCurrent') : t('pptx.tableStyleEditor.newStyle')
				}}
			</button>
			<button
				v-if="entry"
				type="button"
				class="rounded bg-muted hover:bg-accent px-2 py-1 text-[11px] transition-colors"
				:disabled="!canEdit"
				@click="handleDelete"
			>
				{{ t('pptx.tableStyleEditor.deleteStyle') }}
			</button>
		</div>
	</div>
</template>
