<script setup lang="ts">
import type { PptxElement } from 'pptx-viewer-core';
import { ooxmlGradientAngleToCssDegrees } from 'pptx-viewer-core';
import {
	addGradientStopPatch,
	gradientStateOf,
	gradientStatePatch,
	removeGradientStopPatch,
	updateGradientStopPatch,
} from 'pptx-viewer-shared';
import type { GradientStop, ThemeColorPickerCommit } from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { injectRecentColors } from '../../composables/recent-colors-context';
import ThemeColorSwatchGrid from './ThemeColorSwatchGrid.vue';

/**
 * FillGradientControls: the gradient-fill half of {@link FillPanel}, shown
 * when `shapeStyle.fillMode === 'gradient'`. Split into its own file to keep
 * `FillPanel.vue` thin and under this repo's 300-LOC budget.
 *
 * State extraction and every patch-builder come from shared's
 * `gradient-picker.ts` (`gradientStateOf`, `gradientStatePatch`,
 * `addGradientStopPatch`, `removeGradientStopPatch`, `updateGradientStopPatch`)
 * - the same pure decision functions Angular's `gradient-picker.component.ts`
 * already consumes - so this component only maps DOM events onto those.
 */
const props = defineProps<{
	element: PptxElement;
}>();

const emit = defineEmits<{
	update: [patch: Partial<PptxElement>];
}>();

const { t } = useI18n();
const recentColors = injectRecentColors();

const state = computed(() => gradientStateOf(props.element));

/**
 * CSS gradient string for the preview strip. `state.angle` is the authored
 * OOXML angle, which is not the same axis as CSS's `linear-gradient()`
 * angle, so the preview has to run it through the same conversion the canvas
 * renderer uses or it lies about the direction by 90deg.
 */
const previewCss = computed(() => {
	const s = state.value;
	const stopsCss = s.stops.map((stop) => `${stop.color} ${stop.position}%`).join(', ');
	return s.type === 'radial'
		? `radial-gradient(circle, ${stopsCss})`
		: `linear-gradient(${ooxmlGradientAngleToCssDegrees(s.angle)}deg, ${stopsCss})`;
});

function onTypeChange(value: string): void {
	if (value !== 'linear' && value !== 'radial') {
		return;
	}
	emit('update', gradientStatePatch(props.element, { ...state.value, type: value }));
}

function onAngleChange(value: string): void {
	const n = Number(value);
	if (!Number.isFinite(n)) {
		return;
	}
	const angle = ((Math.round(n) % 360) + 360) % 360;
	emit('update', gradientStatePatch(props.element, { ...state.value, angle }));
}

function onStopColor(index: number, value: string): void {
	emit(
		'update',
		updateGradientStopPatch(props.element, index, { color: value, colorRef: undefined }),
	);
}

function onStopColorCommit(value: string): void {
	recentColors?.push(value);
}

function onStopThemePick(index: number, commit: ThemeColorPickerCommit): void {
	emit(
		'update',
		updateGradientStopPatch(props.element, index, { color: commit.hex, colorRef: commit.ref }),
	);
	recentColors?.push(commit.hex);
}

function onStopPosition(index: number, value: string): void {
	const n = Number(value);
	if (!Number.isFinite(n)) {
		return;
	}
	emit(
		'update',
		updateGradientStopPatch(props.element, index, { position: Math.max(0, Math.min(100, n)) }),
	);
}

function onStopOpacity(index: number, value: string): void {
	const n = Number(value);
	if (!Number.isFinite(n)) {
		return;
	}
	const opacity = Math.max(0, Math.min(1, n)) as GradientStop['opacity'];
	emit('update', updateGradientStopPatch(props.element, index, { opacity }));
}

function onRemoveStop(index: number): void {
	const patch = removeGradientStopPatch(props.element, index);
	if (patch) {
		emit('update', patch);
	}
}

function onAddStop(): void {
	emit('update', addGradientStopPatch(props.element, '#888888', 50));
}
</script>

