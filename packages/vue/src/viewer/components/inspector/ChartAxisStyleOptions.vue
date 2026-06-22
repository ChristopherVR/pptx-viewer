<script setup lang="ts">
import type { PptxChartAxisFormatting } from 'pptx-viewer-core';
import { EDITABLE_AXIS_ROWS, GRIDLINE_DASH_OPTIONS } from 'pptx-viewer-shared';
import { computed } from 'vue';

import type {
	ChartAxisTitleStyleEdit,
	ChartGridlineStyleEdit,
} from '../../composables/useChartEditing';

/**
 * ChartAxisStyleOptions: per-axis log scale, axis-title font styling, and
 * major/minor gridline line styling (colour/width/dash). Mirrors React's
 * `ChartAxisStyleOptions`. Routes through the SDK-op emits exposed by
 * `useChartEditing` (log scale / title style / gridline style).
 */
const props = defineProps<{
	axes: readonly PptxChartAxisFormatting[] | undefined;
}>();

const emit = defineEmits<{
	setLogScale: [
		axisType: PptxChartAxisFormatting['axisType'],
		opts: { enabled: boolean; base?: number },
	];
	setTitleStyle: [axisType: PptxChartAxisFormatting['axisType'], edit: ChartAxisTitleStyleEdit];
	setGridlineStyle: [
		axisType: PptxChartAxisFormatting['axisType'],
		which: 'major' | 'minor',
		edit: ChartGridlineStyleEdit,
	];
}>();

type AxisRow = (typeof EDITABLE_AXIS_ROWS)[number] & { axis: PptxChartAxisFormatting };

const rows = computed<AxisRow[]>(() =>
	EDITABLE_AXIS_ROWS.map((row) => ({
		...row,
		axis: props.axes?.find((a) => a.axisType === row.type),
	})).filter((row): row is AxisRow => Boolean(row.axis)),
);

function onLogToggle(event: Event, row: AxisRow): void {
	emit('setLogScale', row.type, {
		enabled: (event.target as HTMLInputElement).checked,
		base: row.axis.logBase,
	});
}

function onLogBase(event: Event, row: AxisRow): void {
	const num = Number.parseFloat((event.target as HTMLInputElement).value);
	if (Number.isFinite(num) && num > 1) {
		emit('setLogScale', row.type, { enabled: true, base: num });
	}
}

function onFontFamily(event: Event, row: AxisRow): void {
	emit('setTitleStyle', row.type, {
		fontFamily: (event.target as HTMLInputElement).value || null,
	});
}

function onFontSize(event: Event, row: AxisRow): void {
	const num = Number.parseFloat((event.target as HTMLInputElement).value);
	emit('setTitleStyle', row.type, { fontSize: Number.isFinite(num) ? num : null });
}

function onBold(event: Event, row: AxisRow): void {
	emit('setTitleStyle', row.type, { fontBold: (event.target as HTMLInputElement).checked });
}

function onColor(event: Event, row: AxisRow): void {
	emit('setTitleStyle', row.type, { fontColor: (event.target as HTMLInputElement).value });
}

function gridSpPr(row: AxisRow, which: 'major' | 'minor') {
	return which === 'major' ? row.axis.majorGridlinesSpPr : row.axis.minorGridlinesSpPr;
}

function gridEnabled(row: AxisRow, which: 'major' | 'minor'): boolean {
	return Boolean(which === 'major' ? row.axis.majorGridlines : row.axis.minorGridlines);
}

function onGridColor(event: Event, row: AxisRow, which: 'major' | 'minor'): void {
	emit('setGridlineStyle', row.type, which, { color: (event.target as HTMLInputElement).value });
}

function onGridWidth(event: Event, row: AxisRow, which: 'major' | 'minor'): void {
	const num = Number.parseFloat((event.target as HTMLInputElement).value);
	emit('setGridlineStyle', row.type, which, { width: Number.isFinite(num) ? num : null });
}

function onGridDash(event: Event, row: AxisRow, which: 'major' | 'minor'): void {
	emit('setGridlineStyle', row.type, which, {
		dashStyle: (event.target as HTMLSelectElement).value || null,
	});
}

const INPUT = 'flex-1 bg-muted border border-border rounded px-1.5 py-0.5 w-full';
const GRID_KINDS: ReadonlyArray<{ which: 'major' | 'minor'; label: string }> = [
	{ which: 'major', label: 'Major gridlines' },
	{ which: 'minor', label: 'Minor gridlines' },
];
</script>

