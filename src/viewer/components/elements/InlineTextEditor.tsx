import React, { useRef, useEffect } from "react";
import type { PptxElement, TextStyle } from "../../../core";
import { hasTextProperties } from "../../../core";
import { getTextCompensationTransform, toCssWritingMode } from "../../utils";

/**
 * Uncontrolled inline text editor — keeps text in a local ref so that
 * keystrokes never propagate state updates to the parent tree.
 * The parent text is updated only on blur / commit / cancel.
 *
 * The editor is wrapped in a layout div that mirrors the display-mode
 * text container (flex vertical alignment, body-inset padding, warp
 * transforms) so that font, position and spacing remain consistent
 * between viewing and editing.
 *
 * `effectiveTextStyle` is derived from the first content segment's style
 * merged with the element-level textStyle so that the textarea visually
 * matches what was rendered in display mode (preserving font family, size,
 * color, bold, etc. from the actual run properties).
 */
export function InlineTextEditor({
  initialText,
  spellCheck,
  rtl,
  textDirection,
  textStyle,
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
  /** Layout style from getTextLayoutStyle — provides flex vertical alignment. */
  layoutStyle: React.CSSProperties;
  element: PptxElement;
  onCommit: () => void;
  onCancel: () => void;
  onEditChange: (t: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync text to parent on every input via ref (no re-render)
  const handleInput = () => {
    if (textareaRef.current) {
      onEditChange(textareaRef.current.value);
    }
  };

  // Auto-focus on mount and select all text so the user can immediately replace
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
  }, []);

  // Derive the effective text style for the textarea from the first non-break
  // segment's run properties so the visual appearance matches display mode.
  // Fall back to the element-level textStyle when no segment data is available.
  const firstContentSegment = hasTextProperties(element)
    ? element.textSegments?.find(
        (seg) =>
          seg.text !== "\n" &&
          !seg.isParagraphBreak &&
          seg.text.trim().length > 0,
      )
    : undefined;

  // Build an effective textStyle that overlays segment-level run properties
  // on top of the element-level textStyle so the textarea matches display mode.
  const effectiveTextStyle: React.CSSProperties = {
    ...textStyle,
    ...(firstContentSegment?.style?.fontFamily
      ? { fontFamily: firstContentSegment.style.fontFamily }
      : {}),
    ...(typeof firstContentSegment?.style?.fontSize === "number"
      ? { fontSize: firstContentSegment.style.fontSize }
      : {}),
    ...(typeof firstContentSegment?.style?.bold === "boolean"
      ? { fontWeight: firstContentSegment.style.bold ? 700 : 400 }
      : {}),
    ...(typeof firstContentSegment?.style?.italic === "boolean"
      ? {
          fontStyle: firstContentSegment.style.italic ? "italic" : "normal",
        }
      : {}),
    ...(firstContentSegment?.style?.color
      ? { color: firstContentSegment.style.color }
      : {}),
  };

  // Build wrapper style: start from layout (flex/alignment/padding), then overlay
  // the effective text style. Re-apply layout padding last so that the body-inset
  // padding from layoutStyle is not overridden by any padding in effectiveTextStyle.
  const wrapperStyle: React.CSSProperties = {
    ...layoutStyle,
    ...effectiveTextStyle,
    // Re-assert layout padding so it wins over any padding in effectiveTextStyle.
    paddingTop: layoutStyle.paddingTop,
    paddingBottom: layoutStyle.paddingBottom,
    paddingLeft: layoutStyle.paddingLeft,
    paddingRight: layoutStyle.paddingRight,
    transform: getTextCompensationTransform(element),
    transformOrigin: "center",
  };

  return (
    <div
      className="relative z-10 w-full h-full whitespace-pre-wrap break-words leading-[1.3]"
      style={wrapperStyle}
    >
      <textarea
        ref={textareaRef}
        defaultValue={initialText}
        spellCheck={spellCheck}
        dir={rtl ? "rtl" : "ltr"}
        className="w-full h-full bg-transparent outline-none resize-none"
        style={{
          color: "inherit",
          fontSize: "inherit",
          fontFamily: "inherit",
          fontWeight: "inherit",
          fontStyle: "inherit",
          textAlign: "inherit" as React.CSSProperties["textAlign"],
          lineHeight: "inherit",
          letterSpacing: "inherit",
          textDecorationLine: "inherit",
          backgroundColor: "transparent",
          border: "none",
          padding: 0,
          margin: 0,
          writingMode: toCssWritingMode(textDirection),
          textOrientation: toCssWritingMode(textDirection)
            ? "mixed"
            : undefined,
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onInput={handleInput}
        onBlur={() => {
          // Sync final text before committing
          if (textareaRef.current) {
            onEditChange(textareaRef.current.value);
          }
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
            if (textareaRef.current) {
              onEditChange(textareaRef.current.value);
            }
            onCommit();
          }
        }}
      />
    </div>
  );
}
