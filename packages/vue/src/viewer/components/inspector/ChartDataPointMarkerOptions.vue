<script setup lang="ts">
import type {
	PptxChartDataPoint,
	PptxChartMarkerSymbol,
	PptxChartSeries,
	PptxChartType,
} from 'pptx-viewer-core';
import { MARKER_SUPPORTED_TYPES, MARKER_SYMBOL_OPTIONS } from 'pptx-viewer-shared';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import type { ChartMarkerEdit } from '../../composables/useChartEditing';

/**
 * ChartDataPointMarkerOptions: per-data-point marker overrides for line/scatter/
 * bubble/radar charts, targeting one series at a time. Mirrors React's
 * `ChartDataPointMarkerOptions`. Emits `setPointMarker(seriesIndex, pointIndex,
 * edit)` where `null` clears the override.
 */
const props = defineProps<{
	chartType: PptxChartType;
	categories: readonly string[];
	series: readonly PptxChartSeries[];
}>();

const emit = defineEmits<{
	setPointMarker: [seriesIndex: number, pointIndex: number, marker: ChartMarkerEdit | null];
}>();

// Concrete symbols only (drop the '' auto sentinel used by the series picker).
const SYMBOL_OPTIONS = MARKER_SYMBOL_OPTIONS.filter((o) => o.value !== '');

const { t } = useI18n();

const seriesIndex = ref(0);

const visible = computed(
	() =>
		MARKER_SUPPORTED_TYPES.has(props.chartType) &&
		props.series.length > 0 &&
		props.categories.length > 0,
);

const activeIndex = computed(() => Math.min(seriesIndex.value, props.series.length - 1));
const activeSeries = computed<PptxChartSeries | undefined>(() => props.series[activeIndex.value]);

function pointFor(idx: number): PptxChartDataPoint | undefined {
	return activeSeries.value?.dataPoints?.find((p) => p.idx === idx);
}

function onSeriesPick(event: Event): void {
	seriesIndex.value = Number.parseInt((event.target as HTMLSelectElement).value, 10);
}

function onToggle(event: Event, idx: number): void {
	const checked = (event.target as HTMLInputElement).checked;
	emit('setPointMarker', activeIndex.value, idx, checked ? { symbol: 'circle' } : null);
}

function onSymbol(event: Event, idx: number): void {
	emit('setPointMarker', activeIndex.value, idx, {
		symbol: (event.target as HTMLSelectElement).value as PptxChartMarkerSymbol,
	});
}

function onSize(event: Event, idx: number): void {
	const num = Number.parseInt((event.target as HTMLInputElement).value, 10);
	emit('setPointMarker', activeIndex.value, idx, { size: Number.isFinite(num) ? num : undefined });
}

function onFill(event: Event, idx: number): void {
	emit('setPointMarker', activeIndex.value, idx, {
		fillColor: (event.target as HTMLInputElement).value,
	});
}
</script>

<template>
	<div
		v-if="visible"
		class="pptx-vue-chart-card rounded border border-border bg-card p-2 space-y-2"
	>
		<div class="pptx-vue-chart-heading text-[11px] uppercase tracking-wide text-muted-foreground">
			{{ t('pptx.chart.pointMarkers') }}
		</div>

		<label v-if="props.series.length > 1" class="flex items-center gap-2 text-[11px]">
			<span class="w-12 text-muted-foreground shrink-0">{{ t('pptx.chart.series') }}</span>
			<select
				class="pptx-vue-chart-input flex-1 bg-muted border border-border rounded px-1.5 py-0.5 w-full"
				data-testid="chart-point-marker-series"
				:value="activeIndex"
				@change="onSeriesPick"
			>
				<option v-for="(s, i) in props.series" :key="`${s.name}-${i}`" :value="i">
					{{ s.name }}
				</option>
			</select>
		</label>

		<div class="space-y-2">
			<div v-for="(cat, idx) in props.categories" :key="`${cat}-${idx}`" class="space-y-1">
				<div class="flex items-center gap-2 text-[11px]">
					<span class="flex-1 truncate" :title="cat">{{ cat }}</span>
					<label class="flex items-center gap-1 shrink-0">
						<input
							type="checkbox"
							data-testid="chart-point-marker-toggle"
							:checked="pointFor(idx)?.marker !== undefined"
							@change="onToggle($event, idx)"
						/>
						<span class="text-muted-foreground">{{ t('pptx.chart.markerOverride') }}</span>
					</label>
				</div>

				<div v-if="pointFor(idx)?.marker" class="flex items-center gap-2 ml-2 flex-wrap">
					<select
						class="bg-muted border border-border rounded px-1.5 py-0.5 text-[11px]"
						data-testid="chart-point-marker-symbol"
						:value="pointFor(idx)?.marker?.symbol"
						@change="onSymbol($event, idx)"
					>
						<option v-for="opt in SYMBOL_OPTIONS" :key="opt.value" :value="opt.value">
							{{ opt.label }}
						</option>
					</select>
					<input
						type="number"
						min="1"
						max="20"
						data-testid="chart-point-marker-size"
						class="w-14 bg-muted border border-border rounded px-1.5 py-0.5 text-[11px]"
						:value="pointFor(idx)?.marker?.size ?? ''"
						:placeholder="t('pptx.chart.auto')"
						:title="t('pptx.chart.markerSize')"
						@input="onSize($event, idx)"
					/>
					<input
						type="color"
						data-testid="chart-point-marker-fill"
						class="h-6 w-8 cursor-pointer rounded border border-border bg-transparent"
						:value="pointFor(idx)?.marker?.spPr?.fillColor ?? '#4472c4'"
						:title="t('pptx.chart.markerFill')"
						@input="onFill($event, idx)"
					/>
				</div>
			</div>
		</div>
	</div>
</template>
