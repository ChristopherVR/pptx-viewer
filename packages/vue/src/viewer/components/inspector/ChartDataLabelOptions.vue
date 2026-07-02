<script setup lang="ts">
import type { PptxChartDataLabelOptions, PptxChartStyle } from 'pptx-viewer-core';
import { DATA_LABEL_CONTENT_OPTIONS, DATA_LABEL_POSITION_OPTIONS } from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

/**
 * ChartDataLabelOptions: data-label content flags + position. Only rendered once
 * the master data-labels toggle (in ChartDisplayOptions) is on. Mirrors React's
 * `ChartDataLabelOptions`; emits a shallow `PptxChartStyle` patch.
 */
const props = defineProps<{
	style: PptxChartStyle | undefined;
}>();

const emit = defineEmits<{
	update: [patch: Partial<PptxChartStyle>];
}>();

const { t } = useI18n();

const visible = computed(() => Boolean(props.style?.hasDataLabels));
const labels = computed<PptxChartDataLabelOptions>(() => props.style?.dataLabels ?? {});

function patchLabels(patch: Partial<PptxChartDataLabelOptions>): void {
	emit('update', { dataLabels: { ...labels.value, ...patch } });
}

function onContentToggle(event: Event, key: keyof PptxChartDataLabelOptions): void {
	patchLabels({ [key]: (event.target as HTMLInputElement).checked });
}

function onPosition(event: Event): void {
	const value = (event.target as HTMLSelectElement).value;
	patchLabels({
		position: (value || undefined) as PptxChartDataLabelOptions['position'],
	});
}
</script>

<template>
	<div
		v-if="visible"
		class="pptx-vue-chart-card rounded border border-border bg-card p-2 space-y-2"
	>
		<div class="pptx-vue-chart-heading text-[11px] uppercase tracking-wide text-muted-foreground">
			{{ t('pptx.chart.dataLabels') }}
		</div>
		<div class="space-y-1.5">
			<label
				v-for="opt in DATA_LABEL_CONTENT_OPTIONS"
				:key="opt.key"
				class="flex items-center gap-2 cursor-pointer"
			>
				<input
					type="checkbox"
					data-testid="chart-data-label-content"
					class="accent-primary"
					:checked="labels[opt.key] ?? false"
					@change="onContentToggle($event, opt.key)"
				/>
				<span class="text-[11px]">{{ opt.label }}</span>
			</label>

			<label class="flex items-center gap-2 text-[11px]">
				<span class="w-16 text-muted-foreground shrink-0">{{ t('pptx.chart.labelPosition') }}</span>
				<select
					class="pptx-vue-chart-input flex-1 bg-muted border border-border rounded px-1.5 py-0.5 w-full"
					data-testid="chart-data-label-position"
					:value="labels.position ?? ''"
					@change="onPosition"
				>
					<option v-for="opt in DATA_LABEL_POSITION_OPTIONS" :key="opt.value" :value="opt.value">
						{{ opt.label }}
					</option>
				</select>
			</label>
		</div>
	</div>
</template>
