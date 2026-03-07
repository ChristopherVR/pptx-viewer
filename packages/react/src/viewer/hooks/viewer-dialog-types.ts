/**
 * Types for the {@link useViewerDialogs} hook.
 *
 * Describes the input dependencies and the output shape for all dialog-related
 * state and handlers in the viewer (SmartArt, equation editor, master view,
 * custom shows, password protection, accessibility checks, etc.).
 *
 * @module viewer-dialog-types
 */
import type {
  PptxSlide,
  PptxPresentationProperties,
} from "pptx-viewer-core";
import type { ViewerMode } from "../types-core";
import type { CanvasSize } from "../types";
import type { EditorHistoryResult } from "./useEditorHistory";

/**
 * Input dependencies required by the {@link useViewerDialogs} hook.
 *
 * Collects references to core state, setters, and the editor history
 * so the hook can manage dialog visibility, master view transitions,
 * guide creation, custom show CRUD, and accessibility checking.
 */
export interface UseViewerDialogsInput {
  /** Current viewer mode (edit, view, present, master). */
  mode: ViewerMode;
  /** All slides in the presentation. */
  slides: PptxSlide[];
  /** The currently active slide, or undefined. */
  activeSlide: PptxSlide | undefined;
  /** Zero-based index of the active slide. */
  activeSlideIndex: number;
  /** Slide canvas dimensions (used for guide positioning). */
  canvasSize: CanvasSize;
  /** Ref to the container element (used for viewport width detection). */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Custom shows defined in the presentation. */
  customShows: Array<{ id: string; name: string; slideRIds: string[] }>;
  /** ID of the currently active custom show. */
  activeCustomShowId: string | null;
  /** Setter for custom shows. */
  setCustomShows: React.Dispatch<
    React.SetStateAction<
      Array<{ id: string; name: string; slideRIds: string[] }>
    >
  >;
  /** Setter for the active custom show id. */
  setActiveCustomShowId: React.Dispatch<React.SetStateAction<string | null>>;
  /** Setter for the slide guides array. */
  setGuides: React.Dispatch<
    React.SetStateAction<
      Array<{ id: string; axis: "h" | "v"; position: number }>
    >
  >;
  /** Setter for presentation-level properties. */
  setPresentationProperties: React.Dispatch<
    React.SetStateAction<PptxPresentationProperties>
  >;
  /** Setter for accessibility issue results. */
  setAccessibilityIssues: React.Dispatch<
    React.SetStateAction<
      Array<{
        slideIndex: number;
        elementId: string;
        severity: "error" | "warning" | "info";
        message: string;
      }>
    >
  >;
  /** Setter to open/close the accessibility panel. */
  setIsAccessibilityPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  /** Setter for the viewer mode. */
  setMode: React.Dispatch<React.SetStateAction<ViewerMode>>;
  /** Setter for the pre-master-view mode (used to restore on close). */
  setPreMasterMode: React.Dispatch<React.SetStateAction<ViewerMode>>;
  /** Setter for the active master index. */
  setActiveMasterIndex: React.Dispatch<React.SetStateAction<number>>;
  /** Setter for the active layout index within a master. */
  setActiveLayoutIndex: React.Dispatch<React.SetStateAction<number | null>>;
  /** Setter for the primary selected element id. */
  setSelectedElementId: React.Dispatch<React.SetStateAction<string | null>>;
  /** Setter for the multi-selection element ids. */
  setSelectedElementIds: React.Dispatch<React.SetStateAction<string[]>>;
  /** The mode the viewer was in before entering master view. */
  preMasterMode: ViewerMode;
  /** Whether the presentation contains digital signatures (triggers strip warning on edit). */
  hasDigitalSignatures: boolean;
  /** Whether there are unsaved modifications. */
  isDirty: boolean;
  /** Editor history instance (used for markDirty on settings changes). */
  history: EditorHistoryResult;
}

/**
 * Output shape of the {@link useViewerDialogs} hook.
 *
 * Provides boolean state + setters for every dialog/modal, plus handler
 * callbacks for master view navigation, guide creation, custom show management,
 * slide-show settings, password, and accessibility.
 */
