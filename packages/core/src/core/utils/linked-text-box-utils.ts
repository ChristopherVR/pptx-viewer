/**
 * Linked text box overflow utilities.
 *
 * In PowerPoint, text boxes can be chained via `a:linkedTxbx` so that
 * text overflows from one box to the next. Each box in the chain shares
 * the same `linkedTxbxId` and is ordered by `linkedTxbxSeq` (0-based).
 *
 * The first box (seq 0) holds all the text. Subsequent boxes display
 * whatever overflows from the previous box in the chain.
 *
 * This module provides pure functions for:
 * - Building a map of linked text box chains from a set of elements
 * - Estimating how many text characters / paragraphs fit in a box
 * - Distributing text segments across a chain of linked boxes
 *
 * @module linked-text-box-utils
 */

import type { PptxElement, PptxElementWithText, TextSegment } from "../types";
import { hasTextProperties } from "../types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single member of a linked text box chain, with its sequence number. */
export interface LinkedTextBoxChainMember {
  element: PptxElementWithText;
  seq: number;
}

/** A complete chain of linked text boxes, sorted by sequence number. */
export interface LinkedTextBoxChain {
  chainId: number;
  members: LinkedTextBoxChainMember[];
}

/**
 * Result of distributing text segments across a linked text box chain.
 * Maps element IDs to the text segments that element should render.
 */
export type LinkedTextBoxSegmentMap = Map<string, TextSegment[]>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default font size (in points) when no font size is specified. */
const DEFAULT_FONT_SIZE_PT = 12;

/** Default line height multiplier for estimating text capacity. */
const DEFAULT_LINE_HEIGHT_MULTIPLIER = 1.3;

/**
 * Approximate average character width as a fraction of font size.
 * This is a rough heuristic (assumes ~0.6em average character width
 * for proportional Latin fonts). It will be imprecise for CJK or
 * monospace fonts but is sufficient for overflow distribution.
 */
const AVG_CHAR_WIDTH_RATIO = 0.6;

/** Default body inset in pixels when not specified on the element. */
const DEFAULT_BODY_INSET_PX = 7;

// ---------------------------------------------------------------------------
// Chain building
// ---------------------------------------------------------------------------

/**
 * Scan a flat list of slide elements and group them into linked text box
 * chains keyed by `linkedTxbxId`.
 *
 * Elements without a `linkedTxbxId` are ignored. Each chain's members
 * are sorted ascending by `linkedTxbxSeq`.
 *
 * @param elements - All elements on a single slide.
 * @returns A map from chain ID to the ordered chain descriptor.
 */
export function buildLinkedTextBoxChains(
  elements: readonly PptxElement[],
): Map<number, LinkedTextBoxChain> {
  const chains = new Map<number, LinkedTextBoxChain>();

  for (const el of elements) {
    if (!hasTextProperties(el)) continue;
    if (el.linkedTxbxId === undefined) continue;

    const chainId = el.linkedTxbxId;
    const seq = el.linkedTxbxSeq ?? 0;

    let chain = chains.get(chainId);
    if (!chain) {
      chain = { chainId, members: [] };
      chains.set(chainId, chain);
    }
    chain.members.push({ element: el, seq });
  }

  // Sort each chain by sequence number.
  for (const chain of chains.values()) {
    chain.members.sort((a, b) => a.seq - b.seq);
  }

  return chains;
}

// ---------------------------------------------------------------------------
// Capacity estimation
// ---------------------------------------------------------------------------

/**
 * Estimate how many characters of text can fit inside a text box,
 * given its dimensions, body insets, and the dominant font size.
 *
 * This uses a simple area-based heuristic:
 *   availableArea = (width - hInsets) * (height - vInsets)
 *   charsPerLine  = availableWidth / (fontSize * avgCharWidthRatio)
 *   lines         = availableHeight / (fontSize * lineHeight)
 *   capacity      = charsPerLine * lines
 *
 * @param element - The text-bearing element to estimate capacity for.
 * @returns The estimated number of characters that fit in the box.
 */
export function estimateTextBoxCapacity(element: PptxElementWithText): number {
  const style = element.textStyle;

  const insetLeft = style?.bodyInsetLeft ?? DEFAULT_BODY_INSET_PX;
  const insetRight = style?.bodyInsetRight ?? DEFAULT_BODY_INSET_PX;
  const insetTop = style?.bodyInsetTop ?? DEFAULT_BODY_INSET_PX;
  const insetBottom = style?.bodyInsetBottom ?? DEFAULT_BODY_INSET_PX;

  const availableWidth = Math.max(0, element.width - insetLeft - insetRight);
  const availableHeight = Math.max(0, element.height - insetTop - insetBottom);

  if (availableWidth <= 0 || availableHeight <= 0) return 0;

  // Determine effective font size from the element's dominant style
  // or the first text segment's style.
  let fontSizePt = style?.fontSize ?? DEFAULT_FONT_SIZE_PT;
  if (
    fontSizePt <= 0 &&
    element.textSegments &&
    element.textSegments.length > 0
  ) {
    for (const seg of element.textSegments) {
      if (seg.style?.fontSize && seg.style.fontSize > 0) {
        fontSizePt = seg.style.fontSize;
        break;
      }
    }
  }
  if (fontSizePt <= 0) fontSizePt = DEFAULT_FONT_SIZE_PT;

  // Convert font size from points to pixels (1pt = 1.333px).
  const fontSizePx = fontSizePt * (4 / 3);

  const lineHeightMultiplier =
    style?.lineSpacing ?? DEFAULT_LINE_HEIGHT_MULTIPLIER;
  const lineHeightPx = fontSizePx * lineHeightMultiplier;

  const charsPerLine = Math.max(
    1,
    Math.floor(availableWidth / (fontSizePx * AVG_CHAR_WIDTH_RATIO)),
  );
  const numLines = Math.max(1, Math.floor(availableHeight / lineHeightPx));

  return charsPerLine * numLines;
}

