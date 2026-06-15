<script setup lang="ts">
import type { PptxSlide } from 'pptx-viewer-core';
import { ANIMATION_KEYFRAMES_CSS } from 'pptx-viewer-shared';
import type { CSSProperties } from 'vue';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { useAnimationPlayback } from '../composables/useAnimationPlayback';
import type { CanvasSize } from '../types';
import SlideStage from './SlideStage.vue';

/**
 * PresentationMode — a full-viewport slideshow overlay.
 *
 * Renders the active slide via {@link SlideStage}, scaled to fit the viewport
 * while preserving aspect ratio, centered on a black background. Mounted into
 * `document.body` via `<Teleport>` and pinned with `position: fixed; inset: 0`.
 *
 * Navigation mirrors the React `usePresentationMode` semantics:
 *  - ArrowRight / Space / PageDown → next slide
 *  - ArrowLeft / PageUp           → previous slide
 *  - Home / End                   → first / last slide
 *  - Esc                          → exit (emits `close`)
 *  - Click on the stage           → next slide
 *
 * Real fullscreen is requested via the Fullscreen API where available; absence
 * degrades gracefully to the fixed overlay.
 */
const props = withDefaults(
	defineProps<{
		slides: PptxSlide[];
		canvasSize: CanvasSize;
		mediaDataUrls: Map<string, string>;
		startIndex?: number;
	}>(),
	{ startIndex: 0 },
);

const emit = defineEmits<{
	(e: 'close'): void;
	(e: 'slide-change', index: number): void;
}>();

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

function clampIndex(index: number): number {
	const last = Math.max(0, props.slides.length - 1);
	if (index < 0) {
		return 0;
	}
	if (index > last) {
		return last;
	}
	return index;
}

const currentIndex = ref(clampIndex(props.startIndex));

const activeSlide = computed<PptxSlide | undefined>(() => props.slides[currentIndex.value]);

// ---------------------------------------------------------------------------
// Fit-to-viewport scaling
// ---------------------------------------------------------------------------

const viewportWidth = ref(typeof window === 'undefined' ? 0 : window.innerWidth);
const viewportHeight = ref(typeof window === 'undefined' ? 0 : window.innerHeight);

const scale = computed(() => {
	const { width, height } = props.canvasSize;
	if (width <= 0 || height <= 0 || viewportWidth.value <= 0 || viewportHeight.value <= 0) {
		return 1;
	}
	return Math.min(viewportWidth.value / width, viewportHeight.value / height);
});

/**
 * The scaled stage uses `transform: scale()` with a `top left` origin, so its
 * laid-out box still occupies the unscaled dimensions. Wrap it in a box sized to
 * the *scaled* footprint so flexbox can center it correctly.
 */
const frameStyle = computed<CSSProperties>(() => ({
	width: `${props.canvasSize.width * scale.value}px`,
	height: `${props.canvasSize.height * scale.value}px`,
}));

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

function goTo(index: number): void {
	const target = clampIndex(index);
	if (target === currentIndex.value) {
		return;
	}
	currentIndex.value = target;
}

// Animation playback: each "next" first reveals the slide's next click-group of
// element animations; only when the slide's builds are exhausted do we advance.
const slideAnimations = computed(() => activeSlide.value?.animations ?? []);
const playback = useAnimationPlayback({ animations: slideAnimations });
const frameRef = ref<HTMLDivElement | null>(null);

function applyAnimationStyles(): void {
	const root = frameRef.value;
	if (!root) {
		return;
	}
	const revealed = playback.elementStyles.value;
	const pending = playback.pendingStyles.value;
	root.querySelectorAll<HTMLElement>('[data-element-id]').forEach((el) => {
		const id = el.dataset.elementId;
		if (!id) {
			return;
		}
		el.style.animation = '';
		el.style.opacity = '';
		const active = revealed.get(id) ?? pending.get(id);
		if (active) {
			Object.assign(el.style, active);
		}
	});
}

