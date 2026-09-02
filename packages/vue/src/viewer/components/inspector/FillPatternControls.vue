<script setup lang="ts">
import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';
import { getPatternSvg, PATTERN_PRESET_OPTIONS } from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { injectRecentColors } from '../../composables/recent-colors-context';

/**
 * FillPatternControls: the pattern-fill half of {@link FillPanel}, shown when
 * `shapeStyle.fillMode === 'pattern'`. Split into its own file to keep
 * `FillPanel.vue` thin and under this repo's 300-LOC budget.
 *
 * The preset list comes from shared's `PATTERN_PRESET_OPTIONS` (the same
 * 56-entry `{ value, labelKey }` catalogue every binding now shares, replacing
 * a hand-copied token list per binding), and each swatch's preview is rendered
 * with shared's `getPatternSvg` so the picker shows the exact tile the shape
 * itself will paint. Foreground/background colour mirror React's
 * `FillAdvancedControls.tsx`: foreground is the shape's own `fillColor`,
 * background is `fillPatternBackgroundColor`.
 */
const props = defineProps<{
	element: PptxElement;
}>();

const emit = defineEmits<{
	update: [patch: Partial<PptxElement>];
}>();

const { t } = useI18n();
const recentColors = injectRecentColors();

const currentStyle = computed<ShapeStyle>(() =>
	hasShapeProperties(props.element) ? (props.element.shapeStyle ?? {}) : {},
);

const foreground = computed(() => currentStyle.value.fillColor ?? '#000000');
const background = computed(() => currentStyle.value.fillPatternBackgroundColor ?? '#ffffff');
const preset = computed(() => currentStyle.value.fillPatternPreset ?? 'pct20');

function swatchSvg(value: string): string | null {
	return getPatternSvg(value, foreground.value, background.value);
}

function patchStyle(patch: Partial<ShapeStyle>): void {
	emit('update', {
		shapeStyle: { ...currentStyle.value, fillMode: 'pattern', ...patch },
	} as Partial<PptxElement>);
}

function onSelectPreset(value: string): void {
	patchStyle({ fillPatternPreset: value });
}

function onForeground(value: string): void {
	patchStyle({ fillColor: value });
}

function onBackground(value: string): void {
	patchStyle({ fillPatternBackgroundColor: value });
}

function onColorCommit(value: string): void {
	recentColors?.push(value);
}
</script>

<template>
	<div class="pptx-vue-pattern flex flex-col gap-2 text-xs">
		<span class="pptx-vue-pattern-label text-muted-foreground">{{
			t('pptx.table.patternPreset')
		}}</span>
		<div
			class="pptx-vue-pattern-grid grid max-h-48 grid-cols-8 gap-1 overflow-y-auto rounded border border-border p-2"
		>
			<button
				v-for="opt in PATTERN_PRESET_OPTIONS"
				:key="opt.value"
				type="button"
				data-testid="fx-pattern-swatch"
				:title="t(opt.labelKey)"
				:aria-pressed="preset === opt.value"
				class="pptx-vue-pattern-swatch h-8 w-8 rounded border transition-colors"
				:class="
					preset === opt.value ? 'border-2 border-primary' : 'border-border hover:border-primary/50'
				"
				@click="onSelectPreset(opt.value)"
			>
				<div
					v-if="swatchSvg(opt.value)"
					class="h-full w-full rounded-sm"
					:style="{
						backgroundImage: `url('data:image/svg+xml;utf8,${encodeURIComponent(swatchSvg(opt.value) ?? '')}')`,
						backgroundRepeat: 'repeat',
						backgroundSize: '8px 8px',
					}"
				/>
			</button>
		</div>

		<label class="pptx-vue-pattern-field flex flex-col gap-1">
			<span class="pptx-vue-pattern-label text-muted-foreground">{{
				t('pptx.fillAdvanced.foregroundColor')
			}}</span>
			<input
				type="color"
				class="pptx-vue-pattern-color h-8 w-full rounded border border-border bg-muted p-0"
				:value="foreground"
				@input="onForeground(($event.target as HTMLInputElement).value)"
				@change="onColorCommit(($event.target as HTMLInputElement).value)"
			/>
		</label>
		<label class="pptx-vue-pattern-field flex flex-col gap-1">
			<span class="pptx-vue-pattern-label text-muted-foreground">{{
				t('pptx.fillAdvanced.backgroundColor')
			}}</span>
			<input
				type="color"
				class="pptx-vue-pattern-color h-8 w-full rounded border border-border bg-muted p-0"
				:value="background"
				@input="onBackground(($event.target as HTMLInputElement).value)"
				@change="onColorCommit(($event.target as HTMLInputElement).value)"
			/>
		</label>
	</div>
</template>
