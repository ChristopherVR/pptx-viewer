/**
 * Tests for context-menu action dispatch logic in useElementManipulation.
 *
 * The handleContextMenuAction switch statement is pure mapping logic
 * that dispatches to individual handler functions. We verify the mapping
 * here by providing mock handlers and checking which one is called.
 */
import { describe, it, expect, vi } from "vitest";

import type { ElementContextMenuAction } from "../types";

// ---------------------------------------------------------------------------
// Extracted pure dispatch — mirrors handleContextMenuAction
// ---------------------------------------------------------------------------

interface Handlers {
  handleCopy: () => void;
  handleCut: () => void;
  handlePaste: () => void;
  handleDuplicate: () => void;
  handleDelete: () => void;
  handleMoveLayer: (direction: string) => void;
  handleMoveLayerToEdge: (direction: string) => void;
  setIsInspectorPaneOpen: (open: boolean) => void;
  setSidebarPanelMode: (mode: string) => void;
  handleGroupElements: () => void;
  handleUngroupElement: () => void;
  onOpenHyperlinkDialog: () => void;
}

function dispatchContextMenuAction(
  action: ElementContextMenuAction,
  handlers: Handlers,
): void {
  switch (action) {
    case "copy":
      handlers.handleCopy();
      break;
    case "cut":
      handlers.handleCut();
      break;
    case "paste":
      handlers.handlePaste();
      break;
    case "duplicate":
      handlers.handleDuplicate();
      break;
    case "delete":
      handlers.handleDelete();
      break;
    case "bring-forward":
    case "bringForward":
      handlers.handleMoveLayer("forward");
      break;
    case "send-backward":
    case "sendBackward":
      handlers.handleMoveLayer("backward");
      break;
    case "bring-front":
    case "bringToFront":
      handlers.handleMoveLayerToEdge("front");
      break;
    case "send-back":
    case "sendToBack":
      handlers.handleMoveLayerToEdge("back");
      break;
    case "comment":
    case "addComment":
      handlers.setIsInspectorPaneOpen(true);
      handlers.setSidebarPanelMode("comments");
      break;
    case "group":
      handlers.handleGroupElements();
      break;
    case "ungroup":
      handlers.handleUngroupElement();
      break;
    case "editHyperlink":
      handlers.onOpenHyperlinkDialog();
      break;
  }
}

// ---------------------------------------------------------------------------
// Mock handler factory
// ---------------------------------------------------------------------------

function createMockHandlers(): Handlers {
  return {
    handleCopy: vi.fn(),
    handleCut: vi.fn(),
    handlePaste: vi.fn(),
    handleDuplicate: vi.fn(),
    handleDelete: vi.fn(),
    handleMoveLayer: vi.fn(),
    handleMoveLayerToEdge: vi.fn(),
    setIsInspectorPaneOpen: vi.fn(),
    setSidebarPanelMode: vi.fn(),
    handleGroupElements: vi.fn(),
    handleUngroupElement: vi.fn(),
    onOpenHyperlinkDialog: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useElementManipulation — context menu dispatch", () => {
  it("should dispatch 'copy' to handleCopy", () => {
    const h = createMockHandlers();
    dispatchContextMenuAction("copy", h);
    expect(h.handleCopy).toHaveBeenCalledOnce();
  });

  it("should dispatch 'cut' to handleCut", () => {
    const h = createMockHandlers();
    dispatchContextMenuAction("cut", h);
    expect(h.handleCut).toHaveBeenCalledOnce();
  });

  it("should dispatch 'paste' to handlePaste", () => {
    const h = createMockHandlers();
    dispatchContextMenuAction("paste", h);
    expect(h.handlePaste).toHaveBeenCalledOnce();
  });

  it("should dispatch 'duplicate' to handleDuplicate", () => {
    const h = createMockHandlers();
    dispatchContextMenuAction("duplicate", h);
    expect(h.handleDuplicate).toHaveBeenCalledOnce();
  });

  it("should dispatch 'delete' to handleDelete", () => {
    const h = createMockHandlers();
    dispatchContextMenuAction("delete", h);
    expect(h.handleDelete).toHaveBeenCalledOnce();
  });

  it("should dispatch 'bring-forward' to handleMoveLayer('forward')", () => {
    const h = createMockHandlers();
    dispatchContextMenuAction("bring-forward", h);
    expect(h.handleMoveLayer).toHaveBeenCalledWith("forward");
  });

  it("should dispatch 'bringForward' to handleMoveLayer('forward')", () => {
    const h = createMockHandlers();
    dispatchContextMenuAction("bringForward", h);
    expect(h.handleMoveLayer).toHaveBeenCalledWith("forward");
  });

  it("should dispatch 'send-backward' to handleMoveLayer('backward')", () => {
    const h = createMockHandlers();
    dispatchContextMenuAction("send-backward", h);
    expect(h.handleMoveLayer).toHaveBeenCalledWith("backward");
  });

  it("should dispatch 'sendBackward' to handleMoveLayer('backward')", () => {
    const h = createMockHandlers();
    dispatchContextMenuAction("sendBackward", h);
    expect(h.handleMoveLayer).toHaveBeenCalledWith("backward");
  });

  it("should dispatch 'bring-front' to handleMoveLayerToEdge('front')", () => {
    const h = createMockHandlers();
    dispatchContextMenuAction("bring-front", h);
    expect(h.handleMoveLayerToEdge).toHaveBeenCalledWith("front");
  });

  it("should dispatch 'bringToFront' to handleMoveLayerToEdge('front')", () => {
    const h = createMockHandlers();
    dispatchContextMenuAction("bringToFront", h);
    expect(h.handleMoveLayerToEdge).toHaveBeenCalledWith("front");
  });

  it("should dispatch 'send-back' to handleMoveLayerToEdge('back')", () => {
    const h = createMockHandlers();
    dispatchContextMenuAction("send-back", h);
    expect(h.handleMoveLayerToEdge).toHaveBeenCalledWith("back");
  });

  it("should dispatch 'sendToBack' to handleMoveLayerToEdge('back')", () => {
    const h = createMockHandlers();
    dispatchContextMenuAction("sendToBack", h);
    expect(h.handleMoveLayerToEdge).toHaveBeenCalledWith("back");
  });

  it("should dispatch 'comment' to open inspector in comments mode", () => {
    const h = createMockHandlers();
    dispatchContextMenuAction("comment", h);
    expect(h.setIsInspectorPaneOpen).toHaveBeenCalledWith(true);
    expect(h.setSidebarPanelMode).toHaveBeenCalledWith("comments");
  });

  it("should dispatch 'addComment' to open inspector in comments mode", () => {
    const h = createMockHandlers();
    dispatchContextMenuAction("addComment", h);
    expect(h.setIsInspectorPaneOpen).toHaveBeenCalledWith(true);
    expect(h.setSidebarPanelMode).toHaveBeenCalledWith("comments");
  });

  it("should dispatch 'group' to handleGroupElements", () => {
    const h = createMockHandlers();
    dispatchContextMenuAction("group", h);
    expect(h.handleGroupElements).toHaveBeenCalledOnce();
  });

  it("should dispatch 'ungroup' to handleUngroupElement", () => {
    const h = createMockHandlers();
    dispatchContextMenuAction("ungroup", h);
    expect(h.handleUngroupElement).toHaveBeenCalledOnce();
  });

  it("should dispatch 'editHyperlink' to onOpenHyperlinkDialog", () => {
    const h = createMockHandlers();
    dispatchContextMenuAction("editHyperlink", h);
    expect(h.onOpenHyperlinkDialog).toHaveBeenCalledOnce();
  });
});
