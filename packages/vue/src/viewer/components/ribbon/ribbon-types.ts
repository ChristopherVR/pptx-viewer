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
	PptxCustomShow,
	PptxElement,
	PptxPresentationProperties,
	PptxSlide,
	PptxSlideTransition,
	ShapeStyle,
	TextStyle,
} from 'pptx-viewer-core';
import type {
	AnimationApplyGroup,
	ChangeCaseMode,
	InsertChartKind,
	SlideTemplateId,
	ToolbarActionId,
} from 'pptx-viewer-shared';

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
	| 'record'
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

/**
 * The custom-show picker's whole contract.
 *
 * Named as one object because two places now render the same picker (the
 * quick-access row and the Slide Show tab's popover), and passing nine props
 * twice is nine chances for the two copies to drift apart.
 */
export interface CustomShowsControlsProps {
	customShows: PptxCustomShow[];
	activeCustomShowId: string | null;
	canEdit: boolean;
	isCurrentSlideInActiveShow: boolean;
	onSetActiveCustomShowId: (id: string | null) => void;
	onCreateCustomShow: () => void;
	onRenameActiveCustomShow: () => void;
	onDeleteActiveCustomShow: () => void;
	onToggleCurrentSlideInActiveShow: () => void;
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
	fileName?: string;
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
	/** How many elements the multi-select holds; Group needs two. */
	selectedCount: number;
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
	/**
	 * Guide-overlay visibility. Separate from `snapToShape`: hiding the guides
	 * must not stop the editor snapping, and the guides stay in the model either
	 * way so snapping and save still see the full list.
	 */
	showGuides: boolean;
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
	/** Toolbar buttons / ribbon tabs the host has asked to hide. Undefined/empty hides nothing. */
	hiddenActions?: ToolbarActionId[];
	/** True when the host opted into the AI assistant (the `ai` prop is set). */
	aiEnabled?: boolean;
	/** Whether the AI chat panel is currently open (drives the toggle's active state). */
	isAiPanelOpen?: boolean;
	/** Toggle the AI chat panel open/closed. */
	onToggleAiPanel?: () => void;

	onSetMode: (mode: ViewerMode) => void;
	onToggleSidebar: () => void;
	onToggleInspector: () => void;
	onOpenAnimationPanel: () => void;
	/** `motionPath` carries a motion-path catalogue id in `preset`, not a preset name. */
	onAddAnimation?: (preset: string, group: AnimationApplyGroup) => void;
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
	onAddChart?: (chartKind: InsertChartKind) => void;
	onAddSmartArt: () => void;
	onAddEquation: () => void;
	onAddActionButton: (shapeType: string) => void;
	onInsertField?: (fieldType: string, value?: string) => void;
	onOpenHeaderFooter?: () => void;
	onOpenImagePicker: () => void;
	onOpenMediaPicker: () => void;
	onSetActiveTool: (tool: DrawingTool) => void;
	onSetDrawingColor: (color: string) => void;
	onSetDrawingWidth: (width: number) => void;
	onSetEditTemplateMode: (mode: boolean) => void;
	onSetSpellCheckEnabled: (enabled: boolean) => void;
	onSetShowGrid: (enabled: boolean) => void;
	onSetShowRulers: (enabled: boolean) => void;
	onSetShowGuides: (enabled: boolean) => void;
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
	onGroupElements: () => void;
	onUngroupElement: () => void;
	/** Patch the selection's `shapeStyle` (the Arrange group's outline width). */
	onUpdateElementStyle: (updates: Partial<ShapeStyle>) => void;
	/** Open the hyperlink editor for the selection (Insert > Link). */
	onOpenHyperlinkDialog: () => void;
	onDuplicate: () => void;
	onDelete: () => void;
	/** Open another presentation (File ▸ Open). Hidden when not provided. */
	onOpenFile?: () => void;
	onOpenRecentFile?: (key: string) => void;
	onCreatePresentation: (templateId: string) => void;
	onExportPng: () => void;
	onExportPdf: () => void;
	onExportVideo: () => void;
	onExportGif: () => void;
	/** Serialise the deck to pptx-viewer-json and download it (Export page card). */
	onExportJson: () => void;
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
	/** Open the windowed Reading View (NOT the fullscreen slide show). */
	onOpenReadingView: () => void;
	/** Enter PowerPoint's Outline view: the deck as editable indented text. */
	onOpenOutlineView: () => void;
	onUpdateTextStyle: (updates: Partial<TextStyle>) => void;
	/** Rewrite the selected text's characters (PowerPoint's Aa "Change Case" dropdown). */
	onTransformTextCase: (mode: ChangeCaseMode) => void;
	onSetOverflowMenuOpen: (open: boolean) => void;
	onInsertSlideFromLayout: (path: string, name?: string) => void;
	/** Insert a pre-designed slide template after the active slide (Home ▸ Slide Templates). */
	onInsertSlideFromTemplate?: (templateId: SlideTemplateId) => void;
	/** Deck scheme map so template gallery previews show the deck's theme colours. */
	templateScheme?: Record<string, string>;
	onApplyLayout?: (path: string) => void;
	onResetSlide?: () => void;
	onAddSection?: () => void;
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
	/** PowerPoint's Hide Slide toggle for the active slide (Slide Show tab). */
	onToggleHideSlide?: () => void;
	/** Whether the active slide is hidden, for Hide Slide's pressed state. */
	activeSlideHidden?: boolean;
	onOpenBroadcastDialog?: () => void;
	onToggleSubtitles?: () => void;
	onTransitionChange: (updates: Partial<PptxSlideTransition>) => void;
	onApplyTransitionToAll: () => void;
	/** Deck presentation properties backing the Slide Show tab's Options checkboxes. */
	presentationProperties?: PptxPresentationProperties;
	/** Commit an Options checkbox onto the deck's presentation properties. */
	onPresentationPropertiesChange?: (updates: Partial<PptxPresentationProperties>) => void;
}
