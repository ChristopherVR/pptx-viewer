<script setup lang="ts">
/**
 * SlideDeckInspector: the right-hand property inspector, whichever of its two
 * forms applies.
 *
 * With exactly one element selected it is the element inspector
 * ({@link InspectorPane}); with none it is the tabbed slide/deck inspector
 * ({@link SlideInspector}). `PowerPointViewer.vue` previously spelled both out
 * TWICE (once for the desktop rail, once inside the mobile Format sheet), which
 * is how the two copies drift; the `mobile` flag is now the only difference.
 *
 * The whole `useLoadContent` result arrives as `deck` instead of twenty
 * individual props: every field below is a ref off that one object, so
 * unpacking them here would only make the parent's call site long enough to
 * hide a mistake in.
 */
import type { PptxElement, PptxPresentationProperties, PptxSlide } from 'pptx-viewer-core';
import { useI18n } from 'vue-i18n';

import type { UseCommentsWiringResult } from '../composables/useCommentsWiring';
import type { UseInspectorDeckActionsResult } from '../composables/useInspectorDeckActions';
import type { UseLoadContentResult } from '../composables/useLoadContent';
import InspectorPane from './inspector/InspectorPane.vue';
import SlideInspector from './inspector/SlideInspector.vue';

const props = defineProps<{
	deck: UseLoadContentResult;
	/** Use the compact single-column layout for the mobile bottom sheet. */
	mobile?: boolean;
	/** The single selected element, already augmented with its slide animations. */
	element: PptxElement | undefined;
	activeSlide: PptxSlide | undefined;
	canEdit: boolean;
	slideCount: number;
	authorName: string;
	deckActions: UseInspectorDeckActionsResult;
	comments: UseCommentsWiringResult;
	onUpdate: (patch: Partial<PptxElement>) => void;
	onUpdateSlideAnimations: (animations: PptxSlide['animations']) => void;
	onSlideUpdate: (patch: Partial<PptxSlide>) => void;
	onPresentationUpdate: (patch: Partial<PptxPresentationProperties>) => void;
	onSelectElement: (id: string) => void;
	onClose: () => void;
}>();

const { t } = useI18n();

/** Commit a comments mutation through the history-aware wiring. */
function commit(next: Parameters<UseCommentsWiringResult['commitComments']>[0]): void {
	props.comments.commitComments(next);
}
</script>

<template>
	<InspectorPane
		v-if="element"
		:mobile="mobile"
		:element="element"
		:can-edit="canEdit"
		:slide-count="slideCount"
		:media-data-urls="deck.mediaDataUrls.value"
		:slide-elements="activeSlide?.elements ?? []"
		:slide-animations="activeSlide?.animations ?? []"
		@update="onUpdate"
		@update-slide-animations="onUpdateSlideAnimations"
	/>

	<!-- Slide-level inspector (no element selected): tabbed
	     Elements / Properties / Comments pane, mirroring React. -->
	<SlideInspector
		v-else-if="slideCount > 0"
		:mobile="mobile"
		:slide="activeSlide"
		:theme="deck.theme.value"
		:presentation-properties="deck.presentationProperties.value"
		:can-edit="canEdit"
		:theme-options="deck.themeOptions.value"
		:slide-masters="deck.slideMasters.value"
		:canvas-size="deck.canvasSize.value"
		:slide-size="deck.slideSize.value"
		:notes-canvas-size="deck.notesCanvasSize.value"
		:notes-master="deck.notesMaster.value"
		:handout-master="deck.handoutMaster.value"
		:core-properties="deck.coreProperties.value"
		:app-properties="deck.appProperties.value"
		:custom-properties="deck.customProperties.value"
		:tag-collections="deck.tagCollections.value"
		:comments="comments.commentsApi.slideComments.value"
		:author-name="authorName"
		@slide-update="onSlideUpdate"
		@presentation-update="onPresentationUpdate"
		@apply-theme="deckActions.applyThemeByPath"
		@canvas-size-update="deckActions.updateCanvasSize"
		@slide-size-update="deckActions.updateSlideSize"
		@update-core-properties="deckActions.updateCoreProperties"
		@update-app-properties="deckActions.updateAppProperties"
		@update-custom-properties="deckActions.updateCustomProperties"
		@update-tag-collections="deckActions.updateTagCollections"
		@select-element="onSelectElement"
		@comment-add="(text) => commit(comments.commentsApi.addComment(text))"
		@comment-remove="(id) => commit(comments.commentsApi.removeComment(id))"
		@comment-resolve="(id) => commit(comments.commentsApi.resolveComment(id))"
		@comment-reply="(p) => commit(comments.commentsApi.replyToComment(p.parentId, p.text))"
		@close="onClose"
	/>

	<!-- Mobile-only: the sheet is open but the deck has no slide to describe. -->
	<p v-else-if="mobile" class="px-4 py-6 text-center text-xs text-muted-foreground">
		{{ t('pptx.inspector.noSlideSelected') }}
	</p>
</template>
