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

import { cn } from '../../../utils';
import AnimationsSection from './AnimationsSection.vue';
import ArrangeSection from './ArrangeSection.vue';
import DesignSection from './DesignSection.vue';
import DrawSection from './DrawSection.vue';
import FileSection from './FileSection.vue';
import HomeSection from './HomeSection.vue';
import InsertSection from './InsertSection.vue';
import ReviewSection from './ReviewSection.vue';
import { pill, TOOLBAR_SECTIONS } from './ribbon-constants';
import type { RibbonProps } from './ribbon-types';
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
</script>

<template>
	<div
		role="toolbar"
		aria-label="Presentation toolbar"
		class="relative z-20 border-b border-border bg-secondary/50 overflow-visible"
	>
		<!-- Quick Access Row -->
		<ToolbarPrimaryRow v-bind="props" />

		<!-- Ribbon Tab Bar -->
		<div
			v-if="showRibbon"
			class="flex items-center border-b border-border/60 px-1 max-md:overflow-x-auto max-md:scrollbar-none"
		>
			<button
				v-for="sec in TOOLBAR_SECTIONS"
				:key="sec.id"
				type="button"
				:class="
					cn(
						'relative px-3.5 py-2 text-[12px] font-medium whitespace-nowrap transition-colors max-md:min-h-[36px] max-md:px-3',
						props.toolbarSection === sec.id
							? sec.id === 'file'
								? 'text-white bg-primary/80 rounded-sm'
								: 'text-foreground after:absolute after:-bottom-px after:left-0 after:right-0 after:h-[2.5px] after:bg-primary'
							: sec.id === 'file'
								? 'text-primary hover:bg-primary/15 rounded-sm'
								: 'text-muted-foreground hover:text-foreground hover:bg-accent/30',
					)
				"
				@click="props.onSetToolbarSection(sec.id)"
			>
				{{ t(sec.labelKey) }}
			</button>
			<div class="flex-1" />
			<button
				type="button"
				class="mr-1 rounded px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
				:aria-pressed="!props.isCompactToolbarOpen"
				:title="
					props.isCompactToolbarOpen
						? t('pptx.ribbon.collapseRibbon')
						: t('pptx.ribbon.expandRibbon')
				"
				@click="props.onToggleCompactToolbar"
			>
				{{ props.isCompactToolbarOpen ? '▴' : '▾' }}
			</button>
		</div>

		<!-- Ribbon Content (collapsible via the ribbon toggle) -->
		<div
			v-if="showRibbon"
			v-show="props.isCompactToolbarOpen"
			class="flex items-center gap-1.5 px-2 py-1 max-md:px-1 max-md:py-0.5 overflow-visible flex-nowrap"
		>
			<FileSection
				v-if="s === 'file'"
				:on-open-file="props.onOpenFile"
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
				:on-open-document-properties="props.onOpenDocumentProperties"
				:on-open-password-protection="props.onOpenPasswordProtection"
				:on-open-font-embedding="props.onOpenFontEmbedding"
				:on-open-digital-signatures="props.onOpenDigitalSignatures"
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
				:on-open-image-picker="props.onOpenImagePicker"
				:on-open-media-picker="props.onOpenMediaPicker"
			/>

			<TextSection
				v-if="showText"
				:can-edit="props.canEdit"
				:selected-element="props.selectedElement"
				:table-editor-state="props.tableEditorState"
				:on-update-text-style="props.onUpdateTextStyle"
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
				v-if="s === 'arrange'"
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
				:on-enter-master-view="props.onEnterMasterView"
				:is-selection-pane-open="props.isSelectionPaneOpen"
				:on-toggle-selection-pane="props.onToggleSelectionPane"
				:eyedropper-active="props.eyedropperActive"
				:on-toggle-eyedropper="props.onToggleEyedropper"
			/>

			<template v-if="s === 'help'">
				<button
					type="button"
					:class="pill"
					:title="t('pptx.settings.keyboardShortcuts')"
					@click="props.onToggleShortcuts()"
				>
					{{ t('pptx.settings.keyboardShortcuts') }}
				</button>
				<button
					type="button"
					:class="pill"
					:title="t('pptx.ribbon.accessibilityCheck')"
					@click="props.onRunAccessibilityCheck()"
				>
					{{ t('pptx.ribbon.accessibility') }}
				</button>
			</template>
		</div>
	</div>
</template>
