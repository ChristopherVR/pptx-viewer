import type {
  DrawingTool,
  ElementClipboardPayload,
  SupportedShapeType,
  ToolbarSection,
  ViewerMode,
} from "../../types";
import type {
  PptxElement,
  TextStyle,
  PptxCustomShow,
} from "pptx-viewer-core";

export interface ToolbarProps {
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
  editTemplateMode: boolean;
  newShapeType: SupportedShapeType;
  activeTool: DrawingTool;
  drawingColor: string;
  drawingWidth: number;
  clipboardPayload: ElementClipboardPayload | null;
  onSetMode: (mode: ViewerMode) => void;
  onToggleSidebar: () => void;
  onToggleInspector: () => void;
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
  onAddSmartArt: () => void;
  onAddEquation: () => void;
  onAddActionButton: (shapeType: string) => void;
  onInsertField?: (fieldType: string) => void;
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
  onAddGuide: (axis: "h" | "v") => void;
  onAlignElements: (align: string) => void;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onFlip: (direction: "horizontal" | "vertical") => void;
  onMoveLayer: (direction: string) => void;
  onMoveLayerToEdge: (direction: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onExportPng: () => void;
  onExportPdf: () => void;
  onExportVideo: () => void;
  onExportGif: () => void;
  onPackageForSharing: () => void;
  onSaveAsPpsx: () => void;
  onSaveAsPptm: () => void;
  hasMacros: boolean;
  onCopySlideAsImage: () => void;
  onPrint: () => void;
  onToggleShortcuts: () => void;
  onRunAccessibilityCheck: () => void;
  onToggleSlideSorter: () => void;
  onUpdateTextStyle: (updates: Partial<TextStyle>) => void;
  isOverflowMenuOpen: boolean;
  onSetOverflowMenuOpen: (open: boolean) => void;
  layoutOptions: Array<{ path: string; name: string }>;
  onInsertSlideFromLayout: (path: string) => void;
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
  isSelectionPaneOpen?: boolean;
  onToggleSelectionPane?: () => void;
  eyedropperActive?: boolean;
  onToggleEyedropper?: () => void;
  onOpenSetUpSlideShow?: () => void;
  onOpenBroadcastDialog?: () => void;
  onToggleSubtitles?: () => void;
  showSubtitles?: boolean;
}
