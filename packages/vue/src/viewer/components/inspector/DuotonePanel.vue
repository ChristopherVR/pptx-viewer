<script setup lang="ts">
import type { PptxElement, PptxImageEffects } from 'pptx-viewer-core';
import { DUOTONE_PRESETS, normalizeHexColor } from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import {
	DEFAULT_DUOTONE,
	humanizeEffectLabel,
	mergeEffectsPatch,
} from '../../composables/useImageEditing';
import DebouncedColorInput from './DebouncedColorInput.vue';

/**
 * DuotonePanel: the duotone image effect (`a:duotone`) - a shadow + highlight
 * colour pair plus quick-apply presets from the shared DUOTONE_PRESETS
 * catalogue. Emits the FULL merged `imageEffects` sub-object per change.
 */
const props = defineProps<{
	fx: PptxImageEffects | undefined;
}>();

const emit = defineEmits<{
	update: [patch: Partial<PptxElement>];
}>();

const { t } = useI18n();

const duotone = computed(() => props.fx?.duotone);
const shadow = computed<string>(() =>
	normalizeHexColor(duotone.value?.color1, DEFAULT_DUOTONE.color1),
);
const highlight = computed<string>(() =>
	normalizeHexColor(duotone.value?.color2, DEFAULT_DUOTONE.color2),
);

function commit(color1: string, color2: string): void {
	emit('update', mergeEffectsPatch(props.fx, { duotone: { color1, color2 } }));
}

function clear(): void {
	emit('update', mergeEffectsPatch(props.fx, { duotone: undefined }));
}

function onShadow(hex: string): void {
	commit(hex, highlight.value);
}

function onHighlight(hex: string): void {
	commit(shadow.value, hex);
}
</script>

<template>
	<div class="pptx-vue-duotone flex flex-col gap-2 text-[11px]">
		<span class="font-semibold text-muted-foreground">{{ t('pptx.image.duotone') }}</span>

		<div class="flex items-center gap-3">
			<label class="flex items-center gap-1.5">
				<span class="text-muted-foreground">{{ t('pptx.image.duotoneShadows') }}</span>
				<DebouncedColorInput
					:value="shadow"
					:aria-label="t('pptx.image.duotoneShadowsAria')"
					@commit="onShadow"
				/>
			</label>
			<label class="flex items-center gap-1.5">
				<span class="text-muted-foreground">{{ t('pptx.image.duotoneHighlights') }}</span>
				<DebouncedColorInput
					:value="highlight"
					:aria-label="t('pptx.image.duotoneHighlightsAria')"
					@commit="onHighlight"
				/>
			</label>
		</div>

		<div class="flex flex-col gap-1">
			<span class="text-[10px] text-muted-foreground">{{ t('pptx.image.duotonePresets') }}</span>
			<div class="pptx-vue-duotone__grid grid grid-cols-4 gap-1">
				<button
					v-for="preset in DUOTONE_PRESETS"
					:key="preset.labelKey"
					type="button"
					class="pptx-vue-duotone__cell flex flex-col items-center gap-0.5 rounded border border-border hover:bg-accent p-1 transition-colors"
					:title="humanizeEffectLabel(preset.labelKey)"
					@click="commit(preset.shadow, preset.highlight)"
				>
					<div class="flex h-4 w-full overflow-hidden rounded">
						<div class="flex-1" :style="{ backgroundColor: preset.shadow }" />
						<div class="flex-1" :style="{ backgroundColor: preset.highlight }" />
					</div>
					<span class="w-full truncate text-center text-[8px] text-muted-foreground">
						{{ humanizeEffectLabel(preset.labelKey) }}
					</span>
				</button>
			</div>
		</div>

		<button
			v-if="duotone"
			type="button"
			class="pptx-vue-duotone__clear w-full rounded border border-border bg-muted px-2 py-1 hover:bg-accent transition-colors"
			@click="clear"
		>
			{{ t('pptx.image.duotoneClear') }}
		</button>
	</div>
</template>
