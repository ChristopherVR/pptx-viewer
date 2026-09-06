<script setup lang="ts">
import type { PptxChartData } from 'pptx-viewer-core';
import type { ChartUserShapeRow, ChartUserShapeRowPatch } from 'pptx-viewer-shared';
import {
	createDefaultChartUserShape,
	createDefaultChartUserShapeGroupChild,
	getChartUserShapeGroupTransform,
	listChartUserShapeRows,
	withChartUserShapeAdded,
	withChartUserShapeGroupChildAdded,
	withChartUserShapeRowChartBoxUpdated,
	withChartUserShapeRowFlipUpdated,
	withChartUserShapeRowRemoved,
	withChartUserShapeRowRotationUpdated,
	withChartUserShapeRowTextUpdated,
	withChartUserShapeRowUpdated,
} from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import ChartUserShapePositionFields from './ChartUserShapePositionFields.vue';

/**
 * ChartUserShapeOptions: "Chart overlay shapes" section (`c:userShapes`
 * drawing overlay). Lists a chart's overlay shapes as an indented tree (a
 * `grpSp`'s grouped children included), adds a default text box, deletes any
 * row, and edits a `sp`/`cxnSp` row's text/fill/line, a `pic` row's alt text,
 * and any non-group row's position/size.
 *
 * Pure view over `pptx-viewer-shared`'s `chart-user-shape-edit`/
 * `chart-user-shape-tree` helpers, mirroring React's `ChartUserShapeOptions.tsx`
 * so every binding's overlay editing stays in lock-step (CLAUDE.md Rule 2).
 */
const props = defineProps<{
	chartData: PptxChartData;
}>();

const emit = defineEmits<{
	'update-chart-data': [patch: Partial<PptxChartData>];
}>();

const { t } = useI18n();

const rows = computed(() => listChartUserShapeRows(props.chartData.userShapes));

function pathKey(path: readonly number[]): string {
	return path.join(',');
}

function kindLabel(kind: string): string {
	return t(`pptx.chart.userShapeKind${kind.charAt(0).toUpperCase()}${kind.slice(1)}`);
}

function addTextBox(): void {
	emit('update-chart-data', {
		userShapes: withChartUserShapeAdded(props.chartData.userShapes, createDefaultChartUserShape()),
	});
}

function removeRow(path: readonly number[]): void {
	emit('update-chart-data', {
		userShapes: withChartUserShapeRowRemoved(props.chartData.userShapes, path),
	});
}

function update(path: readonly number[], patch: ChartUserShapeRowPatch): void {
	emit('update-chart-data', {
		userShapes: withChartUserShapeRowUpdated(props.chartData.userShapes, path, patch),
	});
}

function updateBox(
	path: readonly number[],
	box: { from: { x: number; y: number }; to: { x: number; y: number } },
): void {
	emit('update-chart-data', {
		userShapes: withChartUserShapeRowChartBoxUpdated(props.chartData.userShapes, path, box),
	});
}

function updateRotation(path: readonly number[], rotation: number | undefined): void {
	emit('update-chart-data', {
		userShapes: withChartUserShapeRowRotationUpdated(props.chartData.userShapes, path, rotation),
	});
}

function updateFlip(path: readonly number[], flip: { flipH?: boolean; flipV?: boolean }): void {
	emit('update-chart-data', {
		userShapes: withChartUserShapeRowFlipUpdated(props.chartData.userShapes, path, flip),
	});
}

function addIntoGroup(path: readonly number[]): void {
	const transform = getChartUserShapeGroupTransform(props.chartData.userShapes, path);
	if (!transform) {
		return;
	}
	emit('update-chart-data', {
		userShapes: withChartUserShapeGroupChildAdded(
			props.chartData.userShapes,
			path,
			createDefaultChartUserShapeGroupChild(transform),
		),
	});
}

function updateText(path: readonly number[], event: Event): void {
	emit('update-chart-data', {
		userShapes: withChartUserShapeRowTextUpdated(
			props.chartData.userShapes,
			path,
			(event.target as HTMLInputElement).value,
		),
	});
}

