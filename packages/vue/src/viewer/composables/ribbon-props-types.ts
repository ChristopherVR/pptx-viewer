import type {
	PptxChartType,
	PptxComment,
	PptxCustomShow,
	PptxElement,
	PptxLayoutOption,
	PptxSaveFormat,
	PptxSlide,
} from 'pptx-viewer-core';
import type { AlignEdge, DistributeAxis } from 'pptx-viewer-shared';
import type { ComputedRef, Ref } from 'vue';

import type { ShapePreset } from '../components/EditorToolbar.vue';
import type {
	DrawingTool,
	RibbonProps,
	SupportedShapeType,
	TableCellEditorState,
	ToolbarSection,
	ViewerMode,
} from '../components/ribbon/ribbon-types';

/**
 * Input types for `useRibbonProps` (split out to keep every ribbon-props file
 * under the repo's ~300 LOC convention). See `useRibbonProps.ts` for the
 * composable itself and `ribbon-props-state.ts` / `ribbon-props-actions.ts`
 * for the two halves of the `RibbonProps` object it builds.
 */

/** State refs the ribbon adapter reads. */
export interface UseRibbonPropsStateInput {
	ribbonMode: ComputedRef<ViewerMode>;
	canEdit: () => boolean;
	isMobile: Ref<boolean>;
	sidebarCollapsed: Ref<boolean>;
	inspectorOpen: Ref<boolean>;
	ribbonExpanded: Ref<boolean>;
	toolbarSection: Ref<ToolbarSection>;
	zoom: Ref<number>;
	canUndo: ComputedRef<boolean>;
	canRedo: ComputedRef<boolean>;
	findOpen: Ref<boolean>;
	selectedElements: ComputedRef<PptxElement[]>;
	activeTableSelection: ComputedRef<TableCellEditorState | null>;
	editTemplateMode: Ref<boolean>;
	newShapeType: Ref<SupportedShapeType>;
	activeTool: Ref<DrawingTool>;
	drawingColor: Ref<string>;
	drawingWidth: Ref<number>;
	clipboard: Ref<PptxElement | null>;
	spellCheckEnabled: Ref<boolean>;
	showGrid: Ref<boolean>;
	showRulers: Ref<boolean>;
	snapToGrid: Ref<boolean>;
	snapToShape: Ref<boolean>;
	overflowOpen: Ref<boolean>;
	layoutOptions: Ref<PptxLayoutOption[]>;
	customShows: Ref<PptxCustomShow[]>;
	activeCustomShowId: Ref<string | null>;
	isCurrentSlideInActiveShow: ComputedRef<boolean>;
	themeEditorOpen: Ref<boolean>;
	themeGalleryOpen: Ref<boolean>;
	showComments: Ref<boolean>;
	activeComments: ComputedRef<PptxComment[]>;
	formatPainterActive: Ref<boolean>;
	canActivateFormatPainter: ComputedRef<boolean>;
	showSelectionPane: Ref<boolean>;
	showSubtitles: Ref<boolean>;
	activeSlide: ComputedRef<PptxSlide | undefined>;
	presenting: Ref<boolean>;
	canDistribute: ComputedRef<boolean>;
	shareOpen: Ref<boolean>;
	showShortcuts: Ref<boolean>;
	showSettings: Ref<boolean>;
	showA11y: Ref<boolean>;
	showSorter: Ref<boolean>;
	showCustomShows: Ref<boolean>;
	showVersionHistory: Ref<boolean>;
	showPasswordDialog: Ref<boolean>;
	propertiesOpen: Ref<boolean>;
	showFontEmbedding: Ref<boolean>;
	showSignatures: Ref<boolean>;
	showMasterView: Ref<boolean>;
	showSetUpSlideShow: Ref<boolean>;
	broadcastOpen: Ref<boolean>;
	showInsertSmartArt: Ref<boolean>;
	showEquationEditor: Ref<boolean>;
}

/** Action callbacks the ribbon adapter dispatches. */
export interface UseRibbonPropsActionsInput {
	startPresenting: () => void;
	onAddAnimation: RibbonProps['onAddAnimation'];
	onRemoveAnimation: RibbonProps['onRemoveAnimation'];
	zoomIn: () => void;
	zoomOut: () => void;
	zoomReset: () => void;
	undo: () => void;
	redo: () => void;
	addText: () => void;
	addShape: (preset: ShapePreset) => void;
	addTable: () => void;
	addChart: (chartType: PptxChartType) => void;
	addActionButton: (shapeType: string) => void;
	openImagePicker: () => void;
	openMediaPicker: () => void;
	addGuide: (axis: 'h' | 'v') => void;
	onAlign: (edge: AlignEdge) => void;
	onDistribute: (axis: DistributeAxis) => void;
	copySelected: () => void;
	cutSelected: () => void;
	pasteElement: () => void;
	ribbonFlip: (direction: 'horizontal' | 'vertical') => void;
	bringForward: () => void;
	sendBackward: () => void;
	ribbonMoveToEdge: (dir: string) => void;
	duplicateSelected: () => void;
	deleteSelected: () => void;
	handleOpenFile: () => void;
	onExportPng: () => void;
	onExportPdf: () => void;
	onExportWebm: () => void;
	onExportGif: () => void;
	downloadAs: (format: PptxSaveFormat) => Promise<void>;
	onCopySlideAsImage: () => Promise<void>;
	openPrintDialog: () => void;
	ribbonUpdateTextStyle: RibbonProps['onUpdateTextStyle'];
	insertSlideFromLayout: (layoutPath: string, layoutName?: string) => Promise<void>;
	onRenameActiveCustomShow: () => void;
	onDeleteActiveCustomShow: () => void;
	onToggleCurrentSlideInActiveShow: () => void;
	toggleFormatPainter: () => void;
	onToggleSubtitles: () => void;
	onTransitionChange: RibbonProps['onTransitionChange'];
	onApplyTransitionToAll: () => void;
}

export type UseRibbonPropsInput = UseRibbonPropsStateInput & UseRibbonPropsActionsInput;
