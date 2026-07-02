<script setup lang="ts">
import type { PptxChartMarkerSymbol, PptxChartSeries, PptxChartType } from 'pptx-viewer-core';
import { MARKER_SUPPORTED_TYPES, MARKER_SYMBOL_OPTIONS } from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import type { ChartMarkerEdit } from '../../composables/useChartEditing';

/**
 * ChartMarkerOptions: per-series marker symbol/size/fill for line/scatter/
 * bubble/radar charts. Mirrors React's `ChartMarkerOptions`. Emits
 * `setMarker(index, edit)` where `null` removes the marker.
 */
const props = defineProps<{
	chartType: PptxChartType;
	series: readonly PptxChartSeries[];
}>();

const emit = defineEmits<{
	setMarker: [index: number, marker: ChartMarkerEdit | null];
}>();

const { t } = useI18n();

const visible = computed(
	() => MARKER_SUPPORTED_TYPES.has(props.chartType) && props.series.length > 0,
);

function onSymbol(event: Event, index: number): void {
	const value = (event.target as HTMLSelectElement).value;
	if (value === '') {
		emit('setMarker', index, null);
		return;
	}
	emit('setMarker', index, { symbol: value as PptxChartMarkerSymbol });
}

function onSize(event: Event, index: number): void {
	const num = Number.parseInt((event.target as HTMLInputElement).value, 10);
	emit('setMarker', index, { size: Number.isFinite(num) ? num : undefined });
}

function onFill(event: Event, index: number): void {
	emit('setMarker', index, { fillColor: (event.target as HTMLInputElement).value });
}
</script>

<template>
	<div
		v-if="visible"
		class="pptx-vue-chart-card rounded border border-border bg-card p-2 space-y-2"
	>
		<div class="pptx-vue-chart-heading text-[11px] uppercase tracking-wide text-muted-foreground">
			{{ t('pptx.chart.markers') }}
		</div>
		<div class="space-y-2">
			<div v-for="(s, i) in props.series" :key="`${s.name}-${i}`" class="space-y-1">
				<div class="flex items-center gap-2 text-[11px]">
					<span class="flex-1 truncate" :title="s.name">{{ s.name }}</span>
					<select
						class="pptx-vue-chart-input flex-1 bg-muted border border-border rounded px-1.5 py-0.5 w-full"
						data-testid="chart-marker-symbol"
						:value="s.marker?.symbol ?? ''"
						@change="onSymbol($event, i)"
					>
						<option v-for="opt in MARKER_SYMBOL_OPTIONS" :key="opt.value" :value="opt.value">
							{{ opt.label }}
						</option>
					</select>
				</div>

				<div v-if="s.marker && s.marker.symbol !== 'none'" class="flex items-center gap-3 ml-2">
					<label class="flex items-center gap-1 text-[11px]">
						<span class="text-muted-foreground">{{ t('pptx.chart.markerSize') }}</span>
						<input
							type="number"
							min="2"
							max="72"
							data-testid="chart-marker-size"
							class="w-14 bg-muted border border-border rounded px-1.5 py-0.5"
							:value="s.marker.size ?? ''"
							:placeholder="t('pptx.chart.auto')"
							@input="onSize($event, i)"
						/>
					</label>
					<label class="flex items-center gap-1 text-[11px]">
						<span class="text-muted-foreground">{{ t('pptx.chart.markerFill') }}</span>
						<input
							type="color"
							data-testid="chart-marker-fill"
							class="h-6 w-8 cursor-pointer rounded border border-border bg-transparent"
							:value="s.marker.spPr?.fillColor ?? '#4472c4'"
							@input="onFill($event, i)"
						/>
					</label>
				</div>
			</div>
		</div>
	</div>
</template>
