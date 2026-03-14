/**
 * useElementManipulation — Clipboard (copy/cut/paste/duplicate), group/ungroup,
 * delete, flip, align, layer-order, and context-menu dispatch handlers.
 *
 * Handler logic is split across sub-hooks; this module composes them and
 * provides the context-menu dispatch.
 */
import type { ElementContextMenuAction } from "../types";
import type {
  UseElementManipulationInput,
  ElementManipulationHandlers,
} from "./element-manipulation-types";
import { useClipboardHandlers } from "./useClipboardHandlers";
import { useGroupAlignLayerHandlers } from "./useGroupAlignLayerHandlers";

export type {
  UseElementManipulationInput,
  ElementManipulationHandlers,
} from "./element-manipulation-types";

export function useElementManipulation(
  input: UseElementManipulationInput,
): ElementManipulationHandlers {
  const { setIsInspectorPaneOpen, setSidebarPanelMode, onOpenHyperlinkDialog } =
    input;

  const { handleCopy, handleCut, handlePaste, handleDuplicate, handleDelete } =
    useClipboardHandlers(input);

  const {
    handleGroupElements,
    handleUngroupElement,
    handleFlip,
    handleAlignElements,
    handleMoveLayer,
    handleMoveLayerToEdge,
    handleMergeShapes,
    canMergeShapes,
  } = useGroupAlignLayerHandlers(input);

  const handleContextMenuAction = (action: ElementContextMenuAction) => {
    switch (action) {
      case "copy":
        handleCopy();
        break;
      case "cut":
        handleCut();
        break;
      case "paste":
        handlePaste();
        break;
      case "duplicate":
        handleDuplicate();
        break;
      case "delete":
        handleDelete();
        break;
      case "bring-forward":
      case "bringForward":
        handleMoveLayer("forward");
        break;
      case "send-backward":
      case "sendBackward":
        handleMoveLayer("backward");
        break;
      case "bring-front":
      case "bringToFront":
        handleMoveLayerToEdge("front");
        break;
      case "send-back":
      case "sendToBack":
        handleMoveLayerToEdge("back");
        break;
      case "comment":
      case "addComment":
        setIsInspectorPaneOpen(true);
        setSidebarPanelMode("comments");
        break;
      case "group":
        handleGroupElements();
        break;
      case "ungroup":
        handleUngroupElement();
        break;
      case "editHyperlink":
        onOpenHyperlinkDialog();
        break;
    }
  };

  return {
    handleCopy,
    handleCut,
    handlePaste,
    handleDuplicate,
    handleGroupElements,
    handleUngroupElement,
    handleDelete,
    handleFlip,
    handleAlignElements,
    handleMoveLayer,
    handleMoveLayerToEdge,
    handleContextMenuAction,
  };
}
