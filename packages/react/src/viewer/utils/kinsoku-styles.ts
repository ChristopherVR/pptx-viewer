import type React from "react";
import type { TextStyle } from "pptx-viewer-core";

/**
 * Compute CSS properties for East Asian (kinsoku) line-breaking rules.
 *
 * These properties enforce CJK typographic rules based on OOXML paragraph
 * properties: `eaLineBreak`, `hangingPunctuation`, and `latinLineBreak`.
 *
 * @param textStyle - The TextStyle containing paragraph-level flags.
 * @returns A partial CSSProperties object with line-breaking rules.
 */
export function getKinsokuLineBreakStyles(
  textStyle: TextStyle | undefined,
): React.CSSProperties {
  if (!textStyle) return {};

  const result: React.CSSProperties = {};

  // ── East Asian line break ─────────────────────────────────────────────
  // When eaLineBreak is true (the default in most CJK presentations),
  // allow standard CJK line breaks between characters.
  // When false, use strict mode to prevent breaks at kinsoku characters.
  if (textStyle.eaLineBreak === true) {
    result.lineBreak = "normal";
    result.wordBreak = "break-all";
    result.overflowWrap = "break-word";
  } else if (textStyle.eaLineBreak === false) {
    result.lineBreak = "strict";
    result.overflowWrap = "break-word";
  }

  // ── Hanging punctuation ───────────────────────────────────────────────
  // When enabled, CJK punctuation at the end of a line is allowed to
  // "hang" past the text box edge rather than forcing a line break.
  if (textStyle.hangingPunctuation === true) {
    result.hangingPunctuation = "last";
  } else if (textStyle.hangingPunctuation === false) {
    result.hangingPunctuation = "none";
  }

  // ── Latin line break ──────────────────────────────────────────────────
  // When latinLineBreak is true, allow breaking within Latin words
  // (useful for mixed CJK/Latin content where Latin text should also wrap).
  if (textStyle.latinLineBreak === true) {
    result.wordBreak = "break-all";
    result.overflowWrap = "break-word";
  }

  return result;
}
