<script setup lang="ts">
/**
 * SlideSizeCard: the SLIDE SIZE card, mirroring PowerPoint's Design > Slide
 * Size: a preset dropdown, a Landscape/Portrait toggle, and the raw W/H pixel
 * inputs underneath for a hand-sized deck.
 *
 * Every decision here belongs to `resolveSlideSizeSelection` in
 * `pptx-viewer-shared`; this card only maps the descriptor it returns onto
 * controls. In particular it does NOT derive the EMU size from the pixel
 * inputs: that round-trip is lossy (Ledger is 12179300 EMU = 1278.5px) and
 * would cost a preset deck its identity on save.
 */
import type { SlideSizeEmu, SlideSizeOrientation } from 'pptx-viewer-shared';
import {
	resolveSlideSizeSelection,
	SLIDE_SIZE_PRESETS,
	slideSizeFromPreset,
	slideSizeToCanvasPx,
	withSlideSizeOrientation,
} from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import type { CanvasSize } from '../../types';
import { CARD, HEADING, INPUT } from './inspector-cards';

const props = withDefaults(
	defineProps<{
		canvasSize: CanvasSize;
		/** The deck's `p:sldSz`, when one has been loaded or chosen. */
		slideSize?: SlideSizeEmu;
		canEdit?: boolean;
	}>(),
	{ canEdit: true },
);

const emit = defineEmits<{
	/** The raw W/H pixel inputs changed. */
	update: [size: CanvasSize];
	/** A preset or orientation was chosen: both EMU and pixel sizes follow. */
	'update-slide-size': [size: SlideSizeEmu, canvas: CanvasSize];
}>();

const { t } = useI18n();

const FIELDS = [
	['W', 'width'],
	['H', 'height'],
] as const;

const ORIENTATIONS: readonly SlideSizeOrientation[] = ['landscape', 'portrait'];

/** `''` marks the "Custom" entry, which only appears for an unmatched size. */
const CUSTOM_VALUE = '';

const presets = SLIDE_SIZE_PRESETS;

const selection = computed(() =>
	resolveSlideSizeSelection({ current: props.slideSize, canvas: props.canvasSize }),
);

const selectedPresetKey = computed(() => selection.value.preset?.labelKey ?? CUSTOM_VALUE);

function commit(size: SlideSizeEmu): void {
	emit('update-slide-size', size, slideSizeToCanvasPx(size));
}

function onPresetChange(event: Event): void {
	const labelKey = (event.target as HTMLSelectElement).value;
	const preset = presets.find((candidate) => candidate.labelKey === labelKey);
	if (!preset) {
		return;
	}
	commit(slideSizeFromPreset(preset, selection.value.orientation));
}

function onOrientationChange(orientation: SlideSizeOrientation): void {
	commit(withSlideSizeOrientation(selection.value.size, orientation));
}

function onFieldInput(key: 'width' | 'height', event: Event): void {
	const value = Number((event.target as HTMLInputElement).value);
	if (!Number.isFinite(value)) {
		return;
	}
	emit('update', { ...props.canvasSize, [key]: value });
}
</script>

<template>
	<div :class="CARD">
		<div :class="HEADING">{{ t('pptx.slideSize.title') }}</div>

		<label class="mb-1.5 flex flex-col gap-1 text-[11px]">
			<span class="text-muted-foreground">{{ t('pptx.slideSize.presets') }}</span>
			<select
				:class="INPUT"
				data-pptx-slide-size-preset
				:disabled="!props.canEdit"
				:value="selectedPresetKey"
				:aria-label="t('pptx.slideSize.presets')"
				@change="onPresetChange"
			>
				<option v-if="!selection.preset" :value="CUSTOM_VALUE">
					{{ t('pptx.slideSize.customSize') }}
				</option>
				<option v-for="preset in presets" :key="preset.labelKey" :value="preset.labelKey">
					{{ t(`pptx.slideSize.preset.${preset.labelKey}`) }}
				</option>
			</select>
		</label>

		<div class="mb-1.5 flex flex-col gap-1 text-[11px]">
			<span class="text-muted-foreground">{{ t('pptx.slideSize.orientation') }}</span>
			<div class="flex gap-1" role="group" :aria-label="t('pptx.slideSize.orientation')">
				<button
					v-for="orientation in ORIENTATIONS"
					:key="orientation"
					type="button"
					class="flex-1 rounded border px-2 py-1 text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
					:class="
						selection.orientation === orientation
							? 'border-primary bg-accent text-foreground'
							: 'border-border bg-muted text-muted-foreground hover:bg-accent'
					"
					:data-pptx-slide-size-orientation="orientation"
					:aria-pressed="selection.orientation === orientation"
					:disabled="!props.canEdit"
					@click="onOrientationChange(orientation)"
				>
					{{ t(`pptx.slideSize.${orientation}`) }}
				</button>
			</div>
		</div>

		<div class="grid grid-cols-2 gap-1.5 text-[11px]">
			<label v-for="[label, key] in FIELDS" :key="key" class="flex items-center gap-1">
				<span class="text-muted-foreground">{{ label }}</span>
				<input
					type="number"
					:class="INPUT"
					:disabled="!props.canEdit"
					:value="props.canvasSize[key]"
					@input="(e) => onFieldInput(key, e)"
				/>
			</label>
		</div>
	</div>
</template>
