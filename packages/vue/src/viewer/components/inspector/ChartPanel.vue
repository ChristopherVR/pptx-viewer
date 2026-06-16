<script setup lang="ts">
import type { ChartPptxElement, PptxChartData, PptxChartType, PptxElement } from 'pptx-viewer-core';
import { chartDataChangeType, setChartGrouping, setChartTitle } from 'pptx-viewer-core';
import { computed } from 'vue';

/**
 * ChartPanel — inspector panel for chart elements.
 *
 * Mirrors the uniform inspector-panel contract used by the other
 * `components/inspector/` panels:
 *  - Props: `{ element }`
 *  - Emits `update` with a SHALLOW `Partial<PptxElement>` patch, here always
 *    `{ chartData: <full new chart data> }`, intended to be merged via
 *    `ops.updateElement(id, patch)`.
 *
 * All chart mutations go through the real `pptx-viewer-core` helpers
 * (`chartDataChangeType`, `setChartTitle`, `setChartGrouping`) so behaviour
 * stays consistent with the headless SDK.
 */
const props = defineProps<{
	element: PptxElement;
}>();

const emit = defineEmits<{
	update: [patch: Partial<PptxElement>];
}>();

/** Chart types offered in the type selector, in display order. */
const CHART_TYPE_OPTIONS: ReadonlyArray<{ value: PptxChartType; label: string }> = [
	{ value: 'bar', label: 'Bar' },
	{ value: 'line', label: 'Line' },
	{ value: 'pie', label: 'Pie' },
	{ value: 'doughnut', label: 'Doughnut' },
	{ value: 'area', label: 'Area' },
	{ value: 'scatter', label: 'Scatter' },
	{ value: 'bubble', label: 'Bubble' },
	{ value: 'radar', label: 'Radar' },
];

/** Grouping modes; only meaningful for bar/column-style charts. */
const GROUPING_OPTIONS: ReadonlyArray<{
	value: 'clustered' | 'stacked' | 'percentStacked';
	label: string;
}> = [
	{ value: 'clustered', label: 'Clustered' },
	{ value: 'stacked', label: 'Stacked' },
	{ value: 'percentStacked', label: '100% Stacked' },
];

/** Chart types for which the grouping selector is applicable. */
const GROUPING_TYPES = new Set<PptxChartType>(['bar', 'line', 'area', 'bar3D', 'line3D', 'area3D']);

const isChart = computed(() => props.element.type === 'chart');

/** The current chart data, or `null` for non-chart / uninitialised elements. */
const chartData = computed<PptxChartData | null>(() => {
	if (props.element.type !== 'chart') {
		return null;
	}
	return (props.element as ChartPptxElement).chartData ?? null;
});

const currentType = computed<PptxChartType | ''>(() => chartData.value?.chartType ?? '');
const currentTitle = computed<string>(() => chartData.value?.title ?? '');
const currentGrouping = computed<string>(() => chartData.value?.grouping ?? 'clustered');

/** Whether the grouping control should be shown for the current chart type. */
const showGrouping = computed(
	() => chartData.value !== null && GROUPING_TYPES.has(chartData.value.chartType),
);

/**
 * Apply an SDK mutator to a shallow clone of the current chart element and
 * return the resulting chart data, leaving the original element untouched.
 */
function withClonedChart(mutate: (clone: ChartPptxElement) => void): PptxChartData | null {
	const data = chartData.value;
	if (!data) {
		return null;
	}
	const clone: ChartPptxElement = {
		...(props.element as ChartPptxElement),
		chartData: { ...data },
	};
	mutate(clone);
	return clone.chartData ?? null;
}

function emitChartData(next: PptxChartData): void {
	emit('update', { chartData: next } as Partial<PptxElement>);
}

function onTypeChange(event: Event): void {
	const data = chartData.value;
	if (!data) {
		return;
	}
	const value = (event.target as HTMLSelectElement).value as PptxChartType;
	// `chartDataChangeType` returns a fresh PptxChartData and adapts grouping.
	emitChartData(chartDataChangeType(data, value));
}

function onTitleInput(event: Event): void {
	const value = (event.target as HTMLInputElement).value;
	const next = withClonedChart((clone) => {
		setChartTitle(clone, value);
	});
	if (next) {
		emitChartData(next);
	}
}

function onGroupingChange(event: Event): void {
	const value = (event.target as HTMLSelectElement).value as
		| 'clustered'
		| 'stacked'
		| 'percentStacked';
	const next = withClonedChart((clone) => {
		setChartGrouping(clone, value);
	});
	if (next) {
		emitChartData(next);
	}
}
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
			<label class="pptx-vue-chart-field flex flex-col gap-1">
				<span class="pptx-vue-chart-label font-semibold text-muted-foreground">Chart type</span>
				<select
					class="pptx-vue-chart-select w-full bg-muted border border-border rounded px-2 py-1 focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
					data-testid="chart-type"
					:value="currentType"
					@change="onTypeChange"
				>
					<option v-for="opt in CHART_TYPE_OPTIONS" :key="opt.value" :value="opt.value">
						{{ opt.label }}
					</option>
				</select>
			</label>

			<label class="pptx-vue-chart-field flex flex-col gap-1">
				<span class="pptx-vue-chart-label font-semibold text-muted-foreground">Title</span>
				<input
					class="pptx-vue-chart-input w-full bg-muted border border-border rounded px-2 py-1 focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
					data-testid="chart-title"
					type="text"
					:value="currentTitle"
					placeholder="Chart title"
					@input="onTitleInput"
				/>
			</label>

			<label v-if="showGrouping" class="pptx-vue-chart-field flex flex-col gap-1">
				<span class="pptx-vue-chart-label font-semibold text-muted-foreground">Grouping</span>
				<select
					class="pptx-vue-chart-select w-full bg-muted border border-border rounded px-2 py-1 focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
					data-testid="chart-grouping"
					:value="currentGrouping"
					@change="onGroupingChange"
				>
					<option v-for="opt in GROUPING_OPTIONS" :key="opt.value" :value="opt.value">
						{{ opt.label }}
					</option>
				</select>
			</label>
		</template>
	</div>
</template>
