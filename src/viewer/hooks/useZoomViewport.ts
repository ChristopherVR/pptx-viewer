import { useRef, useState, useMemo, useCallback, useEffect } from "react";

import type { PptxElement } from "../../core";
import type { CanvasSize } from "../types";
import {
  MIN_ZOOM_SCALE,
  MAX_ZOOM_SCALE,
  MIN_ELEMENT_SIZE,
  ZOOM_TO_SELECTION_PADDING,
} from "../constants";

/** Axis-aligned bounding box used by zoom / viewport helpers. */
interface SelectionBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface UseZoomViewportInput {
  canvasSize: CanvasSize;
  selectedElements: PptxElement[];
}

export interface UseZoomViewportResult {
  // Refs
  editWrapperRef: React.RefObject<HTMLDivElement | null>;
  canvasStageRef: React.RefObject<HTMLDivElement | null>;
  canvasViewportRef: React.RefObject<HTMLDivElement | null>;
  renderScaleRef: React.MutableRefObject<number>;
  // State
  scale: number;
  setScale: (scale: number) => void;
  editorDimensions: CanvasSize | null;
  setEditorDimensions: (dims: CanvasSize | null) => void;
  // Derived
  fitScale: number;
  editorScale: number;
  // Actions
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleResetZoom: () => void;
  handleZoomToFit: () => void;
  handleZoomToSelection: () => void;
  handleWheel: (e: WheelEvent) => void;
  centerBoundsInViewport: (bounds: SelectionBounds, nextScale: number) => void;
  getCanvasPointFromClient: (
    clientX: number,
    clientY: number,
  ) => { x: number; y: number } | null;
}

