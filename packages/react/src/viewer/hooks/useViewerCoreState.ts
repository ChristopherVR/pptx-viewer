/**
 * useViewerCoreState — Core state declarations for PowerPointViewer.
 *
 * This hook owns every piece of "document-level" React state: slides,
 * elements, selection, canvas dimensions, presentation metadata
 * (masters, theme, sections, custom shows, etc.), and the mutable refs
 * used by pointer-interaction handlers.
 *
 * Derived values (activeSlide, elementLookup, selectedElement, master view
 * elements) are computed by {@link useDerivedElementState} and spread into
 * the return value. Type definitions live in `viewer-core-state-types.ts`.
 * UI panel state lives in {@link useViewerUIState}.
 *
 * @module useViewerCoreState
 */
import { useRef, useState } from "react";

import type {
  PptxAppProperties,
  PptxCoreProperties,
  PptxCustomProperty,
  PptxElement,
  PptxEmbeddedFont,
  PptxHandoutMaster,
  PptxHeaderFooter,
  MasterViewTab,
  PptxNotesMaster,
  PptxSlide,
  PptxSlideMaster,
  PptxTheme,
  PptxThemeOption,
  PptxCustomShow,
  PptxSection,
  PptxPresentationProperties,
  PptxTagCollection,
} from "pptx-viewer-core";
import { DEFAULT_CANVAS_HEIGHT, DEFAULT_CANVAS_WIDTH } from "../constants";
import type {
  CanvasSize,
  DragState,
  ElementClipboardPayload,
  MarqueeSelectionState,
  ResizeState,
  ShapeAdjustmentDragState,
  SupportedShapeType,
} from "../types";
import type { ViewerMode } from "../types-core";
import { useDerivedElementState } from "./useDerivedElementState";
import type {
  UseViewerCoreStateInput,
  ViewerCoreState,
} from "./viewer-core-state-types";

export type {
  UseViewerCoreStateInput,
  ViewerCoreState,
} from "./viewer-core-state-types";

/* ------------------------------------------------------------------ */
/*  Hook                                                              */
/* ------------------------------------------------------------------ */

/**
 * Initializes and returns the core viewer state (refs, useState values,
 * and derived element/master state).
 *
 * @param _input - Content and edit-mode flag (used by upstream wiring; the
 *   hook itself does not consume them directly — they flow through
 *   useContentLifecycle).
 * @returns A {@link ViewerCoreState} object containing every ref, state
 *   value, setter, and derived field.
 */
