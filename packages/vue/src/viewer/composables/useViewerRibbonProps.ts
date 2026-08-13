/**
 * useViewerRibbonProps: bridge the viewer's FEATURE CONTROLLERS to the flat
 * `UseRibbonPropsInput` contract.
 *
 * `useRibbonProps` needs ~150 individual refs and callbacks, one per ribbon
 * control. Spelling that mapping out inside `PowerPointViewer.vue` put a
 * 150-line object literal in a file that should be presentation only, and it is
 * pure data plumbing: nothing about it is a template concern. Here the same
 * mapping takes roughly thirty already-cohesive controllers instead, so a new
 * ribbon control changes one file and the SFC never grows.
 *
 * Nothing is computed here; every field is forwarded verbatim. If a mapping
 * ever needs a decision, that decision belongs in the owning composable.
 */
import type {
	PptxCustomShow,
	PptxElement,
	PptxLayoutOption,
	PptxPresentationProperties,
	PptxSlide,
	PptxTheme,
} from 'pptx-viewer-core';
import type { ComputedRef, Ref, ShallowRef } from 'vue';

import type { RibbonProps } from '../components/ribbon/ribbon-types';
import type { UseRibbonPropsInput } from './ribbon-props-types';
import type { UseCollaborationWiringResult } from './useCollaborationWiring';
import type { UseCommentsWiringResult } from './useCommentsWiring';
import type { UseCustomShowsWiringResult } from './useCustomShowsWiring';
import type { UseDeckViewsResult } from './useDeckViews';
import type { UseDocumentPropertiesDialogResult } from './useDocumentPropertiesDialog';
import type { UseElementDragResult } from './useElementDrag';
import type { UseElementInsertionResult } from './useElementInsertion';
import type { UseExportWiringResult } from './useExportWiring';
import type { UseFontEmbeddingResult } from './useFontEmbedding';
import type { UseHeaderFooterDialogResult } from './useHeaderFooterDialog';
import type { UseInsertElementDialogsResult } from './useInsertElementDialogs';
import type { UseMasterViewWiringResult } from './useMasterViewWiring';
import type { UsePasswordProtectionResult } from './usePasswordProtection';
import type { UsePresentationControlsResult } from './usePresentationControls';
import type { UsePrintResult } from './usePrint';
import type { UseRibbonActionsResult } from './useRibbonActions';
import { useRibbonProps } from './useRibbonProps';
import type { UseRibbonUiStateResult } from './useRibbonUiState';
import type { UseSelectionModelResult } from './useSelectionModel';
import type { UseSelectionPaneWiringResult } from './useSelectionPaneWiring';
import type { UseSignatureWorkflowResult } from './useSignatureWorkflow';
import type { UseSlideShowSettingsResult } from './useSlideShowSettings';
import type { UseSlideTemplateInsertionResult } from './useSlideTemplateInsertion';
import type { UseVersionHistoryWiringResult } from './useVersionHistoryWiring';

/** The subset of `useLoadContent`'s result the ribbon reads. */
export interface RibbonDeckInput {
	layoutOptions: ShallowRef<PptxLayoutOption[]>;
	customShows: ShallowRef<PptxCustomShow[]>;
	/** Loaded deck theme; template gallery previews resolve scheme colours against it. */
	theme: ShallowRef<PptxTheme | undefined>;
}

/** Undo/redo surface (`useEditorHistory`), narrowed to what the ribbon needs. */
export interface RibbonHistoryInput {
	canUndo: ComputedRef<boolean>;
	canRedo: ComputedRef<boolean>;
	undo: () => void;
	redo: () => void;
}

/** Multi-selection commands (`useMultiSelectOps`) plus align/group. */
export interface RibbonArrangeInput {
	bringForward: () => void;
	sendBackward: () => void;
	duplicateSelected: () => void;
	deleteSelected: () => void;
	canDistribute: ComputedRef<boolean>;
	onAlign: UseRibbonPropsInput['onAlign'];
	onDistribute: UseRibbonPropsInput['onDistribute'];
	onGroup: () => void;
	onUngroup: () => void;
}

