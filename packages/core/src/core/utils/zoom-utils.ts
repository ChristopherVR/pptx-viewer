/**
 * Zoom slide utilities for detecting and working with PowerPoint Zoom
 * elements (Slide Zoom, Section Zoom, Summary Zoom).
 *
 * @module zoom-utils
 */

import type { PptxElement, ZoomPptxElement } from "../types/elements";
import type { PptxSlide } from "../types/presentation";

/**
 * Returns `true` when the element is a zoom element.
 */
export function isZoomElement(element: PptxElement): element is ZoomPptxElement {
  return element.type === "zoom";
}

/**
 * Collects all zoom elements from a slide's element list.
 */
export function getZoomElements(slide: PptxSlide): ZoomPptxElement[] {
  return slide.elements.filter(isZoomElement);
}

/**
 * Threshold: a slide is considered a "summary zoom" when it contains at
 * least this many zoom elements targeting distinct slides.
 */
const SUMMARY_ZOOM_MIN_COUNT = 2;

/**
 * Detects whether a slide is a "Summary Zoom" slide.
 *
 * A summary zoom slide contains multiple zoom elements that reference
 * different target slides (covering different sections of the deck).
 *
 * @param slide - The slide to inspect.
 * @returns `true` when the slide qualifies as a summary zoom slide.
 */
export function isSummaryZoomSlide(slide: PptxSlide): boolean {
  const zooms = getZoomElements(slide);
  if (zooms.length < SUMMARY_ZOOM_MIN_COUNT) return false;

  // Check that the zoom elements target distinct slides
  const distinctTargets = new Set(zooms.map((z) => z.targetSlideIndex));
  return distinctTargets.size >= SUMMARY_ZOOM_MIN_COUNT;
}

/**
 * Returns the set of distinct target slide indices referenced by zoom
 * elements on the given slide.
 */
export function getZoomTargetSlideIndexes(slide: PptxSlide): number[] {
  const zooms = getZoomElements(slide);
  const seen = new Set<number>();
  const result: number[] = [];
  for (const z of zooms) {
    if (!seen.has(z.targetSlideIndex)) {
      seen.add(z.targetSlideIndex);
      result.push(z.targetSlideIndex);
    }
  }
  return result;
}

/**
 * Given a zoom element, determines whether navigation should "return"
 * to the summary zoom slide after viewing the target section.
 *
 * For section zoom elements on a summary zoom slide, the user is expected
 * to return to the overview after finishing the section. For single slide
 * zoom elements the return behaviour depends on context.
 *
 * @param zoomElement - The zoom element being activated.
 * @param sourceSlide - The slide that contains the zoom element.
 * @returns `true` when the viewer should track a "return" destination.
 */
export function shouldReturnToZoomSlide(
  zoomElement: ZoomPptxElement,
  sourceSlide: PptxSlide,
): boolean {
  // Section zoom on a summary slide should always return
  if (zoomElement.zoomType === "section" && isSummaryZoomSlide(sourceSlide)) {
    return true;
  }
  // Slide zoom on a summary slide should also return
  if (zoomElement.zoomType === "slide" && isSummaryZoomSlide(sourceSlide)) {
    return true;
  }
  return false;
}

/**
 * For a section zoom, finds the range of slide indices belonging to that
 * section. When the user navigates past the last slide in the section,
 * they should return to the summary zoom slide.
 *
 * @param zoomElement - A section zoom element.
 * @param slides - All slides in the presentation.
 * @returns An array of slide indices in the section, or an empty array
 *   if the section cannot be determined.
 */
export function getSectionSlideRange(
  zoomElement: ZoomPptxElement,
  slides: PptxSlide[],
): number[] {
  if (zoomElement.zoomType !== "section" || !zoomElement.targetSectionId) {
    // Fallback: return just the target slide
    return [zoomElement.targetSlideIndex];
  }

  const sectionId = zoomElement.targetSectionId;
  const result: number[] = [];
  for (let i = 0; i < slides.length; i++) {
    if (slides[i].sectionId === sectionId) {
      result.push(i);
    }
  }

  // If no slides matched by section ID, fall back to the target slide index
  if (result.length === 0) {
    return [zoomElement.targetSlideIndex];
  }

  return result;
}
