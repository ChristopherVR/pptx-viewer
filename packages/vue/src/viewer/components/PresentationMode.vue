<script setup lang="ts">
/**
 * PresentationMode - a full-viewport slideshow overlay.
 *
 * Renders the active slide via {@link SlideStage}, scaled to fit the viewport
 * while preserving aspect ratio, centered on a black background. Mounted into
 * `document.body` via `<Teleport>` and pinned with `position: fixed; inset: 0`.
 *
 * The behaviour lives in four composables, because each is a self-contained
 * machine that this file only has to connect:
 *  - `usePresentationViewport`  fit-to-viewport scale + real fullscreen
 *  - `usePresentationNavigation` where an advance lands (builds, then slides,
 *                                then the end screen) + the transition overlay
 *  - `usePresentationKeyboard`   the shared PowerPoint keymap
 *  - `usePresentationAnimationStyles` per-element native-animation DOM writes
 *
 * Navigation mirrors the React `usePresentationMode` semantics: Right / Space /
 * PageDown advance, Left / PageUp go back, Home / End jump to the show's first
 * and last slide, Esc exits, and a click on the stage advances.
 */
import type { PptxCustomShow, PptxPresentationProperties, PptxSlide } from 'pptx-viewer-core';
import type { AuthoredSlideRange, PresentationContextMenuActionId } from 'pptx-viewer-shared';
import {
	ANIMATION_KEYFRAMES_CSS,
	DEFAULT_VIEWER_OPTIONS,
	endAudienceDisplay,
	getPresentationContextMenuSections,
	handlePresentationStageClick,
	mayLeaveSlideShow,
	PRESENT_TOOLBAR_METRICS,
	PRESENTATION_HIT_TEST_CSS,
	shouldConfirmExternalHyperlink,
	shouldLoopContinuously,
	toggleBlackboard,
} from 'pptx-viewer-shared';
import { computed, inject, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { providePresentationElementStates } from '../composables/presentation-element-states';
import { useAnimationPlayback } from '../composables/useAnimationPlayback';
import { useIsMobile } from '../composables/useIsMobile';
import type { ActiveCustomShow } from '../composables/usePresentationActionExtras';
import { usePresentationActionExtras } from '../composables/usePresentationActionExtras';
import { usePresentationAnimationStyles } from '../composables/usePresentationAnimationStyles';
import { usePresentationAnnotations } from '../composables/usePresentationAnnotations';
import type { SlideAnnotationMap } from '../composables/usePresentationAnnotations';
import { usePresentationKeyboard } from '../composables/usePresentationKeyboard';
import { usePresentationNavigation } from '../composables/usePresentationNavigation';
import { usePresentationShowOrder } from '../composables/usePresentationShowOrder';
import { usePresentationViewport } from '../composables/usePresentationViewport';
import { usePresentationVisibilityPause } from '../composables/usePresentationVisibilityPause';
import { usePresenterSession } from '../composables/usePresenterSession';
import { useSlideAutoAdvance } from '../composables/useSlideAutoAdvance';
import { useToolbarAutoHide } from '../composables/useToolbarAutoHide';
import { useTouchGestures } from '../composables/useTouchGestures';
import { ViewerOptionsKey } from '../composables/useViewerOptionsStore';
import { provideZoomNavigation } from '../composables/zoom-navigation';
import type { CanvasSize } from '../types';
import type { ContextMenuItem } from './ContextMenu.vue';
import ContextMenu from './ContextMenu.vue';
import KeepAnnotationsDialog from './KeepAnnotationsDialog.vue';
import MobilePresenterView from './MobilePresenterView.vue';
import PresentationAnnotationOverlay from './PresentationAnnotationOverlay.vue';
import PresentationAudienceOverlays from './PresentationAudienceOverlays.vue';
import PresentationEndScreen from './PresentationEndScreen.vue';
import PresentationSubtitleBar from './PresentationSubtitleBar.vue';
import PresentationToolbar from './PresentationToolbar.vue';
import PresentationTouchControls from './PresentationTouchControls.vue';
import PresentationTransitionOverlay from './PresentationTransitionOverlay.vue';
import PresenterView from './PresenterView.vue';
import SlideStage from './SlideStage.vue';

const props = withDefaults(
	defineProps<{
		slides: PptxSlide[];
		canvasSize: CanvasSize;
		mediaDataUrls: Map<string, string>;
		content?: ArrayBuffer | Uint8Array | null;
		startIndex?: number;
		startInPresenterView?: boolean;
		presentationProperties?: PptxPresentationProperties;
		/** Membership of the running custom show, when one is selected. */
		activeCustomShow?: { slideRIds: string[] } | null;
		/** Every named custom show, for an on-slide `ppaction://customshow` action's target. */
		customShows?: readonly PptxCustomShow[];
		/**
		 * The `p:showPr/p:sldRg` slide-range restriction, when the deck is
		 * authored to open into a range rather than the whole deck or a custom
		 * show. Applied the same way `activeCustomShow` is: a filter on the
		 * navigable order, not a pre-filtered slide array.
		 */
		authoredRange?: AuthoredSlideRange | null;
		/** File > Options > Advanced > Slide Show behavior flags. */
		endWithBlackSlide?: boolean;
		promptKeepInkAnnotations?: boolean;
		showMenuOnRightClick?: boolean;
		showPopupToolbar?: boolean;
	}>(),
	{
		startIndex: 0,
		startInPresenterView: false,
		endWithBlackSlide: true,
		promptKeepInkAnnotations: true,
		showMenuOnRightClick: true,
		showPopupToolbar: true,
	},
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

const overlayRef = ref<HTMLDivElement | null>(null);
const frameRef = ref<HTMLDivElement | null>(null);

const { t } = useI18n();
// Absent when this overlay is mounted without a `PowerPointViewer` ancestor
// (e.g. an isolated test fixture): the Trust Center default then applies.
const viewerOptions = inject(ViewerOptionsKey, undefined);
// Options > Accessibility > "reduced motion": this overlay is <Teleport>-ed to
// `document.body`, outside the `.pptx-vue-viewer` subtree the option's other
// root class lands on, so it needs its own copy of the class (see theme.css).
const reducedMotion = computed(() => viewerOptions?.value.accessibility.reducedMotion ?? false);

// -- Navigation --------------------------------------------------------
// Declaration order below is load-bearing: `usePresenterSession` and
// `usePresentationAnnotations` both READ the current slide index during setup,
// so `nav` has to exist first, while `playback` is built FROM `nav.activeSlide`
// and is therefore handed back to `nav` as a getter.

/**
 * The show order's ACTUAL active custom show: the dialog-selected one
 * (`activeCustomShow` prop) by default, but temporarily overridden while an
 * on-slide `ppaction://customshow` action is running (see
 * `usePresentationActionExtras.customShow`). `undefined` means "follow the
 * prop"; an explicit `null` means "no show" (the whole deck), which the prop
 * itself cannot express with `undefined` alone once an override is in play.
 */
const activeShowOverride = ref<ActiveCustomShow>(undefined);
const effectiveActiveCustomShow = computed<ActiveCustomShow>(() =>
	activeShowOverride.value !== undefined ? activeShowOverride.value : props.activeCustomShow,
);

/**
 * Which slides this show visits and what a press resolves to (hidden slides
 * skipped, custom show honoured). The rule is shared so no binding can present
 * a slide someone deliberately hid from the room.
 */
const showOrder = usePresentationShowOrder({
	slides: () => props.slides,
	activeCustomShow: () => effectiveActiveCustomShow.value,
	authoredRange: () => props.authoredRange,
});

/**
 * The wave-4 on-slide action verbs (`lastViewed`, `customShow`, `openFile`,
 * `openPresentation`, `playMedia`, `oleVerb`). Needs `nav.currentIndex` +
 * `nav.goTo` for navigation, so it is built once `nav` exists (below) and its
 * `handleShowEnd` is threaded back into `nav`'s own `onShowEnd` option -
 * both close over the same mutable refs, so declaration order here matters.
 */
let actionExtras: ReturnType<typeof usePresentationActionExtras> | undefined;

const nav = usePresentationNavigation({
	slides: () => props.slides,
	startIndex: () => props.startIndex,
	playback: () => playback,
	showOrder,
	endWithBlackSlide: () => props.endWithBlackSlide,
	loopContinuously: () => shouldLoopContinuously(props.presentationProperties ?? {}),
	requestClose: close,
	onSlideChange: (index) => emit('slide-change', index),
	onShowEnd: () => actionExtras?.handleShowEnd() ?? false,
});

actionExtras = usePresentationActionExtras({
	customShows: () => props.customShows ?? [],
	currentIndex: nav.currentIndex,
	activeSlide: () => nav.activeSlide.value,
	activeShowOverride,
	firstShowSlide: showOrder.first,
	goTo: nav.goTo,
	frameRoot: () => frameRef.value,
});

// Animation playback: each "next" first reveals the slide's next native-timing
// (`p:timing`) click-group; only when the slide's builds are exhausted do we
// advance the slide. The controller also drives staged chart / SmartArt builds
// and `p:animClr` colour animations.
const playback = useAnimationPlayback({
	slide: nav.activeSlide,
	showWithAnimation: () => props.presentationProperties?.showWithAnimation,
	frameRoot: () => frameRef.value,
});
// Publish the per-element state map so the chart / SmartArt / connector / shape
// renderers can reveal staged builds and relinquish animated fill / stroke.
providePresentationElementStates(playback.presentationElementStates);

// Slide-Zoom / Section-Zoom tiles jump to their target slide when clicked. The
// context is provided only here (during a running presentation), so the same
// ZoomRenderer stays a static link in the editor/read-only tree.
provideZoomNavigation({ navigateToZoomTarget: nav.goTo });

const { onFrameClick, onFrameHover, onFrameHoverEnd } = usePresentationAnimationStyles({
	frameRef,
	playback,
	activeSlide: () => nav.activeSlide.value,
});

// PowerPoint's "Advance slide: After <n>" (`p:transition/@advTm`). Re-armed on
// every slide change and always cancelled first. Slide 1 of a deck authored
// `advClick="0" advTm="..."` has no other way forward, so without this the show
// never leaves it and looks completely unresponsive.
const autoAdvance = useSlideAutoAdvance({
	slide: nav.activeSlide,
	useTimings: () => props.presentationProperties?.advanceMode !== 'manual',
	suspended: nav.showEndScreen,
	position: nav.currentIndex,
	advance: nav.next,
});

// A hidden tab is a paused show: stage media and cross-slide persistent audio
// stop, and the pending auto-advance timer is cancelled so the deck does not
// run on unseen; everything resumes when the tab is visible again. Unmounting
// this overlay is the show's exit, which also ends all cross-slide audio.
usePresentationVisibilityPause({
	root: overlayRef,
	cancelAutoAdvance: autoAdvance.cancel,
	rearmAutoAdvance: autoAdvance.rearm,
});

// -- Presenter session (audience display link) -------------------------
const presenterSession = usePresenterSession({
	currentSlideIndex: nav.currentIndex,
	content: () => props.content ?? null,
	onAudienceSlide: (index) => {
		if (index >= 0 && index < props.slides.length) {
			nav.currentIndex.value = index;
			emit('slide-change', index);
		}
	},
	// The presenter ended the session. Close this tab; when the browser refuses,
	// leave the black end-of-slide-show screen up rather than the editor.
	onAudienceExit: () => {
		if (endAudienceDisplay(window)) {
			nav.showEndScreen.value = true;
		}
	},
});

const { scale, frameStyle } = usePresentationViewport({
	canvasSize: () => props.canvasSize,
	overlayRef,
	isAudience: presenterSession.isAudience,
});

// -- Ink annotations + exit prompt -------------------------------------
const annotations = usePresentationAnnotations({
	isActive: () => true,
	activeSlideIndex: nav.currentIndex,
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
 * Request exit. When ink annotations were drawn, prompt to keep or discard them
 * before leaving; otherwise exit immediately. The prompt is skipped
 * (annotations silently discarded) when File > Options > Advanced > "Prompt to
 * keep ink annotations when exiting" is off. Hoisted (a function declaration)
 * so `nav`, created above it, can take it as its close callback.
 */
function close(): void {
	// An audience display mirrors the presenter's screen: Escape, the toolbar and
	// the advance past the end screen must never reveal the editor to the room.
	if (!mayLeaveSlideShow()) {
		return;
	}
	if (annotations.hasAnyAnnotations.value && props.promptKeepInkAnnotations) {
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

// -- Presentation chrome: toolbar, presenter view, captions ------------
/** Timestamp (ms) the show started: drives the toolbar/presenter timers. */
const presentationStartTime = ref<number | null>(null);
onMounted(() => {
	presentationStartTime.value = Date.now();
});
/**
 * Where the auto-hiding show toolbar sits, read from the shared chrome spec
 * rather than re-typed here: the offset, stacking order and fade are the same
 * design in all five bindings and a scoped stylesheet cannot see the constant.
 */
const toolbarSlotStyle = computed(() => ({
	bottom: `${String(PRESENT_TOOLBAR_METRICS.bottomOffset)}px`,
	zIndex: String(PRESENT_TOOLBAR_METRICS.zIndex),
	transitionDuration: `${String(PRESENT_TOOLBAR_METRICS.fadeMs)}ms`,
}));
/** Whether the presenter view (notes + next-slide preview) is shown. */
const presenterMode = ref(props.startInPresenterView);
/**
 * Bumped by Ctrl+S to raise the console's "See All Slides" grid. A counter, not
 * a flag, so closing the grid stays local to `PresenterView` and this side never
 * has to be told about it.
 */
const openSlideGridNonce = ref(0);
/** On a phone, the presenter view uses a single-column mobile layout. */
const { isMobile } = useIsMobile();
/** Whether the live-caption (subtitle) bar is shown. */
const subtitlesOn = ref(false);
/** PowerPoint's Ctrl+M: hide ink markup without discarding the strokes. */
const inkMarkupVisible = ref(true);

/**
 * The floating mouse toolbar only appears on `mousemove` and hides again
 * after an idle delay; while hidden it must not intercept pointer events; see
 * `useToolbarAutoHide` for why (it otherwise sits over the persistent touch
 * controls' fixed prev/next buttons).
 */
const { toolbarVisible, setToolbarVisible } = useToolbarAutoHide({
	enabled: () => props.showPopupToolbar,
});

/** Toolbar `move(+-1)` -> next/prev. */
function onToolbarMove(direction: 1 | -1): void {
	if (direction > 0) {
		nav.next();
	} else {
		nav.prev();
	}
}

/**
 * Toolbar Blackboard toggle: one click arms the black screen and the pen
 * together, one click disarms both (shared `toggleBlackboard` transition).
 * The blackout travels the same presenter-snapshot path as the keyboard's
 * B / W toggles; the tool is written directly (not via `setPresentationTool`,
 * which TOGGLES and would clear an already-armed pen).
 */
function onToggleBlackboard(): void {
	const next = toggleBlackboard(
		presenterSession.snapshot.value.blackout,
		annotations.presentationTool.value,
	);
	presenterSession.updateSnapshot({ blackout: next.blackout });
	annotations.presentationTool.value = next.tool;
}

/**
 * Set (or clear) the whole-screen blank, independent of the toolbar's
 * pen-coupled Blackboard toggle: clicking an already-active colour turns the
 * blank off, matching the keyboard B/W shortcuts in `usePresentationKeyboard`.
 */
function setBlankScreen(value: 'black' | 'white'): void {
	const current = presenterSession.snapshot.value.blackout;
	presenterSession.updateSnapshot({ blackout: current === value ? 'none' : value });
}

// -- Slide-show right-click menu ----------------------------------------
// Options > Advanced > "Show menu on right mouse click": while presenting,
// right-click opens a minimal Next/Previous/End Show menu (plus pointer
// tools, See All Slides, Presenter View and the black/white blank screen);
// with the option off, right-click is swallowed entirely (no browser menu
// either). Item order/grouping/i18n keys come from the shared
// `getPresentationContextMenuSections` so this menu cannot drift from React's.
const contextMenuState = ref<{ x: number; y: number } | null>(null);

const contextMenuItems = computed<ContextMenuItem[]>(() => {
	const sections = getPresentationContextMenuSections({
		seeAllSlides: true,
		presenterView: true,
		pointerTools: true,
		eraseInk: true,
		blankBlack: true,
		blankWhite: true,
	});
	const items: ContextMenuItem[] = [];
	sections.forEach((section, sectionIndex) => {
		if (sectionIndex > 0) {
			items.push({ id: `sep-${section.id}`, label: '', separator: true });
		}
		for (const item of section.items) {
			items.push({ id: item.id, label: t(item.labelKey) });
		}
	});
	return items;
});

function onOverlayContextMenu(event: MouseEvent): void {
	event.preventDefault();
	if (!props.showMenuOnRightClick) {
		return;
	}
	contextMenuState.value = { x: event.clientX, y: event.clientY };
}

function onContextMenuSelect(id: string): void {
	switch (id as PresentationContextMenuActionId) {
		case 'next':
			nav.next();
			break;
		case 'previous':
			nav.prev();
			break;
		case 'seeAllSlides':
			presenterMode.value = true;
			openSlideGridNonce.value += 1;
			break;
		case 'presenterView':
			presenterMode.value = !presenterMode.value;
			break;
		case 'pointerArrow':
			annotations.setPresentationTool('none');
			break;
		case 'pointerPen':
			annotations.setPresentationTool('pen');
			break;
		case 'pointerHighlighter':
			annotations.setPresentationTool('highlighter');
			break;
		case 'pointerLaser':
			annotations.setPresentationTool('laser');
			break;
		case 'eraseInk':
			annotations.clearAnnotations();
			break;
		case 'blankBlack':
			setBlankScreen('black');
			break;
		case 'blankWhite':
			setBlankScreen('white');
			break;
		case 'endShow':
			close();
			break;
	}
}

/**
 * How an on-slide Action Setting (`a:hlinkClick`) navigates this show.
 * `goTo` is deliberately the unfiltered jump: an action names its target slide
 * outright, hidden or not, exactly as PowerPoint's typed slide number does.
 */
const actionOptions = computed(() => ({ slideCount: props.slides.length }));
const actionRunner = {
	goToSlide: (index: number) => {
		nav.goTo(index);
	},
	move: (direction: 1 | -1) => {
		if (direction > 0) {
			nav.next();
		} else {
			nav.prev();
		}
	},
	endShow: () => {
		close();
	},
	// Trust Center > "Confirm before opening external hyperlinks", for an
	// on-slide Action Setting that opens a URL (the run-level `<a href>` gate
	// lives in `SlideTextRunBase.vue`; this covers a shape's own action).
	confirmUrl: (url: string) => {
		const options = viewerOptions?.value ?? DEFAULT_VIEWER_OPTIONS;
		if (!shouldConfirmExternalHyperlink(options, url)) {
			return true;
		}
		return window.confirm(`${t('pptx.options.trust.confirmHyperlinks')}\n\n${url}`);
	},
	lastViewed: () => actionExtras?.lastViewed(),
	customShow: (customShowId: string, returnAfter: boolean) =>
		actionExtras?.customShow(customShowId, returnAfter),
	openFile: (target: string) => actionExtras?.openFile(target),
	openPresentation: (target: string) => actionExtras?.openPresentation(target),
	playMedia: (elementId: string | undefined) => actionExtras?.playMedia(elementId),
	oleVerb: (verb: number, elementId: string | undefined) => actionExtras?.oleVerb(verb, elementId),
};

/**
 * Tap-to-advance, but only when no drawing tool is armed and the presenter
 * view is not covering the stage; otherwise a pen stroke or a presenter-view
 * click would skip slides.
 *
 * An on-slide Action Setting outranks the advance: PowerPoint follows the
 * shape's link and leaves the show where the link lands. The shared classifier
 * runs it and tells us whether anything is left for the tap.
 */
function onOverlayClick(event: MouseEvent): void {
	if (annotations.presentationTool.value !== 'none' || presenterMode.value) {
		return;
	}
	const outcome = handlePresentationStageClick(
		event.target,
		nav.activeSlide.value,
		actionOptions.value,
		actionRunner,
	);
	if (outcome !== 'advance') {
		return;
	}
	nav.advanceFromClick();
}

usePresentationKeyboard({
	slideCount: () => props.slides.length,
	next: nav.next,
	prev: nav.prev,
	goTo: nav.goTo,
	firstSlideIndex: () => showOrder.first(0),
	lastSlideIndex: () => showOrder.last(props.slides.length - 1),
	requestClose: close,
	setPresentationTool: annotations.setPresentationTool,
	clearAnnotations: annotations.clearAnnotations,
	inkMarkupVisible,
	subtitlesOn,
	toolbarVisible,
	setToolbarVisible,
	setBlackout: setBlankScreen,
	// PowerPoint's Ctrl+S is "See All Slides", not "open presenter view": raising
	// the console alone left the presenter one more click away from the grid the
	// shortcut is named after, and nothing on screen said which click.
	showAllSlides: () => {
		presenterMode.value = true;
		openSlideGridNonce.value += 1;
	},
});

// -- Touch / swipe navigation (mobile has no Esc / arrow keys) ---------
// A horizontal swipe steps between slides. The gesture math is delegated to the
// shared `createTouchGestureRecognizer` (via `useTouchGestures`); a rightward
// swipe (direction 1) goes to the previous slide, a leftward swipe (direction
// -1) to the next, matching the React present-mode mapping. Pinch-zoom is a
// no-op here (the stage is already fit-to-viewport), so `currentScale` is a
// constant 1 and the pinch callback is omitted.
const presentScale = ref(1);
useTouchGestures({
	targetRef: overlayRef,
	currentScale: presentScale,
	minScale: 1,
	maxScale: 1,
	callbacks: {
		onSwipe: (direction) => {
			if (direction === 1) {
				nav.prev();
			} else {
				// A leftward swipe is PowerPoint's on-click advance, so it is gated by
				// the current slide's advanceOnClick transition flag.
				nav.advanceFromClick();
			}
		},
	},
});
</script>

<template>
	<Teleport to="body">
		<div
			ref="overlayRef"
			class="pptx-vue-presentation"
			:class="{ 'pptx-vue-reduced-motion': reducedMotion }"
			@click="onOverlayClick"
			@contextmenu="onOverlayContextMenu"
		>
			<!-- Inject the static preset @keyframes plus this slide's native-animation
			     (`p:timing`) keyframes (staged builds + `p:animClr` colour stops),
			     plus the show's hit-testing rule: scenery is pointer-transparent so a
			     click reaches the action shape underneath it (or the show's advance). -->
			<component :is="'style'"
				>{{ ANIMATION_KEYFRAMES_CSS }}{{ PRESENTATION_HIT_TEST_CSS
				}}{{ playback.presentationKeyframesCss.value }}</component
			>
			<div
				ref="frameRef"
				class="pptx-vue-presentation-frame"
				:style="frameStyle"
				@click="onFrameClick"
				@mouseover="onFrameHover"
				@mouseout="onFrameHoverEnd"
			>
				<SlideStage
					:slide="nav.activeSlide.value"
					:canvas-size="canvasSize"
					:media-data-urls="mediaDataUrls"
					:scale="scale"
					:presenting="true"
				/>
				<!-- Ink / laser / eraser overlay (captures pointers only when armed).
				     Ctrl+M hides the markup without discarding the strokes. -->
				<PresentationAnnotationOverlay
					v-if="inkMarkupVisible"
					:canvas-size="canvasSize"
					:editor-scale="scale"
					:blackout="presenterSession.snapshot.value.blackout"
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
					v-if="nav.transitionState.value"
					:outgoing-slide="nav.transitionState.value.outgoing"
					:incoming-slide="nav.transitionState.value.incoming"
					:canvas-size="canvasSize"
					:media-data-urls="mediaDataUrls"
					:scale="scale"
					:transition="nav.transitionState.value.transition"
					@done="nav.onTransitionDone"
				/>
			</div>

			<PresentationAudienceOverlays :snapshot="presenterSession.snapshot.value" />

			<!-- Presenter view (notes + next-slide preview): covers the stage.
			     On a phone, a single-column mobile layout replaces the desktop
			     split-screen layout. -->
			<MobilePresenterView
				v-if="presenterMode && isMobile"
				:slides="slides"
				:current-slide-index="nav.currentIndex.value"
				:canvas-size="canvasSize"
				:media-data-urls="mediaDataUrls"
				:presentation-start-time="presentationStartTime"
				:active-custom-show="activeCustomShow"
				:authored-range="authoredRange"
				@click.stop
				@move="onToolbarMove"
				@exit="presenterMode = false"
			/>
			<PresenterView
				v-else-if="presenterMode"
				:slides="slides"
				:current-slide-index="nav.currentIndex.value"
				:canvas-size="canvasSize"
				:media-data-urls="mediaDataUrls"
				:presentation-start-time="presentationStartTime"
				:audience-open="presenterSession.audienceOpen.value"
				:snapshot="presenterSession.snapshot.value"
				:active-custom-show="activeCustomShow"
				:authored-range="authoredRange"
				:open-slide-grid-nonce="openSlideGridNonce"
				@click.stop
				@move="onToolbarMove"
				@open-audience="presenterSession.openAudience"
				@close-audience="presenterSession.closeAudience"
				@swap-displays="() => void presenterSession.swapDisplays()"
				@navigate="nav.goTo"
				@update-snapshot="presenterSession.updateSnapshot"
				@exit="presenterMode = false"
			/>

			<!-- Black "End of slide show" screen: the show has run past its last
			     slide. It MUST be visible - while it is up the next input either
			     goes nowhere (backward) or ends the show (forward), so a deck that
			     kept painting the last slide looked stuck and then exited with no
			     warning. -->
			<PresentationEndScreen v-if="nav.showEndScreen.value" @exit="close" />

			<!-- Live caption bar. -->
			<PresentationSubtitleBar :visible="subtitlesOn" @click.stop />

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
				:current-slide-index="nav.currentIndex.value"
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
				:style="toolbarSlotStyle"
				@click.stop
			>
				<PresentationToolbar
					:presentation-tool="annotations.presentationTool.value"
					:pen-color="annotations.penColor.value"
					:highlighter-color="annotations.highlighterColor.value"
					:has-annotations="annotations.hasAnyAnnotations.value"
					:current-slide-index="nav.currentIndex.value"
					:total-slides="slides.length"
					:presentation-start-time="presentationStartTime"
					:presenter-mode="presenterMode"
					:show-presenter-toggle="true"
					:blackout="presenterSession.snapshot.value.blackout"
					@set-tool="annotations.setPresentationTool"
					@set-pen-color="annotations.setPenColor"
					@set-highlighter-color="annotations.setHighlighterColor"
					@clear-annotations="annotations.clearAnnotations"
					@move="onToolbarMove"
					@end-presentation="close"
					@toggle-presenter-view="presenterMode = !presenterMode"
					@toggle-blackboard="onToggleBlackboard"
				/>
			</div>

			<!-- Slide-show right-click menu. -->
			<ContextMenu
				:open="contextMenuState !== null"
				:x="contextMenuState?.x ?? 0"
				:y="contextMenuState?.y ?? 0"
				:items="contextMenuItems"
				@select="onContextMenuSelect"
				@close="contextMenuState = null"
			/>

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

/* Offset, stacking order and fade come from `toolbarSlotStyle` (the shared
   `PRESENT_TOOLBAR_METRICS`); only the layout that has no number to share
   stays here. */
.pptx-vue-presentation-toolbar-slot {
	position: absolute;
	left: 50%;
	transform: translateX(-50%);
	opacity: 0;
	pointer-events: none;
	transition-property: opacity;
}

.pptx-vue-presentation-toolbar-slot.is-visible {
	opacity: 1;
	pointer-events: auto;
}
</style>
