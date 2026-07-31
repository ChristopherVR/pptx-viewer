<!--
	Animations ribbon section: Vue port of React's `toolbar/AnimationsSection.tsx`.

	Preview, the always-visible preset gallery (the full shared catalogue, see
	`AnimationPresetGallery.vue`), the Advanced Animation group (Exit Effects,
	Path Animation, Effect Options, Animation Panel, Trigger, Painter, Remove)
	and the Timing group (Start mode + Duration). Controls the reference renders
	inert are rendered inert here too rather than omitted, so the tab offers the
	same set either way.
-->
<script setup lang="ts">
import {
	Clock,
	MousePointerClick,
	MoveRight,
	Paintbrush,
	PanelRight,
	Play,
	Sparkles,
	Star,
	Trash2,
} from 'lucide-vue-next';
import type { PptxElement } from 'pptx-viewer-core';
import { DEFAULT_MOTION_PATH_PRESET_ID } from 'pptx-viewer-shared';
import type { AnimationApplyGroup } from 'pptx-viewer-shared';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { cn } from '../../../utils';
import AnimationPresetGallery from './AnimationPresetGallery.vue';
import MotionPathGallery from './MotionPathGallery.vue';
import { ANIMATION_START_MODES, GROUP_LABEL, ic, pill, SEP } from './ribbon-constants';

interface Props {
	canEdit: boolean;
	selectedElement: PptxElement | null;
	isInspectorPaneOpen: boolean;
	onToggleInspector: () => void;
	/** Opens the inspector and switches to properties tab to show the animation panel. */
	onOpenAnimationPanel?: () => void;
	/**
	 * Adds an animation to the selected element. `group` widens past the three
	 * preset buckets with `motionPath`, where `preset` carries a motion-path
	 * catalogue id instead of a preset name.
	 */
	onAddAnimation?: (preset: string, group: AnimationApplyGroup) => void;
	/** Removes all animations from the selected element. */
	onRemoveAnimation?: () => void;
}

const props = defineProps<Props>();

const { t } = useI18n();

const previewActive = ref(false);
const disabled = computed(() => !props.canEdit || props.selectedElement === null);

function handlePreview(): void {
	if (disabled.value) {
		return;
	}
	previewActive.value = true;
	// Reset after a short delay to re-enable the button
	setTimeout(() => {
		previewActive.value = false;
	}, 1200);
}

function openPanel(): void {
	(props.onOpenAnimationPanel ?? props.onToggleInspector)();
}

/** Gallery click: a catalogue id travels as the motion-path bucket's payload. */
function applyMotionPath(presetId: string): void {
	props.onAddAnimation?.(presetId, 'motionPath');
}
</script>

<template>
	<!-- Preview -->
	<button
		type="button"
		:disabled="disabled"
		:class="cn(pill, previewActive ? 'bg-primary hover:bg-primary/80 text-white' : '')"
		:title="t('pptx.animations.previewTooltip')"
		@click="handlePreview"
	>
		<Play :class="ic" />
		{{ t('pptx.animations.preview') }}
	</button>

	<div :class="SEP" />

	<!-- Preset gallery (full shared catalogue) -->
	<AnimationPresetGallery :disabled="disabled" :on-add-animation="props.onAddAnimation" />

	<div :class="SEP" />

	<!-- Motion Paths: geometry, so its own captioned group beside the presets -->
	<div class="flex flex-col items-center gap-0.5">
		<MotionPathGallery :disabled="disabled" :on-apply-motion-path="applyMotionPath" />
		<span :class="GROUP_LABEL">{{ t('pptx.animation.motionPath') }}</span>
	</div>

	<div :class="SEP" />

	<!-- Advanced Animation -->
	<button
		type="button"
		:disabled="disabled"
		:class="pill"
		@click="props.onAddAnimation?.('fadeOut', 'exit')"
	>
		<Star :class="cn(ic, 'text-red-500')" />
		{{ t('pptx.animations.exitEffects') }}
	</button>
	<!--
		One-click default path (Lines: Right). It used to apply a Fly In entrance,
		which is not a path at all.
	-->
	<button
		type="button"
		:disabled="disabled"
		:class="pill"
		@click="applyMotionPath(DEFAULT_MOTION_PATH_PRESET_ID)"
	>
		<MoveRight :class="ic" />
		{{ t('pptx.animations.pathAnimation') }}
	</button>
	<button type="button" :disabled="disabled" :class="pill" @click="openPanel">
		<Sparkles :class="ic" />
		{{ t('pptx.animations.effectOptions') }}
	</button>
	<button
		type="button"
		:class="cn(pill, props.isInspectorPaneOpen ? 'bg-primary hover:bg-primary/80 text-white' : '')"
		:title="t('pptx.animations.openPanelTooltip')"
		@click="openPanel"
	>
		<PanelRight :class="ic" />
		{{ t('pptx.animations.animationPanel') }}
	</button>
	<button type="button" :disabled="disabled" :class="pill" @click="openPanel">
		<MousePointerClick :class="ic" />
		{{ t('pptx.animations.trigger') }}
	</button>
	<!-- Animation Painter has no behaviour in any binding yet; inert, not absent. -->
	<button type="button" disabled :class="pill">
		<Paintbrush :class="ic" />
		{{ t('pptx.animations.painter') }}
	</button>
	<button
		type="button"
		:disabled="disabled"
		:class="pill"
		:title="t('pptx.animations.removeTooltip')"
		@click="props.onRemoveAnimation?.()"
	>
		<Trash2 :class="ic" />
		{{ t('pptx.animations.remove') }}
	</button>

	<div :class="SEP" />

	<!-- Timing -->
	<div class="grid grid-cols-[48px_82px] items-center gap-x-1 gap-y-1 text-[10px]">
		<label for="pptx-animation-start">{{ t('pptx.animations.start') }}</label>
		<select
			id="pptx-animation-start"
			disabled
			class="h-6 rounded-sm border border-border bg-muted px-1 text-[10px]"
		>
			<option v-for="mode in ANIMATION_START_MODES" :key="mode">{{ t(mode) }}</option>
		</select>
		<span class="flex items-center gap-1">
			<Clock :class="ic" /> {{ t('pptx.animations.duration') }}
		</span>
		<input
			type="number"
			min="0"
			step="0.1"
			value="0.5"
			disabled
			:aria-label="t('pptx.animations.duration')"
			class="h-6 rounded-sm border border-border bg-muted px-1 text-[10px]"
		/>
	</div>
</template>
