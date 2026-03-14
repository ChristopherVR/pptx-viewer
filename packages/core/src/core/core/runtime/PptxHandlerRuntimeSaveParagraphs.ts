import {
  XmlObject,
  TextStyle,
  TextSegment,
  type BulletInfo,
} from "../../types";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeSaveRunProperties";
import {
  buildParagraphPropertiesXml,
  assembleParagraphXml,
  computeUniformSegmentOverrides,
  type ParagraphSpacingConfig,
} from "./PptxHandlerRuntimeSaveParagraphHelpers";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  protected createParagraphsFromTextContent(
    text: string | undefined,
    textStyle: TextStyle | undefined,
    textSegments: TextSegment[] | undefined,
    resolveHyperlinkRelationshipId?: (target: string) => string | undefined,
  ): XmlObject[] {
    const paragraphAlign = this.textAlignToDrawingValue(textStyle?.align);

    // Pre-compute spacing XML so the helpers stay pure
    const spacing: ParagraphSpacingConfig = {
      spacingBefore: this.createParagraphSpacingXmlFromPx(
        textStyle?.paragraphSpacingBefore,
      ),
      spacingAfter: this.createParagraphSpacingXmlFromPx(
        textStyle?.paragraphSpacingAfter,
      ),
      lineSpacing: this.createLineSpacingXmlFromMultiplier(
        textStyle?.lineSpacing,
      ),
      lineSpacingExactPt: textStyle?.lineSpacingExactPt,
    };

    const createParagraph = (
      runs: XmlObject[],
      bulletInfo?: BulletInfo,
    ): XmlObject => {
      const paragraphProps = buildParagraphPropertiesXml(
        textStyle,
        paragraphAlign,
        bulletInfo,
        spacing,
      );
      return assembleParagraphXml(runs, paragraphProps);
    };

    const createRun = (runText: string, style: TextStyle | undefined) => ({
      "a:rPr": this.createRunPropertiesFromTextStyle(
        style,
        resolveHyperlinkRelationshipId,
      ),
      "a:t": runText,
    });

    const createFieldRun = (
      runText: string,
      style: TextStyle | undefined,
      fieldType: string,
      fieldGuid?: string,
    ) => ({
      "@_type": fieldType,
      ...(fieldGuid ? { "@_id": fieldGuid } : {}),
      "a:rPr": this.createRunPropertiesFromTextStyle(
        style,
        resolveHyperlinkRelationshipId,
      ),
      "a:t": runText,
    });

    /**
     * Create a run with `a:ruby` containing phonetic annotation.
     * Produces the OOXML `a:r > a:ruby > { a:rubyPr, a:rt, a:rubyBase }` structure.
     */
    const createRubyRun = (segment: TextSegment, style: TextStyle) => {
      const rubyPr: XmlObject = {};
      if (segment.rubyAlignment) {
        rubyPr["@_algn"] = segment.rubyAlignment;
      }
      if (segment.rubyFontSize !== undefined) {
        // Store as half-point size (hps)
        rubyPr["@_hps"] = String(Math.round(segment.rubyFontSize * 2));
      }
      // Ruby text run (phonetic annotation)
      const rtRunProps = this.createRunPropertiesFromTextStyle(
        segment.rubyStyle ?? style,
        resolveHyperlinkRelationshipId,
      );
      const rtRun = {
        "a:rPr": rtRunProps,
        "a:t": segment.rubyText ?? "",
      };
      // Base text run
      const baseRunProps = this.createRunPropertiesFromTextStyle(
        style,
        resolveHyperlinkRelationshipId,
      );
      const baseRun = {
        "a:rPr": baseRunProps,
        "a:t": segment.text,
      };
      return {
        "a:rPr": this.createRunPropertiesFromTextStyle(
          style,
          resolveHyperlinkRelationshipId,
        ),
        "a:ruby": {
          "a:rubyPr": rubyPr,
          "a:rt": { "a:r": rtRun },
          "a:rubyBase": { "a:r": baseRun },
        },
      };
    };

    const paragraphs: XmlObject[] = [];
    let currentRuns: XmlObject[] = [];
    let currentBulletInfo: BulletInfo | undefined;
    const pushParagraph = (): void => {
      if (currentRuns.length === 0) {
        currentRuns.push(createRun("", textStyle));
      }
      paragraphs.push(createParagraph(currentRuns, currentBulletInfo));
      currentRuns = [];
      currentBulletInfo = undefined;
    };

    if (textSegments && textSegments.length > 0) {
      const uniformSegmentOverrides = computeUniformSegmentOverrides(
        textStyle,
        textSegments,
      );

      textSegments.forEach((segment) => {
        const segmentStyle = {
          ...(textStyle || {}),
          ...(segment.style || {}),
          ...uniformSegmentOverrides,
        } as TextStyle;
        const segmentText = String(segment.text ?? "");
        const lineParts = segmentText.split("\n");

        // Capture bullet info from the first segment of each paragraph
        if (currentRuns.length === 0 && segment.bulletInfo) {
          currentBulletInfo = segment.bulletInfo;
        }

        lineParts.forEach((linePart, lineIndex) => {
          if (segment.rubyText !== undefined) {
            // Ruby segment — emit as a:ruby structure
            const rubySeg = { ...segment, text: linePart };
            currentRuns.push(createRubyRun(rubySeg, segmentStyle));
          } else if (segment.fieldType) {
            const fieldRun = createFieldRun(
              linePart,
              segmentStyle,
              segment.fieldType,
              segment.fieldGuid,
            );
            (fieldRun as Record<string, unknown>).__isField = true;
            currentRuns.push(fieldRun);
          } else {
            currentRuns.push(createRun(linePart, segmentStyle));
          }
          if (lineIndex < lineParts.length - 1) {
            pushParagraph();
          }
        });
      });

      if (currentRuns.length > 0 || paragraphs.length === 0) {
        pushParagraph();
      }

      return paragraphs;
    }

    const normalizedText = typeof text === "string" ? text : "";
    const textLines = normalizedText.split("\n");
    textLines.forEach((line) => {
      paragraphs.push(createParagraph([createRun(line, textStyle)]));
    });

    if (paragraphs.length === 0) {
      paragraphs.push(createParagraph([createRun("", textStyle)]));
    }

    return paragraphs;
  }
}
