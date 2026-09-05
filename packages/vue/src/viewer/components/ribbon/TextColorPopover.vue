<script setup lang="ts">
/**
 * TextColorPopover: the hover-reveal swatch popover shared by the ribbon's
 * font-colour and text-highlight-colour pickers in `TextSection.vue`. Split
 * out (mirroring Angular's `RibbonColorPopoverComponent`) so the preset grid,
 * the "Recent colours" row, and the custom-colour input are wired up once
 * instead of twice, and to keep `TextSection.vue` closer to this repo's
 * 300-LOC-per-file budget. The trigger icon is passed via the default slot.
 */
import type { PptxThemeColorRef } from 'pptx-viewer-core';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { injectRecentColors } from '../../composables/recent-colors-context';
import ThemeColorSwatchGrid from '../inspector/ThemeColorSwatchGrid.vue';
import RecentColorsRow from '../RecentColorsRow.vue';
import { vAnchoredPopup } from './anchored-popup';
import { pill } from './ribbon-constants';

const props = defineProps<{
	current: string;
	presets: readonly string[];
	disabled: boolean;
	titleKey: string;
	/** Show the deck's "Theme Colors" grid above the presets (font colour only: highlight
	 * colour has no theme-ref concept on the model). */
	showThemeColors?: boolean;
	/** The element's current theme ref, if any (only meaningful with `showThemeColors`). */
	currentRef?: PptxThemeColorRef;
}>();

const emit = defineEmits<{
	pick: [hex: string, ref?: PptxThemeColorRef];
}>();

const { t } = useI18n();
const recentColors = injectRecentColors();
const triggerRef = ref<HTMLButtonElement | null>(null);
const colorInputRef = ref<HTMLInputElement | null>(null);

/**
 * Every commit through this popover both fires `pick` and records the colour
 * as recently used. Omits the second `pick` argument entirely (rather than
 * passing an explicit `undefined`) when there is no theme ref, so callers
 * that only read the hex see the exact same one-argument emission as before
 * `showThemeColors` existed.
 */
function pick(hex: string, themeRef?: PptxThemeColorRef): void {
	if (themeRef !== undefined) {
		emit('pick', hex, themeRef);
	} else {
		emit('pick', hex);
	}
	recentColors?.push(hex);
}
</script>

<template>
	<div class="relative group">
		<button
			ref="triggerRef"
			type="button"
			:disabled="props.disabled"
			:class="pill"
			:title="t(props.titleKey)"
			@mousedown.prevent
		>
			<slot />
			<div class="w-4 h-1 rounded-sm -mt-0.5" :style="{ backgroundColor: props.current }" />
		</button>
		<div class="z-50 hidden group-hover:block pt-1" v-anchored-popup="{ anchor: triggerRef }">
			<div
				class="rounded-lg border border-border bg-popover backdrop-blur-lg shadow-2xl p-2"
				:class="showThemeColors ? 'w-48' : 'w-36'"
			>
				<ThemeColorSwatchGrid
					v-if="showThemeColors"
					:disabled="props.disabled"
					:selected-ref="currentRef"
					:selected-hex="current"
					@pick="(c) => pick(c.hex, c.ref)"
				/>
				<div v-if="showThemeColors" class="text-[10px] text-muted-foreground mt-1 mb-1">
					{{ t('pptx.colorPicker.standardColors') }}
				</div>
				<div class="grid grid-cols-5 gap-1.5 mb-2">
					<button
						v-for="c in presets"
						:key="c"
						type="button"
						:class="[
							'w-5 h-5 rounded-full border transition-transform hover:scale-125',
							props.current?.toLowerCase() === c
								? 'border-primary ring-1 ring-primary'
								: 'border-border',
						]"
						data-pptx-compact
						:style="{ backgroundColor: c }"
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
				<button
					type="button"
					class="w-full text-[10px] text-muted-foreground hover:text-foreground py-1 transition-colors"
					@mousedown.prevent
					@click="colorInputRef?.click()"
				>
					{{ t('pptx.ribbon.customColour') }}
				</button>
				<input
					ref="colorInputRef"
					type="color"
					class="sr-only"
					:value="props.current"
					@change="pick(($event.target as HTMLInputElement).value)"
				/>
			</div>
		</div>
	</div>
</template>