export function useViewerCoreState(
  _input: UseViewerCoreStateInput,
): ViewerCoreState {
  // ── Refs ──────────────────────────────────────────────────────────
  // Stable refs that persist across renders without causing re-renders.

  /** Root container div — used for ResizeObserver, focus management, and coordinate calculations. */
  const containerRef = useRef<HTMLDivElement>(null);
  /** Hidden file input for image insertion. */
  const imageInputRef = useRef<HTMLInputElement>(null);
  /** Hidden file input for media (audio/video) insertion. */
  const mediaInputRef = useRef<HTMLInputElement>(null);
  /** Mirror of activeSlideIndex for use in event handlers to avoid stale closures. */
  const activeSlideIndexRef = useRef(0);

  // Pointer interaction refs — mutable refs used by pointer-move/up handlers
  // to track ongoing drag, resize, adjustment, and marquee operations without
  // triggering React re-renders on every mousemove event.
  const dragStateRef = useRef<DragState | null>(null);
  const resizeStateRef = useRef<ResizeState | null>(null);
  const shapeAdjustmentDragStateRef = useRef<ShapeAdjustmentDragState | null>(
    null,
  );
  const marqueeStateRef = useRef<MarqueeSelectionState | null>(null);
  const isDrawingRef = useRef(false);

  // ── Core State ────────────────────────────────────────────────────
  const [mode, setMode] = useState<ViewerMode>("edit");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slides, setSlides] = useState<PptxSlide[]>([]);
  const [templateElementsBySlideId, setTemplateElementsBySlideId] = useState<
    Record<string, PptxElement[]>
  >({});
  const [canvasSize, setCanvasSize] = useState<CanvasSize>({
    width: DEFAULT_CANVAS_WIDTH,
    height: DEFAULT_CANVAS_HEIGHT,
  });
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(
    null,
  );
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [inlineEditingElementId, setInlineEditingElementId] = useState<
    string | null
  >(null);
  const [inlineEditingText, setInlineEditingText] = useState("");
  const [editTemplateMode, setEditTemplateMode] = useState(false);
  const [newShapeType, setNewShapeType] = useState<SupportedShapeType>("rect");
  const [clipboardPayload, setClipboardPayload] =
    useState<ElementClipboardPayload | null>(null);
  const [pointerCommitNonce, setPointerCommitNonce] = useState(0);
  const [headerFooter, setHeaderFooter] = useState<PptxHeaderFooter>({});
  const [layoutOptions, setLayoutOptions] = useState<
    Array<{ path: string; name: string }>
  >([]);
  const [slideMasters, setSlideMasters] = useState<PptxSlideMaster[]>([]);
  const [theme, setTheme] = useState<PptxTheme | undefined>();
  const [themeOptions, setThemeOptions] = useState<PptxThemeOption[]>([]);
  const [customShows, setCustomShows] = useState<PptxCustomShow[]>([]);
  const [activeCustomShowId, setActiveCustomShowId] = useState<string | null>(
    null,
  );
  const [sections, setSections] = useState<PptxSection[]>([]);
  const [presentationProperties, setPresentationProperties] =
    useState<PptxPresentationProperties>({});
  const [notesMaster, setNotesMaster] = useState<PptxNotesMaster | undefined>();
  const [handoutMaster, setHandoutMaster] = useState<
    PptxHandoutMaster | undefined
  >();
  const [notesCanvasSize, setNotesCanvasSize] = useState<
    CanvasSize | undefined
  >();
  const [customProperties, setCustomProperties] = useState<
    PptxCustomProperty[]
  >([]);
  const [tagCollections, setTagCollections] = useState<PptxTagCollection[]>([]);
  const [coreProperties, setCoreProperties] = useState<
    PptxCoreProperties | undefined
  >();
  const [appProperties, setAppProperties] = useState<
    PptxAppProperties | undefined
  >();
  const [embeddedFonts, setEmbeddedFonts] = useState<PptxEmbeddedFont[]>([]);
  const [hasMacros, setHasMacros] = useState(false);
  const [hasDigitalSignatures, setHasDigitalSignatures] = useState(false);
  const [digitalSignatureCount, setDigitalSignatureCount] = useState(0);

  // ── Master View State ──────────────────────────────────────────────
  const [activeMasterIndex, setActiveMasterIndex] = useState(0);
  const [activeLayoutIndex, setActiveLayoutIndex] = useState<number | null>(
    null,
  );
  const [preMasterMode, setPreMasterMode] = useState<ViewerMode>("edit");
  const [masterViewTab, setMasterViewTab] = useState<MasterViewTab>("slides");
  const [handoutSlidesPerPage, setHandoutSlidesPerPage] = useState(4);

  // ── Derived State ─────────────────────────────────────────────────
  const derived = useDerivedElementState({
    slides,
    activeSlideIndex,
    templateElementsBySlideId,
    selectedElementId,
    selectedElementIds,
    slideMasters,
    activeMasterIndex,
    activeLayoutIndex,
    notesMaster,
    handoutMaster,
  });

  // ── Return ────────────────────────────────────────────────────────
  return {
    containerRef,
    imageInputRef,
    mediaInputRef,
    activeSlideIndexRef,
    dragStateRef,
    resizeStateRef,
    shapeAdjustmentDragStateRef,
    marqueeStateRef,
    isDrawingRef,
    mode,
    setMode,
    loading,
    setLoading,
    error,
    setError,
    slides,
    setSlides,
    templateElementsBySlideId,
    setTemplateElementsBySlideId,
    canvasSize,
    setCanvasSize,
    activeSlideIndex,
    setActiveSlideIndex,
    selectedElementId,
    setSelectedElementId,
    selectedElementIds,
    setSelectedElementIds,
    isDirty,
    setIsDirty,
    inlineEditingElementId,
    setInlineEditingElementId,
    inlineEditingText,
    setInlineEditingText,
    editTemplateMode,
    setEditTemplateMode,
    newShapeType,
    setNewShapeType,
    clipboardPayload,
    setClipboardPayload,
    pointerCommitNonce,
    setPointerCommitNonce,
    headerFooter,
    setHeaderFooter,
    layoutOptions,
    setLayoutOptions,
    slideMasters,
    setSlideMasters,
    theme,
    setTheme,
    themeOptions,
    setThemeOptions,
    customShows,
    setCustomShows,
    activeCustomShowId,
    setActiveCustomShowId,
    sections,
    setSections,
    presentationProperties,
    setPresentationProperties,
    notesMaster,
    setNotesMaster,
    handoutMaster,
    setHandoutMaster,
    notesCanvasSize,
    setNotesCanvasSize,
    customProperties,
    setCustomProperties,
    tagCollections,
    setTagCollections,
    coreProperties,
    setCoreProperties,
    appProperties,
    setAppProperties,
    embeddedFonts,
    setEmbeddedFonts,
    hasMacros,
    setHasMacros,
    hasDigitalSignatures,
    setHasDigitalSignatures,
    digitalSignatureCount,
    setDigitalSignatureCount,
    activeMasterIndex,
    setActiveMasterIndex,
    activeLayoutIndex,
    setActiveLayoutIndex,
    preMasterMode,
    setPreMasterMode,
    masterViewTab,
    setMasterViewTab,
    handoutSlidesPerPage,
    setHandoutSlidesPerPage,
    ...derived,
  };
}
