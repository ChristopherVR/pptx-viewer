<script setup lang="ts">
/**
 * ViewerSidePanels: the desktop right rail, which is a stack of mutually
 * exclusive-ish panels (property inspector, AI chat, accessibility checker,
 * comments, signatures, selection pane, follow mode, custom shows) rather than
 * one component.
 *
 * Lifted out of `PowerPointViewer.vue` in its original order; only the
 * `!isMobile` half of each gate lives here (the phone equivalents are in
 * {@link ViewerMobileSheets}). Each panel's controller arrives whole so the
 * prop list names features, not fields; the three flags the parent owns
 * directly arrive as a value plus a close callback, because a parent `ref`
 * read in the parent's template is auto-unwrapped before it reaches a prop.
 */
import type { PptxElement, PptxPresentationProperties, PptxSlide } from 'pptx-viewer-core';
import type { PptxAiBridge, PptxAiConfig } from 'pptx-viewer-shared/ai';

import type { AiPanelController } from '../composables/ai/useAiPanelController';
import type { UseAccessibilityResult } from '../composables/useAccessibility';
import type { UseCollaborationWiringResult } from '../composables/useCollaborationWiring';
import type { UseCommentsWiringResult } from '../composables/useCommentsWiring';
import type { UseCustomShowsWiringResult } from '../composables/useCustomShowsWiring';
import type { UseInspectorDeckActionsResult } from '../composables/useInspectorDeckActions';
import type { UseLoadContentResult } from '../composables/useLoadContent';
import type { UseSelectionPaneWiringResult } from '../composables/useSelectionPaneWiring';
import type { UseSignatureWorkflowResult } from '../composables/useSignatureWorkflow';
import AccessibilityPanel from './AccessibilityPanel.vue';
import { AiChatPanelLazy } from './ai';
import CommentsPanel from './CommentsPanel.vue';
import CustomShowsPanel from './CustomShowsPanel.vue';
import FollowModeBar from './FollowModeBar.vue';
import SelectionPane from './SelectionPane.vue';
import SignaturesPanel from './SignaturesPanel.vue';
import SignatureStatusBadge from './SignatureStatusBadge.vue';
import SlideDeckInspector from './SlideDeckInspector.vue';

const props = defineProps<{
	deck: UseLoadContentResult;
	canEdit: boolean;
	isMobile: boolean;
	inspectorOpen: boolean;
	onCloseInspector: () => void;
	inspectorElement: PptxElement | undefined;
	activeSlide: PptxSlide | undefined;
	slideCount: number;
	authorName: string;
	selectedElementIds: string[];
	deckActions: UseInspectorDeckActionsResult;
	comments: UseCommentsWiringResult;
	accessibility: UseAccessibilityResult;
	showA11y: boolean;
	signatureWorkflow: UseSignatureWorkflowResult;
	selectionPane: UseSelectionPaneWiringResult;
	collaboration: UseCollaborationWiringResult;
	customShows: UseCustomShowsWiringResult;
	/** AI assistant config; the panel is gated behind the host opting in. */
	ai?: PptxAiConfig;
	aiPanelOpen: boolean;
	onCloseAiPanel: () => void;
	aiPanel: AiPanelController;
	aiBridge: PptxAiBridge;
	/** Ribbon mode: the AI panel only shows while actually editing. */
	ribbonMode: string;
	goTo: (index: number) => void;
	onInspectorUpdate: (patch: Partial<PptxElement>) => void;
	onUpdateSlideAnimations: (animations: PptxSlide['animations']) => void;
	onSlideUpdate: (patch: Partial<PptxSlide>) => void;
	onPresentationUpdate: (patch: Partial<PptxPresentationProperties>) => void;
}>();

/** Commit a comments mutation through the history-aware wiring. */
function commit(next: Parameters<UseCommentsWiringResult['commitComments']>[0]): void {
	props.comments.commitComments(next);
}
</script>

