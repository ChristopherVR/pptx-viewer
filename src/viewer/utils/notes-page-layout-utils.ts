/**
 * Pure utility functions for notes page layout calculations.
 *
 * Each notes page displays one slide thumbnail in the top half
 * and the slide's speaker notes in the bottom half.
 */

import { A4_PORTRAIT, type PageDimensions } from "./handout-layout-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Dimensions for the slide thumbnail area on a notes page. */
export interface NotesPageSlideArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Dimensions for the notes text area on a notes page. */
export interface NotesPageTextArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Layout data for a single notes page. */
export interface NotesPageData {
  pageIndex: number;
  slideIndex: number;
  slideArea: NotesPageSlideArea;
  textArea: NotesPageTextArea;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Fraction of the printable height allocated to the slide thumbnail. */
const SLIDE_AREA_FRACTION = 0.48;

/** Gap between the slide area and the notes text area (mm). */
const SECTION_GAP = 6;

/** Standard 16:9 aspect ratio for slide thumbnails. */
const SLIDE_ASPECT_RATIO = 16 / 9;

// ---------------------------------------------------------------------------
// Layout Computation
// ---------------------------------------------------------------------------

/**
 * Compute the layout for a single notes page.
 *
 * The slide thumbnail is centred horizontally in the top area,
 * maintaining a 16:9 aspect ratio. The notes text fills the bottom.
 */
export function computeNotesPageLayout(
  pageIndex: number,
  slideIndex: number,
  page: PageDimensions = A4_PORTRAIT,
): NotesPageData {
  const printableWidth = page.width - page.marginLeft - page.marginRight;
  const printableHeight = page.height - page.marginTop - page.marginBottom;

  const slideAreaHeight = printableHeight * SLIDE_AREA_FRACTION;

  // Fit slide thumbnail within the allocated area, keeping 16:9
  let thumbWidth = printableWidth;
  let thumbHeight = thumbWidth / SLIDE_ASPECT_RATIO;

  if (thumbHeight > slideAreaHeight) {
    thumbHeight = slideAreaHeight;
    thumbWidth = thumbHeight * SLIDE_ASPECT_RATIO;
  }

  // Centre horizontally
  const thumbX = (printableWidth - thumbWidth) / 2;
  // Centre vertically within the slide area
  const thumbY = (slideAreaHeight - thumbHeight) / 2;

  const textAreaY = slideAreaHeight + SECTION_GAP;
  const textAreaHeight = printableHeight - textAreaY;

  return {
    pageIndex,
    slideIndex,
    slideArea: {
      x: thumbX,
      y: thumbY,
      width: thumbWidth,
      height: thumbHeight,
    },
    textArea: {
      x: 0,
      y: textAreaY,
      width: printableWidth,
      height: Math.max(0, textAreaHeight),
    },
  };
}

/**
 * Compute layouts for all notes pages from the given slide indices.
 *
 * Each slide gets its own page (1 slide per page).
 */
export function computeAllNotesPages(slideIndices: number[]): NotesPageData[] {
  return slideIndices.map((slideIndex, idx) =>
    computeNotesPageLayout(idx, slideIndex),
  );
}

/**
 * Get the printable area dimensions for the notes page (always portrait A4).
 */
export function getNotesPrintableArea(): { width: number; height: number } {
  return {
    width: A4_PORTRAIT.width - A4_PORTRAIT.marginLeft - A4_PORTRAIT.marginRight,
    height:
      A4_PORTRAIT.height - A4_PORTRAIT.marginTop - A4_PORTRAIT.marginBottom,
  };
}
