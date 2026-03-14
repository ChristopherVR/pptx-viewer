/**
 * Shared types for the useElementManipulation hook and its sub-hooks.
 */
import type { PptxElement, PptxSlide, MergeShapeOperation } from "pptx-viewer-core";
import type { ElementContextMenuAction } from "../types";
import type { ElementOperations } from "./useElementOperations";
import type { EditorHistoryResult } from "./useEditorHistory";

export interface UseElementManipulationInput {
  activeSlide: PptxSlide | undefined;
  activeSlideIndex: number;
  selectedElement: PptxElement | null;
  effectiveSelectedIds: string[];
  selectedElements: PptxElement[];
  selectedElementIdSet: Set<string>;
  elementLookup: Map<string, PptxElement>;
  editTemplateMode: boolean;
  clipboardPayload: { element: PptxElement; isTemplate: boolean } | null;
  setClipboardPayload: React.Dispatch<
    React.SetStateAction<{ element: PptxElement; isTemplate: boolean } | null>
  >;
  setSelectedElementIds: React.Dispatch<React.SetStateAction<string[]>>;
  setTemplateElementsBySlideId: React.Dispatch<
    React.SetStateAction<Record<string, PptxElement[]>>
  >;
  setIsInspectorPaneOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSidebarPanelMode: React.Dispatch<React.SetStateAction<string>>;
  ops: ElementOperations;
  history: EditorHistoryResult;
  onOpenHyperlinkDialog: () => void;
}

export interface ElementManipulationHandlers {
  handleCopy: () => void;
  handleCut: () => void;
  handlePaste: () => void;
  handleDuplicate: () => void;
  handleGroupElements: () => void;
  handleUngroupElement: () => void;
  handleDelete: () => void;
  handleFlip: (direction: "horizontal" | "vertical") => void;
  handleAlignElements: (align: string) => void;
  handleMoveLayer: (direction: string) => void;
  handleMoveLayerToEdge: (direction: string) => void;
  handleMergeShapes: (operation: MergeShapeOperation) => void;
  canMergeShapes: boolean;
  handleContextMenuAction: (action: ElementContextMenuAction) => void;
}

export interface ClipboardHandlers {
  handleCopy: () => void;
  handleCut: () => void;
  handlePaste: () => void;
  handleDuplicate: () => void;
  handleDelete: () => void;
}

export interface GroupAlignLayerHandlers {
  handleGroupElements: () => void;
  handleUngroupElement: () => void;
  handleFlip: (direction: "horizontal" | "vertical") => void;
  handleAlignElements: (align: string) => void;
  handleMoveLayer: (direction: string) => void;
  handleMoveLayerToEdge: (direction: string) => void;
  handleMergeShapes: (operation: MergeShapeOperation) => void;
  canMergeShapes: boolean;
}