/** Slide-level mutations (`useSlideMutations`) the ribbon triggers. */
export interface RibbonSlideMutationsInput {
	toggleSlideHidden: (index: number) => void;
	onAddAnimation: RibbonProps['onAddAnimation'];
	onRemoveAnimation: RibbonProps['onRemoveAnimation'];
	onTransitionChange: RibbonProps['onTransitionChange'];
	onApplyTransitionToAll: () => void;
}

/** Home > Slides > Section and Home > Editing > Select All. */
export interface RibbonSlideCommandsInput {
	addSection: (name: string, afterSlideIndex: number) => void;
	defaultSectionName: () => string;
	selectAllElements: () => void;
}

/** Format painter + clipboard + shortcut-driven copy/cut. */
export interface RibbonEditingInput {
	clipboard: Ref<PptxElement | null>;
	pasteElement: () => void;
	copySelected: () => void;
	cutSelected: () => void;
	formatPainterActive: Ref<boolean>;
	canActivateFormatPainter: ComputedRef<boolean>;
	toggleFormatPainter: () => void;
	updateSelectedShapeStyle: RibbonProps['onUpdateElementStyle'];
	openHyperlinkForSelection: () => void;
}

export interface UseViewerRibbonPropsOptions {
	canEdit: () => boolean;
	isMobile: Ref<boolean>;
	zoom: Ref<number>;
	zoomIn: () => void;
	zoomOut: () => void;
	zoomReset: () => void;
	findOpen: Ref<boolean>;
	activeSlide: ComputedRef<PptxSlide | undefined>;
	activeSlideIndex: Ref<number>;
	showA11y: Ref<boolean>;
	showShortcuts: Ref<boolean>;
	showSettings: Ref<boolean>;
	deck: RibbonDeckInput;
	/** Families the deck embeds, offered as their own font-dropdown group. */
	embeddedFontFamilies: ComputedRef<string[]>;
	/** Families registered this session via File > Options > Fonts. */
	customFontFamilies: Ref<string[]>;
	ui: UseRibbonUiStateResult;
	selection: UseSelectionModelResult;
	history: RibbonHistoryInput;
	arrange: RibbonArrangeInput;
	editing: RibbonEditingInput;
	slideMutations: RibbonSlideMutationsInput;
	slideCommands: RibbonSlideCommandsInput;
	/** Deck presentation properties, for the Slide Show tab's Options checkboxes. */
	presentationProperties: Ref<PptxPresentationProperties>;
	ribbonActions: UseRibbonActionsResult;
	drag: UseElementDragResult;
	insertion: UseElementInsertionResult;
	templateInsertion: UseSlideTemplateInsertionResult;
	insertDialogs: UseInsertElementDialogsResult;
	exporter: UseExportWiringResult;
	printer: UsePrintResult;
	presentation: UsePresentationControlsResult;
	deckViews: UseDeckViewsResult;
	comments: UseCommentsWiringResult;
	collaboration: UseCollaborationWiringResult;
	customShows: UseCustomShowsWiringResult;
	versionHistory: UseVersionHistoryWiringResult;
	documentProperties: UseDocumentPropertiesDialogResult;
	fontEmbedding: UseFontEmbeddingResult;
	signatureWorkflow: UseSignatureWorkflowResult;
	selectionPane: UseSelectionPaneWiringResult;
	slideShow: UseSlideShowSettingsResult;
	password: UsePasswordProtectionResult;
	masterView: UseMasterViewWiringResult;
	headerFooterDialog: UseHeaderFooterDialogResult;
	/** Backstage actions that do not belong to a feature controller. */
	handleOpenFile: () => void;
	handleOpenRecentFile: (key: string) => void;
	createPresentation: (templateId: string) => void;
	compareWithPresentation: () => Promise<void>;
}

