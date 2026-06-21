<script setup lang="ts">
/**
 * PresentationTouchControls: always-visible, touch-friendly controls for
 * presentation (slide-show) mode.
 *
 * The auto-hiding mouse `PresentationToolbar` only reveals itself on pointer
 * movement, so on a touch device there is no way to exit the slideshow or step
 * between slides (a phone has no Escape key). This overlay fills that gap: a
 * persistent close button plus large prev / next navigation buttons, each at
 * least 44px and offset by the device safe-area insets so they clear notches
 * and rounded corners.
 *
 * Rendered only on touch-capable devices so it never clutters the desktop UI
 * (which keeps the auto-hiding mouse toolbar). Every control stops event
 * propagation so a tap on it never falls through to the slide tap-advance.
 *
 * Mirrors the React `PresentationTouchControls`
 * (`packages/react/src/viewer/components/PresentationTouchControls.tsx`).
 */
import { computed } from 'vue';

import { useIsMobile } from '../composables/useIsMobile';

const props = defineProps<{
	/** Zero-based index of the current presentation slide. */
	currentSlideIndex: number;
	/** Total number of slides. */
	totalSlides: number;
}>();

const emit = defineEmits<{
	/** Navigate next (1) / previous (-1). */
	(e: 'move', direction: 1 | -1): void;
	/** Exit the slideshow. */
	(e: 'end'): void;
}>();

const { isTouchDevice } = useIsMobile();

const atFirst = computed(() => props.currentSlideIndex <= 0);
const atLast = computed(() => props.currentSlideIndex >= props.totalSlides - 1);
const counterLabel = computed(() =>
	props.totalSlides === 0 ? '0 / 0' : `${props.currentSlideIndex + 1} / ${props.totalSlides}`,
);
</script>

<template>
	<template v-if="isTouchDevice">
		<!-- Close (top-right, safe-area aware) -->
		<button
			type="button"
			class="pptx-vue-pt-btn pptx-vue-pt-close"
			aria-label="Exit presentation"
			@click.stop="emit('end')"
			@touchend.stop.prevent="emit('end')"
		>
			<span aria-hidden="true">&times;</span>
		</button>

		<!-- Previous (left edge) -->
		<button
			type="button"
			class="pptx-vue-pt-btn pptx-vue-pt-prev"
			aria-label="Previous slide"
			:disabled="atFirst"
			@click.stop="emit('move', -1)"
			@touchend.stop.prevent="emit('move', -1)"
		>
			<span aria-hidden="true">&#x2039;</span>
		</button>

		<!-- Next (right edge) -->
		<button
			type="button"
			class="pptx-vue-pt-btn pptx-vue-pt-next"
			aria-label="Next slide"
			:disabled="atLast"
			@click.stop="emit('move', 1)"
			@touchend.stop.prevent="emit('move', 1)"
		>
			<span aria-hidden="true">&#x203A;</span>
		</button>

		<!-- Slide counter (bottom-centre, safe-area aware) -->
		<span class="pptx-vue-pt-counter">{{ counterLabel }}</span>
	</template>
</template>

<style scoped>
.pptx-vue-pt-btn {
	position: fixed;
	z-index: 2147483002;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 44px;
	height: 44px;
	min-width: 44px;
	min-height: 44px;
	border: none;
	border-radius: 50%;
	background-color: rgba(0, 0, 0, 0.55);
	color: #ffffff;
	line-height: 1;
	cursor: pointer;
	pointer-events: auto;
	touch-action: manipulation;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
}

.pptx-vue-pt-btn:active {
	background-color: rgba(0, 0, 0, 0.75);
}

.pptx-vue-pt-btn:disabled {
	opacity: 0.3;
	cursor: not-allowed;
}

.pptx-vue-pt-close {
	top: calc(env(safe-area-inset-top, 0px) + 0.5rem);
	right: calc(env(safe-area-inset-right, 0px) + 0.5rem);
	font-size: 24px;
}

.pptx-vue-pt-prev,
.pptx-vue-pt-next {
	top: 50%;
	transform: translateY(-50%);
	font-size: 28px;
}

.pptx-vue-pt-prev {
	left: calc(env(safe-area-inset-left, 0px) + 0.5rem);
}

.pptx-vue-pt-next {
	right: calc(env(safe-area-inset-right, 0px) + 0.5rem);
}

.pptx-vue-pt-counter {
	position: fixed;
	z-index: 2147483002;
	bottom: calc(env(safe-area-inset-bottom, 0px) + 0.5rem);
	left: 50%;
	transform: translateX(-50%);
	padding: 4px 12px;
	border-radius: 999px;
	background-color: rgba(0, 0, 0, 0.55);
	color: #ffffff;
	font-size: 12px;
	font-variant-numeric: tabular-nums;
	pointer-events: none;
	user-select: none;
}
</style>
