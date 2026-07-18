import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { createBackstagePresentation } from 'pptx-viewer-shared';
import type { ToolbarActionId } from 'pptx-viewer-shared';

import type { ToolbarProps } from '../components/toolbar/toolbar-types';
import type { ViewerMode } from '../types';
import { hasCopyableFormat } from '../utils/format-painter';
import type { AutosaveStatus } from './useAutosave';
import type { EditorHistoryResult } from './useEditorHistory';
import type { ElementManipulationHandlers } from './useElementManipulation';
import type { ElementOperations } from './useElementOperations';
import type { ExportHandlersResult } from './useExportHandlers';
import type { InsertElementHandlers } from './useInsertElements';
import type { PrintHandlersResult } from './usePrintHandlers';
import type { PropertyHandlersResult } from './usePropertyHandlers';
import { scopeLayoutOptionsToActiveSlide } from './useScopedLayoutOptions';
import type { SlideManagementHandlers } from './useSlideManagement';
import { buildToolbarAnimationHandlers } from './useViewerBuildingBlocks-toolbar-handlers';
import type { ViewerDialogsResult } from './useViewerDialogs';
import type { ViewerState } from './useViewerState';

/**
 * Pure mapping function that reproduces the `<Toolbar ... />` prop wiring
 * from `ViewerToolbarSection.tsx` (the JSX block PowerPointViewer renders
 * internally). Kept as a plain function, not a hook, so it can be called
 * from any composing hook; callers own memoisation if they need it.
 */

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface BuildToolbarPropsInput {
	mode: ViewerMode;
	canEdit: boolean;
	state: ViewerState;
	selectedElement: PptxElement | null;
	activeSlide: PptxSlide | undefined;
	zoom: {
		scale: number;
		handleZoomIn: () => void;
		handleZoomOut: () => void;
		handleZoomToFit: () => void;
	};
	history: EditorHistoryResult;
	findReplace: {
		findReplaceOpen: boolean;
		setFindReplaceOpen: (open: boolean) => void;
	};
	manipulation: ElementManipulationHandlers;
	insertHandlers: InsertElementHandlers;
	exportHandlers: ExportHandlersResult;
	printHandlers: PrintHandlersResult;
	propertyHandlers: PropertyHandlersResult;
	dialogs: ViewerDialogsResult;
	slideOps: SlideManagementHandlers;
	ops: ElementOperations;
	onSetMode: (mode: ViewerMode) => void;
	onEnterPresenterView: () => void;
	onEnterRehearsalMode: () => void;
	onOpenSettings?: () => void;
	onOpenHeaderFooter?: () => void;
	onOpenShareDialog?: () => void;
	onOpenFile?: () => void;
	onOpenRecentFile?: (key: string) => void;
	fileName?: string;
	autosaveStatus?: AutosaveStatus;
	autosaveEnabled?: boolean;
	hiddenActions?: readonly ToolbarActionId[];
}

// ---------------------------------------------------------------------------
// Mapping function
// ---------------------------------------------------------------------------