// ---------------------------------------------------------------------------
// Segment distribution
// ---------------------------------------------------------------------------

/**
 * Count the effective character length of a list of text segments,
 * treating paragraph breaks as 1 character (newline).
 */
function countSegmentChars(segments: readonly TextSegment[]): number {
  let total = 0;
  for (const seg of segments) {
    total += seg.isParagraphBreak ? 1 : seg.text.length;
  }
  return total;
}

/**
 * Split a text segment at a character offset, returning the portion
 * before and after the split point.
 */
function splitSegmentAt(
  segment: TextSegment,
  offset: number,
): [TextSegment, TextSegment] {
  const before: TextSegment = {
    ...segment,
    text: segment.text.slice(0, offset),
  };
  const after: TextSegment = {
    ...segment,
    text: segment.text.slice(offset),
    // The bullet only belongs to the first portion of the split
    bulletInfo: undefined,
  };
  return [before, after];
}

/**
 * Distribute text segments from the head element of a linked text box
 * chain across all members based on estimated character capacity.
 *
 * The first element (seq 0) is the "source" — it typically holds all
 * the text. Segments are consumed greedily by each box in sequence
 * order until its estimated capacity is reached, then the remainder
 * flows to the next box.
 *
 * @param chain - The linked text box chain (must be sorted by seq).
 * @returns A map from element ID to the text segments that element
 *          should display.
 */
export function distributeSegmentsAcrossChain(
  chain: LinkedTextBoxChain,
): LinkedTextBoxSegmentMap {
  const result: LinkedTextBoxSegmentMap = new Map();

  if (chain.members.length === 0) return result;

  // Gather all text segments from the head element (seq 0).
  const headMember = chain.members[0];
  const allSegments = headMember.element.textSegments ?? [];

  if (allSegments.length === 0) {
    // No text to distribute; give each member an empty array.
    for (const member of chain.members) {
      result.set(member.element.id, []);
    }
    return result;
  }

  // If there is only one member, it gets everything.
  if (chain.members.length === 1) {
    result.set(headMember.element.id, [...allSegments]);
    return result;
  }

  // Walk through members, consuming segments up to each box's capacity.
  let remainingSegments = [...allSegments];

  for (let i = 0; i < chain.members.length; i++) {
    const member = chain.members[i];
    const isLast = i === chain.members.length - 1;

    if (isLast || remainingSegments.length === 0) {
      // Last box gets whatever remains (or empty).
      result.set(member.element.id, remainingSegments);
      remainingSegments = [];
      continue;
    }

    const capacity = estimateTextBoxCapacity(member.element);
    const boxSegments: TextSegment[] = [];
    let charsUsed = 0;

    while (remainingSegments.length > 0 && charsUsed < capacity) {
      const seg = remainingSegments[0];

      if (seg.isParagraphBreak) {
        boxSegments.push(seg);
        remainingSegments.shift();
        charsUsed += 1;
        continue;
      }

      const segLen = seg.text.length;
      const spaceLeft = capacity - charsUsed;

      if (segLen <= spaceLeft) {
        // Entire segment fits.
        boxSegments.push(seg);
        remainingSegments.shift();
        charsUsed += segLen;
      } else {
        // Split the segment at the capacity boundary.
        const [before, after] = splitSegmentAt(seg, spaceLeft);
        if (before.text.length > 0) {
          boxSegments.push(before);
        }
        remainingSegments[0] = after;
        charsUsed += before.text.length;
        break;
      }
    }

    result.set(member.element.id, boxSegments);
  }

  // Any remaining members that were not reached get empty segments.
  for (const member of chain.members) {
    if (!result.has(member.element.id)) {
      result.set(member.element.id, []);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// High-level API
// ---------------------------------------------------------------------------

/**
 * For a given element on a slide, determine the text segments it should
 * actually render, accounting for linked text box chains.
 *
 * If the element is not part of a chain, returns `undefined` to signal
 * the caller should use the element's own segments as-is.
 *
 * If the element is part of a chain, returns the slice of segments
 * that belong to this particular box after overflow distribution.
 *
 * @param element - The element to query.
 * @param allElements - All elements on the same slide.
 * @returns The distributed segments for this element, or `undefined`
 *          if the element is not in a linked chain.
 */
export function getLinkedTextBoxSegments(
  element: PptxElement,
  allElements: readonly PptxElement[],
): TextSegment[] | undefined {
  if (!hasTextProperties(element)) return undefined;
  if (element.linkedTxbxId === undefined) return undefined;

  const chains = buildLinkedTextBoxChains(allElements);
  const chain = chains.get(element.linkedTxbxId);
  if (!chain || chain.members.length <= 1) return undefined;

  const segmentMap = distributeSegmentsAcrossChain(chain);
  return segmentMap.get(element.id);
}
