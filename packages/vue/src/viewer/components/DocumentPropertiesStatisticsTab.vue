<script setup lang="ts">
import { computed } from 'vue';

import type { DocumentStatistics } from '../composables/useDocumentStatistics';

/**
 * DocumentPropertiesStatisticsTab — read-only computed statistics.
 *
 * Vue counterpart of React's `DocumentPropertiesStatisticsTab`, but the counts
 * are computed live from the slide model (see `useDocumentStatistics`) rather
 * than read from the often-stale `docProps/app.xml`. Renders created/modified
 * timestamps, revision, and slide/note/word/paragraph/element counts.
 */
const props = defineProps<{
	/** Computed statistics for the loaded presentation. */
	statistics: DocumentStatistics;
}>();

function formatDate(value: string | undefined): string {
	if (!value) {
		return '—';
	}
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

interface StatRow {
	label: string;
	value: string;
}

const rows = computed<StatRow[]>(() => {
	const s = props.statistics;
	return [
		{ label: 'Created', value: formatDate(s.created) },
		{ label: 'Modified', value: formatDate(s.modified) },
		{ label: 'Last modified by', value: s.lastModifiedBy ?? '—' },
		{ label: 'Revision', value: s.revision ?? '—' },
		{ label: 'Slides', value: String(s.slideCount) },
		{ label: 'Hidden slides', value: String(s.hiddenSlideCount) },
		{ label: 'Notes', value: String(s.noteCount) },
		{ label: 'Elements', value: String(s.elementCount) },
		{ label: 'Words', value: String(s.wordCount) },
		{ label: 'Paragraphs', value: String(s.paragraphCount) },
	];
});
</script>

<template>
	<div class="pptx-vue-docprops-stats">
		<div v-for="row in rows" :key="row.label" class="pptx-vue-docprops-stat-row">
			<span class="pptx-vue-docprops-stat-label">{{ row.label }}</span>
			<span class="pptx-vue-docprops-stat-value">{{ row.value }}</span>
		</div>
	</div>
</template>

<style scoped>
.pptx-vue-docprops-stats {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
}

.pptx-vue-docprops-stat-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.75rem;
	font-size: 0.8125rem;
}

.pptx-vue-docprops-stat-label {
	color: var(--pptx-vue-muted-foreground, #9a9a9a);
}

.pptx-vue-docprops-stat-value {
	color: var(--pptx-vue-foreground, #e5e5e5);
	font-variant-numeric: tabular-nums;
}
</style>
