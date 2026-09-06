<script setup lang="ts">
import { X } from 'lucide-vue-next';
import type { PptxChartSeries } from 'pptx-viewer-core';
import { useI18n } from 'vue-i18n';

import { injectRecentColors } from '../../composables/recent-colors-context';
import { useDebouncedCallback } from '../../composables/useDebouncedCallback';

/**
 * ChartSeriesColorOptions: per-series colour swatch + clear button. Split out
 * of `ChartPanel.vue` to keep that file under the repo's 300-LOC guideline;
 * mirrors the delimited "series colour" block React keeps in
 * `ChartDataPanel.tsx`/`ChartSeriesColorOptions.tsx`.
 *
 * Colour commits are debounced (~180ms) here so dragging through the native
 * colour picker collapses into one history-friendly `setColor` emit.
 */
const props = defineProps<{
	series: readonly PptxChartSeries[];
}>();

const emit = defineEmits<{
	setColor: [index: number, color: string];
	clearColor: [index: number];
}>();

const { t } = useI18n();
const recentColors = injectRecentColors();

const DEFAULT_SERIES_COLOR = '#4472c4';

const commitColor = useDebouncedCallback(
	(index: number, color: string) => emit('setColor', index, color),
	180,
);

function onInput(event: Event, index: number): void {
	commitColor(index, (event.target as HTMLInputElement).value);
}

function onCommit(event: Event): void {
	recentColors?.push((event.target as HTMLInputElement).value);
}

function onClear(index: number): void {
	commitColor.cancel();
	emit('clearColor', index);
}
</script>

<template>
	<div v-if="series.length > 0" class="pptx-vue-chart-field flex flex-col gap-1">
		<span class="pptx-vue-chart-label font-semibold text-muted-foreground">{{
			t('pptx.chart.seriesColors')
		}}</span>
		<div
			v-for="(s, si) in series"
			:key="`${s.name}-${si}`"
			class="pptx-vue-chart-series-color flex items-center gap-2"
		>
			<span class="flex-1 truncate" :title="s.name">{{ s.name }}</span>
			<input
				type="color"
				class="pptx-vue-chart-swatch h-6 w-8 cursor-pointer rounded border border-border bg-muted p-0"
				data-testid="chart-series-color"
				:value="s.color || DEFAULT_SERIES_COLOR"
				:aria-label="t('pptx.chart.seriesColor', { name: s.name })"
				@input="onInput($event, si)"
				@change="onCommit"
			/>
			<button
				v-if="s.color"
				type="button"
				class="pptx-vue-chart-clear text-muted-foreground hover:text-red-400 shrink-0"
				:title="t('pptx.chart.clearSeriesColor')"
				@click="onClear(si)"
			>
				<X class="w-3 h-3" aria-hidden="true" />
			</button>
		</div>
	</div>
</template>
