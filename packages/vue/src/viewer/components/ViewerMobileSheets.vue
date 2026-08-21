<script setup lang="ts">
/**
 * ViewerMobileSheets: the phone chrome (bottom bar plus the slides / notes /
 * format / comments bottom sheets that stand in for the desktop rails).
 *
 * Every sheet here is unmounted while presenting, mirroring React's
 * `mode !== 'present'` gate on `MobileChromeOverlay`. Leaving them mounted
 * under the full-screen slideshow keeps their controls tab-focusable and
 * creates duplicate accessible names (a second "Next slide", "Menu", ...)
 * beneath the overlay, so the gate is an accessibility contract, not a
 * cosmetic one; it lives on the single `v-if` below.
 */
import type {
	PptxComment,
	PptxElement,
	PptxPresentationProperties,
	PptxSlide,
} from 'pptx-viewer-core';
import { useI18n } from 'vue-i18n';

import type { UseCommentsWiringResult } from '../composables/useCommentsWiring';
import type { UseInspectorDeckActionsResult } from '../composables/useInspectorDeckActions';
import type { UseLoadContentResult } from '../composables/useLoadContent';
import type { UseMobileChromeResult } from '../composables/useMobileChrome';
import type { UseSlideOperationsResult } from '../composables/useSlideOperations';
import CommentsPanel from './CommentsPanel.vue';
import MobileBottomBar from './MobileBottomBar.vue';
import MobileSheet from './MobileSheet.vue';
import MobileSlidesSheet from './MobileSlidesSheet.vue';
import NotesPanel from './NotesPanel.vue';
import SlideDeckInspector from './SlideDeckInspector.vue';

const props = defineProps<{
	chrome: UseMobileChromeResult;
	deck: UseLoadContentResult;
	slideOps: UseSlideOperationsResult;
	comments: UseCommentsWiringResult;
	deckActions: UseInspectorDeckActionsResult;
	/** Slides with the template layer merged in, so the rail matches the canvas. */
	mergedSlides: PptxSlide[];
	activeSlide: PptxSlide | undefined;
	activeSlideIndex: number;
	slideCount: number;
	activeComments: PptxComment[];
	canEdit: boolean;
	editTemplateMode?: boolean;
	/** Bottom inset so the fixed bar clears an open on-screen keyboard. */
	keyboardInset: number;
	/** The single selected element, already augmented with its slide animations. */
	inspectorElement: PptxElement | undefined;
	authorName: string;
	goTo: (index: number) => void;
	toggleSlideHidden: (index: number) => void;
	onNotesUpdate: (notes: string) => void;
	onInspectorUpdate: (patch: Partial<PptxElement>) => void;
	onUpdateSlideAnimations: (animations: PptxSlide['animations']) => void;
	onSlideUpdate: (patch: Partial<PptxSlide>) => void;
	onPresentationUpdate: (patch: Partial<PptxPresentationProperties>) => void;
	onSelectElement: (id: string) => void;
}>();

// oxlint-disable-next-line eslint/one-var -- distinct concern from the `defineProps` macro call above, forcing one statement hurts readability
const { t } = useI18n();

/** Commit a comments mutation through the history-aware wiring. */
function commit(next: Parameters<UseCommentsWiringResult['commitComments']>[0]): void {
	props.comments.commitComments(next);
}
</script>

<template>
	<MobileBottomBar
		:slide-count="slideCount"
		:active-sheet="chrome.activeSheet.value"
		:keyboard-inset="keyboardInset"
		:comment-count="activeComments.length"
		@slides="chrome.toggleMobileSheet('slides')"
		@insert="chrome.mobileQuickInsert"
		@format="chrome.toggleMobileSheet('format')"
		@comments="chrome.toggleMobileSheet('comments')"
		@notes="chrome.toggleMobileSheet('notes')"
	/>

	<!-- Slide-rail sheet (the slides panel is a left rail on desktop, hidden
	     inline on mobile). Reuses SlidesPaneSidebar inside the shared
	     swipe-dismiss MobileSheet; selecting a slide closes it. -->
	<MobileSlidesSheet
		:open="chrome.mobileSlidesOpen.value"
		:slides="mergedSlides"
		:active-index="activeSlideIndex"
		:canvas-size="deck.canvasSize.value"
		:media-data-urls="deck.mediaDataUrls.value"
		:can-edit="canEdit"
		@close="chrome.mobileSlidesOpen.value = false"
		@select="goTo"
		@reorder="(p) => slideOps.moveSlide(p.from, p.to)"
		@add-slide="slideOps.addSlide()"
		@duplicate="(i) => slideOps.duplicateSlide(i)"
		@delete="(i) => slideOps.deleteSlide(i)"
		@toggle-hidden="toggleSlideHidden"
	/>

	<!-- Speaker-notes sheet (toggled from the bottom bar). Uses the shared
	     MobileSheet so it swipe-dismisses like Format/Comments. -->
	<MobileSheet
		:open="chrome.mobileNotesOpen.value"
		:title="t('pptx.notes.title')"
		@close="chrome.mobileNotesOpen.value = false"
	>
		<NotesPanel embedded :slide="activeSlide" :expanded="true" @update="onNotesUpdate" />
	</MobileSheet>

	<!-- Format / properties sheet (right-rail inspector on desktop) -->
	<MobileSheet
		v-if="canEdit"
		:open="chrome.mobileInspectorOpen.value"
		inspector
		:title="t('pptx.arrange.format')"
		@close="chrome.mobileInspectorOpen.value = false"
	>
		<SlideDeckInspector
			mobile
			:deck="deck"
			:element="inspectorElement"
			:active-slide="activeSlide"
			:can-edit="canEdit"
			:edit-template-mode="editTemplateMode"
			:slide-count="slideCount"
			:author-name="authorName"
			:deck-actions="deckActions"
			:comments="comments"
			:on-update="onInspectorUpdate"
			:on-update-slide-animations="onUpdateSlideAnimations"
			:on-slide-update="onSlideUpdate"
			:on-presentation-update="onPresentationUpdate"
			:on-select-element="onSelectElement"
			:on-close="() => (chrome.mobileInspectorOpen.value = false)"
		/>
	</MobileSheet>

	<!-- Comments sheet (right-rail panel on desktop) -->
	<MobileSheet
		v-if="canEdit"
		:open="chrome.mobileCommentsOpen.value"
		:title="t('pptx.toolbar.comments')"
		@close="chrome.mobileCommentsOpen.value = false"
	>
		<CommentsPanel
			embedded
			:comments="comments.commentsApi.slideComments.value"
			:author-name="authorName"
			@add="(text) => commit(comments.commentsApi.addComment(text))"
			@remove="(id) => commit(comments.commentsApi.removeComment(id))"
			@resolve="(id) => commit(comments.commentsApi.resolveComment(id))"
			@reply="(p) => commit(comments.commentsApi.replyToComment(p.parentId, p.text))"
		/>
	</MobileSheet>
</template>
