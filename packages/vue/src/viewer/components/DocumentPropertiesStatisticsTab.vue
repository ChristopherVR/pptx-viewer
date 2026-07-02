<script setup lang="ts">
import { formatIsoDate as formatDate } from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

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

const { t } = useI18n();

interface StatRow {
	labelKey: string;
	value: string;
}

const rows = computed<StatRow[]>(() => {
	const s = props.statistics;
	return [
		{ labelKey: 'pptx.documentProperties.statistics.created', value: formatDate(s.created) },
		{ labelKey: 'pptx.documentProperties.statistics.modified', value: formatDate(s.modified) },
		{
			labelKey: 'pptx.documentProperties.statistics.lastModifiedBy',
			value: s.lastModifiedBy ?? '—',
		},
		{ labelKey: 'pptx.documentProperties.statistics.revision', value: s.revision ?? '—' },
		{ labelKey: 'pptx.documentProperties.statistics.slides', value: String(s.slideCount) },
		{
			labelKey: 'pptx.documentProperties.statistics.hiddenSlides',
			value: String(s.hiddenSlideCount),
		},
		{ labelKey: 'pptx.documentProperties.statistics.notes', value: String(s.noteCount) },
		{ labelKey: 'pptx.documentProperties.statistics.elements', value: String(s.elementCount) },
		{ labelKey: 'pptx.documentProperties.statistics.words', value: String(s.wordCount) },
		{ labelKey: 'pptx.documentProperties.statistics.paragraphs', value: String(s.paragraphCount) },
	];
});
</script>

<template>
	<div class="pptx-vue-docprops-stats flex flex-col gap-2">
		<div
			v-for="row in rows"
			:key="row.labelKey"
			class="pptx-vue-docprops-stat-row flex items-center justify-between gap-3 text-[0.8125rem]"
		>
			<span class="pptx-vue-docprops-stat-label text-muted-foreground">{{ t(row.labelKey) }}</span>
			<span class="pptx-vue-docprops-stat-value tabular-nums text-foreground">{{ row.value }}</span>
		</div>
	</div>
</template>
