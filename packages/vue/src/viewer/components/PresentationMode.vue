<script setup lang="ts">
import type { PptxSlide } from 'pptx-viewer-core';
import { ANIMATION_KEYFRAMES_CSS } from 'pptx-viewer-shared';
import type { CSSProperties } from 'vue';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { useAnimationPlayback } from '../composables/useAnimationPlayback';
import { useIsMobile } from '../composables/useIsMobile';
import { usePresentationAnnotations } from '../composables/usePresentationAnnotations';
import type { SlideAnnotationMap } from '../composables/usePresentationAnnotations';
import { useToolbarAutoHide } from '../composables/useToolbarAutoHide';
import { useTouchGestures } from '../composables/useTouchGestures';
import { provideZoomNavigation } from '../composables/zoom-navigation';
import type { CanvasSize } from '../types';
import KeepAnnotationsDialog from './KeepAnnotationsDialog.vue';
import MobilePresenterView from './MobilePresenterView.vue';
import PresentationAnnotationOverlay from './PresentationAnnotationOverlay.vue';
import PresentationSubtitleBar from './PresentationSubtitleBar.vue';
import PresentationToolbar from './PresentationToolbar.vue';
import PresentationTouchControls from './PresentationTouchControls.vue';
import PresentationTransitionOverlay from './PresentationTransitionOverlay.vue';
import PresenterView from './PresenterView.vue';
import SlideStage from './SlideStage.vue';

/**
 * PresentationMode - a full-viewport slideshow overlay.
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
	/**
	 * Exit the show. When the presenter chose to keep ink annotations, the
	 * per-slide stroke map is attached so the host can persist them as ink
	 * elements (mirrors the Angular binding's exit contract).
	 */
	(e: 'close', payload?: { annotations: SlideAnnotationMap }): void;
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

// Slide-Zoom / Section-Zoom tiles jump to their target slide when clicked. The
// context is provided only here (during a running presentation), so the same
// ZoomRenderer stays a static link in the editor/read-only tree.
provideZoomNavigation({ navigateToZoomTarget: goTo });

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

/**
 * Request exit. When ink annotations were drawn, prompt to keep or discard them
 * (KeepAnnotationsDialog) before leaving; otherwise exit immediately.
 */
function close(): void {
	if (annotations.hasAnyAnnotations.value) {
		showKeepPrompt.value = true;
		return;
	}
	emit('close');
}

/** Keep: hand the per-slide stroke map to the host, which persists it as ink. */
function onKeepAnnotations(): void {
	const map: SlideAnnotationMap = new Map(annotations.allSlideAnnotations.value);
	showKeepPrompt.value = false;
	emit('close', { annotations: map });
}

/** Discard: drop the strokes and exit without persisting. */
function onDiscardAnnotations(): void {
	showKeepPrompt.value = false;
	emit('close');
}

// ---------------------------------------------------------------------------
// Presentation chrome: ink annotations, toolbar, presenter view, captions
// ---------------------------------------------------------------------------

/** Timestamp (ms) the show started: drives the toolbar/presenter timers. */
const presentationStartTime = ref<number | null>(null);
/** Whether the presenter view (notes + next-slide preview) is shown. */
const presenterMode = ref(false);
/** On a phone, the presenter view uses a single-column mobile layout. */
const { isMobile, isTouchDevice } = useIsMobile();
/** Whether the live-caption (subtitle) bar is shown. */
const subtitlesOn = ref(false);

/**
 * The floating mouse toolbar only appears on `mousemove` and hides again
 * after an idle delay; while hidden it must not intercept pointer events; see
 * `useToolbarAutoHide` for why (it otherwise sits over the persistent touch
 * controls' fixed prev/next buttons).
 */
const { toolbarVisible } = useToolbarAutoHide();

const annotations = usePresentationAnnotations({
	isActive: () => true,
	activeSlideIndex: currentIndex,
});

/** Whether the keep-or-discard-annotations prompt is showing (set on exit). */
const showKeepPrompt = ref(false);
/** Total stroke count across all slides, for the prompt copy. */
const annotationCount = computed(() => {
	let total = 0;
	for (const strokes of annotations.allSlideAnnotations.value.values()) {
		total += strokes.length;
	}
	return total;
});
/** Number of slides that carry at least one stroke, for the prompt copy. */
const annotatedSlideCount = computed(() => annotations.allSlideAnnotations.value.size);

