<script setup lang="ts">
import type { PptxTextWarpPreset, TextStyle } from 'pptx-viewer-core';
import { TEXT_WARP_PRESETS, warpPreviewPath } from 'pptx-viewer-shared';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

/**
 * TextWarpGallery: collapsible gallery of text-warp presets, sourced from the
 * shared `TEXT_WARP_PRESETS` catalogue with miniature SVG previews from
 * `warpPreviewPath`. Selecting a preset emits `select` with the preset value,
 * or `undefined` for the identity `textNoShape` preset. The parent
 * (`TextPanel`) merges it into the full `textStyle` sub-object.
 */
const props = defineProps<{
	ts: TextStyle | undefined;
}>();

const emit = defineEmits<{
	select: [preset: PptxTextWarpPreset | undefined];
}>();

const { t } = useI18n();

const expanded = ref(false);

const currentPreset = computed<PptxTextWarpPreset>(() => props.ts?.textWarpPreset ?? 'textNoShape');

const currentLabel = computed<string>(() => {
	const match = TEXT_WARP_PRESETS.find((p) => p.value === currentPreset.value);
	return match?.label ?? currentPreset.value;
});

function pick(value: PptxTextWarpPreset): void {
	emit('select', value === 'textNoShape' ? undefined : value);
}
</script>

<template>
	<div class="pptx-vue-textwarp mt-2 rounded border border-border bg-card p-2 space-y-2">
		<button
			type="button"
			class="pptx-vue-textwarp-toggle flex w-full items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground"
			@click="expanded = !expanded"
		>
			<span>{{ t('pptx.textWarp.title') }}</span>
			<span class="text-muted-foreground">{{ expanded ? '-' : '+' }}</span>
		</button>

		<div v-if="!expanded" class="pptx-vue-textwarp-current text-[11px] text-muted-foreground">
			{{ currentLabel }}
		</div>

		<div v-else class="pptx-vue-textwarp-grid grid grid-cols-5 gap-1">
			<button
				v-for="opt in TEXT_WARP_PRESETS"
				:key="opt.value"
				type="button"
				:title="opt.label"
				class="pptx-vue-textwarp-swatch flex items-center justify-center rounded p-1"
				:class="
					currentPreset === opt.value
						? 'bg-primary ring-1 ring-primary'
						: 'bg-muted hover:bg-accent'
				"
				@click="pick(opt.value)"
			>
				<svg width="40" height="20" viewBox="0 0 40 20">
					<path
						:d="warpPreviewPath(opt.value)"
						stroke="currentColor"
						:stroke-width="1.5"
						fill="none"
						:class="currentPreset === opt.value ? 'text-white' : 'text-muted-foreground'"
					/>
				</svg>
			</button>
		</div>
	</div>
</template>
