<!--
	Animations ribbon section: a thin adapter over the shared
	`pptx-ui-ribbon-animations` view (Preview, the always-visible preset and
	motion-path galleries, Advanced Animation and the inert Timing fields).
	The slide model, selection, Preview playback and inspector lifecycle stay
	native to this binding.
-->
<script setup lang="ts">
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { playAnimationRibbonPreview } from 'pptx-viewer-shared';
import type { AnimationApplyGroup, RibbonAnimationsRequestEvent } from 'pptx-viewer-shared';
import { computed, onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';

interface Props {
	canEdit: boolean;
	selectedElement: PptxElement | null;
	/** The slide holding `selectedElement`; animations are stored per-slide, keyed by elementId. */
	activeSlide?: Pick<PptxSlide, 'animations'>;
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
let timer: ReturnType<typeof setTimeout> | undefined;
const disabled = computed(() => !props.canEdit || props.selectedElement === null);
const selectedAnimation = computed(() =>
	props.selectedElement
		? (props.activeSlide?.animations ?? []).find((a) => a.elementId === props.selectedElement?.id)
		: undefined,
);
const state = computed(() => ({
	editable: props.canEdit,
	hasSelection: props.selectedElement !== null,
	paneOpen: props.isInspectorPaneOpen,
	previewActive: previewActive.value,
	translate: t,
}));

function request(event: RibbonAnimationsRequestEvent): void {
	const intent = event.detail;
	if (intent.kind === 'add') {
		props.onAddAnimation?.(intent.preset, intent.group);
	} else if (intent.value === 'remove') {
		props.onRemoveAnimation?.();
	} else if (intent.value === 'preview') {
		if (disabled.value) {
			return;
		}
		previewActive.value = true;
		clearTimeout(timer);
		timer = setTimeout(() => {
			previewActive.value = false;
		}, 1200);
		// Plays the selected element's own authored effect in place on the canvas.
		playAnimationRibbonPreview(document, selectedAnimation.value);
	} else {
		(props.onOpenAnimationPanel ?? props.onToggleInspector)();
	}
}

onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
	<pptx-ui-ribbon-animations :state.prop="state" @animations-request="request" />
</template>