/**
 * Tap-to-advance, but only when no drawing tool is armed and the presenter
 * view is not covering the stage; otherwise a pen stroke or a presenter-view
 * click would skip slides.
 */
function onOverlayClick(): void {
	if (annotations.presentationTool.value !== 'none' || presenterMode.value) {
		return;
	}
	next();
}

/** Toolbar `move(±1)` → next/prev. */
function onToolbarMove(direction: 1 | -1): void {
	if (direction > 0) {
		next();
	} else {
		prev();
	}
}

// Slide-transition overlay: when the active slide carries a transition, play it
// over the frame (outgoing snapshot + animated incoming) until `done`.
const transitionState = ref<{
	outgoing: PptxSlide | undefined;
	incoming: PptxSlide | undefined;
	transition: NonNullable<PptxSlide['transition']>;
} | null>(null);

watch(currentIndex, (index, previousIndex) => {
	emit('slide-change', index);
	playback.reset();
	const incoming = props.slides[index];
	const transition = incoming?.transition;
	if (transition && transition.type && transition.type !== 'none') {
		transitionState.value = {
			outgoing: props.slides[previousIndex],
			incoming,
			transition,
		};
	} else {
		transitionState.value = null;
	}
});

function onTransitionDone(): void {
	transitionState.value = null;
}

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
			return;
		case 'c':
		case 'C':
			// Toggle live captions (mirrors PowerPoint's "C" shortcut).
			event.preventDefault();
			subtitlesOn.value = !subtitlesOn.value;
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
// A horizontal swipe steps between slides. The gesture math is delegated to the
// shared `createTouchGestureRecognizer` (via `useTouchGestures`); a rightward
// swipe (direction 1) goes to the previous slide, a leftward swipe (direction
// -1) to the next, matching the React present-mode mapping. Pinch-zoom is a
// no-op here (the stage is already fit-to-viewport), so `currentScale` is a
// constant 1 and the pinch callback is omitted.

const overlayRef = ref<HTMLDivElement | null>(null);
const presentScale = ref(1);

