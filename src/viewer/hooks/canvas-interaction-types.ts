/**
 * Shared type for canvas interaction handler signatures.
 */
export interface CanvasInteractionHandlers {
  handleElementClick: (elementId: string, e: React.MouseEvent) => void;
  handleElementDoubleClick: (elementId: string, e: React.MouseEvent) => void;
  handleElementMouseDown: (elementId: string, e: React.MouseEvent) => void;
  handleElementContextMenu: (elementId: string, e: React.MouseEvent) => void;
  handleCanvasMouseDown: (e: React.MouseEvent) => void;
  handleResizePointerDown: (
    elementId: string,
    e: React.MouseEvent,
    handle: string,
  ) => void;
  handleAdjustmentPointerDown: (elementId: string, e: React.MouseEvent) => void;
  handleInlineEditCommit: () => void;
}
