import React, { useRef, useEffect, useCallback } from "react";
import type { PptxElement, TextStyle } from "pptx-viewer-core";
import { hasTextProperties } from "pptx-viewer-core";
import {
  getTextCompensationTransform,
  getTextWarpStyle,
  renderTextSegments,
} from "../../utils";
import { DEFAULT_TEXT_COLOR } from "../../constants";

/**
 * Rich inline text editor — uses a `contentEditable` div that renders the same
 * rich text segments as view mode so formatting (per-run fonts, sizes, colors,
 * bullets, paragraph indentation, text effects) is preserved while editing.
 *
 * The editor extracts plain text on commit via `innerText` and passes it to the
 * parent's `onEditChange` callback, which feeds into `remapTextToSegments` to
 * redistribute the edited text across the original rich segments.
 *
 * The outer wrapper matches the view-mode text container exactly:
 * - `getTextLayoutStyle` for flex vertical alignment, body-inset padding, columns
 * - `getTextStyleForElement` (textStyle) for element-level font defaults
 * - `getTextWarpStyle` for text warp 3D transforms
 * - `getTextCompensationTransform` for rotation compensation
 */
export function InlineTextEditor({
  initialText,
  spellCheck,
  rtl,
  textDirection,
  textStyle,
  textStyleRaw,
  layoutStyle,
  element,
  onCommit,
  onCancel,
  onEditChange,
}: {
  initialText: string;
  spellCheck: boolean;
  rtl?: boolean;
  textDirection?: TextStyle["textDirection"];
  textStyle: React.CSSProperties;
  /** Raw TextStyle object for computing warp transforms. */
  textStyleRaw?: TextStyle;
  /** Layout style from getTextLayoutStyle — provides flex vertical alignment. */
  layoutStyle: React.CSSProperties;
  element: PptxElement;
  onCommit: () => void;
  onCancel: () => void;
  onEditChange: (t: string) => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);

  // Extract plain text from the contentEditable div
  const extractText = useCallback((): string => {
    const el = editorRef.current;
    if (!el) return initialText;
    return el.innerText || "";
  }, [initialText]);

  // Sync text to parent on every input via ref (no re-render)
  const handleInput = useCallback(() => {
    onEditChange(extractText());
  }, [extractText, onEditChange]);

  // Auto-focus on mount and place cursor at end
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    // Place cursor at end of content
    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }, []);

  // Build wrapper style matching view-mode exactly:
  // layoutStyle (flex alignment, vertical padding, columns) + textStyle (font defaults,
  // horizontal padding/insets) + warp transforms + compensation transform.
  //
  // View mode applies: getTextLayoutStyle + txtS + getTextWarpStyle + compensationTransform
  // We replicate that same order here.
  const warpStyle = getTextWarpStyle(textStyleRaw);

  // Merge the compensation transform with warp transform if both exist
  const compensationTransform = getTextCompensationTransform(element);
  const warpTransform = warpStyle?.transform;
  const mergedTransform = [compensationTransform, warpTransform]
    .filter(Boolean)
    .join(" ") || undefined;

  const wrapperStyle: React.CSSProperties = {
    ...layoutStyle,
    ...textStyle,
    ...warpStyle,
    transform: mergedTransform,
    transformOrigin: warpStyle?.transformOrigin || "center",
  };

  // Determine if the element has rich text segments to render
  const hasRichSegments =
    hasTextProperties(element) &&
    element.textSegments &&
    element.textSegments.length > 0;

  return (
    <div
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      spellCheck={spellCheck}
      dir={rtl ? "rtl" : "ltr"}
      className="relative z-10 w-full h-full whitespace-pre-wrap break-words leading-[1.3] outline-none"
      style={{
        ...wrapperStyle,
        cursor: "text",
        minHeight: "1em",
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onInput={handleInput}
      onBlur={() => {
        onEditChange(extractText());
        onCommit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
          return;
        }
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          onEditChange(extractText());
          onCommit();
        }
      }}
      // Prevent paste from inserting HTML — paste as plain text only
      onPaste={(e) => {
        e.preventDefault();
        const text = e.clipboardData.getData("text/plain");
        document.execCommand("insertText", false, text);
      }}
    >
      {hasRichSegments
        ? renderTextSegments(element, DEFAULT_TEXT_COLOR)
        : initialText}
    </div>
  );
}
