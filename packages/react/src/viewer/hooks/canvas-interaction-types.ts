import type { PptxElement, TextStyle } from 'pptx-viewer-core';

/**
 * Shared type for canvas interaction handler signatures.
 */
export interface CanvasInteractionHandlers {
	handleElementClick: (elementId: string, e: React.MouseEvent) => void;
	handleElementDoubleClick: (elementId: string, e: React.MouseEvent) => void;
	handleElementMouseDown: (elementId: string, e: React.MouseEvent) => void;
	handleElementContextMenu: (elementId: string, e: React.MouseEvent) => void;
	handleCanvasMouseDown: (e: React.MouseEvent) => void;
	handleResizePointerDown: (elementId: string, e: React.MouseEvent, handle: string) => void;
	handleAdjustmentPointerDown: (elementId: string, e: React.MouseEvent) => void;
	/** Commit a new rotation (degrees) for an element from the on-canvas rotate handle. */
	handleRotate: (elementId: string, rotationDeg: number) => void;
	/** Commit an inline (on-canvas) SmartArt node edit through the element-update path. */
	handleUpdateSmartArtElement: (elementId: string, updates: Partial<PptxElement>) => void;
	/** Apply a text-style toggle (Ctrl/Cmd+B/I/U) to the element being inline-edited. */
	handleFormatText: (updates: Partial<TextStyle>) => void;
	handleInlineEditCommit: () => void;
}
