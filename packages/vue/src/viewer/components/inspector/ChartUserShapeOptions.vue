<script setup lang="ts">
import type { PptxChartData, PptxChartUserShape } from 'pptx-viewer-core';
import {
	createDefaultChartUserShape,
	listChartUserShapeDescriptors,
	withChartUserShapeAdded,
	withChartUserShapeRemoved,
	withChartUserShapeUpdated,
} from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

/**
 * ChartUserShapeOptions: "Chart overlay shapes" section (`c:userShapes`
 * drawing overlay, C2-G10 edit/serialize follow-up). List existing overlay
 * shapes, add a default text box, delete one, and nudge a `sp`/`cxnSp`
 * shape's anchor fractions.
 *
 * Pure view over `pptx-viewer-shared`'s `chart-user-shape-edit` helpers,
 * mirroring React's `ChartUserShapeOptions.tsx` so every binding's overlay
 * editing stays in lock-step (CLAUDE.md Rule 2).
 */
const props = defineProps<{
	chartData: PptxChartData;
}>();

const emit = defineEmits<{
	'update-chart-data': [patch: Partial<PptxChartData>];
}>();

const { t } = useI18n();

const descriptors = computed(() => listChartUserShapeDescriptors(props.chartData.userShapes));

function kindLabel(kind: string): string {
	return t(`pptx.chart.userShapeKind${kind.charAt(0).toUpperCase()}${kind.slice(1)}`);
}

function addTextBox(): void {
	emit('update-chart-data', {
		userShapes: withChartUserShapeAdded(props.chartData.userShapes, createDefaultChartUserShape()),
	});
}

function removeShape(index: number): void {
	emit('update-chart-data', {
		userShapes: withChartUserShapeRemoved(props.chartData.userShapes, index),
	});
}

function updateAnchor(index: number, patch: Partial<PptxChartUserShape>): void {
	emit('update-chart-data', {
		userShapes: withChartUserShapeUpdated(props.chartData.userShapes, index, patch),
	});
}

function onFromX(index: number, from: { x: number; y: number }, event: Event): void {
	updateAnchor(index, { from: { ...from, x: Number((event.target as HTMLInputElement).value) } });
}
function onFromY(index: number, from: { x: number; y: number }, event: Event): void {
	updateAnchor(index, { from: { ...from, y: Number((event.target as HTMLInputElement).value) } });
}
function onToX(index: number, to: { x: number; y: number }, event: Event): void {
	updateAnchor(index, { to: { ...to, x: Number((event.target as HTMLInputElement).value) } });
}
function onToY(index: number, to: { x: number; y: number }, event: Event): void {
	updateAnchor(index, { to: { ...to, y: Number((event.target as HTMLInputElement).value) } });
}
</script>

<template>
	<div class="pptx-vue-chart-card rounded border border-border bg-card p-2 space-y-2">
		<div class="flex items-center justify-between">
			<span class="text-[11px] uppercase tracking-wide text-muted-foreground">{{
				t('pptx.chart.userShapes')
			}}</span>
			<button
				type="button"
				class="rounded bg-muted hover:bg-accent px-2 py-1 text-[11px] transition-colors"
				data-testid="chart-user-shape-add"
				@click="addTextBox"
			>
				{{ t('pptx.chart.userShapeAddTextBox') }}
			</button>
		</div>

		<div v-if="descriptors.length === 0" class="text-[11px] text-muted-foreground">
			{{ t('pptx.chart.userShapesEmpty') }}
		</div>

		<div v-else class="space-y-2">
			<div
				v-for="d in descriptors"
				:key="d.index"
				class="space-y-1 rounded border border-border p-1.5"
				data-testid="chart-user-shape-row"
			>
				<div class="flex items-center gap-2 text-[11px]">
					<span class="flex-1 truncate"
						>{{ kindLabel(d.kind) }}<template v-if="d.text"> - {{ d.text }}</template></span
					>
					<button
						type="button"
						class="rounded bg-muted hover:bg-accent px-2 py-1 text-[11px] transition-colors"
						:aria-label="t('pptx.chart.userShapeDelete')"
						data-testid="chart-user-shape-delete"
						@click="removeShape(d.index)"
					>
						&#10005;
					</button>
				</div>

				<div v-if="d.editable" class="flex items-center gap-1 text-[11px]">
					<span class="text-muted-foreground">{{ t('pptx.chart.userShapeFrom') }}</span>
					<input
						type="number"
						step="0.01"
						min="0"
						max="1"
						class="flex-1 bg-muted border border-border rounded px-1.5 py-0.5 w-full"
						:value="d.from.x"
						@change="onFromX(d.index, d.from, $event)"
					/>
					<input
						type="number"
						step="0.01"
						min="0"
						max="1"
						class="flex-1 bg-muted border border-border rounded px-1.5 py-0.5 w-full"
						:value="d.from.y"
						@change="onFromY(d.index, d.from, $event)"
					/>
					<template v-if="d.anchor === 'rel' && d.to">
						<span class="text-muted-foreground">{{ t('pptx.chart.userShapeTo') }}</span>
						<input
							type="number"
							step="0.01"
							min="0"
							max="1"
							class="flex-1 bg-muted border border-border rounded px-1.5 py-0.5 w-full"
							:value="d.to.x"
							@change="onToX(d.index, d.to, $event)"
						/>
						<input
							type="number"
							step="0.01"
							min="0"
							max="1"
							class="flex-1 bg-muted border border-border rounded px-1.5 py-0.5 w-full"
							:value="d.to.y"
							@change="onToY(d.index, d.to, $event)"
						/>
					</template>
				</div>
				<div v-else class="text-[10px] italic text-muted-foreground">
					{{ t('pptx.chart.userShapeNotEditable') }}
				</div>
			</div>
		</div>
	</div>
</template>
