<script setup lang="ts">
/**
 * RibbonToolbar: Vue port of React's `components/Toolbar.tsx`.
 *
 * The Office-style ribbon shell: a quick-access primary row, the tab bar
 * (File / Home / Insert / … / Help), and the active tab's section content.
 * Each section is a dedicated SFC under `ribbon/` mirroring its React
 * counterpart; this shell only routes props + the active tab, exactly like
 * React's `Toolbar`.
 *
 * The React component swaps in a `MobileToolbar` under 768px; the Vue viewer
 * renders its own mobile chrome (`MobileBottomBar`) at the host level, so this
 * shell always renders the desktop ribbon (the host hides it on mobile).
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { useToolbarVisibility } from '../../composables/useToolbarVisibility';
import AnimationsSection from './AnimationsSection.vue';
import ArrangeSection from './ArrangeSection.vue';
import DesignSection from './DesignSection.vue';
import DrawingGroup from './DrawingGroup.vue';
import DrawSection from './DrawSection.vue';
import EditingSection from './EditingSection.vue';
import FileSection from './FileSection.vue';
import HelpSection from './HelpSection.vue';
import HomeSection from './HomeSection.vue';
import InsertSection from './InsertSection.vue';
import RecordSection from './RecordSection.vue';
import ReviewSection from './ReviewSection.vue';
import type { RibbonProps } from './ribbon-types';
import RibbonTabBar from './RibbonTabBar.vue';
import SlideShowSection from './SlideShowSection.vue';
import TextSection from './TextSection.vue';
import ToolbarPrimaryRow from './ToolbarPrimaryRow.vue';
import TransitionsSection from './TransitionsSection.vue';
import ViewSection from './ViewSection.vue';

interface Props extends RibbonProps {}

const props = defineProps<Props>();
const { t } = useI18n();

const showRibbon = computed(() => props.mode === 'edit' || props.mode === 'master');
const s = computed(() => props.toolbarSection);
/** The Text group shows on both the Home and Text tabs (mirrors React). */
const showText = computed(() => s.value === 'home' || s.value === 'text');
/** Tab list + per-button gating, driven by the host's `hiddenActions` prop. */
const { visibleTabs } = useToolbarVisibility(() => props.hiddenActions);
</script>

