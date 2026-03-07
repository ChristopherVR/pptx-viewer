import React from "react";

import type { TextStyle, BulletInfo } from "pptx-viewer-core";
import { TEXT_BUILD_ID_SEP } from "./animation-timeline";
import type { ElementAnimationState } from "./animation-timeline";

/**
 * A paragraph entry linking a text segment to its global index
 * in the original textSegments array (for highlights).
 */
export interface ParagraphEntry {
  segment: {
    text: string;
    style: TextStyle;
    bulletInfo?: BulletInfo;
    fieldType?: string;
    equationXml?: Record<string, unknown>;
  };
  globalIndex: number;
}

/**
 * Build inline style for a sub-element animation state (visibility + CSS animation).
 */
export function buildAnimStyle(
  state: ElementAnimationState | undefined,
): React.CSSProperties | undefined {
  if (!state) return undefined;
  const style: React.CSSProperties = {};
  if (state.visible === false) {
    style.visibility = "hidden";
  }
  if (state.cssAnimation) {
    style.animation = state.cssAnimation;
  }
  return Object.keys(style).length > 0 ? style : undefined;
}

/**
 * Wrap rendered paragraph segments with animation-aware spans when
 * sub-element animation states are present.
 *
 * If no sub-element states exist for this element, returns the rendered
 * segments unchanged (zero overhead in the default case).
 */
export function wrapWithTextBuildAnimation(
  elementId: string,
  paraIndex: number,
  renderedSegments: React.ReactNode[],
  paraSegments: ReadonlyArray<ParagraphEntry>,
  subElementAnimStates: ReadonlyMap<string, ElementAnimationState> | undefined,
): React.ReactNode {
  if (!subElementAnimStates || subElementAnimStates.size === 0) {
    return renderedSegments;
  }

  // ── Paragraph-level build ──
  const paraKey = `${elementId}${TEXT_BUILD_ID_SEP}p${paraIndex}`;
  const paraState = subElementAnimStates.get(paraKey);
  if (paraState) {
    const style = buildAnimStyle(paraState);
    return (
      <span
        key={paraKey}
        data-anim-id={paraKey}
        style={{ display: "inline", ...style }}
      >
        {renderedSegments}
      </span>
    );
  }

  // ── Word-level build ──
  const firstWordKey = `${elementId}${TEXT_BUILD_ID_SEP}w${paraIndex}-0`;
  if (subElementAnimStates.has(firstWordKey)) {
    return wrapByWord(elementId, paraIndex, paraSegments, subElementAnimStates);
  }

  // ── Character-level build ──
  const firstCharKey = `${elementId}${TEXT_BUILD_ID_SEP}c${paraIndex}-0`;
  if (subElementAnimStates.has(firstCharKey)) {
    return wrapByChar(elementId, paraIndex, paraSegments, subElementAnimStates);
  }

  return renderedSegments;
}

/**
 * Split paragraph text into words and wrap each in an animated span.
 */
function wrapByWord(
  elementId: string,
  paraIndex: number,
  paraSegments: ReadonlyArray<ParagraphEntry>,
  states: ReadonlyMap<string, ElementAnimationState>,
): React.ReactNode {
  // Concatenate paragraph text to split by word boundaries
  const fullText = paraSegments.map((e) => e.segment.text).join("");
  const words = fullText.split(/(\s+)/);
  let wordIdx = 0;
  const nodes: React.ReactNode[] = [];

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (!w) continue;
    const isWhitespace = /^\s+$/.test(w);
    if (isWhitespace) {
      nodes.push(<React.Fragment key={`ws-${i}`}>{w}</React.Fragment>);
      continue;
    }
    const key = `${elementId}${TEXT_BUILD_ID_SEP}w${paraIndex}-${wordIdx}`;
    const state = states.get(key);
    const style = buildAnimStyle(state);
    nodes.push(
      <span
        key={key}
        data-anim-id={key}
        style={{ display: "inline", ...style }}
      >
        {w}
      </span>,
    );
    wordIdx++;
  }

  return nodes;
}

/**
 * Split paragraph text into characters and wrap each in an animated span.
 */
function wrapByChar(
  elementId: string,
  paraIndex: number,
  paraSegments: ReadonlyArray<ParagraphEntry>,
  states: ReadonlyMap<string, ElementAnimationState>,
): React.ReactNode {
  const fullText = paraSegments.map((e) => e.segment.text).join("");
  const nodes: React.ReactNode[] = [];

  for (let i = 0; i < fullText.length; i++) {
    const key = `${elementId}${TEXT_BUILD_ID_SEP}c${paraIndex}-${i}`;
    const state = states.get(key);
    const style = buildAnimStyle(state);
    nodes.push(
      <span
        key={key}
        data-anim-id={key}
        style={{ display: "inline", ...style }}
      >
        {fullText[i]}
      </span>,
    );
  }

  return nodes;
}
