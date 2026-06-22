<script setup lang="ts">
import type { ChartPptxElement, PptxChartData, PptxChartType, PptxElement } from 'pptx-viewer-core';
import { GROUPING_OPTIONS, GROUPING_SUPPORTED_TYPES, CHART_TYPE_OPTIONS } from 'pptx-viewer-shared';
import { computed } from 'vue';

import { useChartEditing } from '../../composables/useChartEditing';
import ChartAxisOptions from './ChartAxisOptions.vue';
import ChartAxisStyleOptions from './ChartAxisStyleOptions.vue';
import ChartComboTypeOptions from './ChartComboTypeOptions.vue';
import ChartDataLabelOptions from './ChartDataLabelOptions.vue';
import ChartDataPointOptions from './ChartDataPointOptions.vue';
import ChartDisplayOptions from './ChartDisplayOptions.vue';
import ChartErrorBarOptions from './ChartErrorBarOptions.vue';
import ChartMarkerOptions from './ChartMarkerOptions.vue';
import ChartTrendlineOptions from './ChartTrendlineOptions.vue';

/**
 * ChartPanel: inspector panel for chart elements, at full parity with the React
 * chart editor.
 *
 *  - Props: `{ element }`.
 *  - Emits `update` with a SHALLOW `Partial<PptxElement>` patch, always
 *    `{ chartData: <full new chart data> }`, merged via `ops.updateElement`.
 *
 * The SFC stays thin: the type/title/grouping/series-colour controls live
 * inline, while every advanced section is its own subcomponent. All mutation
 * plumbing (clone-mutate-emit, `pptx-viewer-core` SDK ops) lives in the
 * `useChartEditing` composable.
 */
const props = defineProps<{
	element: PptxElement;
}>();

const emit = defineEmits<{
	update: [patch: Partial<PptxElement>];
}>();

const DEFAULT_SERIES_COLOR = '#4472c4';

const isChart = computed(() => props.element.type === 'chart');

const chartElement = computed<ChartPptxElement | null>(() =>
	props.element.type === 'chart' ? (props.element as ChartPptxElement) : null,
);

const chartData = computed<PptxChartData | null>(() => chartElement.value?.chartData ?? null);

const series = computed(() => chartData.value?.series ?? []);
const categories = computed(() => chartData.value?.categories ?? []);
const currentType = computed<PptxChartType | ''>(() => chartData.value?.chartType ?? '');
const currentTitle = computed<string>(() => chartData.value?.title ?? '');
const currentGrouping = computed<string>(() => chartData.value?.grouping ?? 'clustered');

const showGrouping = computed(
	() => chartData.value !== null && GROUPING_SUPPORTED_TYPES.has(chartData.value.chartType),
);

function emitChartData(next: PptxChartData): void {
	emit('update', { chartData: next } as Partial<PptxElement>);
}

const editing = useChartEditing(chartElement, chartData, emitChartData);

function onTypeChange(event: Event): void {
	editing.patchChartData({ chartType: (event.target as HTMLSelectElement).value as PptxChartType });
}

function onTitleInput(event: Event): void {
	editing.patchChartData({ title: (event.target as HTMLInputElement).value });
}

function onGroupingChange(event: Event): void {
	editing.patchChartData({
		grouping: (event.target as HTMLSelectElement).value as PptxChartData['grouping'],
	});
}

function onSeriesColorInput(event: Event, index: number): void {
	editing.setSeriesColor(index, (event.target as HTMLInputElement).value);
}

function onClearSeriesColor(index: number): void {
	editing.setSeriesColor(index, null);
}

const FIELD = 'pptx-vue-chart-field flex flex-col gap-1';
const LABEL = 'pptx-vue-chart-label font-semibold text-muted-foreground';
const CONTROL =
	'w-full bg-muted border border-border rounded px-2 py-1 focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20';
</script>

<template>
	<div class="pptx-vue-chart-panel flex flex-col gap-3 p-3 text-xs">
		<p v-if="!isChart" class="pptx-vue-chart-muted text-muted-foreground italic">
			Select a chart to edit its properties.
		</p>

		<p v-else-if="!chartData" class="pptx-vue-chart-muted text-muted-foreground italic">
			This chart has no editable data.
		</p>

		<template v-else>
			<label :class="FIELD">
				<span :class="LABEL">Chart type</span>
				<select
					:class="['pptx-vue-chart-select', CONTROL]"
					data-testid="chart-type"
					:value="currentType"
					@change="onTypeChange"
				>
					<option v-for="opt in CHART_TYPE_OPTIONS" :key="opt.value" :value="opt.value">
						{{ opt.label }}
					</option>
				</select>
			</label>

			<label :class="FIELD">
				<span :class="LABEL">Title</span>
				<input
					:class="['pptx-vue-chart-input', CONTROL]"
					data-testid="chart-title"
					type="text"
					:value="currentTitle"
					placeholder="Chart title"
					@input="onTitleInput"
				/>
			</label>

			<label v-if="showGrouping" :class="FIELD">
				<span :class="LABEL">Grouping</span>
				<select
					:class="['pptx-vue-chart-select', CONTROL]"
					data-testid="chart-grouping"
					:value="currentGrouping"
					@change="onGroupingChange"
				>
					<option v-for="opt in GROUPING_OPTIONS" :key="opt.value" :value="opt.value">
						{{ opt.label }}
					</option>
				</select>
			</label>

			<ChartDisplayOptions :style="chartData.style" @update="editing.updateStyle" />

			<ChartDataLabelOptions :style="chartData.style" @update="editing.updateStyle" />

			<ChartAxisOptions :axes="chartData.axes" @update-axis="editing.updateAxis" />

			<ChartAxisStyleOptions
				:axes="chartData.axes"
				@set-log-scale="editing.setAxisLogScale"
				@set-title-style="editing.setAxisTitleStyle"
				@set-gridline-style="editing.setGridlineStyle"
			/>

			<ChartMarkerOptions
				:chart-type="chartData.chartType"
				:series="series"
				@set-marker="editing.setSeriesMarker"
			/>

			<ChartComboTypeOptions
				:chart-type="chartData.chartType"
				:series="series"
				@set-series-type="editing.setSeriesType"
			/>

			<ChartDataPointOptions
				:chart-type="chartData.chartType"
				:categories="categories"
				:series="series"
				@set-point-fill="editing.setPointFill"
				@set-point-explosion="editing.setPointExplosion"
			/>

			<ChartTrendlineOptions
				:chart-type="chartData.chartType"
				:series="series"
				@set-trendline="editing.setSeriesTrendline"
			/>

			<ChartErrorBarOptions
				:chart-type="chartData.chartType"
				:series="series"
				@set-error-bars="editing.setSeriesErrorBars"
			/>

			<div v-if="series.length > 0" :class="FIELD">
				<span :class="LABEL">Series colours</span>
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
						:aria-label="`${s.name} colour`"
						@input="onSeriesColorInput($event, si)"
					/>
					<button
						v-if="s.color"
						type="button"
						class="pptx-vue-chart-clear text-muted-foreground hover:text-red-400 shrink-0"
						title="Clear series colour"
						@click="onClearSeriesColor(si)"
					>
						&times;
					</button>
				</div>
			</div>
		</template>
	</div>
</template>