<template>
	<div
		role="toolbar"
		:aria-label="t('pptx.toolbar.presentationToolbarAria')"
		class="relative z-20 border-b border-border bg-secondary/50 overflow-visible"
	>
		<!-- Quick Access Row -->
		<ToolbarPrimaryRow v-bind="props" />

		<!-- Ribbon Tab Bar -->
		<RibbonTabBar
			v-if="showRibbon"
			:toolbar-section="props.toolbarSection"
			:visible-tabs="visibleTabs"
			:on-set-toolbar-section="props.onSetToolbarSection"
			:can-edit="props.canEdit"
			:on-enter-rehearsal-mode="props.onEnterRehearsalMode"
			:on-set-mode="props.onSetMode"
			:on-open-share-dialog="props.onOpenShareDialog"
			:on-package-for-sharing="props.onPackageForSharing"
			:is-collaborating="props.isCollaborating"
			:collaborator-count="props.collaboratorCount"
			:hidden-actions="props.hiddenActions"
			:is-compact-toolbar-open="props.isCompactToolbarOpen"
			:on-toggle-compact-toolbar="props.onToggleCompactToolbar"
		/>

		<!-- Ribbon Content (collapsible via the ribbon toggle) -->
		<div
			v-if="showRibbon"
			v-show="props.isCompactToolbarOpen"
			class="flex items-center gap-1.5 px-2 py-1 max-md:px-1 max-md:py-0.5 overflow-visible flex-nowrap"
		>
			<FileSection
				v-if="s === 'file'"
				:file-name="props.fileName"
				:on-close="() => props.onSetToolbarSection('home')"
				:on-create-presentation="props.onCreatePresentation"
				:on-open-file="props.onOpenFile"
				:on-open-recent-file="props.onOpenRecentFile"
				:on-export-png="props.onExportPng"
				:on-export-pdf="props.onExportPdf"
				:on-export-video="props.onExportVideo"
				:on-export-gif="props.onExportGif"
				:on-package-for-sharing="props.onPackageForSharing"
				:on-save-as-pptx="props.onSaveAsPptx"
				:on-save-as-ppsx="props.onSaveAsPpsx"
				:on-save-as-pptm="props.onSaveAsPptm"
				:has-macros="props.hasMacros"
				:on-copy-slide-as-image="props.onCopySlideAsImage"
				:on-print="props.onPrint"
				:on-open-settings="props.onOpenSettings"
				:on-open-share-dialog="props.onOpenShareDialog"
				:on-open-document-properties="props.onOpenDocumentProperties"
				:on-open-password-protection="props.onOpenPasswordProtection"
				:on-open-font-embedding="props.onOpenFontEmbedding"
				:on-open-digital-signatures="props.onOpenDigitalSignatures"
				:hidden-actions="props.hiddenActions"
			/>

			<HomeSection
				v-if="s === 'home'"
				:can-edit="props.canEdit"
				:clipboard-payload="props.clipboardPayload"
				:format-painter-active="props.formatPainterActive"
				:can-activate-format-painter="props.canActivateFormatPainter"
				:on-copy="props.onCopy"
				:on-cut="props.onCut"
				:on-paste="props.onPaste"
				:on-toggle-format-painter="props.onToggleFormatPainter"
				:layout-options="props.layoutOptions"
				:on-insert-slide-from-layout="props.onInsertSlideFromLayout"
				:on-apply-layout="props.onApplyLayout"
				:on-reset-slide="props.onResetSlide"
				:on-add-section="props.onAddSection"
				:selected-element="props.selectedElement"
				:on-update-text-style="props.onUpdateTextStyle"
			/>

			<InsertSection
				v-if="s === 'insert'"
				:can-edit="props.canEdit"
				:new-shape-type="props.newShapeType"
				:on-set-new-shape-type="props.onSetNewShapeType"
				:on-add-text-box="props.onAddTextBox"
				:on-add-shape="props.onAddShape"
				:on-add-table="props.onAddTable"
				:on-add-chart="props.onAddChart"
				:on-add-smart-art="props.onAddSmartArt"
				:on-add-equation="props.onAddEquation"
				:on-add-action-button="props.onAddActionButton"
				:on-insert-field="props.onInsertField"
				:on-open-header-footer="props.onOpenHeaderFooter"
				:on-open-image-picker="props.onOpenImagePicker"
				:on-open-media-picker="props.onOpenMediaPicker"
			/>

			<TextSection
				v-if="showText"
				:can-edit="props.canEdit"
				:selected-element="props.selectedElement"
				:table-editor-state="props.tableEditorState"
				:on-update-text-style="props.onUpdateTextStyle"
				:on-transform-text-case="props.onTransformTextCase"
			/>

			<EditingSection
				v-if="s === 'home'"
				:on-toggle-find-replace="props.onToggleFindReplace"
				:on-select-all="props.onSelectAll"
			/>

			<DrawingGroup
				v-if="s === 'home'"
				:can-edit="props.canEdit"
				:selected-element="props.selectedElement"
				:new-shape-type="props.newShapeType"
				:on-set-new-shape-type="props.onSetNewShapeType"
				:on-add-shape="props.onAddShape"
				:on-move-layer="props.onMoveLayer"
				:on-move-layer-to-edge="props.onMoveLayerToEdge"
			/>

			<DrawSection
				v-if="s === 'draw'"
				:active-tool="props.activeTool"
				:drawing-color="props.drawingColor"
				:drawing-width="props.drawingWidth"
				:on-set-active-tool="props.onSetActiveTool"
				:on-set-drawing-color="props.onSetDrawingColor"
				:on-set-drawing-width="props.onSetDrawingWidth"
			/>

			<ArrangeSection
				v-if="s === 'home' || s === 'arrange'"
				:can-edit="props.canEdit"
				:selected-element="props.selectedElement"
				:clipboard-payload="props.clipboardPayload"
				:on-align-elements="props.onAlignElements"
				:on-distribute-elements="props.onDistributeElements"
				:can-distribute="props.canDistribute"
				:on-copy="props.onCopy"
				:on-cut="props.onCut"
				:on-paste="props.onPaste"
				:on-flip="props.onFlip"
				:on-move-layer="props.onMoveLayer"
				:on-move-layer-to-edge="props.onMoveLayerToEdge"
				:on-duplicate="props.onDuplicate"
				:on-delete="props.onDelete"
				:format-painter-active="props.formatPainterActive"
				:on-toggle-format-painter="props.onToggleFormatPainter"
				:can-activate-format-painter="props.canActivateFormatPainter"
			/>

			<DesignSection
				v-if="s === 'design'"
				:can-edit="props.canEdit"
				:on-toggle-theme-gallery="props.onToggleThemeGallery"
				:is-theme-gallery-open="props.isThemeGalleryOpen"
				:on-toggle-theme-editor="props.onToggleThemeEditor"
				:is-theme-editor-open="props.isThemeEditorOpen"
				:on-open-document-properties="props.onOpenDocumentProperties"
				:on-toggle-inspector="props.onToggleInspector"
				:is-inspector-pane-open="props.isInspectorPaneOpen"
			/>

			<TransitionsSection
				v-if="s === 'transitions'"
				:is-inspector-pane-open="props.isInspectorPaneOpen"
				:on-toggle-inspector="props.onToggleInspector"
			/>

			<AnimationsSection
				v-if="s === 'animations'"
				:can-edit="props.canEdit"
				:selected-element="props.selectedElement"
				:is-inspector-pane-open="props.isInspectorPaneOpen"
				:on-toggle-inspector="props.onToggleInspector"
				:on-open-animation-panel="props.onOpenAnimationPanel"
				:on-add-animation="props.onAddAnimation"
				:on-remove-animation="props.onRemoveAnimation"
			/>

			<SlideShowSection
				v-if="s === 'slideShow'"
				:on-present="() => props.onSetMode('present')"
				:on-enter-presenter-view="props.onEnterPresenterView ?? (() => {})"
				:on-enter-rehearsal-mode="props.onEnterRehearsalMode ?? (() => {})"
				:on-open-set-up-slide-show="props.onOpenSetUpSlideShow ?? (() => {})"
				:on-open-broadcast-dialog="props.onOpenBroadcastDialog ?? (() => {})"
				:on-toggle-subtitles="props.onToggleSubtitles ?? (() => {})"
				:show-subtitles="props.showSubtitles ?? false"
				:on-set-mode="props.onSetMode"
				:hidden-actions="props.hiddenActions"
			/>

			<ReviewSection
				v-if="s === 'review'"
				:can-edit="props.canEdit"
				:spell-check-enabled="props.spellCheckEnabled"
				:on-set-spell-check-enabled="props.onSetSpellCheckEnabled"
				:on-toggle-comments="props.onToggleComments"
				:is-comments-panel-open="props.isCommentsPanelOpen"
				:slide-comment-count="props.slideCommentCount"
				:on-compare="props.onCompare"
				:on-set-language="props.onOpenSettings"
				:on-open-accessibility-check="props.onRunAccessibilityCheck"
			/>

			<RecordSection
				v-if="s === 'record'"
				:on-record-from-beginning="props.onEnterRehearsalMode ?? (() => {})"
				:on-record-from-current="props.onEnterRehearsalMode ?? (() => {})"
			/>

			<ViewSection
				v-if="s === 'view'"
				:can-edit="props.canEdit"
				:edit-template-mode="props.editTemplateMode"
				:on-set-edit-template-mode="props.onSetEditTemplateMode"
				:spell-check-enabled="props.spellCheckEnabled"
				:on-set-spell-check-enabled="props.onSetSpellCheckEnabled"
				:show-grid="props.showGrid"
				:show-rulers="props.showRulers"
				:snap-to-grid="props.snapToGrid"
				:snap-to-shape="props.snapToShape"
				:on-set-show-grid="props.onSetShowGrid"
				:on-set-show-rulers="props.onSetShowRulers"
				:on-set-snap-to-grid="props.onSetSnapToGrid"
				:on-set-snap-to-shape="props.onSetSnapToShape"
				:on-add-guide="props.onAddGuide"
				:on-zoom-to-fit="props.onZoomToFit"
				:on-enter-master-view="props.onEnterMasterView"
				:is-selection-pane-open="props.isSelectionPaneOpen"
				:on-toggle-selection-pane="props.onToggleSelectionPane"
				:eyedropper-active="props.eyedropperActive"
				:on-toggle-eyedropper="props.onToggleEyedropper"
			/>

			<HelpSection
				v-if="s === 'help'"
				:on-toggle-shortcuts="props.onToggleShortcuts"
				:on-run-accessibility-check="props.onRunAccessibilityCheck"
			/>
		</div>
	</div>
</template>
