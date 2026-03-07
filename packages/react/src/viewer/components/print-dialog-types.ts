/**
 * Shared types, interfaces, and constants for the PrintDialog family.
 */
import type { PptxSlide } from "pptx-viewer-core";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** What to print. */
export type PrintWhat = "slides" | "handouts" | "notes" | "outline";

/** Page orientation for the printed output. */
export type PrintOrientation = "portrait" | "landscape";

/** Colour mode for the printed output. */
export type PrintColorMode = "color" | "grayscale" | "blackAndWhite";

/** Handout slides-per-page options. */
export type HandoutSlidesPerPage = 1 | 2 | 3 | 4 | 6 | 9;

/** Slide range mode. */
export type PrintSlideRange = "all" | "current" | "custom";

/** Resolved print settings emitted on confirm. */
export interface PrintSettings {
  printWhat: PrintWhat;
  orientation: PrintOrientation;
  colorMode: PrintColorMode;
  frameSlides: boolean;
  slidesPerPage: HandoutSlidesPerPage;
  slideRange: PrintSlideRange;
  customRangeFrom: number;
  customRangeTo: number;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PrintDialogProps {
  open: boolean;
  onClose: () => void;
  onPrint: (settings: PrintSettings) => void;
  slides: PptxSlide[];
  activeSlideIndex: number;
  /** Default slides-per-page from presentation properties. */
  defaultSlidesPerPage?: number;
  /** Default frame-slides from presentation properties. */
  defaultFrameSlides?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const HANDOUT_OPTIONS: HandoutSlidesPerPage[] = [1, 2, 3, 4, 6, 9];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a Tailwind class string for styled radio/checkbox cards. */
export const radioClass = (active: boolean): string =>
  `flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-colors ${
    active
      ? "border-primary bg-primary/10 text-foreground"
      : "border-border bg-background text-muted-foreground hover:border-primary/40"
  }`;
