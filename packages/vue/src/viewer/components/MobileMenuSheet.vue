<script setup lang="ts">
/**
 * MobileMenuSheet - Vue port of React's
 * `components/mobile/MobileMenuSheet.tsx`.
 *
 * Drawer-style sheet that exposes every ribbon section (File / Home / Insert /
 * Text / Draw / Arrange / Design / Transitions / Animations / Slide Show /
 * Review / View) in a single mobile-friendly scroll. Tapping a section chip
 * selects it; the matching desktop ribbon section component is then rendered
 * below in a wrapping, larger-touch-target layout. The section SFCs are reused
 * verbatim (same prop contract as `RibbonToolbar.vue`), so behaviour matches
 * the desktop ribbon.
 *
 * The host (`PowerPointViewer.vue`) passes the same aggregate `RibbonProps`
 * bundle it already assembles for the desktop ribbon, plus `open` + a `close`
 * emit, exactly like React threads `ToolbarProps` through.
 */
import { TOOLBAR_TABS } from 'pptx-viewer-shared';
import type { ToolbarTabId } from 'pptx-viewer-shared';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { cn } from '../../utils';
import { useToolbarVisibility } from '../composables/useToolbarVisibility';
import MobileSheet from './MobileSheet.vue';
import AnimationsSection from './ribbon/AnimationsSection.vue';
import ArrangeSection from './ribbon/ArrangeSection.vue';
import { toCustomShowsControlsProps } from './ribbon/custom-show-controls-props';
import DesignSection from './ribbon/DesignSection.vue';
import DrawSection from './ribbon/DrawSection.vue';
import FileSection from './ribbon/FileSection.vue';
import HomeSection from './ribbon/HomeSection.vue';
import InsertSection from './ribbon/InsertSection.vue';
import { MOBILE_MENU_ITEMS } from './ribbon/mobile-menu-items';
import type { MobileMenuKey } from './ribbon/mobile-menu-items';
import ReviewSection from './ribbon/ReviewSection.vue';
import type { RibbonProps } from './ribbon/ribbon-types';
import SlideShowSection from './ribbon/SlideShowSection.vue';
import TextSection from './ribbon/TextSection.vue';
import TransitionsSection from './ribbon/TransitionsSection.vue';
import ViewSection from './ribbon/ViewSection.vue';

