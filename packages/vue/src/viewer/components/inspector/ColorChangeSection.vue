<script setup lang="ts">
import type { PptxElement, PptxImageEffects } from 'pptx-viewer-core';
import { normalizeHexColor } from 'pptx-viewer-shared';
import { computed } from 'vue';

import { DEFAULT_CLR_CHANGE, mergeEffectsPatch } from '../../composables/useImageEditing';
import DebouncedColorInput from './DebouncedColorInput.vue';

/**
 * ColorChangeSection: recolour (chroma-key) toggle with from/to colour pickers
 * and a "make target transparent" option, mapping to `imageEffects.clrChange`
 * (`a:clrChange`). Emits the FULL merged `imageEffects` sub-object per change.
 */
const props = defineProps<{
	fx: PptxImageEffects | undefined;
}>();

const emit = defineEmits<{
	update: [patch: Partial<PptxElement>];
}>();

const cc = computed(() => props.fx?.clrChange);
const clrFrom = computed<string>(() =>
	normalizeHexColor(cc.value?.clrFrom, DEFAULT_CLR_CHANGE.clrFrom),
);
const clrTo = computed<string>(() => normalizeHexColor(cc.value?.clrTo, DEFAULT_CLR_CHANGE.clrTo));
const toTransparent = computed<boolean>(() => Boolean(cc.value?.clrToTransparent));

function commit(patch: Partial<PptxImageEffects>): void {
	emit('update', mergeEffectsPatch(props.fx, patch));
}

function onToggle(event: Event): void {
	const on = (event.target as HTMLInputElement).checked;
	commit({ clrChange: on ? { ...DEFAULT_CLR_CHANGE } : undefined });
}

function onFrom(hex: string): void {
	commit({
		clrChange: { clrFrom: hex, clrTo: clrTo.value, clrToTransparent: toTransparent.value },
	});
}

function onTo(hex: string): void {
	commit({
		clrChange: { clrFrom: clrFrom.value, clrTo: hex, clrToTransparent: toTransparent.value },
	});
}

function onTransparent(event: Event): void {
	commit({
		clrChange: {
			clrFrom: clrFrom.value,
			clrTo: clrTo.value,
			clrToTransparent: (event.target as HTMLInputElement).checked,
		},
	});
}
</script>

<template>
	<div class="pptx-vue-color-change flex flex-col gap-1 text-[11px]">
		<label class="flex items-center justify-between gap-2">
			<span class="font-semibold text-muted-foreground">Recolour</span>
			<input type="checkbox" :checked="Boolean(cc)" @change="onToggle" />
		</label>

		<div v-if="cc" class="grid grid-cols-2 gap-1.5">
			<label class="flex items-center gap-2">
				<span class="text-muted-foreground">From</span>
				<DebouncedColorInput :value="clrFrom" aria-label="Recolour from" @commit="onFrom" />
			</label>
			<label class="flex items-center gap-2">
				<span class="text-muted-foreground">To</span>
				<DebouncedColorInput
					:value="clrTo"
					:disabled="toTransparent"
					aria-label="Recolour to"
					@commit="onTo"
				/>
			</label>
			<label class="col-span-2 flex items-center justify-between gap-2">
				<span class="text-muted-foreground">Make target transparent</span>
				<input type="checkbox" :checked="toTransparent" @change="onTransparent" />
			</label>
		</div>
	</div>
</template>
