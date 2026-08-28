import type {
	PptxElement,
	PptxLayoutOption,
	PptxLayoutPreview,
	PptxSlide,
	PptxSlideTransition,
	PptxPresentationProperties,
	TextStyle,
	PptxCustomShow,
	ShapeStyle,
} from 'pptx-viewer-core';
import type {
	AnimationApplyGroup,
	InsertChartKind,
	SlideTemplateId,
	ToolbarActionId,
} from 'pptx-viewer-shared';

import type {
	DrawingTool,
	ElementClipboardPayload,
	SupportedShapeType,
	TableCellEditorState,
	ToolbarSection,
	ViewerMode,
} from '../../types';
import type { ChangeCaseMode } from '../../utils/text-case-transform';

export interface ToolbarProps {
	fileName?: string;
	mode: ViewerMode;
	canEdit: boolean;
	/**
	 * True when `canEdit` is false because Trust Center > "Open presentations
	 * in Protected View" is on (not because the host itself withheld edit
	 * permission). Turns the toolbar's read-only badge into an "Enable
	 * Editing" action.
	 */
	isProtectedView?: boolean;
	/** Drops the Protected View override for this session. Only offered when `isProtectedView` is true. */
	onEnableEditing?: () => void;
	isNarrowViewport: boolean;
	isSidebarCollapsed: boolean;
	isInspectorPaneOpen: boolean;
	isCompactToolbarOpen: boolean;
	toolbarSection: ToolbarSection;
	scale: number;
	canUndo: boolean;
	canRedo: boolean;
	undoLabel: string | undefined;
	redoLabel: string | undefined;
	findReplaceOpen: boolean;
	selectedElement: PptxElement | null;
	tableEditorState?: TableCellEditorState | null;
	editTemplateMode: boolean;
	newShapeType: SupportedShapeType;
	activeTool: DrawingTool;
	drawingColor: string;
	drawingWidth: number;
	clipboardPayload: ElementClipboardPayload | null;
	onSetMode: (mode: ViewerMode) => void;
	onToggleSidebar: () => void;
	onToggleInspector: () => void;
	/** Opens the inspector pane and switches to the properties tab (for animation panel). */
	onOpenAnimationPanel: () => void;
	/**
	 * Adds an animation to the selected element. For the three preset buckets
	 * `preset` is a `PptxAnimationPreset`; for `motionPath` it is a motion-path
	 * catalogue id.
	 */
	onAddAnimation?: (preset: string, group: AnimationApplyGroup) => void;
	/** Removes all animations from the selected element. */
	onRemoveAnimation?: () => void;
	onToggleCompactToolbar: () => void;
	onSetToolbarSection: (section: ToolbarSection) => void;
	onZoomIn: () => void;
	onZoomOut: () => void;
	onZoomToFit: () => void;
	onUndo: () => void;
	onRedo: () => void;
	onToggleFindReplace: () => void;
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
	spellCheckEnabled: boolean;
	showGrid: boolean;
	showRulers: boolean;
	/** Whether the drawing guides are painted on the canvas (View ▸ Guides). */
	showGuides: boolean;
	snapToGrid: boolean;
	snapToShape: boolean;
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
	/** Combine the multi-selection into one group element. */
	onGroupElements: () => void;
	/** Dissolve the selected group back into its children. */
	onUngroupElement: () => void;
	/** Patch the selected element's shape style (outline width, fill, ...). */
	onUpdateElementStyle: (updates: Partial<ShapeStyle>) => void;
	/** How many elements the multi-select currently holds. */
	selectedCount: number;
	/** Open the hyperlink editor for the current selection. */
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
	onExportJson: () => void;
	onOpenShareDialog?: () => void;
	onSaveAsPptx: () => void;
	onSaveAsPpsx: () => void;
	onSaveAsPptm: () => void;
	hasMacros: boolean;
	onCopySlideAsImage: () => void;
	onPrint: () => void;
	onToggleShortcuts: () => void;
	onOpenSettings?: () => void;
	onRunAccessibilityCheck: () => void;
	onToggleSlideSorter: () => void;
	/** Enter PowerPoint's Reading View (full window, not the fullscreen show). */
	onOpenReadingView: () => void;
	/** Enter PowerPoint's Outline view: the deck as editable indented text. */
	onOpenOutlineView: () => void;
	onUpdateTextStyle: (updates: Partial<TextStyle>) => void;
	/** Rewrite the selected text's characters (PowerPoint's Aa "Change Case" dropdown). */
	onTransformTextCase: (mode: ChangeCaseMode) => void;
	isOverflowMenuOpen: boolean;
	onSetOverflowMenuOpen: (open: boolean) => void;
	layoutOptions: PptxLayoutOption[];
	/** `layoutPath` of the active slide, marking the current gallery tile. */
	currentLayoutPath?: string;
	/** Supplies gallery artwork; without it the menus stay name-only. */
	loadLayoutPreviews?: () => Promise<PptxLayoutPreview[]>;
	/** Theme major/minor latin faces, leading the font dropdown. */
	themeFonts?: { heading?: string; body?: string };
	/** Families the deck embeds, offered as their own dropdown group. */
	embeddedFontFamilies?: readonly string[];
	/** Families registered this session via File > Options > Fonts. */
	customFontFamilies?: readonly string[];
	onInsertSlideFromLayout: (path: string, name?: string) => void;
	/** Re-map the active slide onto another of its master's layouts. */
	onApplyLayout?: (path: string) => void;
	/** Insert a pre-designed starter slide from the template gallery. */
	onInsertSlideFromTemplate?: (templateId: SlideTemplateId) => void;
	/** Deck scheme map so template gallery previews show the deck theme. */
	templateScheme?: Record<string, string>;
	customShows: PptxCustomShow[];
	activeCustomShowId: string | null;
	onSetActiveCustomShowId: (id: string | null) => void;
	onCreateCustomShow: () => void;
	onRenameActiveCustomShow: () => void;
	onDeleteActiveCustomShow: () => void;
	onToggleCurrentSlideInActiveShow: () => void;
	isCurrentSlideInActiveShow: boolean;
	onToggleVersionHistory?: () => void;
	onOpenPasswordProtection?: () => void;
	onOpenDocumentProperties?: () => void;
	/** Design > Slide Size: reveal the inspector card that owns the slide size. */
	onOpenSlideSize?: () => void;
	onOpenFontEmbedding?: () => void;
	onOpenDigitalSignatures?: () => void;
	onEnterMasterView: () => void;
	onCloseMasterView: () => void;
	onEnterPresenterView?: () => void;
	onEnterRehearsalMode?: () => void;
	onToggleThemeEditor: () => void;
	isThemeEditorOpen: boolean;
	onToggleThemeGallery: () => void;
	isThemeGalleryOpen: boolean;
	onCompare?: () => void;
	onToggleComments?: () => void;
	isCommentsPanelOpen?: boolean;
	spellCheckActive?: boolean;
	slideCommentCount?: number;
	formatPainterActive?: boolean;
	onToggleFormatPainter?: () => void;
	canActivateFormatPainter?: boolean;
	isSelectionPaneOpen?: boolean;
	onToggleSelectionPane?: () => void;
	eyedropperActive?: boolean;
	onToggleEyedropper?: () => void;
	onOpenSetUpSlideShow?: () => void;
	/** PowerPoint's Hide Slide toggle for the active slide (Slide Show tab). */
	onToggleHideSlide?: () => void;
	/** Whether the active slide is hidden, for Hide Slide's pressed state. */
	activeSlideHidden?: boolean;
	onOpenBroadcastDialog?: () => void;
	onToggleSubtitles?: () => void;
	showSubtitles?: boolean;
	activeSlide?: PptxSlide;
	onTransitionChange: (updates: Partial<PptxSlideTransition>) => void;
	onApplyTransitionToAll: () => void;
	/**
	 * Home > Slides > Reset: re-apply the active slide's own layout, restoring
	 * inherited placeholder geometry. Undeclared until now, which is why
	 * `SlidesGroup` bound `undefined` and the button did nothing.
	 */
	onResetSlide?: () => void;
	/** Home > Slides > Section: start a new section at the active slide. */
	onAddSection?: () => void;
	/** Home > Editing > Select > Select All (every element on the active slide). */
	onSelectAll?: () => void;
	/**
	 * Slide Show > Options: what the four checkboxes read, and how a tick is
	 * committed. See shared `ribbon-slide-show-options`.
	 */
	presentationProperties?: PptxPresentationProperties;
	onPresentationPropertiesChange?: (updates: Partial<PptxPresentationProperties>) => void;
	/** Host-supplied list of toolbar buttons/ribbon tabs to hide. See `PowerPointViewerProps.hiddenActions`. */
	hiddenActions?: readonly ToolbarActionId[];
	/** File > Options > Advanced > "Quickly access this number of Recent Documents". */
	recentPresentationsCount?: number;
	/** Whether the AI assistant is available (the host passed the `ai` prop). */
	aiEnabled?: boolean;
	/** Whether the AI assistant panel is currently open. */
	isAiPanelOpen?: boolean;
	/** Toggle the AI assistant panel. */
	onToggleAiPanel?: () => void;
	/**
	 * Run a Quick Access command beyond the dedicated Save/Undo/Redo trio, by
	 * catalog id. Used for the below-ribbon strip when Options > Quick Access
	 * Toolbar > position is "below" (the same handler `TitleBar` uses for its
	 * own inline strip when position is "above").
	 */
	onQuickCommand?: (id: string) => void;
}
