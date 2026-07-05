/**
 * Ribbon UI types: the Vue counterpart of React's `types-ui.ts` / `types-core.ts`
 * subset that the Office-style ribbon needs, plus the aggregate `RibbonProps`
 * contract (mirrors React's `ToolbarProps`).
 *
 * The ribbon and its sections take **callback props** (functions) just like the
 * React components, so the section ports stay near-mechanical and the host wires
 * everything in one place (`PowerPointViewer.vue`), exactly as React's
 * `Toolbar.tsx` does. Callbacks are optional where the host may not yet supply
 * them, so the ribbon degrades gracefully during the incremental wire-up.
 */
import type {
	PptxChartType,
	PptxCustomShow,
	PptxElement,
	PptxSlide,
	PptxSlideTransition,
	TextStyle,
} from 'pptx-viewer-core';

/** Viewer interaction mode. Mirrors React `ViewerMode`. */
export type ViewerMode = 'preview' | 'edit' | 'present' | 'master';

/** Ribbon tab id. Mirrors React `ToolbarSection`. */
export type ToolbarSection =
	| 'file'
	| 'home'
	| 'insert'
	| 'text'
	| 'arrange'
	| 'draw'
	| 'design'
	| 'transitions'
	| 'animations'
	| 'slideShow'
	| 'review'
	| 'view'
	| 'help';

/** Active drawing/inking tool. Mirrors React `DrawingTool`. */
export type DrawingTool = 'select' | 'pen' | 'highlighter' | 'eraser' | 'freeform';

/** Shape preset the Insert tab inserts. Mirrors React `SupportedShapeType`. */
export type SupportedShapeType =
	| 'rect'
	| 'roundRect'
	| 'ellipse'
	| 'triangle'
	| 'rtTriangle'
	| 'diamond'
	| 'cylinder'
	| 'parallelogram'
	| 'trapezoid'
	| 'pentagon'
	| 'hexagon'
	| 'octagon'
	| 'chevron'
	| 'star5'
	| 'star6'
	| 'star8'
	| 'plus'
	| 'heart'
	| 'cloud'
	| 'sun'
	| 'moon'
	| 'pie'
	| 'plaque'
	| 'teardrop'
	| 'line'
	| 'rtArrow'
	| 'leftArrow'
	| 'upArrow'
	| 'downArrow'
	| 'connector'
	| 'freeform';

/** Opaque clipboard payload: only its presence gates the Paste button. */
export type ElementClipboardPayload = Record<string, unknown>;

/** Table inline-edit state: present while a table cell is being edited. */
export interface TableCellEditorState {
	elementId: string;
	rowIndex: number;
	columnIndex: number;
}

/** A `{ path, name }` layout option for the New-Slide dropdown. */
export interface LayoutOption {
	path: string;
	name: string;
}

/**
 * Aggregate ribbon contract (state + callbacks). Mirrors React `ToolbarProps`.
 * The shell (`RibbonToolbar.vue`) passes the relevant subset to each section.
 */
export interface RibbonProps {
	mode: ViewerMode;
	canEdit: boolean;
	isNarrowViewport: boolean;
	isSidebarCollapsed: boolean;
	isInspectorPaneOpen: boolean;
	isCompactToolbarOpen: boolean;
	toolbarSection: ToolbarSection;
	scale: number;
	canUndo: boolean;
	canRedo: boolean;
	undoLabel?: string;
	redoLabel?: string;
	findReplaceOpen: boolean;
	selectedElement: PptxElement | null;
	tableEditorState?: TableCellEditorState | null;
	editTemplateMode: boolean;
	newShapeType: SupportedShapeType;
	activeTool: DrawingTool;
	drawingColor: string;
	drawingWidth: number;
	clipboardPayload: ElementClipboardPayload | null;
	spellCheckEnabled: boolean;
	showGrid: boolean;
	showRulers: boolean;
	snapToGrid: boolean;
	snapToShape: boolean;
	isOverflowMenuOpen: boolean;
	layoutOptions: LayoutOption[];
	customShows: PptxCustomShow[];
	activeCustomShowId: string | null;
	isCurrentSlideInActiveShow: boolean;
	hasMacros: boolean;
	isThemeEditorOpen: boolean;
	isThemeGalleryOpen: boolean;
	isCommentsPanelOpen?: boolean;
	slideCommentCount?: number;
	formatPainterActive?: boolean;
	canActivateFormatPainter?: boolean;
	isSelectionPaneOpen?: boolean;
	eyedropperActive?: boolean;
	showSubtitles?: boolean;
	activeSlide?: PptxSlide;
	/** True when a collaboration session is connected (Share button turns green). */
	isCollaborating?: boolean;
	/** Connected collaborator count, shown on the Share button while collaborating. */
	collaboratorCount?: number;