useTouchGestures({
	targetRef: overlayRef,
	currentScale: presentScale,
	minScale: 1,
	maxScale: 1,
	callbacks: {
		onSwipe: (direction) => {
			if (direction === 1) {
				prev();
			} else {
				next();
			}
		},
	},
});

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
	presentationStartTime.value = Date.now();
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
		<div ref="overlayRef" class="pptx-vue-presentation" @click="onOverlayClick">
			<!-- Inject the animation @keyframes once for this overlay. -->
			<component :is="'style'">{{ ANIMATION_KEYFRAMES_CSS }}</component>
			<div ref="frameRef" class="pptx-vue-presentation-frame" :style="frameStyle">
				<SlideStage
					:slide="activeSlide"
					:canvas-size="canvasSize"
					:media-data-urls="mediaDataUrls"
					:scale="scale"
				/>
				<!-- Ink / laser / eraser overlay (captures pointers only when armed). -->
				<PresentationAnnotationOverlay
					:canvas-size="canvasSize"
					:editor-scale="scale"
					:presentation-tool="annotations.presentationTool.value"
					:annotation-strokes="annotations.annotationStrokes.value"
					:current-stroke="annotations.currentStroke.value"
					:laser-position="annotations.laserPosition.value"
					@pointer-down="annotations.handlePointerDown"
					@pointer-move="annotations.handlePointerMove"
					@pointer-up="annotations.handlePointerUp"
					@laser-move="annotations.handleLaserMove"
					@laser-leave="annotations.handleLaserLeave"
					@erase="annotations.eraseAtPoint"
				/>
				<!-- Slide-transition animation (covers the frame until `done`). -->
				<PresentationTransitionOverlay
					v-if="transitionState"
					:outgoing-slide="transitionState.outgoing"
					:incoming-slide="transitionState.incoming"
					:canvas-size="canvasSize"
					:media-data-urls="mediaDataUrls"
					:scale="scale"
					:transition="transitionState.transition"
					@done="onTransitionDone"
				/>
			</div>

			<!-- Presenter view (notes + next-slide preview): covers the stage.
			     On a phone, a single-column mobile layout replaces the desktop
			     split-screen layout. -->
			<MobilePresenterView
				v-if="presenterMode && isMobile"
				:slides="slides"
				:current-slide-index="currentIndex"
				:canvas-size="canvasSize"
				:media-data-urls="mediaDataUrls"
				:presentation-start-time="presentationStartTime"
				@click.stop
				@move="onToolbarMove"
				@exit="presenterMode = false"
			/>
			<PresenterView
				v-else-if="presenterMode"
				:slides="slides"
				:current-slide-index="currentIndex"
				:canvas-size="canvasSize"
				:media-data-urls="mediaDataUrls"
				:presentation-start-time="presentationStartTime"
				@click.stop
				@move="onToolbarMove"
				@exit="presenterMode = false"
			/>

			<!-- Live caption bar. -->
			<PresentationSubtitleBar :visible="subtitlesOn" @click.stop />

			<!-- Mouse users get a slide counter; the auto-hiding PresentationToolbar
			     already carries their nav + end controls. -->
			<div v-if="!isTouchDevice" class="pptx-vue-presentation-counter" @click.stop>
				{{ currentIndex + 1 }} / {{ slides.length }}
			</div>

			<!-- Persistent touch controls (close + prev/next + counter): the primary
			     touch affordance for exiting / navigating the slideshow, since the
			     mouse toolbar stays hidden without a pointer move and a phone has no
			     Escape key. Touch-only and safe-area aware. Rendered BEFORE the
			     auto-hiding toolbar below (mirrors React's `ViewerCanvasArea` order)
			     so that role/name queries which grab the first accessible match
			     (e.g. `getByRole('button', { name: /next slide/i }).first()`) resolve
			     to this always-interactive control rather than the toolbar's copy,
			     which is genuinely non-interactive (`pointer-events: none`) while
			     hidden. -->
			<PresentationTouchControls
				:current-slide-index="currentIndex"
				:total-slides="slides.length"
				@move="onToolbarMove"
				@end="close"
			/>

			<!-- Control bar (nav + ink tools + presenter toggle + end). Hidden
			     (opacity 0, pointer-events none) until the mouse moves, and hidden
			     again after an idle delay: see `useToolbarAutoHide`. A touch-only
			     device never dispatches `mousemove`, so this bar simply never
			     appears there, which matters because it visually and physically
			     overlaps `PresentationTouchControls`' fixed prev/next buttons. -->
			<div
				class="pptx-vue-presentation-toolbar-slot"
				:class="{ 'is-visible': toolbarVisible }"
				@click.stop
			>
				<PresentationToolbar
					:presentation-tool="annotations.presentationTool.value"
					:pen-color="annotations.penColor.value"
					:highlighter-color="annotations.highlighterColor.value"
					:has-annotations="annotations.hasAnyAnnotations.value"
					:current-slide-index="currentIndex"
					:total-slides="slides.length"
					:presentation-start-time="presentationStartTime"
					:presenter-mode="presenterMode"
					:show-presenter-toggle="true"
					@set-tool="annotations.setPresentationTool"
					@set-pen-color="annotations.setPenColor"
					@set-highlighter-color="annotations.setHighlighterColor"
					@clear-annotations="annotations.clearAnnotations"
					@move="onToolbarMove"
					@end-presentation="close"
					@toggle-presenter-view="presenterMode = !presenterMode"
				/>
			</div>

			<!-- Keep-or-discard ink annotations on exit. -->
			<KeepAnnotationsDialog
				:open="showKeepPrompt"
				:annotation-count="annotationCount"
				:slide-count="annotatedSlideCount"
				@keep="onKeepAnnotations"
				@discard="onDiscardAnnotations"
			/>
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

.pptx-vue-presentation-toolbar-slot {
	position: absolute;
	bottom: 24px;
	left: 50%;
	transform: translateX(-50%);
	z-index: 80;
	opacity: 0;
	pointer-events: none;
	transition: opacity 300ms;
}

.pptx-vue-presentation-toolbar-slot.is-visible {
	opacity: 1;
	pointer-events: auto;
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
</style>
