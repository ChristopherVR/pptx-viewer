<script setup lang="ts">
import { formatIsoDate as formatDate } from 'pptx-viewer-shared';
import { computed } from 'vue';

import type { DocumentStatistics } from '../composables/useDocumentStatistics';

/**
 * DocumentPropertiesStatisticsTab: read-only computed statistics.
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
	<div class="pptx-vue-docprops-stats flex flex-col gap-2">
		<div
			v-for="row in rows"
			:key="row.label"
			class="pptx-vue-docprops-stat-row flex items-center justify-between gap-3 text-[0.8125rem]"
		>
			<span class="pptx-vue-docprops-stat-label text-muted-foreground">{{ row.label }}</span>
			<span class="pptx-vue-docprops-stat-value tabular-nums text-foreground">{{ row.value }}</span>
		</div>
	</div>
</template>
