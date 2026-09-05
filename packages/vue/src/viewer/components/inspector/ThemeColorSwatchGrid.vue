<script setup lang="ts">
import type { PptxThemeColorRef } from 'pptx-viewer-core';
import type { ThemeColorPickerCommit } from 'pptx-viewer-shared';
import {
	buildThemeColorSwatchGrid,
	findSelectedThemeSwatch,
	themeColorSwatchRows,
	themeSwatchCommit,
} from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { injectThemeColorMap } from '../../composables/theme-color-map-context';

/**
 * PowerPoint's "Theme Colors" grid: ten columns (Background 1, Text 1,
 * Background 2, Text 2, Accent 1..6) each with a base swatch and five
 * luminance variants, built from the loaded deck's real theme colours
 * (`ThemeColorMapKey`) rather than a hard-coded Office palette.
 *
 * Renders nothing (not even the heading) when no deck theme is loaded yet,
 * so callers can render this unconditionally alongside their existing
 * hex/recent-colour controls.
 */
const props = defineProps<{
	disabled?: boolean;
	/** The element's current theme ref, if any (highlights the matching swatch). */
	selectedRef?: PptxThemeColorRef;
	/** The element's current resolved hex, used to highlight a swatch when no ref is stored. */
	selectedHex?: string;
}>();

const emit = defineEmits<{
	pick: [commit: ThemeColorPickerCommit];
}>();

const { t } = useI18n();
const themeColorMap = injectThemeColorMap();

const columns = computed(() => buildThemeColorSwatchGrid(themeColorMap?.value));
const rows = computed(() => themeColorSwatchRows(columns.value));
const selected = computed(() =>
	findSelectedThemeSwatch(columns.value, props.selectedRef, props.selectedHex),
);
</script>

<template>
	<div v-if="columns.length > 0" class="pptx-vue-theme-swatch-grid mt-1">
		<div class="pptx-vue-theme-swatch-grid-heading text-[10px] text-muted-foreground mb-1">
			{{ t('pptx.colorPicker.themeColors') }}
		</div>
		<div class="flex flex-col gap-0.5">
			<div v-for="(row, rowIndex) in rows" :key="rowIndex" class="flex gap-0.5">
				<template v-for="(swatch, colIndex) in row" :key="colIndex">
					<button
						v-if="swatch"
						type="button"
						:disabled="disabled"
						data-pptx-compact
						:title="swatch.label"
						:aria-label="swatch.label"
						class="h-4 w-4 rounded-sm border transition-transform hover:scale-110 disabled:opacity-40 disabled:cursor-not-allowed"
						:class="selected === swatch ? 'border-primary ring-1 ring-primary' : 'border-border'"
						:style="{ backgroundColor: swatch.hex }"
						@click="emit('pick', themeSwatchCommit(swatch))"
					/>
					<div v-else class="h-4 w-4" />
				</template>
			</div>
		</div>
	</div>
</template>
