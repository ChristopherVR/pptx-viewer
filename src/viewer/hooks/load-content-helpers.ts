/**
 * Pure helper functions extracted from useLoadContent to keep hook file lean.
 */
import type {
  MediaPptxElement,
  PptxElement,
  PptxDrawingGuide,
} from "../../core";
import { guideEmuToPx } from "../../core/utils/guide-utils";

export interface GuideEntry {
  id: string;
  axis: "h" | "v";
  position: number;
}

/**
 * Recursively walks an element tree and pushes every media element
 * into the supplied collector array.
 */
export function collectMediaElements(
  elements: PptxElement[],
  collector: MediaPptxElement[],
): void {
  for (const element of elements) {
    if (element.type === "media") {
      collector.push(element);
      continue;
    }
    if (element.type === "group" && element.children?.length) {
      collectMediaElements(element.children, collector);
    }
  }
}

/**
 * Converts raw EMU-based drawing guides from the parsed presentation
 * and the first slide into pixel-based `GuideEntry` objects.
 */
export function buildInitialGuides(
  presentationGuides: PptxDrawingGuide[] | undefined,
  firstSlideGuides: PptxDrawingGuide[] | undefined,
): GuideEntry[] {
  const guides: GuideEntry[] = [];
  if (presentationGuides) {
    for (const g of presentationGuides) {
      guides.push({
        id: g.id,
        axis: g.orientation === "horz" ? "h" : "v",
        position: guideEmuToPx(g.positionEmu),
      });
    }
  }
  if (firstSlideGuides) {
    for (const g of firstSlideGuides) {
      guides.push({
        id: g.id,
        axis: g.orientation === "horz" ? "h" : "v",
        position: guideEmuToPx(g.positionEmu),
      });
    }
  }
  return guides;
}
