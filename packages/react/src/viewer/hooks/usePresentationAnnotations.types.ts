/**
 * Types for presentation annotation state.
 */

export type PresentationTool =
  | "none"
  | "laser"
  | "pen"
  | "highlighter"
  | "eraser";

export interface AnnotationStroke {
  id: string;
  points: Array<{ x: number; y: number }>;
  color: string;
  width: number;
  opacity: number;
}

export interface LaserPosition {
  x: number;
  y: number;
}

/** Annotations grouped by slide index. */
export type SlideAnnotationMap = Map<number, AnnotationStroke[]>;

export interface UsePresentationAnnotationsInput {
  isActive: boolean;
  /** Current slide index — used to track which slide annotations belong to. */
  activeSlideIndex: number;
}

export interface UsePresentationAnnotationsResult {
  presentationTool: PresentationTool;
  setPresentationTool: (tool: PresentationTool) => void;
  penColor: string;
  setPenColor: (color: string) => void;
  highlighterColor: string;
  setHighlighterColor: (color: string) => void;
  annotationStrokes: AnnotationStroke[];
  currentStroke: AnnotationStroke | null;
  laserPosition: LaserPosition | null;
  toolbarVisible: boolean;
  setToolbarVisible: (visible: boolean) => void;
  handlePointerDown: (x: number, y: number) => void;
  handlePointerMove: (x: number, y: number) => void;
  handlePointerUp: () => void;
  handleLaserMove: (x: number, y: number) => void;
  handleLaserLeave: () => void;
  clearAnnotations: () => void;
  eraseAtPoint: (x: number, y: number) => void;
  /** All annotations across all slides (for persistence on exit). */
  allSlideAnnotations: SlideAnnotationMap;
  /** Whether any annotations exist across all slides. */
  hasAnyAnnotations: boolean;
  /** Clear all annotations across all slides. */
  clearAllAnnotations: () => void;
}
