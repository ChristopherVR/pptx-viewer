import type {
	PptxComment,
	PptxCustomShow,
	PptxElement,
	PptxLayoutOption,
	PptxLayoutPreview,
	PptxPresentationProperties,
	PptxSaveFormat,
	PptxSlide,
	PptxTheme,
} from 'pptx-viewer-core';
import type {
	AlignEdge,
	DistributeAxis,
	InsertChartKind,
	SlideTemplateId,
} from 'pptx-viewer-shared';
import type { ComputedRef, Ref, ShallowRef } from 'vue';

import type { ShapePreset } from '../components/EditorToolbar.vue';
import type {
	DrawingTool,
	RibbonProps,
	SupportedShapeType,
	TableCellEditorState,
	ToolbarSection,
	ViewerMode,
} from '../components/ribbon/ribbon-types';
import type { UseCollaborationResult } from './useCollaboration';

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
	/** Guide-overlay visibility; independent of snapping (see `useRibbonUiState`). */
	showGuides: Ref<boolean>;
	snapToGrid: Ref<boolean>;
	snapToShape: Ref<boolean>;
	overflowOpen: Ref<boolean>;
	layoutOptions: Ref<PptxLayoutOption[]>;
	/** Families the deck embeds, offered as their own font-dropdown group. */
	embeddedFontFamilies: Ref<string[]> | ComputedRef<string[]>;
	/** Families registered this session via File > Options > Fonts. */
	customFontFamilies: Ref<string[]>;
	/** Loaded deck theme; template gallery previews resolve scheme colours against it. */
	theme: ShallowRef<PptxTheme | undefined>;
	customShows: Ref<PptxCustomShow[]>;
	activeCustomShowId: Ref<string | null>;
	isCurrentSlideInActiveShow: ComputedRef<boolean>;
	themeEditorOpen: Ref<boolean>;
	themeGalleryOpen: Ref<boolean>;
	eyedropperActive: Ref<boolean>;
	showComments: Ref<boolean>;
	activeComments: ComputedRef<PptxComment[]>;
	formatPainterActive: Ref<boolean>;
	canActivateFormatPainter: ComputedRef<boolean>;
	showSelectionPane: Ref<boolean>;
	showSubtitles: Ref<boolean>;
	activeSlide: ComputedRef<PptxSlide | undefined>;
	/** Index of the active slide, for per-slide ribbon commands (Hide Slide). */
	activeSlideIndex: Ref<number>;
	/** Toggle a slide's `hidden` flag (one undo step), from `useSlideMutations`. */
	toggleSlideHidden: (index: number) => void;
	/** Deck presentation properties, backing the Slide Show tab's Options checkboxes. */
	presentationProperties: Ref<PptxPresentationProperties>;
	presenting: Ref<boolean>;
	canDistribute: ComputedRef<boolean>;
	shareOpen: Ref<boolean>;
	showShortcuts: Ref<boolean>;
	showSettings: Ref<boolean>;
	showHeaderFooter: Ref<boolean>;
	showA11y: Ref<boolean>;
	showSorter: Ref<boolean>;
	showReadingView: Ref<boolean>;
	showOutlineView: Ref<boolean>;
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
	/** Collaboration session, for the tab-row Share button's connected state. */
	collab: UseCollaborationResult;
}

/** Action callbacks the ribbon adapter dispatches. */
export interface UseRibbonPropsActionsInput {
	startPresenting: () => void;
	startPresenterView: () => void;
	startRehearsal: () => void;
	compareWithPresentation: () => Promise<void>;
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
	addChart: (chartKind: InsertChartKind) => void;
	addField: (fieldType: string, value?: string) => void;
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
	onGroup: () => void;
	onUngroup: () => void;
	/** Patch the selection's `shapeStyle` (the Arrange group's outline width). */
	updateSelectedShapeStyle: RibbonProps['onUpdateElementStyle'];
	/** Open the hyperlink editor on the current selection (Insert ▸ Link). */
	openHyperlinkForSelection: () => void;
	duplicateSelected: () => void;
	deleteSelected: () => void;
	handleOpenFile: () => void;
	handleOpenRecentFile: (key: string) => void;
	createPresentation: (templateId: string) => void;
	onExportPng: () => void;
	onExportPdf: () => void;
	onExportWebm: () => void;
	onExportGif: () => void;
	onExportJson: () => void;
	downloadAs: (format: PptxSaveFormat) => Promise<void>;
	packageForSharing: () => Promise<void>;
	onCopySlideAsImage: () => Promise<void>;
	openPrintDialog: () => void;
	ribbonUpdateTextStyle: RibbonProps['onUpdateTextStyle'];
	ribbonUpdateTextCase: RibbonProps['onTransformTextCase'];
	insertSlideFromLayout: (layoutPath: string, layoutName?: string) => Promise<void>;
	applyLayoutToActiveSlide: (layoutPath: string) => Promise<void>;
	/** Builds the New Slide / Layout gallery artwork on first menu open. */
	loadLayoutPreviews: () => Promise<PptxLayoutPreview[]>;
	insertSlideFromTemplate: (templateId: SlideTemplateId) => void;
	onRenameActiveCustomShow: () => void;
	onDeleteActiveCustomShow: () => void;
	onToggleCurrentSlideInActiveShow: () => void;
	toggleFormatPainter: () => void;
	onToggleSubtitles: () => void;
	onTransitionChange: RibbonProps['onTransitionChange'];
	onApplyTransitionToAll: () => void;
	/** Start a new deck section (Home > Slides > Section), from `useSectionOperations`. */
	addSection: (name: string, afterSlideIndex: number) => void;
	/** The localised name a ribbon-created section gets. */
	defaultSectionName: () => string;
	/** Select every element on the active slide (Home > Editing > Select All). */
	selectAllElements: () => void;
	/** Drop the element selection (Design > Slide Size shows the deck panel). */
	clearSelection: () => void;
	/** Commit a Slide Show Options checkbox, from `useSlideShowSettings`. */
	onPresentationPropertiesUpdate: (patch: Partial<PptxPresentationProperties>) => void;
}

export type UseRibbonPropsInput = UseRibbonPropsStateInput & UseRibbonPropsActionsInput;
