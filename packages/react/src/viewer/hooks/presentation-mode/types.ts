import type { PptxAction, PptxSlide } from "pptx-viewer-core";
import type { ViewerMode, PresentationAnimationRuntime } from "../../types";
import type { ElementAnimationState } from "../../utils/animation-timeline";

// ---------------------------------------------------------------------------
// Input / output interfaces
// ---------------------------------------------------------------------------

export interface UsePresentationModeInput {
  mode: ViewerMode;
  slides: PptxSlide[];
  visibleSlideIndexes: number[];
  activeSlideIndex: number;
  containerRef: React.RefObject<HTMLElement | null>;
  onSetMode: (mode: ViewerMode) => void;
  onSetActiveSlideIndex: (index: number) => void;
  onPlayActionSound?: (soundPath: string) => void;
  /** Called when L key is pressed during presentation. */
  onToggleLaser?: () => void;
  /** Called when P key is pressed during presentation. */
  onTogglePen?: () => void;
  /** Called when E key is pressed during presentation. */
  onToggleEraser?: () => void;
  /** Called when Ctrl+M is pressed during presentation. */
  onToggleToolbar?: () => void;
  /** Called to persist rehearsal timings into slide transitions. */
  onSaveRehearsalTimings?: (timings: Record<number, number>) => void;
  /** Whether to loop continuously (kiosk or explicit loop setting). */
  loopContinuously?: boolean;
  /** Whether to play animations during the slide show (false = skip all animations). */
  showWithAnimation?: boolean;
  /** Whether to use rehearsed auto-advance timings (false = manual advance only). */
  useTimings?: boolean;
}

export interface UsePresentationModeResult {
  presentationSlideIndex: number;
  setPresentationSlideIndex: (index: number) => void;
  presentationSlideVisible: boolean;
  presentationAnimations: PresentationAnimationRuntime[];
  presentationElementStates: Map<string, ElementAnimationState>;
  presentationKeyframesCss: string;
  clearPresentationTimers: () => void;
  runPresentationEntranceAnimations: (slideIndex: number) => void;
  movePresentationSlide: (direction: 1 | -1) => void;
  navigateToSlide: (slideIndex: number) => void;
  handlePresentationAction: (action: PptxAction) => void;
  /**
   * Handle a shape click in presentation mode. If the shape is an interactive
   * trigger, play its animation sequence. Returns `true` if handled.
   */
  handleInteractiveShapeClick: (shapeId: string) => boolean;
  /** Set of shape IDs that are interactive sequence triggers on the current slide. */
  interactiveTriggerShapeIds: ReadonlySet<string>;
  /** Set of shape IDs that are hover animation triggers on the current slide. */
  hoverTriggerShapeIds: ReadonlySet<string>;
  /** Handle hover start on a shape. If the shape has a hover sequence, play it. Returns `true` if handled. */
  handleHoverStart: (shapeId: string) => boolean;
  /** Handle hover end on a shape. Resets the hover sequence for replay. */
  handleHoverEnd: (shapeId: string) => void;
  /** Must be called from a user-gesture handler (click) to satisfy browser fullscreen policy. */
  enterPresentMode: () => void;
  /** Whether presenter view (split-screen with notes) is active instead of fullscreen. */
  presenterMode: boolean;
  /** Enter presenter view mode (no fullscreen, shows notes panel). */
  enterPresenterView: () => void;
  /** Timestamp (ms) when the presentation started — used for elapsed timer. */
  presentationStartTime: number | null;
  // --- Rehearse Timings ---
  /** Whether the current presentation session is in rehearse-timings mode. */
  rehearsing: boolean;
  /** Enter rehearse-timings mode (fullscreen presentation + timing HUD). */
  enterRehearsalMode: () => void;
  /** Recorded timings in ms, keyed by slide index. Populated during rehearsal. */
  recordedTimings: Record<number, number>;
  /** Timestamp when the current slide started (ms since epoch). */
  slideStartTime: number | null;
  /** Whether the rehearsal summary dialog should be shown. */
  showRehearsalSummary: boolean;
  /** Dismiss the rehearsal summary (discard timings). */
  dismissRehearsalSummary: () => void;
  /** Save recorded timings into each slide's transition.advanceAfterMs. */
  saveRehearsalTimings: () => void;
  /** Whether rehearsal timer is paused. */
  rehearsalPaused: boolean;
  /** Toggle the rehearsal timer pause state. */
  toggleRehearsalPause: () => void;
  // --- Zoom Navigation ---
  /** Handle a zoom element click in presentation mode. */
  handleZoomClick: (targetSlideIndex: number, returnSlideIndex: number) => void;
  /** Ref holding the slide index to return to after zoom navigation. */
  zoomReturnSlideIndex: React.RefObject<number | null>;
  /** Navigate back to the zoom summary slide. Returns true if navigation occurred. */
  returnToZoomSlide: () => boolean;
  /** Clear the stored zoom return index. */
  clearZoomReturn: () => void;
  // --- Audience Window ---
  /** Open the audience display in a separate browser window. Returns `true` if successful. */
  openAudienceWindow: () => boolean;
  /** Close the audience display window. */
  closeAudienceWindow: () => void;
  /** Whether the audience window is currently open. */
  isAudienceWindowOpen: () => boolean;
  /** Send a slide index to the audience window explicitly. */
  syncSlideToAudience: (slideIndex: number) => void;
}
