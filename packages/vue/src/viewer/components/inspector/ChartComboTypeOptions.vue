<script setup lang="ts">
import type { PptxChartSeries, PptxChartType } from 'pptx-viewer-core';
import { COMBO_SERIES_TYPE_OPTIONS, COMBO_SUPPORTED_TYPES } from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

/**
 * ChartComboTypeOptions: per-series chart-type override for combo charts.
 * Mirrors React's `ChartComboTypeOptions`. Emits `setSeriesType(index, type)`
 * where `null` reverts the series to the chart-level type.
 */
const props = defineProps<{
	chartType: PptxChartType;
	series: readonly PptxChartSeries[];
}>();

const emit = defineEmits<{
	setSeriesType: [index: number, seriesType: PptxChartType | null];
}>();

const { t } = useI18n();

const visible = computed(
	() => COMBO_SUPPORTED_TYPES.has(props.chartType) && props.series.length >= 2,
);

function onChange(event: Event, index: number): void {
	const value = (event.target as HTMLSelectElement).value;
	emit('setSeriesType', index, value === '' ? null : (value as PptxChartType));
}
</script>

<template>
	<div
		v-if="visible"
		class="pptx-vue-chart-card rounded border border-border bg-card p-2 space-y-2"
	>
		<div class="pptx-vue-chart-heading text-[11px] uppercase tracking-wide text-muted-foreground">
			{{ t('pptx.chart.comboTypes') }}
		</div>
		<div class="space-y-1.5">
			<div
				v-for="(s, i) in props.series"
				:key="`${s.name}-${i}`"
				class="flex items-center gap-2 text-[11px]"
			>
				<span class="flex-1 truncate" :title="s.name">{{ s.name }}</span>
				<select
					class="pptx-vue-chart-input flex-1 bg-muted border border-border rounded px-1.5 py-0.5 w-full"
					data-testid="chart-combo-type"
					:value="s.seriesChartType ?? ''"
					@change="onChange($event, i)"
				>
					<option v-for="opt in COMBO_SERIES_TYPE_OPTIONS" :key="opt.value" :value="opt.value">
						{{ t(opt.labelKey) }}
					</option>
				</select>
			</div>
		</div>
	</div>
</template>
