<script setup lang="ts">
/**
 * ShapeColorPopover: the Home > Drawing Shape Fill / Shape Outline button
 * and its swatch popover (theme grid, standard colours, recent colours).
 * Extracted from `DrawingGroup.vue`, which rendered the same markup twice.
 */
import type { PptxThemeColorRef } from 'pptx-viewer-core';
import type { ThemeColorPickerCommit } from 'pptx-viewer-shared';
import { RIBBON_SHAPE_SWATCHES } from 'pptx-viewer-shared';
import type { Component } from 'vue';
import { useI18n } from 'vue-i18n';

import { injectRecentColors } from '../../composables/recent-colors-context';
import ThemeColorSwatchGrid from '../inspector/ThemeColorSwatchGrid.vue';
import RecentColorsRow from '../RecentColorsRow.vue';
import { vAnchoredPopup } from './anchored-popup';
import { ic, pill } from './ribbon-constants';
import { useDropdown } from './use-dropdown';

interface Props {
	disabled: boolean;
	icon: Component;
	/** i18n key of the button title. */
	titleKey: string;
	/** Prefix of each standard swatch's aria-label ("Fill colour", "Outline colour"). */
	swatchAriaPrefix: string;
	selectedRef?: PptxThemeColorRef;
	selectedHex?: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{ pick: [color: string, ref?: PptxThemeColorRef] }>();
const { t } = useI18n();
const recentColors = injectRecentColors();
const menu = useDropdown();

function pick(color: string, ref?: PptxThemeColorRef): void {
	emit('pick', color, ref);
	recentColors?.push(color);
	menu.close();
}

function onThemePick(commit: ThemeColorPickerCommit): void {
	pick(commit.hex, commit.ref);
}
</script>

<template>
	<div :ref="menu.root" class="relative">
		<button
			type="button"
			:disabled="props.disabled"
			:class="pill"
			:title="t(props.titleKey)"
			@click="menu.toggle()"
		>
			<component :is="props.icon" :class="ic" />
		</button>
		<div v-if="menu.open.value" class="z-50 pt-1" v-anchored-popup="{ anchor: menu.root.value }">
			<div class="rounded-lg border border-border bg-popover backdrop-blur-lg shadow-2xl p-2">
				<ThemeColorSwatchGrid
					:disabled="props.disabled"
					:selected-ref="props.selectedRef"
					:selected-hex="props.selectedHex"
					@pick="onThemePick"
				/>
				<div class="mt-1 text-[10px] text-muted-foreground mb-1">
					{{ t('pptx.colorPicker.standardColors') }}
				</div>
				<div class="grid grid-cols-6 gap-1">
					<button
						v-for="c in RIBBON_SHAPE_SWATCHES"
						:key="c"
						type="button"
						:aria-label="`${props.swatchAriaPrefix} ${c}`"
						class="w-5 h-5 rounded border border-border/60 hover:scale-110 transition-transform"
						data-pptx-compact
						:style="{ backgroundColor: c }"
						:title="c"
						@mousedown.prevent
						@click="pick(c)"
					/>
				</div>
				<RecentColorsRow
					v-if="recentColors"
					:colors="recentColors.recent.value"
					:disabled="props.disabled"
					@pick="pick"
				/>
			</div>
		</div>
	</div>
</template>
