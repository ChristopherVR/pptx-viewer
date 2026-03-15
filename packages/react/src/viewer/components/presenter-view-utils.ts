/**
 * Utility functions for PresenterView — time formatting, notes rendering,
 * and font-size controls.
 */
import React from "react";

import type { TextSegment } from "pptx-viewer-core";

// ---------------------------------------------------------------------------
// Notes font-size constants
// ---------------------------------------------------------------------------

/** Minimum font size (px) for speaker notes in presenter view. */
export const NOTES_FONT_SIZE_MIN = 10;

/** Maximum font size (px) for speaker notes in presenter view. */
export const NOTES_FONT_SIZE_MAX = 32;

/** Step increment (px) when increasing/decreasing notes font size. */
export const NOTES_FONT_SIZE_STEP = 2;

/** Default font size (px) for speaker notes. */
export const NOTES_FONT_SIZE_DEFAULT = 14;

/**
 * Clamp a notes font size value to the allowed range.
 */
export function clampNotesFontSize(size: number): number {
  return Math.max(NOTES_FONT_SIZE_MIN, Math.min(NOTES_FONT_SIZE_MAX, size));
}

// ---------------------------------------------------------------------------
// Time formatting
// ---------------------------------------------------------------------------

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
 * Format a millisecond duration as MM:SS, or HH:MM:SS when the elapsed
 * time is one hour or longer.
 */
export function formatElapsed(elapsedMs: number): string {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Rich-text notes rendering
// ---------------------------------------------------------------------------

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