export interface ViewerDialogsResult {
  /** Whether the Insert SmartArt dialog is visible. */
  isSmartArtDialogOpen: boolean;
  setIsSmartArtDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  /** Whether the equation (MathML/OMML) editor dialog is visible. */
  isEquationDialogOpen: boolean;
  setIsEquationDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  /** Whether the hyperlink editor dialog is visible. */
  isHyperlinkDialogOpen: boolean;
  setIsHyperlinkDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  /** Whether the set/remove password dialog is visible. */
  isPasswordDialogOpen: boolean;
  setIsPasswordDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  /** Whether the document properties dialog is visible. */
  isDocPropsDialogOpen: boolean;
  setIsDocPropsDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  /** Whether the font embedding panel is visible. */
  isFontEmbeddingOpen: boolean;
  setIsFontEmbeddingOpen: React.Dispatch<React.SetStateAction<boolean>>;
  /** Whether the digital signatures detail dialog is visible. */
  isDigitalSigDialogOpen: boolean;
  setIsDigitalSigDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  /** Whether the "signatures will be stripped" warning dialog is visible. */
  isSignatureStrippedDialogOpen: boolean;
  setIsSignatureStrippedDialogOpen: React.Dispatch<
    React.SetStateAction<boolean>
  >;
  /** Whether the "Set Up Slide Show" configuration dialog is visible. */
  isSetUpSlideShowOpen: boolean;
  setIsSetUpSlideShowOpen: React.Dispatch<React.SetStateAction<boolean>>;
  /** Whether the broadcast (share screen) dialog is visible. */
  isBroadcastDialogOpen: boolean;
  setIsBroadcastDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  /** Whether the presentation is currently password-protected. */
  isPasswordProtected: boolean;
  /** OMML data for the equation currently being edited, or null. */
  editingEquationOmml: Record<string, unknown> | null;
  setEditingEquationOmml: React.Dispatch<
    React.SetStateAction<Record<string, unknown> | null>
  >;
  /** Whether font embedding is enabled for save. */
  embedFontsEnabled: boolean;
  setEmbedFontsEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  /** True when the container is narrower than 768px (triggers compact layout). */
  isNarrowViewport: boolean;

  // ── Master view handlers ──────────────────────────────────────────

  /** Switches the viewer to master view mode, preserving the previous mode for restoration. */
  handleEnterMasterView: () => void;
  /** Exits master view and restores the previous mode. */
  handleCloseMasterView: () => void;
  /**
   * Selects a slide master by index and clears layout/element selection.
   * @param index - Zero-based index into the `slideMasters` array.
   */
  handleSelectMaster: (index: number) => void;
  /**
   * Selects a specific layout within a master.
   * @param masterIndex - Zero-based master index.
   * @param layoutIndex - Zero-based layout index within that master.
   */
  handleSelectLayout: (masterIndex: number, layoutIndex: number) => void;

  // ── Guide handlers ────────────────────────────────────────────────

  /**
   * Adds a horizontal or vertical guide at the canvas center.
   * @param axis - "h" for horizontal, "v" for vertical.
   */
  handleAddGuide: (axis: "h" | "v") => void;

  // ── Custom show handlers ──────────────────────────────────────────

  /** Creates a new empty custom show and makes it active. */
  handleCreateCustomShow: () => void;
  /** Prompts to rename the currently active custom show. */
  handleRenameActiveCustomShow: () => void;
  /** Deletes the currently active custom show. */
  handleDeleteActiveCustomShow: () => void;
  /** Adds or removes the current slide from the active custom show. */
  handleToggleCurrentSlideInActiveShow: () => void;
  /** Whether the current slide is included in the active custom show. */
  isCurrentSlideInActiveShow: boolean;

  // ── Slide show settings ───────────────────────────────────────────

  /**
   * Persists updated presentation properties (loop, range, show type, etc.).
   * @param props - The new presentation properties to save.
   */
  handleSaveSlideShowSettings: (props: PptxPresentationProperties) => void;
  /** Toggles the subtitle overlay during presentation mode. */
  handleToggleSubtitles: () => void;

  // ── Password handlers ─────────────────────────────────────────────

  /**
   * Sets a password on the presentation.
   * @param password - The password string to apply.
   */
  handleSetPassword: (password: string) => void;
  /** Removes password protection from the presentation. */
  handleRemovePassword: () => void;

  // ── Accessibility ─────────────────────────────────────────────────

  /** Runs an accessibility check across all slides and opens the results panel. */
  handleRunAccessibilityCheck: () => void;
}
