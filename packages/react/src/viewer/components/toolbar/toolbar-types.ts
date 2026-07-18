import type {
	PptxElement,
	PptxSlide,
	PptxSlideTransition,
	PptxChartType,
	TextStyle,
	PptxCustomShow,
} from 'pptx-viewer-core';
import type { ToolbarActionId } from 'pptx-viewer-shared';

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
	/** Adds an animation preset to the selected element. */
	onAddAnimation?: (preset: string, group: 'entrance' | 'emphasis' | 'exit') => void;
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
	onAddChart?: (chartType: PptxChartType) => void;
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
	snapToGrid: boolean;
	snapToShape: boolean;
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
	onOpenRecentFile?: (key: string) => void;
	onCreatePresentation: (templateId: string) => void;
	onExportPng: () => void;
	onExportPdf: () => void;
	onExportVideo: () => void;
	onExportGif: () => void;
	onPackageForSharing: () => void;
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
	onUpdateTextStyle: (updates: Partial<TextStyle>) => void;
	/** Rewrite the selected text's characters (PowerPoint's Aa "Change Case" dropdown). */
	onTransformTextCase: (mode: ChangeCaseMode) => void;
	isOverflowMenuOpen: boolean;
	onSetOverflowMenuOpen: (open: boolean) => void;
	layoutOptions: Array<{ path: string; name: string }>;
	onInsertSlideFromLayout: (path: string, name?: string) => void;
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
	onOpenBroadcastDialog?: () => void;
	onToggleSubtitles?: () => void;
	showSubtitles?: boolean;
	activeSlide?: PptxSlide;
	onTransitionChange: (updates: Partial<PptxSlideTransition>) => void;
	onApplyTransitionToAll: () => void;
	/** Host-supplied list of toolbar buttons/ribbon tabs to hide. See `PowerPointViewerProps.hiddenActions`. */
	hiddenActions?: readonly ToolbarActionId[];
	/** Whether the AI assistant is available (the host passed the `ai` prop). */
	aiEnabled?: boolean;
	/** Whether the AI assistant panel is currently open. */
	isAiPanelOpen?: boolean;
	/** Toggle the AI assistant panel. */
	onToggleAiPanel?: () => void;
}
