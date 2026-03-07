/**
 * Utility functions for PresenterView — time formatting and notes rendering.
 */
import React from "react";

import type { TextSegment } from "pptx-viewer-core";

/**
 * Format a Date as a locale time string (HH:MM:SS).
 */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Format a millisecond duration as MM:SS.
 */
export function formatElapsed(elapsedMs: number): string {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Render rich-text notes segments into React nodes.
 */
export function renderNotesSegments(
  segments: TextSegment[],
): React.ReactNode[] {
  return segments.map((segment, index) => {
    if (segment.isParagraphBreak)
      return React.createElement("br", { key: `br-${index}` });
    const style: React.CSSProperties = {};
    if (segment.style.bold) style.fontWeight = "bold";
    if (segment.style.italic) style.fontStyle = "italic";
    if (segment.style.underline) style.textDecoration = "underline";
    if (segment.style.strikethrough) {
      style.textDecoration =
        (style.textDecoration ? `${style.textDecoration} ` : "") +
        "line-through";
    }
    if (segment.style.color) style.color = segment.style.color;
    if (segment.style.fontSize) style.fontSize = `${segment.style.fontSize}pt`;
    if (segment.style.fontFamily) style.fontFamily = segment.style.fontFamily;
    return React.createElement(
      "span",
      { key: `seg-${index}`, style },
      segment.text,
    );
  });
}
