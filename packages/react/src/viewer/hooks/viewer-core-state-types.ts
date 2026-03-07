/**
 * Type definitions for the useViewerCoreState hook.
 *
 * Extracted to keep the main hook file under the 300-line limit.
 * These types describe the shape of the core viewer state: the primary
 * refs, state values, setters, and derived fields that together form
 * the foundation every other hook in the viewer depends upon.
 *
 * @module viewer-core-state-types
 */
import type React from "react";

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
  PptxSlideLayout,
  PptxSlideMaster,
  PptxTheme,
  PptxThemeOption,
  PptxCustomShow,
  PptxSection,
  PptxPresentationProperties,
  PptxTagCollection,
} from "pptx-viewer-core";
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

/* ------------------------------------------------------------------ */
/*  Input                                                             */
/* ------------------------------------------------------------------ */

/**
 * Input parameters for the {@link useViewerCoreState} hook.
 *
 * @property content - Raw binary content of the PPTX file to load. `null`/`undefined` when no file is loaded yet.
 * @property canEdit - Whether the viewer allows editing operations (false for read-only mode).
 */
export interface UseViewerCoreStateInput {
  content: ArrayBuffer | Uint8Array | null | undefined;
  canEdit: boolean;
}

/* ------------------------------------------------------------------ */
/*  Output                                                            */
/* ------------------------------------------------------------------ */

/**
 * The full output shape of {@link useViewerCoreState}.
 *
 * This interface exposes every ref, state value, setter, and derived field
 * that comprises the core viewer state. It is merged with {@link ViewerUIState}
 * inside {@link useViewerState} to produce the unified {@link ViewerState}.
 */
export interface ViewerCoreState {
  // ── Refs ──────────────────────────────────────────────────────────

  /** Ref to the outermost container `<div>` wrapping the viewer. */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Hidden `<input type="file">` used to trigger image file selection. */
  imageInputRef: React.RefObject<HTMLInputElement | null>;
  /** Hidden `<input type="file">` used to trigger audio/video file selection. */
  mediaInputRef: React.RefObject<HTMLInputElement | null>;
  /** Mutable ref mirroring `activeSlideIndex` for use in event handlers that must not re-subscribe on index change. */
  activeSlideIndexRef: React.MutableRefObject<number>;
  /** Tracks the in-progress drag operation (move) for element(s). */
  dragStateRef: React.MutableRefObject<DragState | null>;
  /** Tracks the in-progress resize operation for an element. */
  resizeStateRef: React.MutableRefObject<ResizeState | null>;
  /** Tracks the in-progress shape adjustment handle drag. */
  shapeAdjustmentDragStateRef: React.MutableRefObject<ShapeAdjustmentDragState | null>;
  /** Tracks the in-progress marquee (lasso) selection rectangle. */
  marqueeStateRef: React.MutableRefObject<MarqueeSelectionState | null>;
  /** Whether the user is currently performing a freeform drawing stroke. */
  isDrawingRef: React.MutableRefObject<boolean>;

  // ── Core State ────────────────────────────────────────────────────

