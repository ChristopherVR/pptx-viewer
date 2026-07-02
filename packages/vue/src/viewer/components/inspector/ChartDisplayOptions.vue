<script setup lang="ts">
import type { PptxChartStyle } from 'pptx-viewer-core';
import { LEGEND_POSITION_OPTIONS } from 'pptx-viewer-shared';
import { useI18n } from 'vue-i18n';

/**
 * ChartDisplayOptions: chart-level display toggles (title / legend visibility +
 * position / gridlines / data-labels master toggle). Mirrors React's
 * `ChartDisplayOptions`. Emits a shallow `PptxChartStyle` patch via `update`.
 */
const props = defineProps<{
	style: PptxChartStyle | undefined;
}>();

const emit = defineEmits<{
	update: [patch: Partial<PptxChartStyle>];
}>();

const { t } = useI18n();

function patch(p: Partial<PptxChartStyle>): void {
	emit('update', p);
}

function onCheckbox(event: Event, key: keyof PptxChartStyle): void {
	patch({ [key]: (event.target as HTMLInputElement).checked } as Partial<PptxChartStyle>);
}

function onLegendPosition(event: Event): void {
	patch({ legendPosition: (event.target as HTMLSelectElement).value });
}
</script>

<template>
	<div class="pptx-vue-chart-card rounded border border-border bg-card p-2 space-y-2">
		<div class="pptx-vue-chart-heading text-[11px] uppercase tracking-wide text-muted-foreground">
			{{ t('pptx.chart.display') }}
		</div>
		<div class="space-y-1.5">
			<label class="flex items-center gap-2 cursor-pointer">
				<input
					type="checkbox"
					data-testid="chart-show-title"
					class="accent-primary"
					:checked="props.style?.hasTitle ?? false"
					@change="onCheckbox($event, 'hasTitle')"
				/>
				<span class="text-[11px]">{{ t('pptx.chart.showTitle') }}</span>
			</label>

			<label class="flex items-center gap-2 cursor-pointer">
				<input
					type="checkbox"
					data-testid="chart-show-legend"
					class="accent-primary"
					:checked="props.style?.hasLegend ?? false"
					@change="onCheckbox($event, 'hasLegend')"
				/>
				<span class="text-[11px]">{{ t('pptx.chart.showLegend') }}</span>
			</label>

			<label v-if="props.style?.hasLegend" class="flex items-center gap-2 text-[11px] ml-4">
				<span class="w-12 text-muted-foreground shrink-0">{{
					t('pptx.chart.legendPosition')
				}}</span>
				<select
					class="pptx-vue-chart-input flex-1 bg-muted border border-border rounded px-1.5 py-0.5 w-full"
					data-testid="chart-legend-position"
					:value="props.style.legendPosition ?? 'b'"
					@change="onLegendPosition"
				>
					<option v-for="opt in LEGEND_POSITION_OPTIONS" :key="opt.value" :value="opt.value">
						{{ opt.label }}
					</option>
				</select>
			</label>

			<label class="flex items-center gap-2 cursor-pointer">
				<input
					type="checkbox"
					data-testid="chart-show-gridlines"
					class="accent-primary"
					:checked="props.style?.hasGridlines ?? false"
					@change="onCheckbox($event, 'hasGridlines')"
				/>
				<span class="text-[11px]">{{ t('pptx.chart.showGridlines') }}</span>
			</label>

			<label class="flex items-center gap-2 cursor-pointer">
				<input
					type="checkbox"
					data-testid="chart-show-data-labels"
					class="accent-primary"
					:checked="props.style?.hasDataLabels ?? false"
					@change="onCheckbox($event, 'hasDataLabels')"
				/>
				<span class="text-[11px]">{{ t('pptx.chart.showDataLabels') }}</span>
			</label>
		</div>
	</div>
</template>
