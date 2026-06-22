<script setup lang="ts">
import type { PptxChartErrBars, PptxChartSeries, PptxChartType } from 'pptx-viewer-core';
import {
	ERROR_BAR_SUPPORTED_TYPES,
	ERROR_BAR_TYPE_OPTIONS,
	ERROR_BAR_VALTYPE_OPTIONS,
	ERROR_BAR_VALUE_TYPES,
} from 'pptx-viewer-shared';
import { computed } from 'vue';

/**
 * ChartErrorBarOptions: per-series error bars (value type, direction, amount).
 * Mirrors React's `ChartErrorBarOptions`. Emits `setErrorBars(index, bars)`
 * where `null` removes the error bars.
 */
const props = defineProps<{
	chartType: PptxChartType;
	series: readonly PptxChartSeries[];
}>();

const emit = defineEmits<{
	setErrorBars: [index: number, errBars: PptxChartErrBars | null];
}>();

const visible = computed(
	() => ERROR_BAR_SUPPORTED_TYPES.has(props.chartType) && props.series.length > 0,
);

function firstBars(s: PptxChartSeries): PptxChartErrBars | undefined {
	return s.errBars?.[0];
}

function showValue(bars: PptxChartErrBars | undefined): boolean {
	return Boolean(bars && ERROR_BAR_VALUE_TYPES.has(bars.valType));
}

function onValType(event: Event, index: number, bars: PptxChartErrBars | undefined): void {
	const value = (event.target as HTMLSelectElement).value;
	if (!value) {
		emit('setErrorBars', index, null);
		return;
	}
	emit('setErrorBars', index, {
		direction: bars?.direction ?? 'y',
		barType: bars?.barType ?? 'both',
		valType: value as PptxChartErrBars['valType'],
		val: bars?.val,
	});
}

function onBarType(event: Event, index: number, bars: PptxChartErrBars): void {
	emit('setErrorBars', index, {
		...bars,
		barType: (event.target as HTMLSelectElement).value as PptxChartErrBars['barType'],
	});
}

function onAmount(event: Event, index: number, bars: PptxChartErrBars): void {
	const raw = (event.target as HTMLInputElement).value;
	const num = raw === '' ? undefined : Number.parseFloat(raw);
	if (raw !== '' && !Number.isFinite(num)) {
		return;
	}
	emit('setErrorBars', index, { ...bars, val: num });
}
</script>

<template>
	<div
		v-if="visible"
		class="pptx-vue-chart-card rounded border border-border bg-card p-2 space-y-2"
	>
		<div class="pptx-vue-chart-heading text-[11px] uppercase tracking-wide text-muted-foreground">
			Error bars
		</div>
		<div class="space-y-2">
			<div v-for="(s, i) in props.series" :key="`${s.name}-${i}`" class="space-y-1">
				<div class="flex items-center gap-2 text-[11px]">
					<span class="flex-1 truncate" :title="s.name">{{ s.name }}</span>
					<select
						class="pptx-vue-chart-input flex-1 bg-muted border border-border rounded px-1.5 py-0.5 w-full"
						data-testid="chart-error-bar-valtype"
						:value="firstBars(s)?.valType ?? ''"
						@change="onValType($event, i, firstBars(s))"
					>
						<option v-for="opt in ERROR_BAR_VALTYPE_OPTIONS" :key="opt.value" :value="opt.value">
							{{ opt.label }}
						</option>
					</select>
				</div>

				<div v-if="firstBars(s)" class="flex items-center gap-2 ml-2">
					<select
						class="pptx-vue-chart-input flex-1 bg-muted border border-border rounded px-1.5 py-0.5 w-full"
						data-testid="chart-error-bar-type"
						:value="firstBars(s)!.barType"
						@change="onBarType($event, i, firstBars(s)!)"
					>
						<option v-for="opt in ERROR_BAR_TYPE_OPTIONS" :key="opt.value" :value="opt.value">
							{{ opt.label }}
						</option>
					</select>
					<input
						v-if="showValue(firstBars(s))"
						type="number"
						data-testid="chart-error-bar-amount"
						class="pptx-vue-chart-input flex-1 bg-muted border border-border rounded px-1.5 py-0.5 w-full"
						:value="firstBars(s)!.val ?? ''"
						placeholder="Amount"
						@input="onAmount($event, i, firstBars(s)!)"
					/>
				</div>
			</div>
		</div>
	</div>
</template>
