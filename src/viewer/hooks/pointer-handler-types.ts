/**
 * Shared types for the usePointerHandlers hook and its extracted helpers.
 */
import type { PptxElement, PptxSlide } from "../../core";
import type {
  CanvasSize,
  DragState,
  MarqueeSelectionState,
  ResizeState,
  ShapeAdjustmentDragState,
} from "../types";

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
  editTemplateMode: boolean;
  snapToGrid: boolean;
  snapToShape: boolean;
  guides: Array<{ id: string; axis: "h" | "v"; position: number }>;
  templateElements: PptxElement[];
  elementLookup: Map<string, PptxElement>;
  setMarqueeSelectionState: React.Dispatch<
    React.SetStateAction<MarqueeSelectionState | null>
  >;
  setSnapLines: React.Dispatch<
    React.SetStateAction<Array<{ axis: string; position: number }>>
  >;
  setTemplateElementsBySlideId: React.Dispatch<
    React.SetStateAction<Record<string, PptxElement[]>>
  >;
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
