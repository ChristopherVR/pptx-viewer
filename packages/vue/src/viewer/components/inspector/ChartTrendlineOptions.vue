<script setup lang="ts">
import type { PptxChartSeries, PptxChartTrendline, PptxChartType } from 'pptx-viewer-core';
import { TRENDLINE_SUPPORTED_TYPES, TRENDLINE_TYPE_OPTIONS } from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

/**
 * ChartTrendlineOptions: per-series trendline regression type + equation/R^2
 * display flags. Mirrors React's `ChartTrendlineOptions`. Emits
 * `setTrendline(index, trendline)` where `null` removes the trendline.
 */
const props = defineProps<{
	chartType: PptxChartType;
	series: readonly PptxChartSeries[];
}>();

const emit = defineEmits<{
	setTrendline: [index: number, trendline: PptxChartTrendline | null];
}>();

const { t } = useI18n();

const visible = computed(
	() => TRENDLINE_SUPPORTED_TYPES.has(props.chartType) && props.series.length > 0,
);

function firstTrendline(s: PptxChartSeries): PptxChartTrendline | undefined {
	return s.trendlines?.[0];
}

function onType(event: Event, index: number, current: PptxChartTrendline | undefined): void {
	const value = (event.target as HTMLSelectElement).value;
	if (!value) {
		emit('setTrendline', index, null);
		return;
	}
	emit('setTrendline', index, {
		...current,
		trendlineType: value as PptxChartTrendline['trendlineType'],
	});
}

function onFlag(
	event: Event,
	index: number,
	current: PptxChartTrendline,
	key: 'displayEq' | 'displayRSq',
): void {
	emit('setTrendline', index, { ...current, [key]: (event.target as HTMLInputElement).checked });
}
</script>

<template>
	<div
		v-if="visible"
		class="pptx-vue-chart-card rounded border border-border bg-card p-2 space-y-2"
	>
		<div class="pptx-vue-chart-heading text-[11px] uppercase tracking-wide text-muted-foreground">
			{{ t('pptx.chart.trendlines') }}
		</div>
		<div class="space-y-2">
			<div v-for="(s, i) in props.series" :key="`${s.name}-${i}`" class="space-y-1">
				<div class="flex items-center gap-2 text-[11px]">
					<span class="flex-1 truncate" :title="s.name">{{ s.name }}</span>
					<select
						class="pptx-vue-chart-input flex-1 bg-muted border border-border rounded px-1.5 py-0.5 w-full"
						data-testid="chart-trendline-type"
						:value="firstTrendline(s)?.trendlineType ?? ''"
						@change="onType($event, i, firstTrendline(s))"
					>
						<option v-for="opt in TRENDLINE_TYPE_OPTIONS" :key="opt.value" :value="opt.value">
							{{ opt.label }}
						</option>
					</select>
				</div>

				<div v-if="firstTrendline(s)" class="flex items-center gap-3 ml-2">
					<label class="flex items-center gap-1 text-[11px] cursor-pointer">
						<input
							type="checkbox"
							data-testid="chart-trendline-eq"
							class="accent-primary"
							:checked="firstTrendline(s)?.displayEq ?? false"
							@change="onFlag($event, i, firstTrendline(s)!, 'displayEq')"
						/>
						<span>{{ t('pptx.chart.trendlineEquation') }}</span>
					</label>
					<label class="flex items-center gap-1 text-[11px] cursor-pointer">
						<input
							type="checkbox"
							data-testid="chart-trendline-rsq"
							class="accent-primary"
							:checked="firstTrendline(s)?.displayRSq ?? false"
							@change="onFlag($event, i, firstTrendline(s)!, 'displayRSq')"
						/>
						<span>{{ t('pptx.chart.trendlineRSquared') }}</span>
					</label>
				</div>
			</div>
		</div>
	</div>
</template>