<template>
	<!-- Property inspector (single selection, edit mode). On mobile this
	     becomes a swipe-dismissable bottom sheet (see ViewerMobileSheets). -->
	<SlideDeckInspector
		v-if="canEdit && !isMobile && inspectorOpen"
		:deck="deck"
		:element="inspectorElement"
		:active-slide="activeSlide"
		:can-edit="canEdit"
		:slide-count="slideCount"
		:author-name="authorName"
		:deck-actions="deckActions"
		:comments="comments"
		:on-update="onInspectorUpdate"
		:on-update-slide-animations="onUpdateSlideAnimations"
		:on-slide-update="onSlideUpdate"
		:on-presentation-update="onPresentationUpdate"
		:on-select-element="selectionPane.onSelectionPaneSelect"
		:on-close="onCloseInspector"
	/>

	<!-- AI assistant chat panel (right rail, sibling of the inspector).
	     Gated behind the optional `ai` prop; lazily loaded on first open
	     so `@ai-sdk/vue` + the AI core only ship when actually used. -->
	<AiChatPanelLazy
		v-if="ai && aiPanelOpen && !isMobile && (ribbonMode === 'edit' || ribbonMode === 'master')"
		:bridge="aiBridge"
		:config="ai"
		:ai-panel="aiPanel"
		@close="onCloseAiPanel"
	/>

	<!-- Accessibility checker -->
	<AccessibilityPanel
		v-if="canEdit && showA11y"
		:issues="accessibility.issues.value"
		@select-slide="goTo"
	/>

	<!-- Comments (desktop right rail; mobile uses the bottom sheet) -->
	<CommentsPanel
		v-if="canEdit && !isMobile && comments.showComments.value"
		:comments="comments.commentsApi.slideComments.value"
		:author-name="authorName"
		@add="(text) => commit(comments.commentsApi.addComment(text))"
		@remove="(id) => commit(comments.commentsApi.removeComment(id))"
		@resolve="(id) => commit(comments.commentsApi.resolveComment(id))"
		@reply="(p) => commit(comments.commentsApi.replyToComment(p.parentId, p.text))"
	/>

	<!-- Signed-document badge (opens the signatures panel). -->
	<div
		v-if="signatureWorkflow.hasDigitalSignatures.value && !isMobile"
		class="pointer-events-auto absolute right-2 top-2 z-50"
	>
		<SignatureStatusBadge
			:has-signatures="signatureWorkflow.hasDigitalSignatures.value"
			:signature-count="deck.signatures.value.length"
			@click="signatureWorkflow.showSignatures.value = true"
		/>
	</div>

	<!-- Digital signatures -->
	<SignaturesPanel
		v-if="signatureWorkflow.showSignatures.value"
		:signatures="deck.signatures.value"
	/>

	<!-- Selection pane (View > Selection Pane): object list + z-order +
	     visibility over the active slide's elements. -->
	<SelectionPane
		v-if="canEdit && !isMobile && selectionPane.showSelectionPane.value"
		:elements="activeSlide?.elements ?? []"
		:selected-ids="selectedElementIds"
		:can-edit="canEdit"
		@select="selectionPane.onSelectionPaneSelect"
		@toggle-visibility="selectionPane.onSelectionPaneToggleVisibility"
		@reorder="selectionPane.onSelectionPaneReorder"
		@close="selectionPane.showSelectionPane.value = false"
	/>

	<!-- Collaboration follow-mode -->
	<FollowModeBar
		v-if="collaboration.collabActive.value"
		:presences="collaboration.collab.remotePresences.value"
		:followed-client-id="collaboration.collab.followedClientId.value"
		@follow="collaboration.collab.followUser"
	/>

	<!-- Custom shows -->
	<CustomShowsPanel
		v-if="canEdit && customShows.showCustomShows.value"
		:custom-shows="deck.customShows.value"
		:slides="deck.slides.value"
		:active-show-id="customShows.activeCustomShowId.value"
		@create="customShows.onCreateCustomShow"
		@rename="customShows.customShowOps.renameCustomShow"
		@delete="customShows.onDeleteCustomShow"
		@select="(id) => (customShows.activeCustomShowId.value = id)"
		@toggle-slide="customShows.customShowOps.toggleSlideInShow"
		@move-slide="customShows.customShowOps.moveSlideInShow"
	/>
</template>
