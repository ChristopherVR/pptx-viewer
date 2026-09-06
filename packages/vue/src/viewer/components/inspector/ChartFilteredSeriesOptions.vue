<script setup lang="ts">
import { Eye, EyeOff } from 'lucide-vue-next';
import type { PptxChartData } from 'pptx-viewer-core';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

/**
 * ChartFilteredSeriesOptions: PowerPoint's "Chart Filters" series show/hide,
 * plus a per-series editor for the cached label strings behind "Value From
 * Cells" (`c15:datalabelsRange`/`c15:dlblRangeCache`), when a series carries
 * one. Mirrors React's `ChartFilteredSeriesOptions.tsx`; both wrap the pure
 * transforms in `pptx-viewer-shared`'s `chart-ext-editor-actions.ts`.
 */
const props = defineProps<{
	chartData: PptxChartData;
	canEdit: boolean;
}>();

const emit = defineEmits<{
	'hide-series': [seriesIndex: number];
	'restore-series': [filteredIndex: number];
	'set-data-labels-range-cache': [seriesIndex: number, pointIndex: number, text: string];
}>();

const { t } = useI18n();

const filteredSeries = computed(() => props.chartData.filteredSeries ?? []);

const seriesWithRange = computed(() =>
	props.chartData.series
		.map((series, index) => ({ series, index }))
		.filter(({ series }) => series.dataLabelOptions?.dataLabelsRange),
);

const showVisibleRows = computed(() => props.chartData.series.length > 1);

const visible = computed(
	() =>
		filteredSeries.value.length > 0 ||
		seriesWithRange.value.length > 0 ||
		props.chartData.series.length > 1,
);

function filteredName(index: number): string {
	const filtered = filteredSeries.value[index];
	return filtered?.name ?? props.chartData.filteredSeriesTitle ?? t('pptx.chart.seriesShort');
}

function onHide(index: number): void {
	emit('hide-series', index);
}

function onRestore(index: number): void {
	emit('restore-series', index);
}

function onCacheInput(event: Event, seriesIndex: number, pointIndex: number): void {
	emit(
		'set-data-labels-range-cache',
		seriesIndex,
		pointIndex,
		(event.target as HTMLInputElement).value,
	);
}
</script>

<template>
	<div
		v-if="visible"
		class="pptx-vue-chart-card rounded border border-border bg-card p-2 space-y-2"
	>
		<div class="pptx-vue-chart-heading text-[11px] uppercase tracking-wide text-muted-foreground">
			{{ t('pptx.chart.chartFilters') }}
		</div>

		<div v-if="showVisibleRows" class="space-y-1">
			<div
				v-for="(series, index) in chartData.series"
				:key="`visible-${series.name}-${index}`"
				class="flex items-center gap-2 text-[11px]"
			>
				<span class="flex-1 truncate" :title="series.name">{{ series.name }}</span>
				<button
					type="button"
					class="rounded bg-muted hover:bg-accent px-1.5 py-0.5 text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
					:disabled="!canEdit"
					:aria-label="t('pptx.chart.hideSeries', { name: series.name })"
					:data-testid="`chart-series-hide-${index}`"
					@click="onHide(index)"
				>
					<EyeOff class="size-3" aria-hidden="true" />
				</button>
			</div>
		</div>

		<div v-if="filteredSeries.length > 0" class="space-y-1">
			<div
				v-for="(filtered, index) in filteredSeries"
				:key="`filtered-${filteredName(index)}-${index}`"
				class="flex items-center gap-2 text-[11px] opacity-60"
			>
				<span class="flex-1 truncate" :title="filteredName(index)">{{ filteredName(index) }}</span>
				<button
					type="button"
					class="rounded bg-muted hover:bg-accent px-1.5 py-0.5 text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
					:disabled="!canEdit"
					:aria-label="t('pptx.chart.showSeries', { name: filteredName(index) })"
					:data-testid="`chart-series-show-${index}`"
					@click="onRestore(index)"
				>
					<Eye class="size-3" aria-hidden="true" />
				</button>
			</div>
		</div>

		<div
			v-for="{ series, index: seriesIndex } in seriesWithRange"
			:key="`range-${series.name}-${seriesIndex}`"
			class="space-y-1"
		>
			<div class="text-[11px] text-muted-foreground truncate" :title="series.name">
				{{ t('pptx.chart.valueFromCells', { name: series.name }) }}
			</div>
			<label
				v-for="(text, pointIndex) in series.dataLabelOptions!.dataLabelsRange!.cache"
				:key="pointIndex"
				class="flex items-center gap-2 text-[11px]"
			>
				<span class="w-16 shrink-0 truncate text-muted-foreground">{{
					chartData.categories[pointIndex] ?? pointIndex
				}}</span>
				<input
					type="text"
					class="flex-1 bg-muted border border-border rounded px-1.5 py-0.5"
					:disabled="!canEdit"
					:value="text"
					:data-testid="`chart-dlbl-range-${seriesIndex}-${pointIndex}`"
					@input="onCacheInput($event, seriesIndex, pointIndex)"
				/>
			</label>
		</div>
	</div>
</template>
