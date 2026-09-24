/**
 * Shared types for the useElementManipulation hook and its sub-hooks.
 */
import type { PptxElement, PptxSlide, MergeShapeOperation } from 'pptx-viewer-core';

import type { ElementContextMenuAction } from '../types';
import type { EditorHistoryResult } from './useEditorHistory';
import type { ElementOperations } from './useElementOperations';

export interface UseElementManipulationInput {
	activeSlide: PptxSlide | undefined;
	activeSlideIndex: number;
	selectedElement: PptxElement | null;
	effectiveSelectedIds: string[];
	selectedElements: PptxElement[];
	selectedElementIdSet: Set<string>;
	elementLookup: Map<string, PptxElement>;
	editTemplateMode: boolean;
	/** Slide bounds in px; a lone element aligns against these (Align to Slide). */
	canvasSize?: { width: number; height: number };
	clipboardPayload: { element: PptxElement; isTemplate: boolean } | null;
	setClipboardPayload: React.Dispatch<
		React.SetStateAction<{ element: PptxElement; isTemplate: boolean } | null>
	>;
	setSelectedElementIds: React.Dispatch<React.SetStateAction<string[]>>;
	setIsInspectorPaneOpen: React.Dispatch<React.SetStateAction<boolean>>;
	setSidebarPanelMode: React.Dispatch<React.SetStateAction<string>>;
	ops: ElementOperations;
	history: EditorHistoryResult;
	onOpenHyperlinkDialog: () => void;
	/**
	 * Enter inline text edit for `elementId`, same as double-clicking it.
	 * Wired to `canvasHandlers.handleElementDoubleClick`; omitted (never) in
	 * production, only in tests that do not exercise "Edit Text".
	 */
	onEditText?: (elementId: string) => void;
	/**
	 * Rasterise `elementId`'s own DOM node and download it as PNG ("Save as
	 * Picture"). Lives outside this hook because it needs the binding's
	 * `html2canvasFallback` driver and a DOM lookup, neither of which this
	 * hook otherwise touches.
	 */
	onSaveElementAsPicture?: (elementId: string) => void;
	/**
	 * Notified with the freshly-inserted clone after an ordinary paste, so the
	 * Paste Options mini-toolbar (`usePasteSpecial`) has something to reformat.
	 * Not called for Duplicate: PowerPoint's toolbar only follows a paste.
	 */
	onPasted?: (element: PptxElement) => void;
}

export interface ElementManipulationHandlers {
	handleCopy: () => void;
	handleCut: () => void;
	handlePaste: () => void;
	handleDuplicate: () => void;
	handleGroupElements: () => void;
	handleUngroupElement: () => void;
	handleDelete: () => void;
	handleFlip: (direction: 'horizontal' | 'vertical') => void;
	handleAlignElements: (align: string) => void;
	handleDistributeElements: (axis: string) => void;
	canDistribute: boolean;
	/** Whether every currently selected element allows `a:spLocks/@noGrp` grouping. */
	selectionGroupable: boolean;
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
	handleFlip: (direction: 'horizontal' | 'vertical') => void;
	handleAlignElements: (align: string) => void;
	handleDistributeElements: (axis: string) => void;
	canDistribute: boolean;
	/** Whether every currently selected element allows `a:spLocks/@noGrp` grouping. */
	selectionGroupable: boolean;
	handleMoveLayer: (direction: string) => void;
	handleMoveLayerToEdge: (direction: string) => void;
	handleMergeShapes: (operation: MergeShapeOperation) => void;
	canMergeShapes: boolean;
}