export function useZoomViewport({
  canvasSize,
  selectedElements,
}: UseZoomViewportInput): UseZoomViewportResult {
  // ── Refs ──────────────────────────────────────────────────────────────
  const editWrapperRef = useRef<HTMLDivElement>(null);
  const canvasStageRef = useRef<HTMLDivElement>(null);
  const canvasViewportRef = useRef<HTMLDivElement>(null);
  const renderScaleRef = useRef(1);

  // ── State ─────────────────────────────────────────────────────────────
  const [scale, setScale] = useState(1);
  const [editorDimensions, setEditorDimensions] = useState<CanvasSize | null>(
    null,
  );

  // ── Derived ───────────────────────────────────────────────────────────
  const effectiveEditorDimensions = editorDimensions || {
    width: canvasSize.width,
    height: canvasSize.height,
  };

  const fitScale = useMemo(() => {
    if (!effectiveEditorDimensions.width || !effectiveEditorDimensions.height) {
      return 1;
    }
    const widthScale = effectiveEditorDimensions.width / canvasSize.width;
    const heightScale = effectiveEditorDimensions.height / canvasSize.height;
    return Math.min(widthScale, heightScale, 1);
  }, [effectiveEditorDimensions, canvasSize]);

  const editorScale = fitScale * scale;

  // Keep the mutable ref in sync so imperative code has the latest value.
  useEffect(() => {
    renderScaleRef.current = editorScale;
  }, [editorScale]);

  // ── Actions ───────────────────────────────────────────────────────────

  const centerBoundsInViewport = useCallback(
    (bounds: SelectionBounds, nextScale: number) => {
      const wrapper = editWrapperRef.current;
      const canvasViewport = canvasViewportRef.current;
      if (!wrapper || !canvasViewport) return;

      const boundedScale = Math.min(
        Math.max(nextScale, MIN_ZOOM_SCALE),
        MAX_ZOOM_SCALE,
      );
      const nextEditorScale = fitScale * boundedScale;
      const centerX = (bounds.minX + bounds.maxX) / 2;
      const centerY = (bounds.minY + bounds.maxY) / 2;
      const targetScrollLeft =
        canvasViewport.offsetLeft +
        centerX * nextEditorScale -
        wrapper.clientWidth / 2;
      const targetScrollTop =
        canvasViewport.offsetTop +
        centerY * nextEditorScale -
        wrapper.clientHeight / 2;

      wrapper.scrollTo({
        left: Math.max(targetScrollLeft, 0),
        top: Math.max(targetScrollTop, 0),
        behavior: "smooth",
      });
    },
    [fitScale],
  );

  const handleZoomIn = useCallback(() => {
    setScale((currentScale) => Math.min(currentScale + 0.1, MAX_ZOOM_SCALE));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((currentScale) => Math.max(currentScale - 0.1, MIN_ZOOM_SCALE));
  }, []);

  const handleResetZoom = useCallback(() => {
    setScale(1);
  }, []);

  const handleZoomToFit = useCallback(() => {
    setScale(1);
  }, []);

  const handleZoomToSelection = useCallback(() => {
    if (selectedElements.length === 0) return;

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    selectedElements.forEach((element) => {
      minX = Math.min(minX, element.x);
      minY = Math.min(minY, element.y);
      maxX = Math.max(
        maxX,
        element.x + Math.max(element.width, MIN_ELEMENT_SIZE),
      );
      maxY = Math.max(
        maxY,
        element.y + Math.max(element.height, MIN_ELEMENT_SIZE),
      );
    });

    if (
      !Number.isFinite(minX) ||
      !Number.isFinite(minY) ||
      !Number.isFinite(maxX) ||
      !Number.isFinite(maxY)
    ) {
      return;
    }

    const selectionBounds: SelectionBounds = { minX, minY, maxX, maxY };

    const boundsWidth = Math.max(
      selectionBounds.maxX - selectionBounds.minX,
      MIN_ELEMENT_SIZE,
    );
    const boundsHeight = Math.max(
      selectionBounds.maxY - selectionBounds.minY,
      MIN_ELEMENT_SIZE,
    );
    const availableWidth = Math.max(
      effectiveEditorDimensions.width - ZOOM_TO_SELECTION_PADDING,
      MIN_ELEMENT_SIZE,
    );
    const availableHeight = Math.max(
      effectiveEditorDimensions.height - ZOOM_TO_SELECTION_PADDING,
      MIN_ELEMENT_SIZE,
    );
    const targetEditorScale = Math.min(
      availableWidth / boundsWidth,
      availableHeight / boundsHeight,
    );
    const safeFitScale = fitScale > Number.EPSILON ? fitScale : Number.EPSILON;
    const nextScale = Math.min(
      Math.max(targetEditorScale / safeFitScale, MIN_ZOOM_SCALE),
      MAX_ZOOM_SCALE,
    );

    setScale(nextScale);

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        centerBoundsInViewport(selectionBounds, nextScale);
      });
    });
  }, [
    centerBoundsInViewport,
    effectiveEditorDimensions.height,
    effectiveEditorDimensions.width,
    fitScale,
    selectedElements,
  ]);

  const handleWheel = useCallback((event: WheelEvent) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    const delta = event.deltaY * -0.001;
    setScale((currentScale) =>
      Math.min(Math.max(currentScale + delta, MIN_ZOOM_SCALE), MAX_ZOOM_SCALE),
    );
  }, []);

  // Attach the wheel listener natively with { passive: false } so that
  // preventDefault() works. React's onWheel is passive since React 17+.
  useEffect(() => {
    const viewport = canvasViewportRef.current;
    if (!viewport) return;
    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      viewport.removeEventListener("wheel", handleWheel);
    };
  }, [handleWheel]);

  const getCanvasPointFromClient = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const canvasStage = canvasStageRef.current;
      if (!canvasStage) return null;

      const rect = canvasStage.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      const x = (clientX - rect.left) / editorScale;
      const y = (clientY - rect.top) / editorScale;
      return {
        x: Math.max(0, Math.min(canvasSize.width, x)),
        y: Math.max(0, Math.min(canvasSize.height, y)),
      };
    },
    [canvasSize.height, canvasSize.width, editorScale],
  );

  // ── Return ────────────────────────────────────────────────────────────
  return {
    editWrapperRef,
    canvasStageRef,
    canvasViewportRef,
    renderScaleRef,
    scale,
    setScale,
    editorDimensions,
    setEditorDimensions,
    fitScale,
    editorScale,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handleZoomToFit,
    handleZoomToSelection,
    handleWheel,
    centerBoundsInViewport,
    getCanvasPointFromClient,
  };
}