	onSetMode: (mode: ViewerMode) => void;
	onToggleSidebar: () => void;
	onToggleInspector: () => void;
	onOpenAnimationPanel: () => void;
	onAddAnimation?: (preset: string, group: 'entrance' | 'emphasis' | 'exit') => void;
	onRemoveAnimation?: () => void;
	onToggleCompactToolbar: () => void;
	onSetToolbarSection: (section: ToolbarSection) => void;
	onZoomIn: () => void;
	onZoomOut: () => void;
	onZoomToFit: () => void;
	onUndo: () => void;
	onRedo: () => void;
	onToggleFindReplace: () => void;
	onSelectAll?: () => void;
	onSetNewShapeType: (type: SupportedShapeType) => void;
	onAddTextBox: () => void;
	onAddShape: () => void;
	onAddTable: () => void;
	onAddChart?: (chartType: PptxChartType) => void;
	onAddSmartArt: () => void;
	onAddEquation: () => void;
	onAddActionButton: (shapeType: string) => void;
	onInsertField?: (fieldType: string, value?: string) => void;
	onOpenImagePicker: () => void;
	onOpenMediaPicker: () => void;
	onSetActiveTool: (tool: DrawingTool) => void;
	onSetDrawingColor: (color: string) => void;
	onSetDrawingWidth: (width: number) => void;
	onSetEditTemplateMode: (mode: boolean) => void;
	onSetSpellCheckEnabled: (enabled: boolean) => void;
	onSetShowGrid: (enabled: boolean) => void;
	onSetShowRulers: (enabled: boolean) => void;
	onSetSnapToGrid: (enabled: boolean) => void;
	onSetSnapToShape: (enabled: boolean) => void;
	onAddGuide: (axis: 'h' | 'v') => void;
	onAlignElements: (align: string) => void;
	onDistributeElements: (axis: string) => void;
	canDistribute: boolean;
	onCopy: () => void;
	onCut: () => void;
	onPaste: () => void;
	onFlip: (direction: 'horizontal' | 'vertical') => void;
	onMoveLayer: (direction: string) => void;
	onMoveLayerToEdge: (direction: string) => void;
	onDuplicate: () => void;
	onDelete: () => void;
	/** Open another presentation (File ▸ Open). Hidden when not provided. */
	onOpenFile?: () => void;
	onExportPng: () => void;
	onExportPdf: () => void;
	onExportVideo: () => void;
	onExportGif: () => void;
	onPackageForSharing: () => void;
	onOpenShareDialog?: () => void;
	onSaveAsPptx: () => void;
	onSaveAsPpsx: () => void;
	onSaveAsPptm: () => void;
	onCopySlideAsImage: () => void;
	onPrint: () => void;
	onToggleShortcuts: () => void;
	onOpenSettings?: () => void;
	onRunAccessibilityCheck: () => void;
	onToggleSlideSorter: () => void;
	onUpdateTextStyle: (updates: Partial<TextStyle>) => void;
	onSetOverflowMenuOpen: (open: boolean) => void;
	onInsertSlideFromLayout: (path: string, name?: string) => void;
	onSetActiveCustomShowId: (id: string | null) => void;
	onCreateCustomShow: () => void;
	onRenameActiveCustomShow: () => void;
	onDeleteActiveCustomShow: () => void;
	onToggleCurrentSlideInActiveShow: () => void;
	onToggleVersionHistory?: () => void;
	onOpenPasswordProtection?: () => void;
	onOpenDocumentProperties?: () => void;
	onOpenFontEmbedding?: () => void;
	onOpenDigitalSignatures?: () => void;
	onEnterMasterView: () => void;
	onCloseMasterView: () => void;
	onEnterPresenterView?: () => void;
	onEnterRehearsalMode?: () => void;
	onToggleThemeEditor: () => void;
	onToggleThemeGallery: () => void;
	onCompare?: () => void;
	onToggleComments?: () => void;
	onToggleFormatPainter?: () => void;
	onToggleSelectionPane?: () => void;
	onToggleEyedropper?: () => void;
	onOpenSetUpSlideShow?: () => void;
	onOpenBroadcastDialog?: () => void;
	onToggleSubtitles?: () => void;
	onTransitionChange: (updates: Partial<PptxSlideTransition>) => void;
	onApplyTransitionToAll: () => void;
}
