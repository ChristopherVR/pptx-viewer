import { TextSegment, TextStyle } from "../../types";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeSaveImageEffects";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  protected textStylesEqual(
    left: TextStyle | undefined,
    right: TextStyle | undefined,
  ): boolean {
    const keys: Array<keyof TextStyle> = [
      "fontFamily",
      "fontSize",
      "bold",
      "italic",
      "underline",
      "strikethrough",
      "rtl",
      "hyperlink",
      "color",
      "align",
      "vAlign",
      "textDirection",
      "columnCount",
    ];
    return keys.every((key) => left?.[key] === right?.[key]);
  }

  protected hasMixedTextStyles(textSegments: TextSegment[]): boolean {
    if (textSegments.length <= 1) return false;
    const baseStyle = textSegments[0]?.style;
    return textSegments.some(
      (segment, index) =>
        index > 0 && !this.textStylesEqual(segment.style, baseStyle),
    );
  }

  protected areTextSegmentsUniform(
    textSegments: TextSegment[] | undefined,
  ): boolean {
    if (!textSegments || textSegments.length <= 1) return true;
    return !this.hasMixedTextStyles(textSegments);
  }

  protected parseBooleanAttr(value: unknown): boolean {
    const normalized = String(value ?? "")
      .trim()
      .toLowerCase();
    return normalized === "1" || normalized === "true";
  }

  protected parseOptionalBooleanAttr(value: unknown): boolean | undefined {
    if (value === undefined || value === null) return undefined;
    const normalized = String(value).trim();
    if (normalized.length === 0) return undefined;
    return this.parseBooleanAttr(normalized);
  }

  protected normalizeTypefaceToken(typeface: string): string | undefined {
    const normalized = typeface.trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  protected resolveThemeTypeface(
    typeface: string | undefined,
  ): string | undefined {
    const normalized = this.normalizeTypefaceToken(typeface || "");
    if (!normalized) return undefined;

    if (normalized.startsWith("+")) {
      const token = normalized.slice(1).toLowerCase();
      const resolved = this.themeFontMap[token];
      if (resolved) {
        return resolved;
      }
    }

    return normalized;
  }

  protected cloneTextStyleValue(style: TextStyle | undefined): TextStyle {
    return style ? { ...style } : {};
  }

  protected compactTextSegments(
    textSegments: TextSegment[],
    fallbackStyle: TextStyle | undefined,
  ): TextSegment[] {
    const compacted: TextSegment[] = [];
    textSegments.forEach((segment) => {
      const segmentText = String(segment.text || "");
      if (segmentText.length === 0) return;
      const segmentStyle = this.cloneTextStyleValue(segment.style);
      const previous = compacted[compacted.length - 1];
      if (previous && this.textStylesEqual(previous.style, segmentStyle)) {
        previous.text += segmentText;
        return;
      }
      compacted.push({
        text: segmentText,
        style: segmentStyle,
      });
    });

    if (compacted.length === 0) {
      return [
        {
          text: "",
          style: this.cloneTextStyleValue(fallbackStyle),
        },
      ];
    }
    return compacted;
  }
}
