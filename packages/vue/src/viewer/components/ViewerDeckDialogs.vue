<script setup lang="ts">
/**
 * ViewerDeckDialogs: deck-level setup and insertion dialogs (broadcast, Set Up
 * Slide Show, password protection, font embedding, Insert > SmartArt,
 * Insert > Equation, and the signature-stripping warning).
 *
 * Lifted out of `PowerPointViewer.vue` unchanged and kept in their original
 * sibling order. As in {@link ViewerEditDialogs}, open state arrives as `Ref`s
 * because each dialog closes itself.
 */
import type { PptxCustomShow, PptxPresentationProperties } from 'pptx-viewer-core';

import type { UseCollaborationWiringResult } from '../composables/useCollaborationWiring';
import type { UseFontEmbeddingResult } from '../composables/useFontEmbedding';
import type { UseInsertElementDialogsResult } from '../composables/useInsertElementDialogs';
import type { UseInspectorDeckActionsResult } from '../composables/useInspectorDeckActions';
import type { UsePasswordProtectionResult } from '../composables/usePasswordProtection';
import type { UseSignatureWorkflowResult } from '../composables/useSignatureWorkflow';
import type { UseSlideShowSettingsResult } from '../composables/useSlideShowSettings';
import BroadcastDialog from './BroadcastDialog.vue';
import EquationEditorDialog from './EquationEditorDialog.vue';
import FontEmbeddingPanel from './FontEmbeddingPanel.vue';
import InsertSmartArtDialog from './InsertSmartArtDialog.vue';
import PasswordProtectionDialog from './PasswordProtectionDialog.vue';
import SetUpSlideShowDialog from './SetUpSlideShowDialog.vue';
import SignatureStrippedDialog from './SignatureStrippedDialog.vue';
import SlideSizeRescalePrompt from './SlideSizeRescalePrompt.vue';

defineProps<{
	collaboration: UseCollaborationWiringResult;
	broadcastServerUrl?: string;
	slideShow: UseSlideShowSettingsResult;
	presentationProperties: PptxPresentationProperties;
	customShows: PptxCustomShow[];
	slideCount: number;
	password: UsePasswordProtectionResult;
	fontEmbedding: UseFontEmbeddingResult;
	insertDialogs: UseInsertElementDialogsResult;
	signatureWorkflow: UseSignatureWorkflowResult;
	signatureCount: number;
	deckActions: UseInspectorDeckActionsResult;
}>();
</script>

<template>
	<!-- Broadcast -->
	<BroadcastDialog
		:open="collaboration.broadcastOpen.value"
		:active="collaboration.collabActive.value"
		:viewer-url="collaboration.broadcastViewerUrl.value"
		:defaults="{ serverUrl: broadcastServerUrl }"
		@start="collaboration.onBroadcastStart"
		@stop="collaboration.onBroadcastStop"
		@close="collaboration.broadcastOpen.value = false"
	/>

	<!-- Slide Show > Set Up Slide Show -->
	<SetUpSlideShowDialog
		:open="slideShow.showSetUpSlideShow.value"
		:properties="presentationProperties"
		:custom-shows="customShows"
		:slide-count="slideCount"
		@save="slideShow.onSaveSlideShowSettings"
		@close="slideShow.showSetUpSlideShow.value = false"
	/>

	<!-- File > Protect Presentation -->
	<PasswordProtectionDialog
		:open="password.showPasswordDialog.value"
		:is-currently-protected="password.isPasswordProtected.value"
		@set-password="password.onSetPassword"
		@remove-password="password.onRemovePassword"
		@close="password.showPasswordDialog.value = false"
	/>

	<!-- File > Embed Fonts -->
	<FontEmbeddingPanel
		:open="fontEmbedding.showFontEmbedding.value"
		:embed-fonts-enabled="fontEmbedding.embedFontsEnabled.value"
		:used-font-families="fontEmbedding.usedFontFamilies.value"
		:embedded-fonts="fontEmbedding.embeddedFontNames.value"
		:can-embed-fonts="fontEmbedding.fontEmbedding.value.interactive"
		:embed-unavailable-key="fontEmbedding.fontEmbedding.value.disabledReasonKey"
		@toggle-embed-fonts="fontEmbedding.embedFontsEnabled.value = $event"
		@close="fontEmbedding.showFontEmbedding.value = false"
	/>

	<!-- Insert > SmartArt -->
	<InsertSmartArtDialog
		:open="insertDialogs.showInsertSmartArt.value"
		@insert="insertDialogs.onInsertElement"
		@close="insertDialogs.showInsertSmartArt.value = false"
	/>

	<!-- Insert > Equation (also re-edits an existing equation) -->
	<EquationEditorDialog
		:open="insertDialogs.showEquationEditor.value"
		:existing-omml="insertDialogs.editingEquationOmml.value"
		@insert="insertDialogs.onInsertElement"
		@apply="insertDialogs.onApplyEquation"
		@close="insertDialogs.closeEquationEditor"
	/>

	<!-- First-edit warning: saving a signed deck strips its signatures. -->
	<SignatureStrippedDialog
		:open="signatureWorkflow.showSignatureStripped.value"
		:signature-count="signatureCount"
		@confirm="signatureWorkflow.onAckSignatureStripped"
		@cancel="signatureWorkflow.onAckSignatureStripped"
	/>

	<!-- Design > Slide Size: Maximize / Ensure Fit prompt when the deck already
	     has content and the chosen size does not match it. -->
	<SlideSizeRescalePrompt
		:open="deckActions.pendingSlideSizeRescale.value !== null"
		@choose="deckActions.chooseSlideSizeRescale"
		@close="deckActions.cancelSlideSizeRescale"
	/>
</template>
