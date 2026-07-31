<script setup lang="ts">
/**
 * AnimationPresetGallery: the Animations tab's preset gallery.
 *
 * The whole shared catalogue, not a sample of it. The ribbon used to hard-code
 * six presets while `pptx-viewer-shared` already published twenty-seven, so
 * twenty-one effects the editor can actually apply were reachable only from the
 * inspector. Sourcing the buttons from the shared arrays keeps every binding's
 * gallery identical by construction, and keeps a preset added to the catalogue
 * from needing five separate follow-ups.
 *
 * Every preset is a real button in the accessibility tree rather than an entry
 * behind a hover menu: a gallery a screen-reader user cannot enumerate is a
 * gallery they do not have. The captions are plain `<span>`s for the same
 * reason in reverse, a caption that answers to a click is a control the tab
 * does not really offer. The column scrolls instead of growing so the ribbon
 * keeps the single-row height the layout-parity spec guards.
 *
 * Order is the catalogue's own, which already leads each bucket with the
 * effects PowerPoint puts first (Appear / Fade In / Fly In, Spin / Pulse,
 * Fade Out), so the previously featured six still read as the primary set
 * without being rendered twice.
 */
import { Star } from 'lucide-vue-next';
import type { PptxAnimationPreset } from 'pptx-viewer-core';
import {
	EMPHASIS_PRESET_VALUES,
	ENTRANCE_PRESET_VALUES,
	EXIT_PRESET_VALUES,
} from 'pptx-viewer-shared';
import type { AnimationGroup } from 'pptx-viewer-shared';
import { useI18n } from 'vue-i18n';

import { cn } from '../../../utils';

interface Props {
	disabled: boolean;
	onAddAnimation?: (preset: string, group: AnimationGroup) => void;
}

const props = defineProps<Props>();
const { t } = useI18n();

/** One gallery column: a bucket's caption plus the presets that belong to it. */
interface PresetCategory {
	group: AnimationGroup;
	labelKey: string;
	tone: string;
	presets: readonly PptxAnimationPreset[];
}

const CATEGORIES: readonly PresetCategory[] = [
	{
		group: 'entrance',
		labelKey: 'pptx.animation.entrance',
		tone: 'text-emerald-500',
		presets: ENTRANCE_PRESET_VALUES,
	},
	{
		group: 'emphasis',
		labelKey: 'pptx.animation.emphasis',
		tone: 'text-amber-500',
		presets: EMPHASIS_PRESET_VALUES,
	},
	{
		group: 'exit',
		labelKey: 'pptx.animation.exit',
		tone: 'text-red-500',
		presets: EXIT_PRESET_VALUES,
	},
];

function presetLabel(preset: PptxAnimationPreset): string {
	return t(`pptx.animation.preset.${preset}`);
}
</script>

<template>
	<div
		class="flex max-h-[62px] items-start gap-2 overflow-y-auto rounded-sm border border-border/60 bg-muted/30 px-1.5 py-1"
		:aria-label="t('pptx.animations.galleryAria')"
	>
		<div v-for="category in CATEGORIES" :key="category.group" class="flex flex-col gap-0.5">
			<span class="text-[9px] font-semibold leading-3 text-muted-foreground">
				{{ t(category.labelKey) }}
			</span>
			<div class="flex max-w-[150px] flex-wrap gap-0.5">
				<button
					v-for="preset in category.presets"
					:key="preset"
					type="button"
					:disabled="props.disabled"
					:title="presetLabel(preset)"
					class="inline-flex items-center gap-0.5 rounded-sm px-1 py-0.5 text-[9px] leading-3 text-foreground transition-colors hover:bg-accent disabled:opacity-35"
					@click="props.onAddAnimation?.(preset, category.group)"
				>
					<Star :class="cn('h-2.5 w-2.5 fill-current', category.tone)" aria-hidden="true" />
					<span class="whitespace-nowrap">{{ presetLabel(preset) }}</span>
				</button>
			</div>
		</div>
	</div>
</template>
