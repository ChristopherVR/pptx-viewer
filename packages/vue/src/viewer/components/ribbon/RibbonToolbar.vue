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
import { computed, inject } from 'vue';
import { useI18n } from 'vue-i18n';

import { useToolbarVisibility } from '../../composables/useToolbarVisibility';
import { ViewerOptionsKey } from '../../composables/useViewerOptionsStore';
import AnimationsSection from './AnimationsSection.vue';
import ArrangeSection from './ArrangeSection.vue';
import DesignSection from './DesignSection.vue';
import DrawingGroup from './DrawingGroup.vue';
import DrawSection from './DrawSection.vue';
import EditingSection from './EditingSection.vue';
import FileSection from './FileSection.vue';
import HomeSection from './HomeSection.vue';
import InsertSection from './InsertSection.vue';
import type { RibbonProps } from './ribbon-types';
import RibbonTabBar from './RibbonTabBar.vue';
import RibbonTailSections from './RibbonTailSections.vue';
import TextSection from './TextSection.vue';
import ToolbarPrimaryRow from './ToolbarPrimaryRow.vue';
import TransitionsSection from './TransitionsSection.vue';

interface Props extends RibbonProps {}

const props = defineProps<Props>();
const { t } = useI18n();

const showRibbon = computed(() => props.mode === 'edit' || props.mode === 'master');
const s = computed(() => props.toolbarSection);
/** The Text group shows on both the Home and Text tabs (mirrors React). */
const showText = computed(() => s.value === 'home' || s.value === 'text');
/**
 * Tab list + per-button gating, driven by the host's `hiddenActions` prop AND
 * the user's File > Options > Customize Ribbon choice. Injection has a
 * fallback so a caller that mounts this shell without the options provider
 * (isolated unit tests, storybook-style fixtures) still renders every tab.
 */
const viewerOptions = inject(ViewerOptionsKey, undefined);
const { visibleTabs } = useToolbarVisibility(
	() => props.hiddenActions,
	() => viewerOptions?.value,
);
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
			class="flex min-h-[82px] items-center gap-0 overflow-x-auto px-1 py-0.5 max-md:min-h-0 max-md:px-1 max-md:py-0.5 flex-nowrap [&>*]:shrink-0"
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
				:on-export-json="props.onExportJson"
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
				:on-open-version-history="props.onToggleVersionHistory"
				:hidden-actions="props.hiddenActions"
				:recent-presentations-count="props.recentPresentationsCount"
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
				:current-layout-path="props.currentLayoutPath"
				:load-layout-previews="props.loadLayoutPreviews"
				:theme-fonts="props.themeFonts"
				:embedded-font-families="props.embeddedFontFamilies"
				:custom-font-families="props.customFontFamilies"
				:on-insert-slide-from-layout="props.onInsertSlideFromLayout"
				:on-insert-slide-from-template="props.onInsertSlideFromTemplate"
				:template-scheme="props.templateScheme"
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
				:has-selection="Boolean(props.selectedElement)"
				:on-open-hyperlink-dialog="props.onOpenHyperlinkDialog"
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
				:on-update-element-style="props.onUpdateElementStyle"
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
				:selected-count="props.selectedCount"
				:selection-groupable="props.selectionGroupable"
				:on-align-elements="props.onAlignElements"
				:on-distribute-elements="props.onDistributeElements"
				:can-distribute="props.canDistribute"
				:on-flip="props.onFlip"
				:on-move-layer="props.onMoveLayer"
				:on-move-layer-to-edge="props.onMoveLayerToEdge"
				:on-group-elements="props.onGroupElements"
				:on-ungroup-element="props.onUngroupElement"
				:on-update-element-style="props.onUpdateElementStyle"
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
				:on-open-slide-size="props.onOpenSlideSize"
				:on-toggle-inspector="props.onToggleInspector"
				:is-inspector-pane-open="props.isInspectorPaneOpen"
			/>

			<TransitionsSection
				v-if="s === 'transitions'"
				:is-inspector-pane-open="props.isInspectorPaneOpen"
				:on-toggle-inspector="props.onToggleInspector"
				:can-edit="props.canEdit"
				:active-slide="props.activeSlide"
				:on-transition-change="props.onTransitionChange"
				:on-apply-transition-to-all="props.onApplyTransitionToAll"
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

			<RibbonTailSections v-bind="props" />
		</div>
	</div>
</template>