export function buildToolbarProps(input: BuildToolbarPropsInput): ToolbarProps {
	const {
		mode,
		canEdit,
		state: s,
		selectedElement,
		activeSlide,
		zoom,
		history,
		findReplace,
		manipulation,
		insertHandlers,
		exportHandlers,
		printHandlers,
		propertyHandlers,
		dialogs,
		slideOps,
		ops,
		onSetMode,
		onEnterPresenterView,
		onEnterRehearsalMode,
		onOpenSettings,
		onOpenHeaderFooter,
		onOpenShareDialog,
		onOpenFile,
		onOpenRecentFile,
		fileName,
		hiddenActions,
	} = input;

	const {
		handleAddAnimation,
		handleRemoveAnimation,
		handleTransitionChange,
		handleApplyTransitionToAll,
	} = buildToolbarAnimationHandlers({
		selectedElement,
		activeSlide,
		propertyHandlers,
		ops,
		history,
	});

	const scopedLayoutOptions = scopeLayoutOptionsToActiveSlide(s.layoutOptions, activeSlide);

	return {
		fileName,
		mode,
		canEdit,
		isNarrowViewport: dialogs.isNarrowViewport,
		isSidebarCollapsed: !s.isSlidesPaneOpen,
		isInspectorPaneOpen: s.isInspectorPaneOpen,
		isCompactToolbarOpen: s.isCompactToolbarOpen,
		toolbarSection: s.toolbarSection,
		scale: zoom.scale,
		canUndo: history.canUndo,
		canRedo: history.canRedo,
		undoLabel: history.undoLabel,
		redoLabel: history.redoLabel,
		findReplaceOpen: findReplace.findReplaceOpen,
		selectedElement,
		tableEditorState: s.tableEditorState,
		editTemplateMode: s.editTemplateMode,
		newShapeType: s.newShapeType,
		activeTool: s.activeTool,
		drawingColor: s.drawingColor,
		drawingWidth: s.drawingWidth,
		clipboardPayload: s.clipboardPayload,
		onSetMode,
		onToggleSidebar: () => s.setIsSlidesPaneOpen((p) => !p),
		onToggleInspector: () => s.setIsInspectorPaneOpen((p) => !p),
		onOpenAnimationPanel: () => {
			s.setIsInspectorPaneOpen(true);
			s.setSidebarPanelMode('properties');
		},
		onAddAnimation: handleAddAnimation,
		onRemoveAnimation: handleRemoveAnimation,
		onToggleCompactToolbar: () => s.setIsCompactToolbarOpen((p) => !p),
		onSetToolbarSection: s.setToolbarSection,
		onZoomIn: zoom.handleZoomIn,
		onZoomOut: zoom.handleZoomOut,
		onZoomToFit: zoom.handleZoomToFit,
		onUndo: history.handleUndo,
		onRedo: history.handleRedo,
		onToggleFindReplace: () => findReplace.setFindReplaceOpen(!findReplace.findReplaceOpen),
		onSetNewShapeType: s.setNewShapeType,
		onAddTextBox: insertHandlers.handleAddTextBox,
		onAddShape: insertHandlers.handleAddShape,
		onAddTable: insertHandlers.handleAddTable,
		onAddChart: insertHandlers.handleAddChart,
		onAddSmartArt: () => dialogs.setIsSmartArtDialogOpen(true),
		onAddEquation: () => {
			dialogs.setEditingEquationOmml(null);
			dialogs.setIsEquationDialogOpen(true);
		},
		onAddActionButton: insertHandlers.handleAddActionButton,
		onInsertField: insertHandlers.handleInsertField,
		onOpenHeaderFooter,
		onOpenImagePicker: () => s.imageInputRef.current?.click(),
		onOpenMediaPicker: () => s.mediaInputRef.current?.click(),
		onSetActiveTool: s.setActiveTool,
		onSetDrawingColor: s.setDrawingColor,
		onSetDrawingWidth: s.setDrawingWidth,
		onSetEditTemplateMode: s.setEditTemplateMode,
		spellCheckEnabled: s.spellCheckEnabled,
		showGrid: s.showGrid,
		showRulers: s.showRulers,
		snapToGrid: s.snapToGrid,
		snapToShape: s.snapToShape,
		onSetSpellCheckEnabled: s.setSpellCheckEnabled,
		onSetShowGrid: s.setShowGrid,
		onSetShowRulers: s.setShowRulers,
		onSetSnapToGrid: s.setSnapToGrid,
		onSetSnapToShape: s.setSnapToShape,
		onAddGuide: dialogs.handleAddGuide,
		onAlignElements: manipulation.handleAlignElements,
		onDistributeElements: manipulation.handleDistributeElements,
		canDistribute: manipulation.canDistribute,
		onCopy: manipulation.handleCopy,
		onCut: manipulation.handleCut,
		onPaste: manipulation.handlePaste,
		onFlip: manipulation.handleFlip,
		onMoveLayer: manipulation.handleMoveLayer,
		onMoveLayerToEdge: manipulation.handleMoveLayerToEdge,
		onDuplicate: manipulation.handleDuplicate,
		onDelete: manipulation.handleDelete,
		onExportPng: exportHandlers.handleExportPng,
		onExportPdf: exportHandlers.handleExportPdf,
		onExportVideo: exportHandlers.handleExportVideo,
		onExportGif: exportHandlers.handleExportGif,
		onPackageForSharing: exportHandlers.handlePackageForSharing,
		onOpenFile,
		onOpenRecentFile,
		onCreatePresentation: (templateId: string) => {
			s.setSlides(createBackstagePresentation(templateId));
			s.setActiveSlideIndex(0);
			s.setSelectedElementId(null);
			s.setSelectedElementIds([]);
			s.setTemplateElementsBySlideId({});
			s.setIsDirty(true);
		},
		onOpenShareDialog,
		onSaveAsPptx: exportHandlers.handleSaveAsPptx,
		onSaveAsPpsx: exportHandlers.handleSaveAsPpsx,
		onSaveAsPptm: exportHandlers.handleSaveAsPptm,
		hasMacros: s.hasMacros,
		onCopySlideAsImage: exportHandlers.handleCopySlideAsImage,
		onPrint: printHandlers.handlePrint,
		onToggleShortcuts: () => s.setIsShortcutHelpOpen((p) => !p),
		onOpenSettings,
		onRunAccessibilityCheck: dialogs.handleRunAccessibilityCheck,
		onToggleSlideSorter: () => s.setShowSlideSorter((p) => !p),
		onUpdateTextStyle: ops.updateSelectedTextStyle,
		onTransformTextCase: ops.updateSelectedTextCase,
		isOverflowMenuOpen: s.isOverflowMenuOpen,
		onSetOverflowMenuOpen: s.setIsOverflowMenuOpen,
		layoutOptions: scopedLayoutOptions,
		onInsertSlideFromLayout: slideOps.handleInsertSlideFromLayout,
		customShows: s.customShows,
		activeCustomShowId: s.activeCustomShowId,
		onSetActiveCustomShowId: s.setActiveCustomShowId,
		onCreateCustomShow: dialogs.handleCreateCustomShow,
		onRenameActiveCustomShow: dialogs.handleRenameActiveCustomShow,
		onDeleteActiveCustomShow: dialogs.handleDeleteActiveCustomShow,
		onToggleCurrentSlideInActiveShow: dialogs.handleToggleCurrentSlideInActiveShow,
		isCurrentSlideInActiveShow: dialogs.isCurrentSlideInActiveShow,
		onEnterMasterView: dialogs.handleEnterMasterView,
		onCloseMasterView: dialogs.handleCloseMasterView,
		onToggleVersionHistory: () => propertyHandlers.setIsVersionHistoryOpen((p) => !p),
		onOpenPasswordProtection: () => dialogs.setIsPasswordDialogOpen(true),
		onOpenDocumentProperties: () => dialogs.setIsDocPropsDialogOpen(true),
		onOpenFontEmbedding: () => dialogs.setIsFontEmbeddingOpen(true),
		onOpenDigitalSignatures: () => dialogs.setIsDigitalSigDialogOpen(true),
		onEnterPresenterView,
		onEnterRehearsalMode,
		onToggleThemeEditor: () => s.setIsThemeEditorOpen((p) => !p),
		isThemeEditorOpen: s.isThemeEditorOpen,
		onToggleThemeGallery: () => s.setIsThemeGalleryOpen((p) => !p),
		isThemeGalleryOpen: s.isThemeGalleryOpen,
		onCompare: propertyHandlers.handleCompare,
		onToggleComments: () => {
			s.setSidebarPanelMode('comments');
			if (!s.isInspectorPaneOpen) {
				s.setIsInspectorPaneOpen(true);
			}
		},
		isCommentsPanelOpen: s.isInspectorPaneOpen,
		slideCommentCount: activeSlide?.comments?.length ?? 0,
		formatPainterActive: s.formatPainterActive,
		canActivateFormatPainter: hasCopyableFormat(selectedElement),
		onToggleFormatPainter: () => s.setFormatPainterActive((p) => !p),
		isSelectionPaneOpen: s.isSelectionPaneOpen,
		onToggleSelectionPane: () => s.setIsSelectionPaneOpen((p) => !p),
		eyedropperActive: s.eyedropperActive,
		onToggleEyedropper: () => s.setEyedropperActive((p) => !p),
		onOpenSetUpSlideShow: () => dialogs.setIsSetUpSlideShowOpen(true),
		onOpenBroadcastDialog: () => dialogs.setIsBroadcastDialogOpen(true),
		onToggleSubtitles: dialogs.handleToggleSubtitles,
		showSubtitles: Boolean(s.presentationProperties.showSubtitles),
		activeSlide,
		onTransitionChange: handleTransitionChange,
		onApplyTransitionToAll: handleApplyTransitionToAll,
		hiddenActions,
	};
}
