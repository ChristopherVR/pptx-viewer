<script setup lang="ts">
import type { PptxElement, PptxImageEffects } from 'pptx-viewer-core';
import { normalizeHexColor } from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { DEFAULT_COLOR_WASH, mergeEffectsPatch } from '../../composables/useImageEditing';
import DebouncedColorInput from './DebouncedColorInput.vue';

/**
 * ColorWashSection: a colour wash (tint) toggle plus wash colour + opacity
 * controls. Emits the FULL merged `imageEffects` sub-object per change, exactly
 * like every other image sub-panel.
 */
const props = defineProps<{
	fx: PptxImageEffects | undefined;
}>();

const emit = defineEmits<{
	update: [patch: Partial<PptxElement>];
}>();

const { t } = useI18n();

const wash = computed(() => props.fx?.colorWash);
const washColor = computed<string>(() =>
	normalizeHexColor(wash.value?.color, DEFAULT_COLOR_WASH.color),
);
const washOpacity = computed<number>(() => wash.value?.opacity ?? DEFAULT_COLOR_WASH.opacity);

function commit(patch: Partial<PptxImageEffects>): void {
	emit('update', mergeEffectsPatch(props.fx, patch));
}

function onToggle(event: Event): void {
	const on = (event.target as HTMLInputElement).checked;
	commit({ colorWash: on ? { ...DEFAULT_COLOR_WASH } : undefined });
}

function onColor(hex: string): void {
	commit({ colorWash: { color: hex, opacity: washOpacity.value } });
}

function onOpacity(event: Event): void {
	commit({
		colorWash: {
			color: washColor.value,
			opacity: Number((event.target as HTMLInputElement).value),
		},
	});
}
</script>

<template>
	<div class="pptx-vue-color-wash flex flex-col gap-1 text-[11px]">
		<label class="flex items-center justify-between gap-2">
			<span class="font-semibold text-muted-foreground">{{ t('pptx.image.colorWash') }}</span>
			<input type="checkbox" :checked="Boolean(wash)" @change="onToggle" />
		</label>

		<div v-if="wash" class="grid grid-cols-2 gap-1.5">
			<label class="flex items-center gap-2">
				<span class="text-muted-foreground">{{ t('pptx.image.washColor') }}</span>
				<DebouncedColorInput
					:value="washColor"
					:aria-label="t('pptx.image.washColorAria')"
					@commit="onColor"
				/>
			</label>
			<label class="flex flex-col gap-1">
				<span class="text-muted-foreground">{{ t('pptx.image.washOpacity') }}</span>
				<input
					type="range"
					class="w-full accent-primary"
					min="0"
					max="100"
					step="1"
					:value="washOpacity"
					@input="onOpacity"
				/>
			</label>
		</div>
	</div>
</template>