<template>
	<div
		v-if="rows.length > 0"
		class="pptx-vue-chart-card rounded border border-border bg-card p-2 space-y-2"
	>
		<div class="pptx-vue-chart-heading text-[11px] uppercase tracking-wide text-muted-foreground">
			Axis styling
		</div>
		<div v-for="row in rows" :key="row.type" class="space-y-1.5">
			<div class="text-[11px] font-medium">{{ row.label }}</div>
			<div class="space-y-1.5 ml-2">
				<div v-if="row.hasScale" class="flex items-center gap-2">
					<label class="flex items-center gap-2 cursor-pointer">
						<input
							type="checkbox"
							data-testid="chart-axis-log-scale"
							class="accent-primary"
							:checked="row.axis.logScale ?? false"
							@change="onLogToggle($event, row)"
						/>
						<span class="text-[11px]">Log scale</span>
					</label>
					<input
						v-if="row.axis.logScale"
						type="number"
						min="2"
						data-testid="chart-axis-log-base"
						title="Log base"
						class="w-16 bg-muted border border-border rounded px-1.5 py-0.5 text-[11px]"
						:value="row.axis.logBase ?? 10"
						@input="onLogBase($event, row)"
					/>
				</div>

				<div class="flex items-center gap-2 text-[11px]">
					<span class="w-12 text-muted-foreground shrink-0">Title font</span>
					<input
						type="text"
						:class="INPUT"
						data-testid="chart-axis-title-font"
						placeholder="Auto"
						:value="row.axis.fontFamily ?? ''"
						@input="onFontFamily($event, row)"
					/>
					<input
						type="number"
						min="4"
						max="96"
						data-testid="chart-axis-title-size"
						title="Font size"
						class="w-14 bg-muted border border-border rounded px-1.5 py-0.5"
						:value="row.axis.fontSize ?? ''"
						placeholder="Auto"
						@input="onFontSize($event, row)"
					/>
				</div>
				<div class="flex items-center gap-3 text-[11px]">
					<label class="flex items-center gap-1 cursor-pointer">
						<input
							type="checkbox"
							data-testid="chart-axis-title-bold"
							class="accent-primary"
							:checked="row.axis.fontBold ?? false"
							@change="onBold($event, row)"
						/>
						<span>Bold</span>
					</label>
					<label class="flex items-center gap-1">
						<span class="text-muted-foreground">Colour</span>
						<input
							type="color"
							data-testid="chart-axis-title-color"
							class="h-6 w-8 cursor-pointer rounded border border-border bg-transparent"
							:value="row.axis.fontColor ?? '#000000'"
							@input="onColor($event, row)"
						/>
					</label>
				</div>

				<template v-for="kind in GRID_KINDS" :key="kind.which">
					<div v-if="gridEnabled(row, kind.which)" class="flex items-center gap-2 text-[11px]">
						<span class="w-12 text-muted-foreground shrink-0">{{ kind.label }}</span>
						<input
							type="color"
							data-testid="chart-gridline-color"
							title="Gridline colour"
							class="h-6 w-8 cursor-pointer rounded border border-border bg-transparent"
							:value="gridSpPr(row, kind.which)?.strokeColor ?? '#d9d9d9'"
							@input="onGridColor($event, row, kind.which)"
						/>
						<input
							type="number"
							min="0.25"
							step="0.25"
							data-testid="chart-gridline-width"
							title="Gridline width"
							class="w-14 bg-muted border border-border rounded px-1.5 py-0.5"
							:value="gridSpPr(row, kind.which)?.strokeWidth ?? ''"
							placeholder="Auto"
							@input="onGridWidth($event, row, kind.which)"
						/>
						<select
							:class="INPUT"
							data-testid="chart-gridline-dash"
							title="Gridline dash"
							:value="gridSpPr(row, kind.which)?.strokeDashStyle ?? ''"
							@change="onGridDash($event, row, kind.which)"
						>
							<option v-for="opt in GRIDLINE_DASH_OPTIONS" :key="opt.value" :value="opt.value">
								{{ opt.label }}
							</option>
						</select>
					</div>
				</template>
			</div>
		</div>
	</div>
</template>
