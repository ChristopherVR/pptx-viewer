<script setup lang="ts">
import type { PptxChartData } from 'pptx-viewer-core';
import {
	BAR3D_SHAPE_OPTIONS,
	bar3DShapePatch,
	RADAR_STYLE_OPTIONS,
	radarStylePatch,
	SURFACE_WIREFRAME_OPTIONS,
	surfaceWireframePatch,
} from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

/**
 * ChartSubtypeOptions: the three OOXML chart-subtype pickers this wave adds
 * (`c:bar3DChart/c:shape`, `c:radarChart/c:radarStyle`,
 * `c:surfaceChart|surface3DChart/c:wireframe`), each visible only for its
 * matching chart family. Sits beside `ChartDisplayOptions`'s gridlines toggle
 * in `ChartPanel.vue`.
 *
 * Mirrors `ChartDisplayOptions`'s gridlines wiring: the option lists and
 * patch builders are pure shared decision functions (`chart-subtype-options`),
 * this component only renders a `<select>` per family and forwards the
 * resulting patch through the same `update-chart-data` event
 * `ChartPanel.vue` already wires to `editing.patchChartData`.
 */
const props = defineProps<{
	chartData: PptxChartData | undefined;
}>();

const emit = defineEmits<{
	'update-chart-data': [patch: Partial<PptxChartData>];
}>();

const { t } = useI18n();

const isBar3D = computed(() => props.chartData?.chartType === 'bar3D');
const isRadar = computed(() => props.chartData?.chartType === 'radar');
const isSurface = computed(() => props.chartData?.chartType === 'surface');

function onBar3DShape(event: Event): void {
	const chartData = props.chartData;
	if (!chartData) {
		return;
	}
	const value = (event.target as HTMLSelectElement).value as NonNullable<PptxChartData['barShape']>;
	emit('update-chart-data', bar3DShapePatch(chartData, value));
}

function onRadarStyle(event: Event): void {
	const chartData = props.chartData;
	if (!chartData) {
		return;
	}
	const value = (event.target as HTMLSelectElement).value as NonNullable<
		PptxChartData['radarStyle']
	>;
	emit('update-chart-data', radarStylePatch(chartData, value));
}

function onSurfaceWireframe(event: Event): void {
	const chartData = props.chartData;
	if (!chartData) {
		return;
	}
	const wireframe = (event.target as HTMLSelectElement).value === 'true';
	emit('update-chart-data', surfaceWireframePatch(chartData, wireframe));
}
</script>

<template>
	<div
		v-if="isBar3D || isRadar || isSurface"
		class="pptx-vue-chart-card rounded border border-border bg-card p-2 space-y-1.5"
	>
		<label v-if="isBar3D" class="flex items-center gap-2 text-[11px]">
			<span class="w-20 text-muted-foreground shrink-0">{{ t('pptx.chart.bar3DShapeLabel') }}</span>
			<select
				:aria-label="t('pptx.chart.bar3DShapeLabel')"
				class="pptx-vue-chart-input flex-1 bg-muted border border-border rounded px-1.5 py-0.5 w-full"
				data-testid="pptx-chart-bar3d-shape"
				:value="chartData?.barShape ?? 'box'"
				@change="onBar3DShape"
			>
				<option v-for="opt in BAR3D_SHAPE_OPTIONS" :key="opt.value" :value="opt.value">
					{{ t(opt.labelKey) }}
				</option>
			</select>
		</label>

		<label v-if="isRadar" class="flex items-center gap-2 text-[11px]">
			<span class="w-20 text-muted-foreground shrink-0">{{ t('pptx.chart.radarStyleLabel') }}</span>
			<select
				:aria-label="t('pptx.chart.radarStyleLabel')"
				class="pptx-vue-chart-input flex-1 bg-muted border border-border rounded px-1.5 py-0.5 w-full"
				data-testid="pptx-chart-radar-style"
				:value="chartData?.radarStyle ?? 'standard'"
				@change="onRadarStyle"
			>
				<option v-for="opt in RADAR_STYLE_OPTIONS" :key="opt.value" :value="opt.value">
					{{ t(opt.labelKey) }}
				</option>
			</select>
		</label>

		<label v-if="isSurface" class="flex items-center gap-2 text-[11px]">
			<span class="w-20 text-muted-foreground shrink-0">{{
				t('pptx.chart.surfaceWireframeLabel')
			}}</span>
			<select
				:aria-label="t('pptx.chart.surfaceWireframeLabel')"
				class="pptx-vue-chart-input flex-1 bg-muted border border-border rounded px-1.5 py-0.5 w-full"
				data-testid="pptx-chart-surface-wireframe"
				:value="chartData?.wireframe ? 'true' : 'false'"
				@change="onSurfaceWireframe"
			>
				<option v-for="opt in SURFACE_WIREFRAME_OPTIONS" :key="opt.value" :value="opt.value">
					{{ t(opt.labelKey) }}
				</option>
			</select>
		</label>
	</div>
</template>
