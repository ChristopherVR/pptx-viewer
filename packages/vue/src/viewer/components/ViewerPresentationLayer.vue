<script setup lang="ts">
/**
 * ViewerPresentationLayer: the full-viewport surfaces that temporarily replace
 * the editing canvas (Slide Sorter, Outline View, Reading View, the slide show
 * itself) plus the Rehearse-Timings HUD that rides along with it.
 *
 * Grouped because they are mutually exclusive siblings at the very end of the
 * viewer's DOM, above everything else, and none of them is part of the editor
 * chrome. Their controllers arrive whole (`deckViews`, `presentation`) rather
 * than unpacked, so this file stays markup.
 */
import type { PptxCustomShow, PptxPresentationProperties, PptxSlide } from 'pptx-viewer-core';
import type { AuthoredSlideRange } from 'pptx-viewer-shared';

import type { UseDeckViewsResult } from '../composables/useDeckViews';
import type { UsePresentationControlsResult } from '../composables/usePresentationControls';
import type { CanvasSize } from '../types';
import OutlineViewOverlay from './OutlineViewOverlay.vue';
import PresentationMode from './PresentationMode.vue';
import ReadingViewOverlay from './ReadingViewOverlay.vue';
import RehearseTimingsHud from './RehearseTimingsHud.vue';
import RehearseTimingsSummary from './RehearseTimingsSummary.vue';
import SlideSorter from './SlideSorter.vue';

defineProps<{
	deckViews: UseDeckViewsResult;
	presentation: UsePresentationControlsResult;
	/** Slides with their template layer merged in: what every VISUAL surface paints. */
	mergedSlides: PptxSlide[];
	/** The editable deck, without the template layer merged in. */
	slides: PptxSlide[];
	canvasSize: CanvasSize;
	mediaDataUrls: Map<string, string>;
	content: Uint8Array | ArrayBuffer;
	activeSlideIndex: number;
	canEdit: boolean;
	presentationProperties: PptxPresentationProperties;
	/** Every named custom show, for an on-slide `ppaction://customshow` action's target. */
	customShows?: readonly PptxCustomShow[];
	/** `p:showPr/p:sldRg`, resolved to deck indexes; `null`/`undefined` for no range. */
	authoredRange?: AuthoredSlideRange | null;
	/** File > Options > Advanced > Slide Show behaviour flags. */
	endWithBlackSlide: boolean;
	promptKeepInkAnnotations: boolean;
	showMenuOnRightClick: boolean;
	showPopupToolbar: boolean;
	duplicateSlide: (index: number) => void;
	deleteSlide: (index: number) => void;
	toggleSlideHidden: (index: number) => void;
}>();
</script>

<template>
	<!-- Slide sorter overlay -->
	<SlideSorter
		v-if="deckViews.showSorter.value"
		:slides="mergedSlides"
		:canvas-size="canvasSize"
		:media-data-urls="mediaDataUrls"
		:content="content"
		:active-index="activeSlideIndex"
		:can-edit="canEdit"
		@select="deckViews.onSorterSelect"
		@reorder="deckViews.onSorterReorder"
		@duplicate="duplicateSlide"
		@delete="deleteSlide"
		@toggle-hidden="toggleSlideHidden"
		@close="deckViews.showSorter.value = false"
	/>

	<!--
		Outline view renders the EDITABLE deck, not `mergedSlides`: the merged one
		has each slide's inherited master/layout elements folded in, and committing
		that back would bake the whole template layer into every slide's own
		elements.
	-->
	<OutlineViewOverlay
		v-if="deckViews.showOutlineView.value"
		:slides="slides"
		:canvas-size="canvasSize"
		:can-edit="canEdit"
		@commit="deckViews.onOutlineCommit"
		@close="deckViews.showOutlineView.value = false"
	/>

	<!-- Reading view overlay (windowed; never the Fullscreen API) -->
	<ReadingViewOverlay
		v-if="deckViews.showReadingView.value"
		:slides="mergedSlides"
		:canvas-size="canvasSize"
		:media-data-urls="mediaDataUrls"
		:active-slide-index="activeSlideIndex"
		@exit="deckViews.onReadingViewExit"
	/>

	<!-- Presentation / slideshow overlay -->
	<PresentationMode
		v-if="presentation.presenting.value"
		:slides="mergedSlides"
		:canvas-size="canvasSize"
		:media-data-urls="mediaDataUrls"
		:start-index="presentation.presentationStartIndex.value"
		:start-in-presenter-view="presentation.startInPresenterView.value"
		:presentation-properties="presentationProperties"
		:active-custom-show="presentation.activePresentationCustomShow.value"
		:custom-shows="customShows"
		:authored-range="authoredRange"
		:end-with-black-slide="endWithBlackSlide"
		:prompt-keep-ink-annotations="promptKeepInkAnnotations"
		:show-menu-on-right-click="showMenuOnRightClick"
		:show-popup-toolbar="showPopupToolbar"
		@close="presentation.closePresentation"
		@slide-change="presentation.handlePresentSlideChange"
	/>
	<RehearseTimingsHud
		v-if="presentation.rehearsal.rehearsing.value"
		:slide-elapsed-ms="presentation.rehearsal.slideElapsedMs.value"
		:total-elapsed-ms="presentation.rehearsal.totalElapsedMs.value"
		:paused="presentation.rehearsal.paused.value"
		@toggle-pause="presentation.rehearsal.togglePause"
	/>
	<RehearseTimingsSummary
		v-if="presentation.rehearsal.showSummary.value"
		:timings="presentation.rehearsal.recordedTimings.value"
		@save="presentation.rehearsal.saveTimings"
		@discard="presentation.rehearsal.dismissSummary"
	/>
</template>
