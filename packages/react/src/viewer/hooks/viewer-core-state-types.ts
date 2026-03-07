/**
 * Type definitions for the useViewerCoreState hook.
 *
 * Extracted to keep the main hook file under the 300-line limit.
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

export interface UseViewerCoreStateInput {
  content: ArrayBuffer | Uint8Array | null | undefined;
  canEdit: boolean;
}

/* ------------------------------------------------------------------ */
/*  Output                                                            */
/* ------------------------------------------------------------------ */

export interface ViewerCoreState {
  // ── Refs ──────────────────────────────────────────────────────────
  containerRef: React.RefObject<HTMLDivElement | null>;
  imageInputRef: React.RefObject<HTMLInputElement | null>;
  mediaInputRef: React.RefObject<HTMLInputElement | null>;
  activeSlideIndexRef: React.MutableRefObject<number>;
  dragStateRef: React.MutableRefObject<DragState | null>;
  resizeStateRef: React.MutableRefObject<ResizeState | null>;
  shapeAdjustmentDragStateRef: React.MutableRefObject<ShapeAdjustmentDragState | null>;
  marqueeStateRef: React.MutableRefObject<MarqueeSelectionState | null>;
  isDrawingRef: React.MutableRefObject<boolean>;

  // ── Core State ────────────────────────────────────────────────────
  mode: ViewerMode;
  setMode: React.Dispatch<React.SetStateAction<ViewerMode>>;
  loading: boolean;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  slides: PptxSlide[];
  setSlides: React.Dispatch<React.SetStateAction<PptxSlide[]>>;
  templateElementsBySlideId: Record<string, PptxElement[]>;
  setTemplateElementsBySlideId: React.Dispatch<
    React.SetStateAction<Record<string, PptxElement[]>>
  >;
  canvasSize: CanvasSize;
  setCanvasSize: React.Dispatch<React.SetStateAction<CanvasSize>>;
  activeSlideIndex: number;
  setActiveSlideIndex: React.Dispatch<React.SetStateAction<number>>;
  selectedElementId: string | null;
  setSelectedElementId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedElementIds: string[];
  setSelectedElementIds: React.Dispatch<React.SetStateAction<string[]>>;
  isDirty: boolean;
  setIsDirty: React.Dispatch<React.SetStateAction<boolean>>;
  inlineEditingElementId: string | null;
  setInlineEditingElementId: React.Dispatch<
    React.SetStateAction<string | null>
  >;
  inlineEditingText: string;
  setInlineEditingText: React.Dispatch<React.SetStateAction<string>>;
  editTemplateMode: boolean;
  setEditTemplateMode: React.Dispatch<React.SetStateAction<boolean>>;
  newShapeType: SupportedShapeType;
  setNewShapeType: React.Dispatch<React.SetStateAction<SupportedShapeType>>;
  clipboardPayload: ElementClipboardPayload | null;
  setClipboardPayload: React.Dispatch<
    React.SetStateAction<ElementClipboardPayload | null>
  >;
  pointerCommitNonce: number;
  setPointerCommitNonce: React.Dispatch<React.SetStateAction<number>>;
  headerFooter: PptxHeaderFooter;
  setHeaderFooter: React.Dispatch<React.SetStateAction<PptxHeaderFooter>>;
  layoutOptions: Array<{ path: string; name: string }>;
  setLayoutOptions: React.Dispatch<
    React.SetStateAction<Array<{ path: string; name: string }>>
  >;
  slideMasters: PptxSlideMaster[];
  setSlideMasters: React.Dispatch<React.SetStateAction<PptxSlideMaster[]>>;
  theme: PptxTheme | undefined;
  setTheme: React.Dispatch<React.SetStateAction<PptxTheme | undefined>>;
  themeOptions: PptxThemeOption[];
  setThemeOptions: React.Dispatch<React.SetStateAction<PptxThemeOption[]>>;
  customShows: PptxCustomShow[];
  setCustomShows: React.Dispatch<React.SetStateAction<PptxCustomShow[]>>;
  activeCustomShowId: string | null;
  setActiveCustomShowId: React.Dispatch<React.SetStateAction<string | null>>;
  sections: PptxSection[];
  setSections: React.Dispatch<React.SetStateAction<PptxSection[]>>;
  presentationProperties: PptxPresentationProperties;
  setPresentationProperties: React.Dispatch<
    React.SetStateAction<PptxPresentationProperties>
  >;
  notesMaster: PptxNotesMaster | undefined;
  setNotesMaster: React.Dispatch<
    React.SetStateAction<PptxNotesMaster | undefined>
  >;
  handoutMaster: PptxHandoutMaster | undefined;
  setHandoutMaster: React.Dispatch<
    React.SetStateAction<PptxHandoutMaster | undefined>
  >;
  notesCanvasSize: CanvasSize | undefined;
  setNotesCanvasSize: React.Dispatch<
    React.SetStateAction<CanvasSize | undefined>
  >;
  customProperties: PptxCustomProperty[];
  setCustomProperties: React.Dispatch<
    React.SetStateAction<PptxCustomProperty[]>
  >;
  tagCollections: PptxTagCollection[];
  setTagCollections: React.Dispatch<React.SetStateAction<PptxTagCollection[]>>;
  coreProperties: PptxCoreProperties | undefined;
  setCoreProperties: React.Dispatch<
    React.SetStateAction<PptxCoreProperties | undefined>
  >;
  appProperties: PptxAppProperties | undefined;
  setAppProperties: React.Dispatch<
    React.SetStateAction<PptxAppProperties | undefined>
  >;
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
  activeMasterIndex: number;
  setActiveMasterIndex: React.Dispatch<React.SetStateAction<number>>;
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
  activeSlide: PptxSlide | undefined;
  templateElements: PptxElement[];
  elementLookup: Map<string, PptxElement>;
  selectedElement: PptxElement | null;
  effectiveSelectedIds: string[];
  selectedElementIdSet: Set<string>;
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
