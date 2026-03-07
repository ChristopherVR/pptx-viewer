/**
 * Types for the useViewerDialogs hook.
 */
import type {
  PptxSlide,
  PptxPresentationProperties,
} from "../../core";
import type { ViewerMode } from "../types-core";
import type { CanvasSize } from "../types";
import type { EditorHistoryResult } from "./useEditorHistory";

export interface UseViewerDialogsInput {
  mode: ViewerMode;
  slides: PptxSlide[];
  activeSlide: PptxSlide | undefined;
  activeSlideIndex: number;
  canvasSize: CanvasSize;
  containerRef: React.RefObject<HTMLDivElement | null>;
  customShows: Array<{ id: string; name: string; slideRIds: string[] }>;
  activeCustomShowId: string | null;
  setCustomShows: React.Dispatch<
    React.SetStateAction<
      Array<{ id: string; name: string; slideRIds: string[] }>
    >
  >;
  setActiveCustomShowId: React.Dispatch<React.SetStateAction<string | null>>;
  setGuides: React.Dispatch<
    React.SetStateAction<
      Array<{ id: string; axis: "h" | "v"; position: number }>
    >
  >;
  setPresentationProperties: React.Dispatch<
    React.SetStateAction<PptxPresentationProperties>
  >;
  setAccessibilityIssues: React.Dispatch<
    React.SetStateAction<
      Array<{
        slideIndex: number;
        elementId: string;
        severity: "error" | "warning" | "info";
        message: string;
      }>
    >
  >;
  setIsAccessibilityPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setMode: React.Dispatch<React.SetStateAction<ViewerMode>>;
  setPreMasterMode: React.Dispatch<React.SetStateAction<ViewerMode>>;
  setActiveMasterIndex: React.Dispatch<React.SetStateAction<number>>;
  setActiveLayoutIndex: React.Dispatch<React.SetStateAction<number | null>>;
  setSelectedElementId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedElementIds: React.Dispatch<React.SetStateAction<string[]>>;
  preMasterMode: ViewerMode;
  hasDigitalSignatures: boolean;
  isDirty: boolean;
  history: EditorHistoryResult;
}

export interface ViewerDialogsResult {
  isSmartArtDialogOpen: boolean;
  setIsSmartArtDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isEquationDialogOpen: boolean;
  setIsEquationDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isHyperlinkDialogOpen: boolean;
  setIsHyperlinkDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isPasswordDialogOpen: boolean;
  setIsPasswordDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isDocPropsDialogOpen: boolean;
  setIsDocPropsDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isFontEmbeddingOpen: boolean;
  setIsFontEmbeddingOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isDigitalSigDialogOpen: boolean;
  setIsDigitalSigDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isSignatureStrippedDialogOpen: boolean;
  setIsSignatureStrippedDialogOpen: React.Dispatch<
    React.SetStateAction<boolean>
  >;
  isSetUpSlideShowOpen: boolean;
  setIsSetUpSlideShowOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isBroadcastDialogOpen: boolean;
  setIsBroadcastDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isPasswordProtected: boolean;
  editingEquationOmml: Record<string, unknown> | null;
  setEditingEquationOmml: React.Dispatch<
    React.SetStateAction<Record<string, unknown> | null>
  >;
  embedFontsEnabled: boolean;
  setEmbedFontsEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  isNarrowViewport: boolean;
  handleEnterMasterView: () => void;
  handleCloseMasterView: () => void;
  handleSelectMaster: (index: number) => void;
  handleSelectLayout: (masterIndex: number, layoutIndex: number) => void;
  handleAddGuide: (axis: "h" | "v") => void;
  handleCreateCustomShow: () => void;
  handleRenameActiveCustomShow: () => void;
  handleDeleteActiveCustomShow: () => void;
  handleToggleCurrentSlideInActiveShow: () => void;
  isCurrentSlideInActiveShow: boolean;
  handleSaveSlideShowSettings: (props: PptxPresentationProperties) => void;
  handleToggleSubtitles: () => void;
  handleSetPassword: (password: string) => void;
  handleRemovePassword: () => void;
  handleRunAccessibilityCheck: () => void;
}
