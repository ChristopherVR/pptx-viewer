/**
 * Hook for managing annotation state during presentation mode.
 *
 * Provides pen, highlighter, eraser, and laser pointer tools that
 * overlay the slide canvas. Tracks annotations per-slide so they can
 * optionally be persisted as ink elements after exiting presentation.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AnnotationStroke,
  LaserPosition,
  PresentationTool,
  SlideAnnotationMap,
  UsePresentationAnnotationsInput,
  UsePresentationAnnotationsResult,
} from "./usePresentationAnnotations.types";

export type {
  AnnotationStroke,
  LaserPosition,
  PresentationTool,
  SlideAnnotationMap,
  UsePresentationAnnotationsInput,
  UsePresentationAnnotationsResult,
}; // ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PEN_WIDTH = 2.5;
const HIGHLIGHTER_WIDTH = 14;
const HIGHLIGHTER_OPACITY = 0.4;
const ERASER_RADIUS = 16;

let strokeIdCounter = 0;
function nextStrokeId(): string {
  strokeIdCounter += 1;
  return `stroke-${strokeIdCounter}`;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function usePresentationAnnotations(
  input: UsePresentationAnnotationsInput,
): UsePresentationAnnotationsResult {
  const { isActive, activeSlideIndex } = input;

  const [presentationTool, setPresentationToolState] =
    useState<PresentationTool>("none");
  const [penColor, setPenColor] = useState("#ff0000");
  const [highlighterColor, setHighlighterColor] = useState("#ffff00");
  const [currentStroke, setCurrentStroke] = useState<AnnotationStroke | null>(
    null,
  );
  const [laserPosition, setLaserPosition] = useState<LaserPosition | null>(
    null,
  );
  const [toolbarVisible, setToolbarVisible] = useState(false);

  // Per-slide annotation storage
  const slideAnnotationsRef = useRef<SlideAnnotationMap>(new Map());
  const [annotationStrokes, setAnnotationStrokes] = useState<
    AnnotationStroke[]
  >([]);
  // Counter to force re-derive hasAnyAnnotations
  const [annotationVersion, setAnnotationVersion] = useState(0);

  const isDrawingRef = useRef(false);
  const activeSlideIndexRef = useRef(activeSlideIndex);
  activeSlideIndexRef.current = activeSlideIndex;

  // When the active slide changes during presentation, save current slide's
  // strokes and load the new slide's strokes.
  const prevSlideIndexRef = useRef(activeSlideIndex);
  useEffect(() => {
    if (!isActive) return;
    if (prevSlideIndexRef.current === activeSlideIndex) return;

    // Save current strokes for previous slide
    setAnnotationStrokes((currentStrokes) => {
      if (currentStrokes.length > 0) {
        slideAnnotationsRef.current.set(
          prevSlideIndexRef.current,
          currentStrokes,
        );
      } else {
        slideAnnotationsRef.current.delete(prevSlideIndexRef.current);
      }
      setAnnotationVersion((v) => v + 1);
      // Load strokes for new slide
      return slideAnnotationsRef.current.get(activeSlideIndex) ?? [];
    });

    prevSlideIndexRef.current = activeSlideIndex;
  }, [isActive, activeSlideIndex]);

  const setPresentationTool = useCallback(
    (tool: PresentationTool) => {
      if (!isActive) return;
      setPresentationToolState((prev) => (prev === tool ? "none" : tool));
    },
    [isActive],
  );

  // -------------------------------------------------------------------
  // Drawing handlers
  // -------------------------------------------------------------------

  const handlePointerDown = useCallback(
    (x: number, y: number) => {
      if (!isActive) return;
      if (presentationTool === "pen" || presentationTool === "highlighter") {
        isDrawingRef.current = true;
        const isPen = presentationTool === "pen";
        setCurrentStroke({
          id: nextStrokeId(),
          points: [{ x, y }],
          color: isPen ? penColor : highlighterColor,
          width: isPen ? PEN_WIDTH : HIGHLIGHTER_WIDTH,
          opacity: isPen ? 1 : HIGHLIGHTER_OPACITY,
        });
      }
    },
    [isActive, presentationTool, penColor, highlighterColor],
  );

  const handlePointerMove = useCallback(
    (x: number, y: number) => {
      if (!isActive || !isDrawingRef.current) return;
      setCurrentStroke((prev) => {
        if (!prev) return null;
        return { ...prev, points: [...prev.points, { x, y }] };
      });
    },
    [isActive],
  );

  const handlePointerUp = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    setCurrentStroke((prev) => {
      if (prev && prev.points.length > 1) {
        setAnnotationStrokes((strokes) => {
          // Guard against React Strict Mode double-invocation of updaters
          if (strokes.some((s) => s.id === prev.id)) return strokes;
          const updated = [...strokes, prev];
          // Also update the per-slide map
          slideAnnotationsRef.current.set(activeSlideIndexRef.current, updated);
          setAnnotationVersion((v) => v + 1);
          return updated;
        });
      }
      return null;
    });
  }, []);

  // -------------------------------------------------------------------
  // Laser handlers
  // -------------------------------------------------------------------

  const handleLaserMove = useCallback(
    (x: number, y: number) => {
      if (!isActive || presentationTool !== "laser") return;
      setLaserPosition({ x, y });
    },
    [isActive, presentationTool],
  );

  const handleLaserLeave = useCallback(() => {
    setLaserPosition(null);
  }, []);

  // -------------------------------------------------------------------
  // Eraser
  // -------------------------------------------------------------------

  const eraseAtPoint = useCallback(
    (x: number, y: number) => {
      if (!isActive || presentationTool !== "eraser") return;
      setAnnotationStrokes((strokes) => {
        const filtered = strokes.filter((stroke) => {
          return !stroke.points.some((pt) => {
            const dx = pt.x - x;
            const dy = pt.y - y;
            return dx * dx + dy * dy < ERASER_RADIUS * ERASER_RADIUS;
          });
        });
        // Update per-slide map
        if (filtered.length > 0) {
          slideAnnotationsRef.current.set(
            activeSlideIndexRef.current,
            filtered,
          );
        } else {
          slideAnnotationsRef.current.delete(activeSlideIndexRef.current);
        }
        setAnnotationVersion((v) => v + 1);
        return filtered;
      });
    },
    [isActive, presentationTool],
  );

  // -------------------------------------------------------------------
  // Clear current slide annotations
  // -------------------------------------------------------------------

  const clearAnnotations = useCallback(() => {
    setAnnotationStrokes([]);
    setCurrentStroke(null);
    isDrawingRef.current = false;
    slideAnnotationsRef.current.delete(activeSlideIndexRef.current);
    setAnnotationVersion((v) => v + 1);
  }, []);

  // -------------------------------------------------------------------
  // Clear all annotations across all slides
  // -------------------------------------------------------------------

  const clearAllAnnotations = useCallback(() => {
    setAnnotationStrokes([]);
    setCurrentStroke(null);
    isDrawingRef.current = false;
    slideAnnotationsRef.current.clear();
    setAnnotationVersion((v) => v + 1);
  }, []);

  // -------------------------------------------------------------------
  // Auto-show toolbar on mouse move, hide after 3s
  // -------------------------------------------------------------------

  const toolbarTimerRef = useRef<number>(0);

  useEffect(() => {
    if (!isActive) {
      setToolbarVisible(false);
      setPresentationToolState("none");
      setCurrentStroke(null);
      setLaserPosition(null);
      // Note: We do NOT clear annotations here — they persist until the
      // user decides to keep or discard them via the dialog.
      return;
    }

    const handleMouseMove = () => {
      setToolbarVisible(true);
      window.clearTimeout(toolbarTimerRef.current);
      toolbarTimerRef.current = window.setTimeout(() => {
        setToolbarVisible(false);
      }, 3000);
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.clearTimeout(toolbarTimerRef.current);
    };
  }, [isActive]);

  // Snapshot current strokes into the map before returning allSlideAnnotations
  // so the caller always gets the latest view.
  const getAllSlideAnnotations = useCallback((): SlideAnnotationMap => {
    // Ensure current slide's strokes are stored
    const map = new Map(slideAnnotationsRef.current);
    if (annotationStrokes.length > 0) {
      map.set(activeSlideIndex, annotationStrokes);
    }
    return map;
  }, [annotationStrokes, activeSlideIndex]);

  const hasAnyAnnotations =
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    annotationVersion >= 0 &&
    (annotationStrokes.length > 0 || slideAnnotationsRef.current.size > 0);

  return {
    presentationTool,
    setPresentationTool,
    penColor,
    setPenColor,
    highlighterColor,
    setHighlighterColor,
    annotationStrokes,
    currentStroke,
    laserPosition,
    toolbarVisible,
    setToolbarVisible,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleLaserMove,
    handleLaserLeave,
    clearAnnotations,
    eraseAtPoint,
    allSlideAnnotations: getAllSlideAnnotations(),
    hasAnyAnnotations,
    clearAllAnnotations,
  };
}
