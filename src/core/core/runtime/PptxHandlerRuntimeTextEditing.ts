import { TextSegment, TextStyle, XmlObject } from "../../types";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeTextRunStyleExtraction";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  protected extractTextSegmentsFromTxBodyForRewrite(
    txBody: XmlObject | undefined,
    baseStyle: TextStyle | undefined,
    relationshipMap?: Map<string, string>,
  ): TextSegment[] {
    if (!txBody) return [];

    const paragraphs = this.ensureArray(txBody["a:p"]) as XmlObject[];
    if (paragraphs.length === 0) return [];

    const segments: TextSegment[] = [];

    paragraphs.forEach((paragraph, paragraphIndex) => {
      if (!paragraph) return;

      const paragraphProps = paragraph["a:pPr"] as XmlObject | undefined;
      const alignMap: Record<string, NonNullable<TextStyle["align"]>> = {
        l: "left",
        ctr: "center",
        r: "right",
        just: "justify",
        justify: "justify",
      };
      const alignToken = String(paragraphProps?.["@_algn"] || "")
        .trim()
        .toLowerCase();
      const paragraphRtl = this.parseOptionalBooleanAttr(
        paragraphProps?.["@_rtl"],
      );
      const paragraphAlign =
        alignMap[alignToken] ||
        baseStyle?.align ||
        (paragraphRtl ? "right" : "left");

      const paragraphDefaultStyle = {
        ...(baseStyle || {}),
        ...(paragraphRtl !== undefined ? { rtl: paragraphRtl } : {}),
        ...this.extractTextRunStyle(
          paragraphProps?.["a:defRPr"] as XmlObject | undefined,
          paragraphAlign,
          relationshipMap,
        ),
      } as TextStyle;

      const appendRunSegment = (
        value: unknown,
        runProperties: XmlObject | undefined,
      ): void => {
        if (value === undefined || value === null) return;
        const runText = typeof value === "string" ? value : String(value);
        if (runText.length === 0) return;
        const runStyle = {
          ...paragraphDefaultStyle,
          ...this.extractTextRunStyle(
            runProperties,
            paragraphAlign,
            relationshipMap,
          ),
        } as TextStyle;
        segments.push({
          text: runText,
          style: runStyle,
        });
      };

      const runs = this.ensureArray(paragraph["a:r"]) as XmlObject[];
      runs.forEach((run) => {
        if (!run) return;
        appendRunSegment(run["a:t"], run["a:rPr"] as XmlObject | undefined);
      });

      const fields = this.ensureArray(paragraph["a:fld"]) as XmlObject[];
      fields.forEach((field) => {
        if (!field) return;
        const fieldText = field["a:t"];
        const fieldRunProps = field["a:rPr"] as XmlObject | undefined;
        const value =
          fieldText === undefined || fieldText === null
            ? undefined
            : typeof fieldText === "string"
              ? fieldText
              : String(fieldText);
        if (value === undefined || value.length === 0) return;
        const runStyle = {
          ...paragraphDefaultStyle,
          ...this.extractTextRunStyle(
            fieldRunProps,
            paragraphAlign,
            relationshipMap,
          ),
        } as TextStyle;
        const fieldType = String(field["@_type"] || "").trim() || undefined;
        const fieldGuid = String(field["@_id"] || "").trim() || undefined;
        segments.push({
          text: value,
          style: runStyle,
          fieldType,
          fieldGuid,
        });
      });

      if (paragraph["a:t"] !== undefined) {
        appendRunSegment(
          paragraph["a:t"],
          paragraph["a:rPr"] as XmlObject | undefined,
        );
      }

      const lineBreaks = this.ensureArray(paragraph["a:br"]);
      lineBreaks.forEach(() => {
        segments.push({
          text: "\n",
          style: this.cloneTextStyleValue(paragraphDefaultStyle),
        });
      });

      if (paragraphIndex < paragraphs.length - 1) {
        segments.push({
          text: "\n",
          style: this.cloneTextStyleValue(paragraphDefaultStyle),
        });
      }
    });

    return this.compactTextSegments(segments, baseStyle);
  }

  protected remapEditedTextToExistingStyles(
    existingSegments: TextSegment[],
    nextText: string,
    fallbackStyle: TextStyle | undefined,
  ): TextSegment[] {
    const normalizedNextText = this.normalizeTextLineBreaks(nextText);
    const existingChars: Array<{ char: string; style: TextStyle }> = [];

    existingSegments.forEach((segment) => {
      const segmentText = this.normalizeTextLineBreaks(
        String(segment.text || ""),
      );
      const segmentStyle = {
        ...(fallbackStyle || {}),
        ...(segment.style || {}),
      } as TextStyle;
      for (const char of Array.from(segmentText)) {
        existingChars.push({
          char,
          style: this.cloneTextStyleValue(segmentStyle),
        });
      }
    });

    const nextChars = Array.from(normalizedNextText);
    if (nextChars.length === 0) {
      return [
        {
          text: "",
          style: this.cloneTextStyleValue(
            existingChars[0]?.style || fallbackStyle,
          ),
        },
      ];
    }

    if (existingChars.length === 0) {
      return [
        {
          text: normalizedNextText,
          style: this.cloneTextStyleValue(fallbackStyle),
        },
      ];
    }

    const existingTextChars = existingChars.map((entry) => entry.char);
    let prefixLength = 0;
    while (
      prefixLength < existingTextChars.length &&
      prefixLength < nextChars.length &&
      existingTextChars[prefixLength] === nextChars[prefixLength]
    ) {
      prefixLength += 1;
    }

    let existingSuffixIndex = existingTextChars.length - 1;
    let nextSuffixIndex = nextChars.length - 1;
    while (
      existingSuffixIndex >= prefixLength &&
      nextSuffixIndex >= prefixLength &&
      existingTextChars[existingSuffixIndex] === nextChars[nextSuffixIndex]
    ) {
      existingSuffixIndex -= 1;
      nextSuffixIndex -= 1;
    }

    const remappedChars: Array<{ char: string; style: TextStyle }> = [];
    for (let index = 0; index < prefixLength; index++) {
      remappedChars.push({
        char: nextChars[index],
        style: this.cloneTextStyleValue(existingChars[index]?.style),
      });
    }

    const insertedStyle = this.cloneTextStyleValue(
      (prefixLength > 0 ? existingChars[prefixLength - 1]?.style : undefined) ||
        (existingSuffixIndex + 1 < existingChars.length
          ? existingChars[existingSuffixIndex + 1]?.style
          : undefined) ||
        existingChars[0]?.style ||
        fallbackStyle,
    );
    for (
      let index = prefixLength;
      index <= nextSuffixIndex && index < nextChars.length;
      index++
    ) {
      remappedChars.push({
        char: nextChars[index],
        style: this.cloneTextStyleValue(insertedStyle),
      });
    }

    const existingSuffixStart = existingSuffixIndex + 1;
    const nextSuffixStart = nextSuffixIndex + 1;
    for (let index = 0; index < nextChars.length - nextSuffixStart; index++) {
      remappedChars.push({
        char: nextChars[nextSuffixStart + index],
        style: this.cloneTextStyleValue(
          existingChars[existingSuffixStart + index]?.style || insertedStyle,
        ),
      });
    }

    const remappedSegments = remappedChars.map((entry) => ({
      text: entry.char,
      style: entry.style,
    }));
    return this.compactTextSegments(remappedSegments, fallbackStyle);
  }
}
