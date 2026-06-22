<script setup lang="ts">
import type { PptxChartAxisFormatting } from 'pptx-viewer-core';
import {
	DISPLAY_UNITS_OPTIONS,
	EDITABLE_AXIS_ROWS,
	TICK_LABEL_POSITION_OPTIONS,
} from 'pptx-viewer-shared';
import { computed } from 'vue';

/**
 * ChartAxisOptions: per-axis scale (min/max/major/minor), display units, axis
 * title text, number format, tick-label position, and major/minor gridline
 * visibility. Mirrors React's `ChartAxisOptions`. Emits `updateAxis(type,patch)`.
 */
const props = defineProps<{
	axes: readonly PptxChartAxisFormatting[] | undefined;
}>();

const emit = defineEmits<{
	updateAxis: [
		axisType: PptxChartAxisFormatting['axisType'],
		patch: Partial<PptxChartAxisFormatting>,
	];
}>();

type AxisRow = (typeof EDITABLE_AXIS_ROWS)[number] & { axis: PptxChartAxisFormatting };

const rows = computed<AxisRow[]>(() =>
	EDITABLE_AXIS_ROWS.map((row) => ({
		...row,
		axis: props.axes?.find((a) => a.axisType === row.type),
	})).filter((row): row is AxisRow => Boolean(row.axis)),
);

type ScaleKey = 'min' | 'max' | 'majorUnit' | 'minorUnit';

function onNumber(
	event: Event,
	axisType: PptxChartAxisFormatting['axisType'],
	key: ScaleKey,
): void {
	const raw = (event.target as HTMLInputElement).value;
	if (raw === '') {
		emit('updateAxis', axisType, { [key]: undefined });
		return;
	}
	const num = Number.parseFloat(raw);
	if (Number.isFinite(num)) {
		emit('updateAxis', axisType, { [key]: num });
	}
}

function onDisplayUnits(event: Event, axisType: PptxChartAxisFormatting['axisType']): void {
	const value = (event.target as HTMLSelectElement).value;
	emit('updateAxis', axisType, {
		displayUnits: (value || undefined) as PptxChartAxisFormatting['displayUnits'],
	});
}

function onTitle(event: Event, axisType: PptxChartAxisFormatting['axisType']): void {
	emit('updateAxis', axisType, { titleText: (event.target as HTMLInputElement).value });
}

function onNumberFormat(event: Event, axisType: PptxChartAxisFormatting['axisType']): void {
	const value = (event.target as HTMLInputElement).value;
	emit('updateAxis', axisType, {
		numFmt: value ? { formatCode: value, sourceLinked: false } : undefined,
	});
}

function onTickPos(event: Event, axisType: PptxChartAxisFormatting['axisType']): void {
	emit('updateAxis', axisType, {
		tickLblPos: (event.target as HTMLSelectElement).value as PptxChartAxisFormatting['tickLblPos'],
	});
}

function onGridline(
	event: Event,
	axisType: PptxChartAxisFormatting['axisType'],
	key: 'majorGridlines' | 'minorGridlines',
): void {
	emit('updateAxis', axisType, { [key]: (event.target as HTMLInputElement).checked });
}

const SCALE_FIELDS: ReadonlyArray<{ key: ScaleKey; label: string }> = [
	{ key: 'min', label: 'Min' },
	{ key: 'max', label: 'Max' },
	{ key: 'majorUnit', label: 'Major' },
	{ key: 'minorUnit', label: 'Minor' },
];

const INPUT = 'flex-1 bg-muted border border-border rounded px-1.5 py-0.5 w-full';
</script>

<template>
	<div
		v-if="rows.length > 0"
		class="pptx-vue-chart-card rounded border border-border bg-card p-2 space-y-2"
	>
		<div class="pptx-vue-chart-heading text-[11px] uppercase tracking-wide text-muted-foreground">
			Axes
		</div>
		<div v-for="row in rows" :key="row.type" class="space-y-1.5">
			<div class="text-[11px] font-medium">{{ row.label }}</div>

			<div v-if="row.hasScale" class="space-y-1.5 ml-2">
				<label
					v-for="field in SCALE_FIELDS"
					:key="field.key"
					class="flex items-center gap-2 text-[11px]"
				>
					<span class="w-16 text-muted-foreground shrink-0">{{ field.label }}</span>
					<input
						type="number"
						:class="INPUT"
						data-testid="chart-axis-scale"
						:value="row.axis[field.key] ?? ''"
						placeholder="Auto"
						@input="onNumber($event, row.type, field.key)"
					/>
				</label>

				<label class="flex items-center gap-2 text-[11px]">
					<span class="w-16 text-muted-foreground shrink-0">Units</span>
					<select
						:class="INPUT"
						data-testid="chart-axis-display-units"
						:value="row.axis.displayUnits ?? ''"
						@change="onDisplayUnits($event, row.type)"
					>
						<option v-for="opt in DISPLAY_UNITS_OPTIONS" :key="opt.value" :value="opt.value">
							{{ opt.label }}
						</option>
					</select>
				</label>
			</div>

			<div class="space-y-1.5 ml-2">
				<label class="flex items-center gap-2 text-[11px]">
					<span class="w-16 text-muted-foreground shrink-0">Title</span>
					<input
						type="text"
						:class="INPUT"
						data-testid="chart-axis-title"
						:value="row.axis.titleText ?? ''"
						placeholder="Axis title"
						@input="onTitle($event, row.type)"
					/>
				</label>

				<label class="flex items-center gap-2 text-[11px]">
					<span class="w-16 text-muted-foreground shrink-0">Format</span>
					<input
						type="text"
						:class="INPUT"
						data-testid="chart-axis-number-format"
						:value="row.axis.numFmt?.formatCode ?? ''"
						placeholder="General"
						@input="onNumberFormat($event, row.type)"
					/>
				</label>

				<label class="flex items-center gap-2 text-[11px]">
					<span class="w-16 text-muted-foreground shrink-0">Ticks</span>
					<select
						:class="INPUT"
						data-testid="chart-axis-tick-pos"
						:value="row.axis.tickLblPos ?? 'nextTo'"
						@change="onTickPos($event, row.type)"
					>
						<option v-for="opt in TICK_LABEL_POSITION_OPTIONS" :key="opt.value" :value="opt.value">
							{{ opt.label }}
						</option>
					</select>
				</label>

				<label class="flex items-center gap-2 cursor-pointer">
					<input
						type="checkbox"
						data-testid="chart-axis-major-gridlines"
						class="accent-primary"
						:checked="row.axis.majorGridlines ?? false"
						@change="onGridline($event, row.type, 'majorGridlines')"
					/>
					<span class="text-[11px]">Major gridlines</span>
				</label>
				<label class="flex items-center gap-2 cursor-pointer">
					<input
						type="checkbox"
						data-testid="chart-axis-minor-gridlines"
						class="accent-primary"
						:checked="row.axis.minorGridlines ?? false"
						@change="onGridline($event, row.type, 'minorGridlines')"
					/>
					<span class="text-[11px]">Minor gridlines</span>
				</label>
			</div>
		</div>
	</div>
</template>