interface Props extends RibbonProps {
	open: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{ close: [] }>();

const { t } = useI18n();
const { isHidden } = useToolbarVisibility(() => props.hiddenActions);

/** Ribbon-tab ids among the menu chips (draw/home/insert/... but not text/arrange, which aren't tabs). */
const TAB_KEYS = new Set<string>(TOOLBAR_TABS.map((tab) => tab.id));

/** Chips resolved with their label, minus any hidden ribbon tabs. */
const MENU_ITEMS = computed(() =>
	MOBILE_MENU_ITEMS.filter(
		(item) => !TAB_KEYS.has(item.key) || !isHidden(item.key as ToolbarTabId),
	).map((item) => ({ key: item.key, label: t(item.labelKey), icon: item.icon })),
);

const active = ref<MobileMenuKey | null>('home');
function toggle(key: MobileMenuKey): void {
	active.value = active.value === key ? null : key;
}

/** Wrapping, larger-touch-target body layout (React's `wrap`). */
const WRAP = 'flex flex-wrap items-center gap-2';
</script>

<template>
	<MobileSheet :open="props.open" :title="t('pptx.mobileMenu.title')" @close="emit('close')">
		<div class="flex flex-col">
			<!-- Section chips: wrap so every section stays reachable without
			     horizontal scrolling (mirrors React's wrapping chip row). -->
			<div class="sticky top-0 z-10 border-b border-border bg-background">
				<div class="flex flex-wrap gap-1.5 px-3 py-2">
					<button
						v-for="item in MENU_ITEMS"
						:key="item.key"
						type="button"
						:class="
							cn(
								'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-[12px] font-medium transition-colors min-h-[36px]',
								active === item.key
									? 'border-primary bg-primary text-white'
									: 'border-border text-muted-foreground hover:bg-accent/40 hover:text-foreground',
							)
						"
						@click="toggle(item.key)"
					>
						<component :is="item.icon" class="h-4 w-4" />
						{{ item.label }}
					</button>
				</div>
			</div>

			<!-- Active section body: reuses the desktop ribbon section SFCs. -->
			<div class="p-3">
				<div v-if="active === 'home'" :class="WRAP">
					<HomeSection
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
						:selected-element="props.selectedElement"
						:on-update-text-style="props.onUpdateTextStyle"
					/>
				</div>

				<div v-else-if="active === 'insert'" :class="WRAP">
					<InsertSection
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
						:on-open-image-picker="props.onOpenImagePicker"
						:on-open-media-picker="props.onOpenMediaPicker"
						:has-selection="Boolean(props.selectedElement)"
						:on-open-hyperlink-dialog="props.onOpenHyperlinkDialog"
					/>
				</div>

				<div v-else-if="active === 'text'" :class="WRAP">
					<TextSection
						:can-edit="props.canEdit"
						:selected-element="props.selectedElement"
						:table-editor-state="props.tableEditorState"
						:on-update-text-style="props.onUpdateTextStyle"
						:on-transform-text-case="props.onTransformTextCase"
					/>
				</div>

				<div v-else-if="active === 'draw'" :class="WRAP">
					<DrawSection
						:active-tool="props.activeTool"
						:drawing-color="props.drawingColor"
						:drawing-width="props.drawingWidth"
						:on-set-active-tool="props.onSetActiveTool"
						:on-set-drawing-color="props.onSetDrawingColor"
						:on-set-drawing-width="props.onSetDrawingWidth"
					/>
				</div>

				<div v-else-if="active === 'arrange'" :class="WRAP">
					<ArrangeSection
						:can-edit="props.canEdit"
						:selected-element="props.selectedElement"
						:selected-count="props.selectedCount"
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
				</div>

				<div v-else-if="active === 'design'" :class="WRAP">
					<DesignSection
						:can-edit="props.canEdit"
						:on-toggle-theme-gallery="props.onToggleThemeGallery"
						:is-theme-gallery-open="props.isThemeGalleryOpen"
						:on-toggle-theme-editor="props.onToggleThemeEditor"
						:is-theme-editor-open="props.isThemeEditorOpen"
						:on-open-document-properties="props.onOpenDocumentProperties"
						:on-toggle-inspector="props.onToggleInspector"
						:is-inspector-pane-open="props.isInspectorPaneOpen"
					/>
				</div>

				<div v-else-if="active === 'transitions'" :class="WRAP">
					<TransitionsSection
						:is-inspector-pane-open="props.isInspectorPaneOpen"
						:on-toggle-inspector="props.onToggleInspector"
					/>
				</div>

				<div v-else-if="active === 'animations'" :class="WRAP">
					<AnimationsSection
						:can-edit="props.canEdit"
						:selected-element="props.selectedElement"
						:is-inspector-pane-open="props.isInspectorPaneOpen"
						:on-toggle-inspector="props.onToggleInspector"
						:on-open-animation-panel="props.onOpenAnimationPanel"
						:on-add-animation="props.onAddAnimation"
						:on-remove-animation="props.onRemoveAnimation"
					/>
				</div>

				<div v-else-if="active === 'slideShow'" :class="WRAP">
					<SlideShowSection
						:on-present="() => props.onSetMode('present')"
						:on-enter-presenter-view="props.onEnterPresenterView ?? (() => {})"
						:on-enter-rehearsal-mode="props.onEnterRehearsalMode ?? (() => {})"
						:on-open-set-up-slide-show="props.onOpenSetUpSlideShow ?? (() => {})"
						:on-open-broadcast-dialog="props.onOpenBroadcastDialog ?? (() => {})"
						:on-toggle-subtitles="props.onToggleSubtitles ?? (() => {})"
						:show-subtitles="props.showSubtitles ?? false"
						:on-set-mode="props.onSetMode"
						:custom-show-controls="toCustomShowsControlsProps(props)"
						:hidden-actions="props.hiddenActions"
					/>
				</div>

				<div v-else-if="active === 'review'" :class="WRAP">
					<ReviewSection
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
				</div>

				<div v-else-if="active === 'view'" :class="WRAP">
					<ViewSection
						:can-edit="props.canEdit"
						:edit-template-mode="props.editTemplateMode"
						:on-set-edit-template-mode="props.onSetEditTemplateMode"
						:spell-check-enabled="props.spellCheckEnabled"
						:on-set-spell-check-enabled="props.onSetSpellCheckEnabled"
						:show-grid="props.showGrid"
						:show-rulers="props.showRulers"
						:show-guides="props.showGuides"
						:snap-to-grid="props.snapToGrid"
						:snap-to-shape="props.snapToShape"
						:on-set-show-grid="props.onSetShowGrid"
						:on-set-show-rulers="props.onSetShowRulers"
						:on-set-show-guides="props.onSetShowGuides"
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
				</div>

				<div v-else-if="active === 'file'" :class="WRAP">
					<FileSection
						:file-name="props.fileName"
						:on-close="() => emit('close')"
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
				</div>

				<p v-else class="py-8 text-center text-sm text-muted-foreground">
					{{ t('pptx.mobileMenu.selectSection') }}
				</p>
			</div>
		</div>
	</MobileSheet>
</template>
