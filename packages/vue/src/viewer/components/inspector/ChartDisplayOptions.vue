<script setup lang="ts">
import type { PptxChartData, PptxChartStyle } from 'pptx-viewer-core';
import {
	chartGridlinesPatch,
	chartGridlinesState,
	LEGEND_POSITION_OPTIONS,
} from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

/**
 * ChartDisplayOptions: chart-level display toggles (title / legend visibility +
 * position / gridlines / data-labels master toggle). Mirrors React's
 * `ChartDisplayOptions`. Emits a shallow `PptxChartStyle` patch via `update`
 * for every field except gridlines.
 *
 * Gridlines is the one field that is NOT a `PptxChartStyle` round-trip: every
 * binding used to wire the checkbox straight to `style.hasGridlines`, a field
 * the renderer never actually reads (real gridline visibility comes from the
 * value axis's `c:majorGridlines`), so toggling the checkbox silently did
 * nothing. Shared's `chart-gridlines-toggle.ts` fixes this by reading/writing
 * the primary value axis instead (`style.hasGridlines` stays in sync as a
 * legacy mirror), which needs the full `PptxChartData`, not just `style` - so
 * this component takes `chartData` and emits gridline changes via the separate
 * `update-chart-data` event with a full `Partial<PptxChartData>` patch.
 */
const props = defineProps<{
	chartData: PptxChartData | undefined;
}>();

const emit = defineEmits<{
	update: [patch: Partial<PptxChartStyle>];
	'update-chart-data': [patch: Partial<PptxChartData>];
}>();

const { t } = useI18n();

const style = computed(() => props.chartData?.style);
const gridlinesOn = computed(() =>
	props.chartData ? chartGridlinesState(props.chartData) : (style.value?.hasGridlines ?? false),
);

function patch(p: Partial<PptxChartStyle>): void {
	emit('update', p);
}

function onCheckbox(event: Event, key: keyof PptxChartStyle): void {
	patch({ [key]: (event.target as HTMLInputElement).checked } as Partial<PptxChartStyle>);
}

function onLegendPosition(event: Event): void {
	patch({ legendPosition: (event.target as HTMLSelectElement).value });
}

function onGridlinesToggle(event: Event): void {
	if (!props.chartData) {
		return;
	}
	const checked = (event.target as HTMLInputElement).checked;
	emit('update-chart-data', chartGridlinesPatch(props.chartData, checked));
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
					:checked="style?.hasTitle ?? false"
					@change="onCheckbox($event, 'hasTitle')"
				/>
				<span class="text-[11px]">{{ t('pptx.chart.showTitle') }}</span>
			</label>

			<label class="flex items-center gap-2 cursor-pointer">
				<input
					type="checkbox"
					data-testid="chart-show-legend"
					class="accent-primary"
					:checked="style?.hasLegend ?? false"
					@change="onCheckbox($event, 'hasLegend')"
				/>
				<span class="text-[11px]">{{ t('pptx.chart.showLegend') }}</span>
			</label>

			<label v-if="style?.hasLegend" class="flex items-center gap-2 text-[11px] ml-4">
				<span class="w-12 text-muted-foreground shrink-0">{{
					t('pptx.chart.legendPosition')
				}}</span>
				<select
					:aria-label="t('pptx.chart.legendPosition')"
					class="pptx-vue-chart-input flex-1 bg-muted border border-border rounded px-1.5 py-0.5 w-full"
					data-testid="chart-legend-position"
					:value="style?.legendPosition ?? 'b'"
					@change="onLegendPosition"
				>
					<option v-for="opt in LEGEND_POSITION_OPTIONS" :key="opt.value" :value="opt.value">
						{{ t(opt.labelKey) }}
					</option>
				</select>
			</label>

			<label class="flex items-center gap-2 cursor-pointer">
				<input
					type="checkbox"
					data-testid="chart-show-gridlines"
					class="accent-primary"
					:checked="gridlinesOn"
					@change="onGridlinesToggle"
				/>
				<span class="text-[11px]">{{ t('pptx.chart.showGridlines') }}</span>
			</label>

			<label class="flex items-center gap-2 cursor-pointer">
				<input
					type="checkbox"
					data-testid="chart-show-data-labels"
					class="accent-primary"
					:checked="style?.hasDataLabels ?? false"
					@change="onCheckbox($event, 'hasDataLabels')"
				/>
				<span class="text-[11px]">{{ t('pptx.chart.showDataLabels') }}</span>
			</label>
		</div>
	</div>
</template>