function next(): void {
	if (playback.advance()) {
		return; // revealed an animation build step; stay on the slide
	}
	goTo(currentIndex.value + 1);
}

function prev(): void {
	goTo(currentIndex.value - 1);
}

function close(): void {
	emit('close');
}

watch(currentIndex, (index) => {
	emit('slide-change', index);
	playback.reset();
});

watch(
	[() => playback.elementStyles.value, () => playback.pendingStyles.value, activeSlide],
	() => {
		void nextTick(applyAnimationStyles);
	},
	{ immediate: true },
);

// ---------------------------------------------------------------------------
// Keyboard + resize listeners
// ---------------------------------------------------------------------------

function handleKeyDown(event: KeyboardEvent): void {
	switch (event.key) {
		case 'Escape':
			event.preventDefault();
			close();
			return;
		case 'ArrowRight':
		case 'PageDown':
		case ' ':
			event.preventDefault();
			next();
			return;
		case 'ArrowLeft':
		case 'PageUp':
			event.preventDefault();
			prev();
			return;
		case 'Home':
			event.preventDefault();
			goTo(0);
			return;
		case 'End':
			event.preventDefault();
			goTo(props.slides.length - 1);
			break;
		default:
	}
}

function handleResize(): void {
	viewportWidth.value = window.innerWidth;
	viewportHeight.value = window.innerHeight;
}

// ---------------------------------------------------------------------------
// Touch / swipe navigation (mobile has no keyboard, so Esc/arrows are absent)
// ---------------------------------------------------------------------------

const SWIPE_THRESHOLD = 50;
const touchStart = ref<{ x: number; y: number } | null>(null);

function onTouchStart(event: TouchEvent): void {
	const touch = event.changedTouches[0];
	touchStart.value = touch ? { x: touch.clientX, y: touch.clientY } : null;
}

function onTouchEnd(event: TouchEvent): void {
	const start = touchStart.value;
	touchStart.value = null;
	if (!start) {
		return;
	}
	const touch = event.changedTouches[0];
	if (!touch) {
		return;
	}
	const dx = touch.clientX - start.x;
	const dy = touch.clientY - start.y;
	// Require a predominantly-horizontal gesture past the threshold.
	if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) <= Math.abs(dy)) {
		return;
	}
	if (dx < 0) {
		next();
	} else {
		prev();
	}
}

const atFirst = computed(() => currentIndex.value <= 0);
const atLast = computed(() => currentIndex.value >= props.slides.length - 1);

const overlayRef = ref<HTMLDivElement | null>(null);

function requestFullscreen(): void {
	const el = overlayRef.value;
	if (!el || typeof el.requestFullscreen !== 'function') {
		return;
	}
	try {
		void el.requestFullscreen().catch(() => {
			/* ignore fullscreen errors */
		});
	} catch {
		/* fullscreen not supported */
	}
}

function exitFullscreen(): void {
	if (typeof document === 'undefined') {
		return;
	}
	try {
		if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
			void document.exitFullscreen().catch(() => {
				/* ignore */
			});
		}
	} catch {
		/* fullscreen not supported */
	}
}

onMounted(() => {
	window.addEventListener('keydown', handleKeyDown);
	window.addEventListener('resize', handleResize);
	handleResize();
	requestFullscreen();
});

onBeforeUnmount(() => {
	window.removeEventListener('keydown', handleKeyDown);
	window.removeEventListener('resize', handleResize);
	exitFullscreen();
});
</script>