<template>
	<div class="pptx-vue-gradient flex flex-col gap-2 text-xs">
		<span
			class="pptx-vue-gradient-heading font-medium uppercase tracking-wide text-muted-foreground"
		>
			{{ t('pptx.gradient.heading') }}
		</span>

		<label class="pptx-vue-gradient-field flex flex-col gap-1">
			<span class="pptx-vue-gradient-label text-muted-foreground">{{
				t('pptx.gradient.type')
			}}</span>
			<select
				:aria-label="t('pptx.gradient.type')"
				class="pptx-vue-gradient-select rounded border border-border bg-muted px-2 py-1"
				:value="state.type"
				@change="onTypeChange(($event.target as HTMLSelectElement).value)"
			>
				<option value="linear">{{ t('pptx.gradient.linear') }}</option>
				<option value="radial">{{ t('pptx.gradient.radial') }}</option>
			</select>
		</label>

		<label v-if="state.type === 'linear'" class="pptx-vue-gradient-field flex flex-col gap-1">
			<span class="pptx-vue-gradient-label text-muted-foreground">{{
				t('pptx.gradient.angle')
			}}</span>
			<div class="flex items-center gap-2">
				<input
					type="range"
					class="pptx-vue-gradient-range flex-1 accent-primary"
					min="0"
					max="359"
					:value="state.angle"
					@input="onAngleChange(($event.target as HTMLInputElement).value)"
				/>
				<input
					type="number"
					class="pptx-vue-gradient-input w-16 rounded border border-border bg-muted px-2 py-1"
					min="0"
					max="359"
					:value="state.angle"
					@change="onAngleChange(($event.target as HTMLInputElement).value)"
				/>
			</div>
		</label>

		<div
			class="pptx-vue-gradient-preview h-5 rounded border border-border"
			:style="{ background: previewCss }"
			aria-hidden="true"
		/>

		<span class="pptx-vue-gradient-stops-heading uppercase tracking-wide text-muted-foreground">
			{{ t('pptx.gradient.stops') }}
		</span>
		<div v-for="(stop, index) in state.stops" :key="index" class="pptx-vue-gradient-stop-block">
			<div
				data-testid="fx-gradient-stop-row"
				class="pptx-vue-gradient-stop-row flex items-center gap-1"
			>
				<span class="pptx-vue-gradient-stop-idx w-3 text-center text-muted-foreground">{{
					index + 1
				}}</span>
				<input
					type="color"
					class="pptx-vue-gradient-color h-6 w-8 cursor-pointer rounded border border-border"
					:value="stop.color"
					@input="onStopColor(index, ($event.target as HTMLInputElement).value)"
					@change="onStopColorCommit(($event.target as HTMLInputElement).value)"
				/>
				<input
					type="number"
					class="pptx-vue-gradient-input w-14 rounded border border-border bg-muted px-1.5 py-0.5"
					:aria-label="t('pptx.gradient.position')"
					min="0"
					max="100"
					:value="Math.round(stop.position)"
					@change="onStopPosition(index, ($event.target as HTMLInputElement).value)"
				/>
				<span class="text-[10px] text-muted-foreground">%</span>
				<input
					type="number"
					class="pptx-vue-gradient-input w-14 rounded border border-border bg-muted px-1.5 py-0.5"
					aria-label="alpha"
					min="0"
					max="1"
					step="0.05"
					:value="stop.opacity ?? 1"
					@change="onStopOpacity(index, ($event.target as HTMLInputElement).value)"
				/>
				<button
					type="button"
					class="pptx-vue-gradient-remove ml-auto rounded border border-border px-1.5 text-muted-foreground hover:text-destructive"
					:title="t('pptx.gradient.removeStop')"
					:disabled="state.stops.length <= 2"
					@click="onRemoveStop(index)"
				>
					&times;
				</button>
			</div>
			<ThemeColorSwatchGrid
				:selected-ref="stop.colorRef"
				:selected-hex="stop.color"
				@pick="(commit) => onStopThemePick(index, commit)"
			/>
		</div>
		<button
			type="button"
			class="pptx-vue-gradient-add self-start rounded border border-border px-2 py-1 text-[11px] text-primary hover:bg-accent"
			@click="onAddStop"
		>
			{{ t('pptx.gradient.addStop') }}
		</button>
	</div>
</template>
