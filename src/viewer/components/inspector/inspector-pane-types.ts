import type {
  PptxAppProperties,
  PptxComment,
  PptxCoreProperties,
  PptxCustomProperty,
  PptxElement,
  PptxHandoutMaster,
  PptxNotesMaster,
  PptxPresentationProperties,
  PptxSlide,
  PptxSlideMaster,
  PptxTagCollection,
  PptxTheme,
  PptxThemeOption,
  ShapeStyle,
  TextStyle,
} from "../../../core";
import type { CanvasSize, TableCellEditorState, ViewerMode } from "../../types";

// ---------------------------------------------------------------------------
// Inspector tab discriminant
// ---------------------------------------------------------------------------

export type InspectorTab = "elements" | "properties" | "comments";

// ---------------------------------------------------------------------------
// Inspector pane props
// ---------------------------------------------------------------------------

export interface InspectorPaneProps {
  isOpen: boolean;
  canEdit: boolean;
  mode: ViewerMode;
  activeSlide: PptxSlide | undefined;
  slides: PptxSlide[];
  canvasSize: CanvasSize;
  selectedElement: PptxElement | null;
  selectedElementIds: string[];
  tableEditorState?: TableCellEditorState | null;
  activeTab: InspectorTab;
  onSetActiveTab: (tab: InspectorTab) => void;
  onClose: () => void;
  onUpdateElementStyle: (updates: Partial<ShapeStyle>) => void;
  onUpdateTextStyle: (updates: Partial<TextStyle>) => void;
  onUpdateElement: (updates: Partial<PptxElement>) => void;
  onUpdateSlide: (updates: Partial<PptxSlide>) => void;
  onSelectElement: (elementId: string | null) => void;
  onMoveLayer: (direction: string) => void;
  onMoveLayerToEdge: (direction: string) => void;
  onDeleteElement: () => void;
  presentationProperties: PptxPresentationProperties;
  onUpdatePresentationProperties: (
    updates: Partial<PptxPresentationProperties>,
  ) => void;
  notesMaster?: PptxNotesMaster;
  handoutMaster?: PptxHandoutMaster;
  notesCanvasSize?: CanvasSize;
  coreProperties?: PptxCoreProperties;
  appProperties?: PptxAppProperties;
  customProperties: PptxCustomProperty[];
  themeOptions: PptxThemeOption[];
  onUpdateCoreProperties: (updates: Partial<PptxCoreProperties>) => void;
  onUpdateAppProperties: (updates: Partial<PptxAppProperties>) => void;
  onUpdateCustomProperties: (next: PptxCustomProperty[]) => void;
  tagCollections?: PptxTagCollection[];
  onUpdateTagCollections?: (next: PptxTagCollection[]) => void;
  onApplyTheme: (themePath: string, applyToAllMasters: boolean) => void;
  comments: PptxComment[];
  commentDraft: string;
  editingCommentId: string | null;
  commentEditDraft: string;
  onSetCommentDraft: (draft: string) => void;
  onAddComment: () => void;
  onDeleteComment: (id: string) => void;
  onStartEditComment: (id: string) => void;
  onSaveEditComment: (id: string) => void;
  onCancelEditComment: () => void;
  onSetCommentEditDraft: (draft: string) => void;
  onToggleCommentResolved?: (id: string) => void;
  onStartReply?: (id: string) => void;
  onCancelReply?: () => void;
  onReplyDraftChange?: (commentId: string, draft: string) => void;
  onSubmitReply?: (commentId: string) => void;
  replyingToCommentId?: string | null;
  replyDraftByCommentId?: Record<string, string>;
  onUpdateCanvasSize: (size: CanvasSize) => void;
  editTemplateMode?: boolean;
  slideMasters?: PptxSlideMaster[];
  onSetTemplateBackground?: (path: string, backgroundColor: string) => void;
  onGetTemplateBackgroundColor?: (path: string) => string | undefined;
  mediaDataUrls?: Map<string, string>;
  theme?: PptxTheme;
}
