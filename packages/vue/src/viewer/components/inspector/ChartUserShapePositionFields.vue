<script setup lang="ts">
import type { PptxChartUserShape } from 'pptx-viewer-core';
import type { ChartUserShapeRow, ChartUserShapeRowPatch } from 'pptx-viewer-shared';
import { getChartUserShapeRowChartBox } from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

/**
 * Position/size editor for one chart overlay row, mirroring React's
 * `ChartUserShapePositionFields.tsx` (CLAUDE.md Rule 2). A top-level row
 * edits its anchor markers directly (rel `from`/`to` fractions, or abs
 * `from` + `ext` EMU: a top-level `grpSp` row's anchor already moves/resizes
 * the whole group with children following, see `chart-user-shape-tree.ts`'s
 * `editablePosition` doc). A nested row, INCLUDING a nested `grpSp` group
 * header, edits a `from`/`to` chart-relative fraction pair instead of raw
 * EMU (`chart-user-shape-row-frame.ts`), matching how a top-level
 * `relSizeAnchor` row already edits.
 */
const props = defineProps<{
	row: ChartUserShapeRow;
	/** The chart's full overlay tree, needed to resolve a nested row's ancestor group chain. */
	userShapes: ReadonlyArray<PptxChartUserShape> | undefined;
}>();

const emit = defineEmits<{
	patch: [path: readonly number[], patch: ChartUserShapeRowPatch];
	boxPatch: [
		path: readonly number[],
		box: { from: { x: number; y: number }; to: { x: number; y: number } },
	];
	/** This row's own rotation edit (see `withChartUserShapeRowRotationUpdated`). */
	rotationPatch: [path: readonly number[], rotation: number | undefined];
	/** This row's own flip edit (see `withChartUserShapeRowFlipUpdated`). */
	flipPatch: [path: readonly number[], flip: { flipH?: boolean; flipV?: boolean }];
}>();

const { t } = useI18n();

const box = computed(() => getChartUserShapeRowChartBox(props.userShapes, props.row.path));

function num(event: Event): number {
	return Number((event.target as HTMLInputElement).value);
}

function onFromX(event: Event): void {
	const from = props.row.from!;
	emit('patch', props.row.path, { from: { ...from, x: num(event) } });
}
function onFromY(event: Event): void {
	const from = props.row.from!;
	emit('patch', props.row.path, { from: { ...from, y: num(event) } });
}
function onToX(event: Event): void {
	const to = props.row.to!;
	emit('patch', props.row.path, { to: { ...to, x: num(event) } });
}
function onToY(event: Event): void {
	const to = props.row.to!;
	emit('patch', props.row.path, { to: { ...to, y: num(event) } });
}
function onExtCx(event: Event): void {
	const ext = props.row.ext!;
	emit('patch', props.row.path, { ext: { ...ext, cx: num(event) } });
}
function onExtCy(event: Event): void {
	const ext = props.row.ext!;
	emit('patch', props.row.path, { ext: { ...ext, cy: num(event) } });
}
function onBoxFromX(event: Event): void {
	const b = box.value!;
	emit('boxPatch', props.row.path, { from: { ...b.from, x: num(event) }, to: b.to });
}
function onBoxFromY(event: Event): void {
	const b = box.value!;
	emit('boxPatch', props.row.path, { from: { ...b.from, y: num(event) }, to: b.to });
}
function onBoxToX(event: Event): void {
	const b = box.value!;
	emit('boxPatch', props.row.path, { from: b.from, to: { ...b.to, x: num(event) } });
}
function onBoxToY(event: Event): void {
	const b = box.value!;
	emit('boxPatch', props.row.path, { from: b.from, to: { ...b.to, y: num(event) } });
}
function onRotation(event: Event): void {
	const value = num(event);
	emit('rotationPatch', props.row.path, value || undefined);
}
function onFlipH(event: Event): void {
	emit('flipPatch', props.row.path, { flipH: (event.target as HTMLInputElement).checked });
}
function onFlipV(event: Event): void {
	emit('flipPatch', props.row.path, { flipV: (event.target as HTMLInputElement).checked });
}
</script>