export function useViewerRibbonProps(o: UseViewerRibbonPropsOptions): ComputedRef<RibbonProps> {
	return useRibbonProps({
		// -- State --
		ribbonMode: o.ribbonActions.ribbonMode,
		canEdit: o.canEdit,
		isMobile: o.isMobile,
		sidebarCollapsed: o.ui.sidebarCollapsed,
		inspectorOpen: o.ui.inspectorOpen,
		ribbonExpanded: o.ui.ribbonExpanded,
		toolbarSection: o.ui.toolbarSection,
		zoom: o.zoom,
		canUndo: o.history.canUndo,
		canRedo: o.history.canRedo,
		findOpen: o.findOpen,
		selectedElements: o.selection.selectedElements,
		activeTableSelection: o.ribbonActions.activeTableSelection,
		editTemplateMode: o.selection.editTemplateMode,
		newShapeType: o.ui.newShapeType,
		activeTool: o.ui.activeTool,
		drawingColor: o.ui.drawingColor,
		drawingWidth: o.ui.drawingWidth,
		clipboard: o.editing.clipboard,
		spellCheckEnabled: o.ui.spellCheckEnabled,
		showGrid: o.ui.showGrid,
		showRulers: o.ui.showRulers,
		showGuides: o.ui.showGuides,
		snapToGrid: o.drag.snapToGrid,
		snapToShape: o.drag.snapToShape,
		overflowOpen: o.ui.overflowOpen,
		layoutOptions: o.deck.layoutOptions,
		embeddedFontFamilies: o.embeddedFontFamilies,
		customFontFamilies: o.customFontFamilies,
		theme: o.deck.theme,
		customShows: o.deck.customShows,
		activeCustomShowId: o.customShows.activeCustomShowId,
		isCurrentSlideInActiveShow: o.customShows.isCurrentSlideInActiveShow,
		themeEditorOpen: o.ui.themeEditorOpen,
		themeGalleryOpen: o.ui.themeGalleryOpen,
		eyedropperActive: o.ui.eyedropperActive,
		showComments: o.comments.showComments,
		activeComments: o.comments.activeComments,
		formatPainterActive: o.editing.formatPainterActive,
		canActivateFormatPainter: o.editing.canActivateFormatPainter,
		showSelectionPane: o.selectionPane.showSelectionPane,
		showSubtitles: o.slideShow.showSubtitles,
		activeSlide: o.activeSlide,
		activeSlideIndex: o.activeSlideIndex,
		toggleSlideHidden: o.slideMutations.toggleSlideHidden,
		presentationProperties: o.presentationProperties,
		presenting: o.presentation.presenting,
		canDistribute: o.arrange.canDistribute,
		shareOpen: o.collaboration.shareOpen,
		showShortcuts: o.showShortcuts,
		showSettings: o.showSettings,
		showHeaderFooter: o.headerFooterDialog.showHeaderFooter,
		showA11y: o.showA11y,
		showSorter: o.deckViews.showSorter,
		showReadingView: o.deckViews.showReadingView,
		showOutlineView: o.deckViews.showOutlineView,
		showCustomShows: o.customShows.showCustomShows,
		showVersionHistory: o.versionHistory.showVersionHistory,
		showPasswordDialog: o.password.showPasswordDialog,
		propertiesOpen: o.documentProperties.propertiesOpen,
		showFontEmbedding: o.fontEmbedding.showFontEmbedding,
		showSignatures: o.signatureWorkflow.showSignatures,
		showMasterView: o.masterView.showMasterView,
		showSetUpSlideShow: o.slideShow.showSetUpSlideShow,
		broadcastOpen: o.collaboration.broadcastOpen,
		showInsertSmartArt: o.insertDialogs.showInsertSmartArt,
		showEquationEditor: o.insertDialogs.showEquationEditor,
		collab: o.collaboration.collab,

		// -- Actions --
		startPresenting: o.presentation.startPresenting,
		startPresenterView: o.presentation.startPresenterView,
		startRehearsal: o.presentation.startRehearsal,
		compareWithPresentation: o.compareWithPresentation,
		onAddAnimation: o.slideMutations.onAddAnimation,
		onRemoveAnimation: o.slideMutations.onRemoveAnimation,
		zoomIn: o.zoomIn,
		zoomOut: o.zoomOut,
		zoomReset: o.zoomReset,
		undo: o.history.undo,
		redo: o.history.redo,
		addText: o.insertion.addText,
		addShape: o.insertion.addShape,
		addTable: o.insertion.addTable,
		addChart: o.insertion.addChart,
		addField: o.insertion.addField,
		addActionButton: o.insertion.addActionButton,
		openImagePicker: o.insertion.openImagePicker,
		openMediaPicker: o.insertion.openMediaPicker,
		addGuide: o.drag.addGuide,
		onAlign: o.arrange.onAlign,
		onDistribute: o.arrange.onDistribute,
		copySelected: o.editing.copySelected,
		cutSelected: o.editing.cutSelected,
		pasteElement: o.editing.pasteElement,
		ribbonFlip: o.ribbonActions.ribbonFlip,
		bringForward: o.arrange.bringForward,
		sendBackward: o.arrange.sendBackward,
		ribbonMoveToEdge: o.ribbonActions.ribbonMoveToEdge,
		onGroup: o.arrange.onGroup,
		onUngroup: o.arrange.onUngroup,
		updateSelectedShapeStyle: o.editing.updateSelectedShapeStyle,
		openHyperlinkForSelection: o.editing.openHyperlinkForSelection,
		duplicateSelected: o.arrange.duplicateSelected,
		deleteSelected: o.arrange.deleteSelected,
		handleOpenFile: o.handleOpenFile,
		handleOpenRecentFile: o.handleOpenRecentFile,
		createPresentation: o.createPresentation,
		onExportPng: o.exporter.onExportPng,
		onExportPdf: o.exporter.onExportPdf,
		onExportWebm: o.exporter.onExportWebm,
		onExportGif: o.exporter.onExportGif,
		onExportJson: o.exporter.onExportJson,
		downloadAs: o.exporter.downloadAs,
		packageForSharing: o.exporter.packageForSharing,
		onCopySlideAsImage: o.exporter.onCopySlideAsImage,
		openPrintDialog: o.printer.openPrintDialog,
		ribbonUpdateTextStyle: o.ribbonActions.ribbonUpdateTextStyle,
		ribbonUpdateTextCase: o.ribbonActions.ribbonUpdateTextCase,
		insertSlideFromLayout: o.insertion.insertSlideFromLayout,
		applyLayoutToActiveSlide: o.insertion.applyLayoutToActiveSlide,
		loadLayoutPreviews: o.insertion.loadLayoutPreviews,
		insertSlideFromTemplate: o.templateInsertion.insertSlideFromTemplate,
		onRenameActiveCustomShow: o.customShows.onRenameActiveCustomShow,
		onDeleteActiveCustomShow: o.customShows.onDeleteActiveCustomShow,
		onToggleCurrentSlideInActiveShow: o.customShows.onToggleCurrentSlideInActiveShow,
		toggleFormatPainter: o.editing.toggleFormatPainter,
		onToggleSubtitles: o.slideShow.onToggleSubtitles,
		onTransitionChange: o.slideMutations.onTransitionChange,
		onApplyTransitionToAll: o.slideMutations.onApplyTransitionToAll,
		addSection: o.slideCommands.addSection,
		defaultSectionName: o.slideCommands.defaultSectionName,
		selectAllElements: o.slideCommands.selectAllElements,
		onPresentationPropertiesUpdate: o.slideShow.onPresentationPropertiesUpdate,
	});
}
