<script setup lang="ts">
/**
 * NotesMasterPanel - settings/summary panel for the notes master.
 *
 * Vue port of the React `NotesMasterPanel.tsx`. Read-only: shows the notes
 * master background swatch and the list of its placeholders. Purely
 * presentational: no emits (the React panel had none either).
 *
 * Props : `{ notesMaster: PptxNotesMaster | undefined }`
 */
import type { PptxNotesMaster } from 'pptx-viewer-core';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
	notesMaster: PptxNotesMaster | undefined;
}>();
const emit = defineEmits<{ 'background-change': [color: string] }>();

const { t } = useI18n();

const placeholderLabelKeys: Record<string, string> = {
	body: 'pptx.notesMaster.phNotesBody',
	sldImg: 'pptx.notesMaster.phSlideImage',
	hdr: 'pptx.field.header',
	ftr: 'pptx.field.footer',
	dt: 'pptx.notesMaster.phDate',
	sldNum: 'pptx.notesMaster.phPageNumber',
};

interface PlaceholderLabel {
	type: string;
	idx?: string;
	label: string;
}

const placeholderLabels = computed<PlaceholderLabel[]>(() => {
	const placeholders = props.notesMaster?.placeholders;
	if (!placeholders) {
		return [];
	}
	return placeholders.map((ph) => ({
		type: ph.type,
		idx: ph.idx,
		label: placeholderLabelKeys[ph.type] ? t(placeholderLabelKeys[ph.type]!) : ph.type,
	}));
});
</script>

<template>
	<div
		v-if="!notesMaster"
		class="pptx-vue-notes-master-panel__empty"
		data-testid="notes-master-panel-empty"
	>
		{{ t('pptx.notesMaster.empty') }}
	</div>

	<div v-else class="pptx-vue-notes-master-panel">
		<section class="pptx-vue-notes-master-panel__card">
			<div class="pptx-vue-notes-master-panel__heading">{{ t('pptx.notesMaster.background') }}</div>
			<input
				type="color"
				:aria-label="t('pptx.master.backgroundColorLabel')"
				class="pptx-vue-notes-master-panel__swatch"
				data-testid="notes-master-bg-swatch"
				:value="notesMaster.backgroundColor ?? '#ffffff'"
				@input="emit('background-change', ($event.target as HTMLInputElement).value)"
			/>
		</section>

		<section class="pptx-vue-notes-master-panel__card">
			<div class="pptx-vue-notes-master-panel__heading">
				{{ t('pptx.notesMaster.placeholders') }}
			</div>
			<div v-if="placeholderLabels.length > 0" class="pptx-vue-notes-master-panel__list">
				<div
					v-for="ph in placeholderLabels"
					:key="`${ph.type}-${ph.idx ?? 'default'}`"
					class="pptx-vue-notes-master-panel__row"
					data-testid="notes-master-placeholder"
				>
					<span class="pptx-vue-notes-master-panel__dot pptx-vue-notes-master-panel__dot--notes" />
					{{ ph.label }}
				</div>
			</div>
			<div v-else class="pptx-vue-notes-master-panel__muted">
				{{ t('pptx.notesMaster.noPlaceholders') }}
			</div>
		</section>
	</div>
</template>

<style scoped>
.pptx-vue-notes-master-panel {
	display: flex;
	flex-direction: column;
	gap: 8px;
	padding: 0 4px;
}

.pptx-vue-notes-master-panel__empty {
	padding: 16px 8px;
	text-align: center;
	font-size: 12px;
	color: var(--pptx-vue-muted-foreground, #6b7280);
}

.pptx-vue-notes-master-panel__card {
	border: 1px solid var(--pptx-vue-border, #e5e7eb);
	border-radius: 6px;
	padding: 8px;
	background: rgba(0, 0, 0, 0.02);
}

.pptx-vue-notes-master-panel__heading {
	margin-bottom: 6px;
	font-size: 10px;
	color: var(--pptx-vue-muted-foreground, #6b7280);
}

.pptx-vue-notes-master-panel__swatch {
	width: 100%;
	height: 32px;
	border: 1px solid var(--pptx-vue-border, #e5e7eb);
	border-radius: 4px;
}

.pptx-vue-notes-master-panel__list {
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.pptx-vue-notes-master-panel__row {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 4px 6px;
	border-radius: 4px;
	background: rgba(0, 0, 0, 0.03);
	font-size: 10px;
	color: var(--pptx-vue-foreground, #111827);
}

.pptx-vue-notes-master-panel__dot {
	flex-shrink: 0;
	width: 8px;
	height: 8px;
	border-radius: 9999px;
}

.pptx-vue-notes-master-panel__dot--notes {
	background: rgba(34, 197, 94, 0.6);
}

.pptx-vue-notes-master-panel__muted {
	font-size: 10px;
	color: var(--pptx-vue-muted-foreground, #6b7280);
}
</style>