function onFill(row: ChartUserShapeRow, event: Event): void {
	update(row.path, { fill: (event.target as HTMLInputElement).value });
}
function onStroke(row: ChartUserShapeRow, event: Event): void {
	update(row.path, { stroke: (event.target as HTMLInputElement).value });
}
function onAltText(row: ChartUserShapeRow, event: Event): void {
	update(row.path, { altText: (event.target as HTMLInputElement).value });
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

		<div v-if="rows.length === 0" class="text-[11px] text-muted-foreground">
			{{ t('pptx.chart.userShapesEmpty') }}
		</div>

		<div v-else class="space-y-2">
			<div
				v-for="row in rows"
				:key="pathKey(row.path)"
				:data-chart-user-shape-path="pathKey(row.path)"
				:style="{ marginLeft: `${row.depth * 12}px` }"
				class="space-y-1 rounded border border-border p-1.5"
				data-testid="chart-user-shape-row"
			>
				<div class="flex items-center gap-2 text-[11px]">
					<span class="flex-1 truncate"
						>{{ kindLabel(row.kind) }}<template v-if="row.text"> - {{ row.text }}</template></span
					>
					<button
						v-if="row.isGroup"
						type="button"
						class="rounded bg-muted hover:bg-accent px-2 py-1 text-[11px] transition-colors"
						data-testid="chart-user-shape-add-into-group"
						@click="addIntoGroup(row.path)"
					>
						{{ t('pptx.chart.userShapeAddIntoGroup') }}
					</button>
					<button
						type="button"
						class="rounded bg-muted hover:bg-accent px-2 py-1 text-[11px] transition-colors"
						:aria-label="t('pptx.chart.userShapeDelete')"
						data-testid="chart-user-shape-delete"
						@click="removeRow(row.path)"
					>
						&#10005;
					</button>
				</div>

				<div v-if="row.editableVisuals" class="flex items-center gap-1 text-[11px]">
					<span class="text-muted-foreground">{{ t('pptx.chart.userShapeText') }}</span>
					<input
						type="text"
						:aria-label="t('pptx.chart.userShapeText')"
						class="flex-1 bg-muted border border-border rounded px-1.5 py-0.5 w-full"
						:value="row.text ?? ''"
						@change="updateText(row.path, $event)"
					/>
				</div>

				<div v-if="row.editableVisuals" class="flex items-center gap-3 text-[11px]">
					<label class="flex items-center gap-1">
						<span class="text-muted-foreground">{{ t('pptx.chart.userShapeFill') }}</span>
						<input
							type="color"
							:aria-label="t('pptx.chart.userShapeFill')"
							:value="row.fill ?? '#ffffff'"
							@change="onFill(row, $event)"
						/>
					</label>
					<label class="flex items-center gap-1">
						<span class="text-muted-foreground">{{ t('pptx.chart.userShapeStroke') }}</span>
						<input
							type="color"
							:aria-label="t('pptx.chart.userShapeStroke')"
							:value="row.stroke ?? '#000000'"
							@change="onStroke(row, $event)"
						/>
					</label>
				</div>

				<div v-if="row.editableAltText" class="flex items-center gap-1 text-[11px]">
					<span class="text-muted-foreground">{{ t('pptx.chart.userShapeAltText') }}</span>
					<input
						type="text"
						:aria-label="t('pptx.chart.userShapeAltText')"
						class="flex-1 bg-muted border border-border rounded px-1.5 py-0.5 w-full"
						:value="row.altText ?? ''"
						@change="onAltText(row, $event)"
					/>
				</div>

				<!-- Every row (including a grpSp group header) is position/size
				editable: a top-level group's own drawing anchor moves/resizes it,
				and a nested row edits a chart-relative from/to fraction. -->
				<ChartUserShapePositionFields
					:row="row"
					:user-shapes="chartData.userShapes"
					@patch="update"
					@box-patch="updateBox"
					@rotation-patch="updateRotation"
					@flip-patch="updateFlip"
				/>
			</div>
		</div>
	</div>
</template>
