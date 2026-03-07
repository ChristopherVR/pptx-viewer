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
}
