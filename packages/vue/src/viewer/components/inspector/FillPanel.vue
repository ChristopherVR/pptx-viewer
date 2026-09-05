<script setup lang="ts">
import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';
import type { ThemeColorPickerCommit } from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { injectRecentColors } from '../../composables/recent-colors-context';
import RecentColorsRow from '../RecentColorsRow.vue';
import FillGradientControls from './FillGradientControls.vue';
import FillPatternControls from './FillPatternControls.vue';
import ThemeColorSwatchGrid from './ThemeColorSwatchGrid.vue';

/**
 * FillPanel: shape fill controls (mode, solid colour, opacity, gradient,
 * pattern).
 *
 * Only meaningful for shape-like elements (`hasShapeProperties`). When the
 * element has no shape properties a muted "No fill options" note is shown.
 *
 * Solid-mode fields emit the FULL merged `shapeStyle` sub-object as a shallow
 * patch directly (`{ shapeStyle: { ...current, fillMode, fillColor,
 * fillOpacity } }`); gradient and pattern mode delegate their own field
 * editing to {@link FillGradientControls} / {@link FillPatternControls} (split
 * out to keep this file under the repo's 300-LOC budget), which build the same
 * shallow `shapeStyle` patch shape from shared's `gradient-picker.ts` /
 * `PATTERN_PRESET_OPTIONS` and re-emit it here untouched.
 */
const props = defineProps<{
	element: PptxElement;
}>();

const emit = defineEmits<{
	update: [patch: Partial<PptxElement>];
}>();

const { t } = useI18n();
const recentColors = injectRecentColors();

type FillMode = 'none' | 'solid' | 'gradient' | 'pattern';

const applicable = computed(() => hasShapeProperties(props.element));

const currentStyle = computed<ShapeStyle>(() =>
	hasShapeProperties(props.element) ? (props.element.shapeStyle ?? {}) : {},
);

const fillMode = computed<FillMode>(() => {
	const mode = currentStyle.value.fillMode;
	return mode === 'gradient' || mode === 'pattern' || mode === 'none' ? mode : 'solid';
});

const fillColor = computed(() => currentStyle.value.fillColor ?? '#ffffff');

const fillOpacityPercent = computed(() => {
	const raw = currentStyle.value.fillOpacity ?? 1;
	return Math.round(raw * 100);
});

function patchStyle(patch: Partial<ShapeStyle>): void {
	emit('update', {
		shapeStyle: { ...currentStyle.value, ...patch },
	} as Partial<PptxElement>);
}

function onMode(value: string): void {
	patchStyle({ fillMode: value as FillMode });
}

function onColor(value: string): void {
	patchStyle({ fillColor: value, fillColorRef: undefined });
}

function onThemeColor(commit: ThemeColorPickerCommit): void {
	patchStyle({ fillColor: commit.hex, fillColorRef: commit.ref });
	recentColors?.push(commit.hex);
}

function onOpacity(value: string): void {
	const n = Number(value);
	if (!Number.isFinite(n)) {
		return;
	}
	const clamped = Math.min(100, Math.max(0, n));
	patchStyle({ fillOpacity: clamped / 100 });
}
</script>

<template>
	<div class="pptx-vue-fill flex flex-col gap-2 text-xs">
		<p v-if="!applicable" class="pptx-vue-fill-note text-muted-foreground italic">
			{{ t('pptx.fill.noOptions') }}
		</p>

		<template v-else>
			<label class="pptx-vue-fill-field flex flex-col gap-1">
				<span class="pptx-vue-fill-label text-muted-foreground">{{ t('pptx.fill.fill') }}</span>
				<select
					:aria-label="t('pptx.fill.fill')"
					class="pptx-vue-fill-select bg-muted border border-border rounded px-2 py-1"
					:value="fillMode"
					@change="onMode(($event.target as HTMLSelectElement).value)"
				>
					<option value="none">{{ t('pptx.fill.none') }}</option>
					<option value="solid">{{ t('pptx.fill.solid') }}</option>
					<option value="gradient">{{ t('pptx.fill.gradient') }}</option>
					<!-- No dedicated `pptx.fill.pattern` key exists yet (see final report);
					     reuses `pptx.table.fillPattern` ("Pattern"), the closest existing key. -->
					<option value="pattern">{{ t('pptx.table.fillPattern') }}</option>
				</select>
			</label>

			<template v-if="fillMode === 'solid'">
				<label class="pptx-vue-fill-field flex flex-col gap-1">
					<span class="pptx-vue-fill-label text-muted-foreground">{{ t('pptx.fill.color') }}</span>
					<input
						type="color"
						class="pptx-vue-fill-color w-full h-8 p-0 bg-muted border border-border rounded"
						:value="fillColor"
						@input="onColor(($event.target as HTMLInputElement).value)"
						@change="recentColors?.push(($event.target as HTMLInputElement).value)"
					/>
				</label>
				<ThemeColorSwatchGrid
					:selected-ref="currentStyle.fillColorRef"
					:selected-hex="fillColor"
					@pick="onThemeColor"
				/>
				<RecentColorsRow
					v-if="recentColors"
					:colors="recentColors.recent.value"
					@pick="
						(hex) => {
							onColor(hex);
							recentColors?.push(hex);
						}
					"
				/>

				<label class="pptx-vue-fill-field flex flex-col gap-1">
					<span class="pptx-vue-fill-label text-muted-foreground">{{
						t('pptx.fill.opacityPercent', { value: fillOpacityPercent })
					}}</span>
					<input
						type="range"
						class="pptx-vue-fill-range w-full accent-primary"
						min="0"
						max="100"
						:value="fillOpacityPercent"
						@input="onOpacity(($event.target as HTMLInputElement).value)"
					/>
				</label>
			</template>

			<FillGradientControls
				v-else-if="fillMode === 'gradient'"
				:element="element"
				@update="(patch) => emit('update', patch)"
			/>

			<FillPatternControls
				v-else-if="fillMode === 'pattern'"
				:element="element"
				@update="(patch) => emit('update', patch)"
			/>
		</template>
	</div>
</template>