<template>
	<Teleport to="body">
		<div
			ref="overlayRef"
			class="pptx-vue-presentation"
			@click="next"
			@touchstart="onTouchStart"
			@touchend="onTouchEnd"
		>
			<!-- Inject the animation @keyframes once for this overlay. -->
			<component :is="'style'">{{ ANIMATION_KEYFRAMES_CSS }}</component>
			<div ref="frameRef" class="pptx-vue-presentation-frame" :style="frameStyle">
				<SlideStage
					:slide="activeSlide"
					:canvas-size="canvasSize"
					:media-data-urls="mediaDataUrls"
					:scale="scale"
				/>
			</div>

			<div class="pptx-vue-presentation-counter" @click.stop>
				{{ currentIndex + 1 }} / {{ slides.length }}
			</div>

			<!-- Always-visible exit control (touch devices have no Escape key). -->
			<button
				type="button"
				class="pptx-vue-presentation-close"
				aria-label="Exit presentation"
				@click.stop="close"
				@touchend.stop.prevent="close"
			>
				&times;
			</button>

			<!--
				Edge navigation buttons — the primary touch affordance for moving
				between slides. They stop propagation so a tap on a control never
				falls through to the overlay's tap-to-advance handler.
			-->
			<button
				type="button"
				class="pptx-vue-presentation-nav pptx-vue-presentation-prev"
				aria-label="Previous slide"
				:disabled="atFirst"
				@click.stop="prev"
				@touchend.stop.prevent="prev"
			>
				&#x2039;
			</button>
			<button
				type="button"
				class="pptx-vue-presentation-nav pptx-vue-presentation-next"
				aria-label="Next slide"
				:disabled="atLast"
				@click.stop="next"
				@touchend.stop.prevent="next"
			>
				&#x203A;
			</button>
		</div>
	</Teleport>
</template>

<style scoped>
.pptx-vue-presentation {
	position: fixed;
	inset: 0;
	z-index: 2147483000;
	display: flex;
	align-items: center;
	justify-content: center;
	background-color: #000000;
	overflow: hidden;
	cursor: default;
	user-select: none;
	/* Allow vertical scroll/pinch but let us interpret horizontal swipes. */
	touch-action: pan-y;
}

.pptx-vue-presentation-frame {
	position: relative;
	overflow: hidden;
}

.pptx-vue-presentation-counter {
	position: fixed;
	bottom: 16px;
	left: 50%;
	transform: translateX(-50%);
	padding: 4px 12px;
	border-radius: 999px;
	background-color: rgba(0, 0, 0, 0.55);
	color: #ffffff;
	font-size: 13px;
	font-family:
		system-ui,
		-apple-system,
		sans-serif;
	line-height: 1.4;
	user-select: none;
	pointer-events: none;
}

.pptx-vue-presentation-close {
	position: fixed;
	top: calc(env(safe-area-inset-top, 0px) + 12px);
	right: calc(env(safe-area-inset-right, 0px) + 12px);
	width: 44px;
	height: 44px;
	min-width: 44px;
	min-height: 44px;
	display: flex;
	align-items: center;
	justify-content: center;
	border: none;
	border-radius: 50%;
	background-color: rgba(0, 0, 0, 0.55);
	color: #ffffff;
	font-size: 24px;
	line-height: 1;
	cursor: pointer;
	pointer-events: auto;
	touch-action: manipulation;
	z-index: 2147483002;
}

.pptx-vue-presentation-close:hover {
	background-color: rgba(255, 255, 255, 0.2);
}

/* ── Edge navigation buttons (touch-friendly, ≥44px) ─────────────────── */
.pptx-vue-presentation-nav {
	position: fixed;
	top: 50%;
	transform: translateY(-50%);
	width: 44px;
	height: 44px;
	min-width: 44px;
	min-height: 44px;
	display: flex;
	align-items: center;
	justify-content: center;
	border: none;
	border-radius: 50%;
	background-color: rgba(0, 0, 0, 0.45);
	color: #ffffff;
	font-size: 28px;
	line-height: 1;
	cursor: pointer;
	pointer-events: auto;
	touch-action: manipulation;
	z-index: 2147483001;
}

.pptx-vue-presentation-nav:hover:not(:disabled) {
	background-color: rgba(255, 255, 255, 0.2);
}

.pptx-vue-presentation-nav:disabled {
	opacity: 0.3;
	cursor: not-allowed;
}

.pptx-vue-presentation-prev {
	left: calc(env(safe-area-inset-left, 0px) + 12px);
}

.pptx-vue-presentation-next {
	right: calc(env(safe-area-inset-right, 0px) + 12px);
}
</style>
