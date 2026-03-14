/**
 * Linked text box overflow utilities for the React rendering layer.
 *
 * This module wraps the core `getLinkedTextBoxSegments` function and
 * provides helpers for computing which text segments should render in
 * each box of a linked text box chain.
 *
 * @module linked-text-box-overflow
 */

import type { PptxElement, TextSegment } from "pptx-viewer-core";
import {
  hasTextProperties,
  getLinkedTextBoxSegments,
  buildLinkedTextBoxChains,
} from "pptx-viewer-core";

/**
 * Determine whether an element participates in a linked text box chain.
 *
 * @param element - The element to check.
 * @returns `true` if the element has a `linkedTxbxId` set.
 */
export function isLinkedTextBox(element: PptxElement): boolean {
  return hasTextProperties(element) && element.linkedTxbxId !== undefined;
}

/**
 * Determine whether an element is the head (seq 0) of a linked text box chain.
 *
 * @param element - The element to check.
 * @returns `true` if the element is the first box in a chain.
 */
export function isLinkedTextBoxHead(element: PptxElement): boolean {
  return (
    hasTextProperties(element) &&
    element.linkedTxbxId !== undefined &&
    (element.linkedTxbxSeq ?? 0) === 0
  );
}

/**
 * Compute the distributed text segments for a given element in a linked
 * text box chain.
 *
 * Returns the segments that this element should display after overflow
 * distribution, or `undefined` if the element is not part of a chain
 * or is the only member.
 *
 * @param element - The element to compute segments for.
 * @param slideElements - All elements on the same slide.
 * @returns Distributed segments for this element, or `undefined`.
 */
export function getOverflowSegments(
  element: PptxElement,
  slideElements: readonly PptxElement[],
): TextSegment[] | undefined {
  return getLinkedTextBoxSegments(element, slideElements);
}

/**
 * Build a complete segment distribution map for all linked text box
 * chains on a slide.
 *
 * Returns a map from element ID to the text segments that element
 * should render. Elements not in any chain are not included.
 *
 * @param slideElements - All elements on a single slide.
 * @returns Map from element ID to distributed segments.
 */
export function buildSlideOverflowMap(
  slideElements: readonly PptxElement[],
): Map<string, TextSegment[]> {
  const result = new Map<string, TextSegment[]>();
  const chains = buildLinkedTextBoxChains(slideElements);

  if (chains.size === 0) return result;

  // Import distributeSegmentsAcrossChain inline to avoid circular deps
  // Actually we can just use getLinkedTextBoxSegments per element
  for (const el of slideElements) {
    if (!isLinkedTextBox(el)) continue;
    const segments = getLinkedTextBoxSegments(el, slideElements);
    if (segments !== undefined) {
      result.set(el.id, segments);
    }
  }

  return result;
}