<template>
	<div v-if="row.depth === 0" class="flex flex-wrap items-center gap-1 text-[11px]">
		<span class="text-muted-foreground">{{ t('pptx.chart.userShapeFrom') }}</span>
		<input
			type="number"
			step="0.01"
			min="0"
			max="1"
			class="flex-1 bg-muted border border-border rounded px-1.5 py-0.5 w-full"
			:value="row.from!.x"
			@change="onFromX"
		/>
		<input
			type="number"
			step="0.01"
			min="0"
			max="1"
			class="flex-1 bg-muted border border-border rounded px-1.5 py-0.5 w-full"
			:value="row.from!.y"
			@change="onFromY"
		/>
		<template v-if="row.anchor === 'rel' && row.to">
			<span class="text-muted-foreground">{{ t('pptx.chart.userShapeTo') }}</span>
			<input
				type="number"
				step="0.01"
				min="0"
				max="1"
				class="flex-1 bg-muted border border-border rounded px-1.5 py-0.5 w-full"
				:value="row.to.x"
				@change="onToX"
			/>
			<input
				type="number"
				step="0.01"
				min="0"
				max="1"
				class="flex-1 bg-muted border border-border rounded px-1.5 py-0.5 w-full"
				:value="row.to.y"
				@change="onToY"
			/>
		</template>
		<template v-if="row.anchor === 'abs' && row.ext">
			<span class="text-muted-foreground">{{ t('pptx.chart.userShapeSize') }}</span>
			<input
				type="number"
				min="0"
				class="flex-1 bg-muted border border-border rounded px-1.5 py-0.5 w-full"
				:value="row.ext.cx"
				@change="onExtCx"
			/>
			<input
				type="number"
				min="0"
				class="flex-1 bg-muted border border-border rounded px-1.5 py-0.5 w-full"
				:value="row.ext.cy"
				@change="onExtCy"
			/>
		</template>
		<span class="text-muted-foreground">{{ t('pptx.chart.userShapeRotation') }}</span>
		<input
			type="number"
			step="1"
			:aria-label="t('pptx.chart.userShapeRotation')"
			class="flex-1 bg-muted border border-border rounded px-1.5 py-0.5 w-full"
			:value="row.rotation ?? 0"
			@change="onRotation"
		/>
		<label class="flex items-center gap-1 cursor-pointer">
			<input
				type="checkbox"
				:aria-label="t('pptx.arrange.flipHorizontally')"
				class="accent-primary"
				:checked="row.flipH ?? false"
				@change="onFlipH"
			/>
			<span class="text-muted-foreground">{{ t('pptx.arrange.flipHorizontally') }}</span>
		</label>
		<label class="flex items-center gap-1 cursor-pointer">
			<input
				type="checkbox"
				:aria-label="t('pptx.arrange.flipVertically')"
				class="accent-primary"
				:checked="row.flipV ?? false"
				@change="onFlipV"
			/>
			<span class="text-muted-foreground">{{ t('pptx.arrange.flipVertically') }}</span>
		</label>
	</div>
	<div v-else-if="box" class="flex flex-wrap items-center gap-1 text-[11px]">
		<span class="text-muted-foreground">{{ t('pptx.chart.userShapeFrom') }}</span>
		<input
			type="number"
			step="0.01"
			min="0"
			max="1"
			class="flex-1 bg-muted border border-border rounded px-1.5 py-0.5 w-full"
			:value="box.from.x"
			@change="onBoxFromX"
		/>
		<input
			type="number"
			step="0.01"
			min="0"
			max="1"
			class="flex-1 bg-muted border border-border rounded px-1.5 py-0.5 w-full"
			:value="box.from.y"
			@change="onBoxFromY"
		/>
		<span class="text-muted-foreground">{{ t('pptx.chart.userShapeTo') }}</span>
		<input
			type="number"
			step="0.01"
			min="0"
			max="1"
			class="flex-1 bg-muted border border-border rounded px-1.5 py-0.5 w-full"
			:value="box.to.x"
			@change="onBoxToX"
		/>
		<input
			type="number"
			step="0.01"
			min="0"
			max="1"
			class="flex-1 bg-muted border border-border rounded px-1.5 py-0.5 w-full"
			:value="box.to.y"
			@change="onBoxToY"
		/>
		<span class="text-muted-foreground">{{ t('pptx.chart.userShapeRotation') }}</span>
		<input
			type="number"
			step="1"
			:aria-label="t('pptx.chart.userShapeRotation')"
			class="flex-1 bg-muted border border-border rounded px-1.5 py-0.5 w-full"
			:value="row.rotation ?? 0"
			@change="onRotation"
		/>
		<label class="flex items-center gap-1 cursor-pointer">
			<input
				type="checkbox"
				:aria-label="t('pptx.arrange.flipHorizontally')"
				class="accent-primary"
				:checked="row.flipH ?? false"
				@change="onFlipH"
			/>
			<span class="text-muted-foreground">{{ t('pptx.arrange.flipHorizontally') }}</span>
		</label>
		<label class="flex items-center gap-1 cursor-pointer">
			<input
				type="checkbox"
				:aria-label="t('pptx.arrange.flipVertically')"
				class="accent-primary"
				:checked="row.flipV ?? false"
				@change="onFlipV"
			/>
			<span class="text-muted-foreground">{{ t('pptx.arrange.flipVertically') }}</span>
		</label>
	</div>
</template>
