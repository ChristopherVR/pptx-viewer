<script setup lang="ts">
/**
 * TransitionPreview: click-to-play thumbnail of the configured transition,
 * matching React's `inspector/TransitionPreview.tsx`.
 *
 * The two stacked layers ("A" outgoing, "B" incoming) are driven by the same
 * shared `getSlideTransitionAnimations` resolver the real presentation
 * overlay uses, so what the author previews is what plays. `outgoingOnTop`
 * decides the stacking order; without it, push/cover-family effects preview
 * upside down relative to the real transition.
 *
 * `playKey` is bumped on every click and keys both layers via `:key`, which
 * forces Vue to recreate the nodes so the CSS animation restarts even when
 * the settings did not change.
 */
import type { PptxSlideTransition } from 'pptx-viewer-core';
import { getSlideTransitionAnimations, SLIDE_TRANSITION_KEYFRAMES } from 'pptx-viewer-shared';
import { computed, onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{ transition: PptxSlideTransition }>();
const { t } = useI18n();

const playing = ref(false);
const playKey = ref(0);
let timer: ReturnType<typeof setTimeout> | undefined;

const durationMs = computed(() => props.transition.durationMs ?? 500);
const animations = computed(() =>
	getSlideTransitionAnimations(
		props.transition.type,
		durationMs.value,
		props.transition.direction,
		props.transition.orient,
		props.transition.spokes,
	),
);
// 'none' and 'cut' have nothing to show: React hides the preview entirely.
const previewable = computed(
	() => props.transition.type !== 'none' && props.transition.type !== 'cut',
);

const incomingAnimation = computed(() =>
	playing.value && animations.value.incoming !== 'none' ? animations.value.incoming : undefined,
);
const outgoingAnimation = computed(() => {
	if (!playing.value) {
		return undefined;
	}
	return animations.value.outgoing !== 'none'
		? animations.value.outgoing
		: `pptx-tr-fade-out ${durationMs.value}ms ease-in-out forwards`;
});

function play(): void {
	playing.value = true;
	playKey.value += 1;
	clearTimeout(timer);
	timer = setTimeout(() => {
		playing.value = false;
	}, durationMs.value + 100);
}

onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
	<div v-if="previewable" class="pptx-vue-transition-preview">
		<span class="pptx-vue-transition-preview-label">{{ t('pptx.transition.preview') }}</span>
		<button
			type="button"
			class="pptx-vue-transition-preview-stage"
			:title="t('pptx.transition.preview')"
			:aria-label="t('pptx.transition.preview')"
			@click="play"
		>
			<span
				:key="`in-${playKey}`"
				class="pptx-vue-transition-layer pptx-vue-transition-incoming"
				:style="{ animation: incomingAnimation }"
			>
				B
			</span>
			<span
				:key="`out-${playKey}`"
				class="pptx-vue-transition-layer pptx-vue-transition-outgoing"
				:style="{ zIndex: animations.outgoingOnTop ? 2 : 0, animation: outgoingAnimation }"
			>
				A
			</span>
		</button>
		<component :is="'style'">{{ SLIDE_TRANSITION_KEYFRAMES }}</component>
	</div>
</template>

<style scoped>
.pptx-vue-transition-preview {
	display: grid;
	gap: 3px;
}

.pptx-vue-transition-preview-label {
	color: var(--pptx-vue-muted-foreground, #6b7280);
	font-size: 10px;
}

.pptx-vue-transition-preview-stage {
	position: relative;
	display: block;
	width: 100%;
	height: 64px;
	padding: 0;
	overflow: hidden;
	border: 1px solid var(--pptx-vue-border, #e5e7eb);
	border-radius: var(--pptx-vue-radius, 8px);
	background: var(--pptx-vue-muted, #f3f4f6);
	cursor: pointer;
}

.pptx-vue-transition-layer {
	position: absolute;
	inset: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	color: var(--pptx-vue-muted-foreground, #6b7280);
	font-size: 9px;
}

/* Translucent BACKGROUND, not element opacity: the transition animations
   drive `opacity` themselves and would fight an inherited value. */
.pptx-vue-transition-incoming {
	background: color-mix(in srgb, var(--pptx-vue-primary, #2563eb) 20%, transparent);
}

.pptx-vue-transition-outgoing {
	background: var(--pptx-vue-background, #ffffff);
}
</style>