  /** Current viewer mode (edit, view, present, master, etc.). */
  mode: ViewerMode;
  setMode: React.Dispatch<React.SetStateAction<ViewerMode>>;
  /** Whether the presentation content is currently being loaded/parsed. */
  loading: boolean;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  /** Non-null when an error occurred during loading or processing. */
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  /** The ordered array of all slides in the presentation. */
  slides: PptxSlide[];
  setSlides: React.Dispatch<React.SetStateAction<PptxSlide[]>>;
  /** Layout/master placeholder elements keyed by slide id, used for template rendering. */
  templateElementsBySlideId: Record<string, PptxElement[]>;
  setTemplateElementsBySlideId: React.Dispatch<
    React.SetStateAction<Record<string, PptxElement[]>>
  >;
  /** Width and height of the slide canvas in CSS pixels. */
  canvasSize: CanvasSize;
  setCanvasSize: React.Dispatch<React.SetStateAction<CanvasSize>>;
  /** Zero-based index of the currently active (visible) slide. */
  activeSlideIndex: number;
  setActiveSlideIndex: React.Dispatch<React.SetStateAction<number>>;
  /** ID of the single primarily-selected element (null when nothing is selected). */
  selectedElementId: string | null;
  setSelectedElementId: React.Dispatch<React.SetStateAction<string | null>>;
  /** IDs for multi-selection (non-empty when multiple elements are selected). */
  selectedElementIds: string[];
  setSelectedElementIds: React.Dispatch<React.SetStateAction<string[]>>;
  /** Whether unsaved changes exist in the presentation. */
  isDirty: boolean;
  setIsDirty: React.Dispatch<React.SetStateAction<boolean>>;
  /** ID of the element whose text is currently being edited inline on the canvas. */
  inlineEditingElementId: string | null;
  setInlineEditingElementId: React.Dispatch<
    React.SetStateAction<string | null>
  >;
  /** The current inline-editing text content (mirrored from the editor). */
  inlineEditingText: string;
  setInlineEditingText: React.Dispatch<React.SetStateAction<string>>;
  /** Whether the user is editing template/layout elements rather than slide elements. */
  editTemplateMode: boolean;
  setEditTemplateMode: React.Dispatch<React.SetStateAction<boolean>>;
  /** The shape type to use when the user draws the next new shape. */
  newShapeType: SupportedShapeType;
  setNewShapeType: React.Dispatch<React.SetStateAction<SupportedShapeType>>;
  /** In-memory clipboard payload for internal copy/paste of elements. */
  clipboardPayload: ElementClipboardPayload | null;
  setClipboardPayload: React.Dispatch<
    React.SetStateAction<ElementClipboardPayload | null>
  >;
  /** Monotonically-increasing nonce bumped after each pointer commit to trigger re-renders. */
  pointerCommitNonce: number;
  setPointerCommitNonce: React.Dispatch<React.SetStateAction<number>>;
  /** Header/footer configuration for the presentation. */
  headerFooter: PptxHeaderFooter;
  setHeaderFooter: React.Dispatch<React.SetStateAction<PptxHeaderFooter>>;
  /** Available slide layout options (path + display name). */
  layoutOptions: Array<{ path: string; name: string }>;
  setLayoutOptions: React.Dispatch<
    React.SetStateAction<Array<{ path: string; name: string }>>
  >;
  /** All slide masters parsed from the presentation. */
  slideMasters: PptxSlideMaster[];
  setSlideMasters: React.Dispatch<React.SetStateAction<PptxSlideMaster[]>>;
  /** The currently active theme applied to the presentation. */
  theme: PptxTheme | undefined;
  setTheme: React.Dispatch<React.SetStateAction<PptxTheme | undefined>>;
  /** Available theme presets the user can switch between. */
  themeOptions: PptxThemeOption[];
  setThemeOptions: React.Dispatch<React.SetStateAction<PptxThemeOption[]>>;
  /** Custom slide shows defined in the presentation. */
  customShows: PptxCustomShow[];
  setCustomShows: React.Dispatch<React.SetStateAction<PptxCustomShow[]>>;
  /** ID of the currently active custom show, or null for normal show. */
  activeCustomShowId: string | null;
  setActiveCustomShowId: React.Dispatch<React.SetStateAction<string | null>>;
  /** Slide sections for organizational grouping. */
  sections: PptxSection[];
  setSections: React.Dispatch<React.SetStateAction<PptxSection[]>>;
  /** Presentation-level properties (loop, show type, subtitles, etc.). */
  presentationProperties: PptxPresentationProperties;
  setPresentationProperties: React.Dispatch<
    React.SetStateAction<PptxPresentationProperties>
  >;
  /** Notes master slide definition (background, elements, styles). */
  notesMaster: PptxNotesMaster | undefined;
  setNotesMaster: React.Dispatch<
    React.SetStateAction<PptxNotesMaster | undefined>
  >;
  /** Handout master definition for print handout layouts. */
  handoutMaster: PptxHandoutMaster | undefined;
  setHandoutMaster: React.Dispatch<
    React.SetStateAction<PptxHandoutMaster | undefined>
  >;
  /** Canvas dimensions for the notes page view (may differ from slide canvas). */
  notesCanvasSize: CanvasSize | undefined;
  setNotesCanvasSize: React.Dispatch<
    React.SetStateAction<CanvasSize | undefined>
  >;
  /** User-defined custom document properties. */
  customProperties: PptxCustomProperty[];
  setCustomProperties: React.Dispatch<
    React.SetStateAction<PptxCustomProperty[]>
  >;
  /** Tag collections associated with slides or elements. */
  tagCollections: PptxTagCollection[];
  setTagCollections: React.Dispatch<React.SetStateAction<PptxTagCollection[]>>;
  /** OPC core properties (title, author, created date, etc.). */
  coreProperties: PptxCoreProperties | undefined;
  setCoreProperties: React.Dispatch<
    React.SetStateAction<PptxCoreProperties | undefined>
  >;
  /** Application-level properties (company, version, etc.). */
  appProperties: PptxAppProperties | undefined;
  setAppProperties: React.Dispatch<
    React.SetStateAction<PptxAppProperties | undefined>
  >;
  /** Fonts embedded within the PPTX file. */
  embeddedFonts: PptxEmbeddedFont[];
  setEmbeddedFonts: React.Dispatch<React.SetStateAction<PptxEmbeddedFont[]>>;
  /** Whether the loaded presentation contains VBA macros. */
  hasMacros: boolean;
  setHasMacros: React.Dispatch<React.SetStateAction<boolean>>;
  /** Whether the loaded presentation contains digital signatures. */
  hasDigitalSignatures: boolean;
  setHasDigitalSignatures: React.Dispatch<React.SetStateAction<boolean>>;
  /** Number of digital signatures detected. */
  digitalSignatureCount: number;
  setDigitalSignatureCount: React.Dispatch<React.SetStateAction<number>>;

