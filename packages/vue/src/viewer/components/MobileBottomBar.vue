<script setup lang="ts">
/**
 * MobileBottomBar — compact, touch-first bottom toolbar for the Vue
 * `pptx-vue-viewer` on small screens.
 *
 * Mirrors the control set of the React mobile chrome
 * (`packages/react/src/viewer/components/mobile/`): slide navigation, a slide
 * counter, zoom in/out, a present action, and an overflow ("⋯") button that
 * surfaces everything that does not fit on a phone. All glyphs reuse the
 * Unicode characters from the desktop `PowerPointViewer.vue` header (‹ › − +)
 * so the two chromes read as one design language.
 *
 * Conventions vs. React:
 *  - function-prop callbacks → emits.
 *  - Tailwind utility classes → scoped CSS (`pptx-vue-` prefix), since the Vue
 *    package ships hand-written styles rather than a Tailwind build.
 *
 * Every tap target is at least 44×44px (WCAG 2.5.5 / Apple HIG) and the bar is
 * pinned with `position: fixed; bottom: 0`, respecting the iOS safe-area inset.
 */
import { computed } from 'vue';

const props = defineProps<{
	/** Zero-based index of the active slide. */
	slideIndex: number;
	/** Total number of slides in the deck. */
	slideCount: number;
	/** Current zoom level, already expressed as a whole percentage. */
	zoomPercent: number;
}>();

const emit = defineEmits<{
	prev: [];
	next: [];
	'zoom-in': [];
	'zoom-out': [];
	present: [];
	menu: [];
}>();

const atStart = computed(() => props.slideIndex <= 0);
const atEnd = computed(() => props.slideIndex >= props.slideCount - 1);
const counterLabel = computed(
	() => `${props.slideCount === 0 ? 0 : props.slideIndex + 1} / ${props.slideCount}`,
);
</script>

<template>
	<nav class="pptx-vue-mobile-bar" aria-label="Slide controls">
		<button
			type="button"
			class="pptx-vue-mobile-btn"
			:disabled="atStart"
			aria-label="Previous slide"
			@click="emit('prev')"
		>
			<span aria-hidden="true">‹</span>
		</button>

		<span class="pptx-vue-mobile-counter" aria-live="polite">{{ counterLabel }}</span>

		<button
			type="button"
			class="pptx-vue-mobile-btn"
			:disabled="atEnd"
			aria-label="Next slide"
			@click="emit('next')"
		>
			<span aria-hidden="true">›</span>
		</button>

		<span class="pptx-vue-mobile-divider" aria-hidden="true" />

		<button
			type="button"
			class="pptx-vue-mobile-btn"
			aria-label="Zoom out"
			@click="emit('zoom-out')"
		>
			<span aria-hidden="true">−</span>
		</button>

		<span class="pptx-vue-mobile-zoom" aria-label="Zoom level">{{ zoomPercent }}%</span>

		<button type="button" class="pptx-vue-mobile-btn" aria-label="Zoom in" @click="emit('zoom-in')">
			<span aria-hidden="true">+</span>
		</button>

		<span class="pptx-vue-mobile-divider" aria-hidden="true" />

		<button
			type="button"
			class="pptx-vue-mobile-btn pptx-vue-mobile-present"
			aria-label="Present"
			@click="emit('present')"
		>
			<span aria-hidden="true">▶</span>
		</button>

		<button
			type="button"
			class="pptx-vue-mobile-btn"
			aria-label="More actions"
			@click="emit('menu')"
		>
			<span aria-hidden="true">⋯</span>
		</button>
	</nav>
</template>

<style scoped>
.pptx-vue-mobile-bar {
	position: fixed;
	bottom: 0;
	left: 0;
	right: 0;
	z-index: 30;
	display: flex;
	align-items: stretch;
	justify-content: center;
	gap: 0.125rem;
	padding: 0.25rem 0.5rem;
	padding-bottom: max(env(safe-area-inset-bottom), 0.25rem);
	border-top: 1px solid var(--pptx-border, rgba(0, 0, 0, 0.12));
	background: var(--pptx-surface, rgba(255, 255, 255, 0.92));
	backdrop-filter: blur(8px);
}

.pptx-vue-mobile-btn {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	min-width: 44px;
	min-height: 44px;
	padding: 0;
	border: none;
	border-radius: 0.5rem;
	background: transparent;
	color: var(--pptx-fg, #1f2937);
	font-size: 1.25rem;
	line-height: 1;
	cursor: pointer;
	transition:
		background-color 0.15s ease,
		transform 0.1s ease;
}

.pptx-vue-mobile-btn:hover:not(:disabled) {
	background: var(--pptx-accent, rgba(0, 0, 0, 0.06));
}

.pptx-vue-mobile-btn:active:not(:disabled) {
	transform: scale(0.94);
}

.pptx-vue-mobile-btn:disabled {
	opacity: 0.35;
	cursor: not-allowed;
}

.pptx-vue-mobile-present {
	color: var(--pptx-primary, #2563eb);
}

.pptx-vue-mobile-counter,
.pptx-vue-mobile-zoom {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	min-width: 44px;
	min-height: 44px;
	padding: 0 0.25rem;
	font-size: 0.8125rem;
	font-variant-numeric: tabular-nums;
	color: var(--pptx-fg-muted, #4b5563);
	user-select: none;
}

.pptx-vue-mobile-divider {
	width: 1px;
	margin: 0.5rem 0.125rem;
	background: var(--pptx-border, rgba(0, 0, 0, 0.12));
}
</style>
