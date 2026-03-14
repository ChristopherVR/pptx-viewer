import { XmlObject, TextSegment, TextStyle } from "../../types";

import type {
  ShapeTextParsingContext,
  ParagraphContentResult,
} from "./PptxHandlerRuntimeTypes";
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeShapeTextParsing";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  /**
   * Collect text content (runs, fields, equations, bullets) for a single
   * paragraph and return text parts + segments.  The returned `seedStyle`
   * is the style from the first concrete content (used by the caller to
   * seed the shape-level textStyle).
   */
  protected collectShapeParagraphContent(
    p: XmlObject,
    pIdx: number,
    paraCount: number,
    paraAlign: TextStyle["align"],
    mergedDefaultRunStyle: TextStyle,
    ctx: ShapeTextParsingContext,
  ): ParagraphContentResult {
    const parts: string[] = [];
    const segments: TextSegment[] = [];
    let seedStyle: TextStyle | undefined;

    const maybeSeed = (style: TextStyle) => {
      if (!seedStyle) seedStyle = { ...style };
    };

    // Bullet info
    const isBodyPlaceholder =
      ctx.placeholderInfo?.type === "body" ||
      ctx.placeholderInfo?.type === "obj";
    const paragraphBulletInfo = this.resolveParagraphBulletInfo(
      p as XmlObject,
      pIdx,
      ctx.txBody as XmlObject,
      ctx.inheritedTxBody,
      isBodyPlaceholder,
      ctx.slidePath,
    );
    if (paragraphBulletInfo && !paragraphBulletInfo.none) {
      let bulletText: string;
      if (paragraphBulletInfo.char) {
        bulletText = `${paragraphBulletInfo.char} `;
      } else if (paragraphBulletInfo.autoNumType) {
        const startAt = paragraphBulletInfo.autoNumStartAt ?? 1;
        bulletText = this.formatAutoNumber(
          paragraphBulletInfo.autoNumType,
          startAt + pIdx,
        );
      } else if (paragraphBulletInfo.imageRelId) {
        bulletText = "\u{1F4CE} ";
      } else {
        bulletText = "• ";
      }
      parts.push(bulletText);
      segments.push({
        text: bulletText,
        style: { ...mergedDefaultRunStyle },
        bulletInfo: paragraphBulletInfo,
      });
      maybeSeed(mergedDefaultRunStyle);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const appendRun = (runText: string, runProps: any) => {
      const runStyle = {
        ...mergedDefaultRunStyle,
        ...this.extractTextRunStyle(
          runProps as XmlObject | undefined,
          paraAlign,
          ctx.slideRelationshipMap,
        ),
      } as TextStyle;
      parts.push(runText);
      segments.push({ text: runText, style: runStyle });
      maybeSeed(runStyle);
    };

    const runs = this.ensureArray(p["a:r"]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    runs.forEach((r: any) => {
      if (!r) return;

      // ── Ruby (phonetic guide) support ──
      const rubyNode = r["a:ruby"] as XmlObject | undefined;
      if (rubyNode) {
        const rubySegment = this.parseRubyElement(
          rubyNode,
          r["a:rPr"],
          paraAlign,
          mergedDefaultRunStyle,
          ctx.slideRelationshipMap,
        );
        if (rubySegment) {
          parts.push(rubySegment.text);
          segments.push(rubySegment);
          maybeSeed(rubySegment.style);
          return;
        }
      }

      const runText =
        typeof r["a:t"] === "string"
          ? r["a:t"]
          : r["a:t"] !== undefined
            ? String(r["a:t"])
            : "";
      appendRun(runText, r["a:rPr"]);
    });

    const fields = this.ensureArray(p["a:fld"]);
    fields.forEach((field: XmlObject | undefined) => {
      if (!field) return;
      const fieldText =
        typeof field["a:t"] === "string"
          ? field["a:t"]
          : field["a:t"] !== undefined
            ? String(field["a:t"])
            : "";
      const fieldRunStyle = {
        ...mergedDefaultRunStyle,
        ...this.extractTextRunStyle(
          field["a:rPr"] as XmlObject | undefined,
          paraAlign,
          ctx.slideRelationshipMap,
        ),
      } as TextStyle;
      const fldType = String(field["@_type"] || "").trim() || undefined;
      const fldGuid =
        String(field["@_uuid"] || field["@_id"] || "").trim() || undefined;
      parts.push(fieldText);
      segments.push({
        text: fieldText,
        style: fieldRunStyle,
        fieldType: fldType,
        fieldGuid: fldGuid,
      });
      maybeSeed(fieldRunStyle);
    });

    if (p["a:t"] !== undefined) {
      const directText =
        typeof p["a:t"] === "string" ? p["a:t"] : String(p["a:t"]);
      appendRun(directText, p["a:rPr"]);
    }

    // ── OMML equation segments (a14:m / m:oMathPara) ────────
    const mathElements = this.ensureArray(
      p["a14:m"] ?? p["m:oMathPara"] ?? p["m:oMath"],
    );
    for (const mathEl of mathElements) {
      if (!mathEl) continue;
      const eqText = "[Equation]";
      parts.push(eqText);
      segments.push({
        text: eqText,
        style: { ...mergedDefaultRunStyle },
        equationXml: mathEl as Record<string, unknown>,
      });
    }
    // Also check mc:AlternateContent wrapping math
    const mathAltContents = this.ensureArray(p["mc:AlternateContent"]);
    for (const ac of mathAltContents) {
      const choice = this.selectAlternateContentBranch(ac as XmlObject);
      if (!choice) continue;
      const innerMath =
        choice["a14:m"] ?? choice["m:oMathPara"] ?? choice["m:oMath"];
      if (!innerMath) continue;
      const eqText = "[Equation]";
      parts.push(eqText);
      segments.push({
        text: eqText,
        style: { ...mergedDefaultRunStyle },
        equationXml: innerMath as Record<string, unknown>,
      });
    }

    const lineBreaks = this.ensureArray(p["a:br"]);
    if (lineBreaks.length > 0) {
      lineBreaks.forEach(() => {
        parts.push("\n");
        segments.push({ text: "\n", style: { ...mergedDefaultRunStyle } });
      });
    }

    if (pIdx < paraCount - 1) {
      parts.push("\n");
      segments.push({ text: "\n", style: { ...mergedDefaultRunStyle } });
    }

    return { parts, segments, seedStyle };
  }

  /**
   * Parse an `a:ruby` element into a {@link TextSegment} with ruby annotation metadata.
   *
   * OOXML structure:
   * ```xml
   * <a:ruby>
   *   <a:rubyPr>
   *     <a:rubyAlign val="ctr"/>
   *   </a:rubyPr>
   *   <a:rt><a:r><a:rPr .../><a:t>phonetic</a:t></a:r></a:rt>
   *   <a:rubyBase><a:r><a:rPr .../><a:t>base</a:t></a:r></a:rubyBase>
   * </a:ruby>
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected parseRubyElement(
    rubyNode: XmlObject,
    runProps: any,
    paraAlign: TextStyle["align"],
    mergedDefaultRunStyle: TextStyle,
    slideRelationshipMap: Map<string, string> | undefined,
  ): TextSegment | undefined {
    // Extract ruby properties
    const rubyPr = rubyNode["a:rubyPr"] as XmlObject | undefined;
    const rubyAlign = String(rubyPr?.["@_algn"] ?? rubyPr?.["a:rubyAlign"]?.["@_val"] ?? "ctr").trim() || "ctr";

    // Extract ruby text (phonetic annotation) from a:rt
    const rtNode = rubyNode["a:rt"] as XmlObject | undefined;
    let rubyText = "";
    let rubyFontSize: number | undefined;
    let rubyStyle: TextStyle | undefined;
    if (rtNode) {
      const rtRuns = this.ensureArray(rtNode["a:r"]);
      const rtParts: string[] = [];
      for (const rtRun of rtRuns) {
        if (!rtRun) continue;
        const rtRunObj = rtRun as XmlObject;
        const t = rtRunObj["a:t"];
        if (t !== undefined) {
          rtParts.push(typeof t === "string" ? t : String(t));
        }
        // Parse style from the first ruby text run
        if (!rubyStyle) {
          rubyStyle = {
            ...mergedDefaultRunStyle,
            ...this.extractTextRunStyle(
              rtRunObj["a:rPr"] as XmlObject | undefined,
              paraAlign,
              slideRelationshipMap,
            ),
          } as TextStyle;
          if (rubyStyle.fontSize) {
            rubyFontSize = rubyStyle.fontSize;
          }
        }
      }
      rubyText = rtParts.join("");
    }

    // Extract base text from a:rubyBase
    const rubyBaseNode = rubyNode["a:rubyBase"] as XmlObject | undefined;
    let baseText = "";
    let baseStyle: TextStyle = { ...mergedDefaultRunStyle };
    if (rubyBaseNode) {
      const baseRuns = this.ensureArray(rubyBaseNode["a:r"]);
      const baseParts: string[] = [];
      for (const baseRun of baseRuns) {
        if (!baseRun) continue;
        const baseRunObj = baseRun as XmlObject;
        const t = baseRunObj["a:t"];
        if (t !== undefined) {
          baseParts.push(typeof t === "string" ? t : String(t));
        }
        // Use style from the first base run
        if (baseParts.length === 1) {
          baseStyle = {
            ...mergedDefaultRunStyle,
            ...this.extractTextRunStyle(
              baseRunObj["a:rPr"] as XmlObject | undefined,
              paraAlign,
              slideRelationshipMap,
            ),
          } as TextStyle;
        }
      }
      baseText = baseParts.join("");
    }

    // Also merge outer run props (a:rPr on the containing a:r)
    if (runProps) {
      const outerStyle = this.extractTextRunStyle(
        runProps as XmlObject | undefined,
        paraAlign,
        slideRelationshipMap,
      );
      baseStyle = { ...baseStyle, ...outerStyle };
    }

    if (!baseText && !rubyText) return undefined;

    // Check for hps (half-point size) on rubyPr
    if (rubyPr?.["@_hps"] !== undefined && rubyFontSize === undefined) {
      const hps = Number.parseInt(String(rubyPr["@_hps"]), 10);
      if (Number.isFinite(hps)) {
        rubyFontSize = hps / 2; // half-points to points
      }
    }

    return {
      text: baseText,
      style: baseStyle,
      rubyText,
      rubyAlignment: rubyAlign,
      rubyFontSize,
      rubyStyle,
    };
  }
}