  // ── Master View State ──────────────────────────────────────────────

  /** Zero-based index of the selected slide master in master view. */
  activeMasterIndex: number;
  setActiveMasterIndex: React.Dispatch<React.SetStateAction<number>>;
  /** Index of the selected layout within the active master, or null when viewing the master itself. */
  activeLayoutIndex: number | null;
  setActiveLayoutIndex: React.Dispatch<React.SetStateAction<number | null>>;
  /** The mode the viewer was in before entering master view (to restore on close). */
  preMasterMode: ViewerMode;
  setPreMasterMode: React.Dispatch<React.SetStateAction<ViewerMode>>;
  /** Active tab within the master view: slides (default), notes, or handout. */
  masterViewTab: MasterViewTab;
  setMasterViewTab: React.Dispatch<React.SetStateAction<MasterViewTab>>;
  /** Handout slides-per-page setting (1, 2, 3, 4, 6, or 9). */
  handoutSlidesPerPage: number;
  setHandoutSlidesPerPage: React.Dispatch<React.SetStateAction<number>>;

  // ── Derived State ─────────────────────────────────────────────────
  // These fields are computed by useDerivedElementState and spread
  // into the core state for convenience.

  /** The slide object at `activeSlideIndex`, or undefined if out of bounds. */
  activeSlide: PptxSlide | undefined;
  /** Template (layout/master placeholder) elements for the active slide. */
  templateElements: PptxElement[];
  /** Fast id-to-element lookup map covering both slide and template elements. */
  elementLookup: Map<string, PptxElement>;
  /** The single primarily-selected element, resolved from `selectedElementId`. */
  selectedElement: PptxElement | null;
  /** Union of `selectedElementIds` and `selectedElementId` — the canonical list of selected ids. */
  effectiveSelectedIds: string[];
  /** Set form of `effectiveSelectedIds` for O(1) membership checks. */
  selectedElementIdSet: Set<string>;
  /** Resolved element objects for all selected ids. */
  selectedElements: PptxElement[];
  /** The currently active master in master view. */
  activeMaster: PptxSlideMaster | undefined;
  /** The currently active layout in master view. */
  activeLayout: PptxSlideLayout | undefined;
  /** Elements for the currently active master or layout in master view. */
  masterViewElements: PptxElement[];
  /** Elements for the notes master (when notes tab is active). */
  notesMasterElements: PptxElement[];
  /** Elements for the handout master (when handout tab is active). */
  handoutMasterElements: PptxElement[];
}
