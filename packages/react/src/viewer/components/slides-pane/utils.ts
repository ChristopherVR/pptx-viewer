import type { SlideSectionGroup } from "../../types";
import { SLIDE_NAV_THUMBNAIL_WIDTH } from "../../constants";

/**
 * Format a duration in milliseconds as "M:SS".
 */
export function formatTimingMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes)}:${String(seconds).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/*  Flat item list for virtualization                                  */
/* ------------------------------------------------------------------ */

/** A section header entry in the flat list. */
export interface FlatSectionItem {
  type: "section";
  sectionIndex: number;
  sectionId: string;
}

/** A slide entry in the flat list. */
export interface FlatSlideItem {
  type: "slide";
  slideIndex: number;
}

export type FlatPaneItem = FlatSectionItem | FlatSlideItem;

/**
 * Build a flat, ordered list of renderable items (section headers + slides)
 * from the section groups. This flattened representation is what the
 * virtualizer iterates over.
 *
 * @param sectionGroups - The grouped slide sections.
 * @param showSectionHeaders - Whether to include section header rows.
 * @param collapsedSections - Map of section ID to collapsed state.
 * @returns A flat array of section-header and slide items.
 */
export function buildFlatPaneItems(
  sectionGroups: SlideSectionGroup[],
  showSectionHeaders: boolean,
  collapsedSections: Record<string, boolean>,
): FlatPaneItem[] {
  const items: FlatPaneItem[] = [];

  for (let si = 0; si < sectionGroups.length; si++) {
    const section = sectionGroups[si];
    if (showSectionHeaders) {
      items.push({
        type: "section",
        sectionIndex: si,
        sectionId: section.id,
      });
    }

    const isCollapsed = collapsedSections[section.id] ?? false;
    if (!isCollapsed) {
      for (const idx of section.slideIndexes) {
        items.push({ type: "slide", slideIndex: idx });
      }
    }
  }
  return items;
}

/**
 * Compute the estimated pixel height of a slide item in the sidebar,
 * based on the canvas aspect ratio.
 *
 * @param canvasWidth  - Canvas width in px (clamped to >= 1).
 * @param canvasHeight - Canvas height in px (clamped to >= 1).
 * @returns Estimated total height of one slide item row in px.
 */
export function estimateSlideItemHeight(
  canvasWidth: number,
  canvasHeight: number,
): number {
  const safeW = Math.max(canvasWidth, 1);
  const safeH = Math.max(canvasHeight, 1);
  const scale = SLIDE_NAV_THUMBNAIL_WIDTH / safeW;
  const previewHeight = Math.max(56, Math.round(safeH * scale));
  // item = border(2) + padding(4) + thumbnail(previewHeight) + footer(~20) + gap(4)
  return previewHeight + 30;
}
