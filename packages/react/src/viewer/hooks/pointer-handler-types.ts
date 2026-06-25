/**
 * Shared types for the usePointerHandlers hook and its extracted helpers.
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';

import type {
	CanvasSize,
	DragState,
	MarqueeSelectionState,
	ResizeState,
	ShapeAdjustmentDragState,
} from '../types';

export interface UsePointerHandlersInput {
	editorScale: number;
	canvasStageRef: React.RefObject<HTMLDivElement | null>;
	canvasSize: CanvasSize;
	activeSlide: PptxSlide | undefined;
	activeSlideIndex: number;
	gridSpacingPx: number;
	dragStateRef: React.MutableRefObject<DragState | null>;
	resizeStateRef: React.MutableRefObject<ResizeState | null>;
	shapeAdjustmentDragStateRef: React.MutableRefObject<ShapeAdjustmentDragState | null>;
	marqueeStateRef: React.MutableRefObject<MarqueeSelectionState | null>;
	/** When true, pointer commits target the per-slide template store. */
	editTemplateMode: boolean;
	snapToGrid: boolean;
	snapToShape: boolean;
	guides: Array<{ id: string; axis: 'h' | 'v'; position: number }>;
	/** Template (master/layout) elements for the active slide (drag/marquee source while editing templates). */
	templateElements: PptxElement[];
	elementLookup: Map<string, PptxElement>;
	setMarqueeSelectionState: React.Dispatch<React.SetStateAction<MarqueeSelectionState | null>>;
	setSnapLines: React.Dispatch<React.SetStateAction<Array<{ axis: string; position: number }>>>;
	setTemplateElementsBySlideId: React.Dispatch<React.SetStateAction<Record<string, PptxElement[]>>>;
	setPointerCommitNonce: React.Dispatch<React.SetStateAction<number>>;
	effectiveSelectedIds: string[];
	applySelection: (primaryId: string | null, ids?: string[]) => void;
	clearSelection: () => void;
	updateSlides: (updater: (s: PptxSlide[]) => PptxSlide[]) => void;
	updateElementById: (id: string, updates: Partial<PptxElement>) => void;
	markDirty: () => void;
}

/** Mutable tracking state shared between pointer-move and pointer-up helpers. */
export interface PointerFrameTracker {
	rafId: number;
	pendingMoveEvent: PointerEvent | null;
	lastSnapLinesKey: string;
}
