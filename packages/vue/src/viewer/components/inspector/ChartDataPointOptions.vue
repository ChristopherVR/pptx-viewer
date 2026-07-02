<script setup lang="ts">
import type { PptxChartDataPoint, PptxChartSeries, PptxChartType } from 'pptx-viewer-core';
import { EXPLOSION_SUPPORTED_TYPES } from 'pptx-viewer-shared';
import { computed, ref } from 'vue';

/**
 * ChartDataPointOptions: per-data-point fill override + pie/doughnut slice
 * explosion, targeting one series at a time. Mirrors React's
 * `ChartDataPointOptions`. Emits `setPointFill` / `setPointExplosion`.
 */
const props = defineProps<{
	chartType: PptxChartType;
	categories: readonly string[];
	series: readonly PptxChartSeries[];
}>();

const emit = defineEmits<{
	setPointFill: [seriesIndex: number, pointIndex: number, color: string | null];
	setPointExplosion: [seriesIndex: number, pointIndex: number, explosion: number | null];
	setPointLabel: [seriesIndex: number, pointIndex: number, text: string | null];
}>();

const seriesIndex = ref(0);

const visible = computed(() => props.series.length > 0 && props.categories.length > 0);

const activeIndex = computed(() => Math.min(seriesIndex.value, props.series.length - 1));
const activeSeries = computed<PptxChartSeries | undefined>(() => props.series[activeIndex.value]);
const showExplosion = computed(() => EXPLOSION_SUPPORTED_TYPES.has(props.chartType));

function pointFor(idx: number): PptxChartDataPoint | undefined {
	return activeSeries.value?.dataPoints?.find((p) => p.idx === idx);
}

function labelFor(idx: number): string {
	return activeSeries.value?.dataLabels?.find((l) => l.idx === idx)?.text ?? '';
}

function onLabel(event: Event, idx: number): void {
	const raw = (event.target as HTMLInputElement).value;
	emit('setPointLabel', activeIndex.value, idx, raw === '' ? null : raw);
}

function onSeriesPick(event: Event): void {
	seriesIndex.value = Number.parseInt((event.target as HTMLSelectElement).value, 10);
}

function onFill(event: Event, idx: number): void {
	emit('setPointFill', activeIndex.value, idx, (event.target as HTMLInputElement).value);
}

function onClearFill(idx: number): void {
	emit('setPointFill', activeIndex.value, idx, null);
}

function onExplosion(event: Event, idx: number): void {
	const raw = (event.target as HTMLInputElement).value;
	if (raw === '') {
		emit('setPointExplosion', activeIndex.value, idx, null);
		return;
	}
	const num = Number.parseInt(raw, 10);
	if (Number.isFinite(num)) {
		emit('setPointExplosion', activeIndex.value, idx, num);
	}
}
</script>

<template>
	<div
		v-if="visible"
		class="pptx-vue-chart-card rounded border border-border bg-card p-2 space-y-2"
	>
		<div class="pptx-vue-chart-heading text-[11px] uppercase tracking-wide text-muted-foreground">
			Data points
		</div>

		<label v-if="props.series.length > 1" class="flex items-center gap-2 text-[11px]">
			<span class="w-12 text-muted-foreground shrink-0">Series</span>
			<select
				class="pptx-vue-chart-input flex-1 bg-muted border border-border rounded px-1.5 py-0.5 w-full"
				data-testid="chart-point-series"
				:value="activeIndex"
				@change="onSeriesPick"
			>
				<option v-for="(s, i) in props.series" :key="`${s.name}-${i}`" :value="i">
					{{ s.name }}
				</option>
			</select>
		</label>

		<div class="space-y-1.5">
			<div
				v-for="(cat, idx) in props.categories"
				:key="`${cat}-${idx}`"
				class="flex items-center gap-2 text-[11px]"
			>
				<span class="flex-1 truncate" :title="cat">{{ cat }}</span>

				<input
					type="text"
					data-testid="chart-point-label"
					class="w-20 bg-muted border border-border rounded px-1.5 py-0.5 text-[11px]"
					:value="labelFor(idx)"
					placeholder="Auto"
					title="Label text"
					@input="onLabel($event, idx)"
				/>

				<input
					type="color"
					data-testid="chart-point-fill"
					class="h-6 w-8 cursor-pointer rounded border border-border bg-transparent"
					:value="pointFor(idx)?.spPr?.fillColor ?? activeSeries?.color ?? '#4472c4'"
					@input="onFill($event, idx)"
				/>
				<button
					v-if="pointFor(idx)?.spPr?.fillColor"
					type="button"
					data-testid="chart-point-fill-clear"
					class="text-muted-foreground hover:text-foreground"
					title="Clear point fill"
					@click="onClearFill(idx)"
				>
					&times;
				</button>

				<input
					v-if="showExplosion"
					type="number"
					min="0"
					max="100"
					data-testid="chart-point-explosion"
					class="w-14 bg-muted border border-border rounded px-1.5 py-0.5"
					:value="pointFor(idx)?.explosion ?? ''"
					placeholder="0"
					title="Slice explosion"
					@input="onExplosion($event, idx)"
				/>
			</div>
		</div>
	</div>
</template>
