import { XmlObject, TextStyle } from "../../types";

import type {
  ShapeTextParsingContext,
  ParagraphStyleResult,
} from "./PptxHandlerRuntimeTypes";
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeShapeBodyParsing";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  /**
   * Resolve paragraph-level styles (alignment, spacing, margins, tabs,
   * level styles) for a single paragraph.  Modifies `textStyle` in place
   * for "first-wins" shape-level properties.
   */
  protected resolveShapeParagraphStyle(
    p: XmlObject,
    textStyle: TextStyle,
    ctx: ShapeTextParsingContext,
  ): ParagraphStyleResult {
    const pPr = p["a:pPr"] as XmlObject | undefined;
    const paragraphRtl = this.parseOptionalBooleanAttr(pPr?.["@_rtl"]);
    if (paragraphRtl !== undefined && textStyle.rtl === undefined) {
      textStyle.rtl = paragraphRtl;
    }

    let paraAlign: TextStyle["align"] = paragraphRtl ? "right" : "left";
    if (pPr?.["@_algn"]) {
      const alignMap: Record<string, TextStyle["align"]> = {
        l: "left",
        ctr: "center",
        r: "right",
        just: "justify",
        justify: "justify",
        justLow: "justLow",
        dist: "dist",
        thaiDist: "thaiDist",
      };
      paraAlign = alignMap[pPr["@_algn"]] || "left";
      if (!textStyle.align) textStyle.align = paraAlign;
    }

    if (textStyle.paragraphSpacingBefore === undefined) {
      const spacingBefore = this.parseParagraphSpacingPx(
        pPr?.["a:spcBef"] as XmlObject | undefined,
      );
      if (spacingBefore !== undefined)
        textStyle.paragraphSpacingBefore = spacingBefore;
    }
    if (textStyle.paragraphSpacingAfter === undefined) {
      const spacingAfter = this.parseParagraphSpacingPx(
        pPr?.["a:spcAft"] as XmlObject | undefined,
      );
      if (spacingAfter !== undefined)
        textStyle.paragraphSpacingAfter = spacingAfter;
    }
    if (
      textStyle.lineSpacing === undefined &&
      textStyle.lineSpacingExactPt === undefined
    ) {
      const lnSpcNode = pPr?.["a:lnSpc"] as XmlObject | undefined;
      const lineSpacing = this.parseLineSpacingMultiplier(lnSpcNode);
      if (lineSpacing !== undefined) {
        textStyle.lineSpacing = lineSpacing;
      } else {
        const exactPt = this.parseLineSpacingExactPt(lnSpcNode);
        if (exactPt !== undefined) textStyle.lineSpacingExactPt = exactPt;
      }
    }

    // Paragraph indentation (marL, marR, indent)
    if (
      textStyle.paragraphMarginLeft === undefined &&
      pPr?.["@_marL"] !== undefined
    ) {
      const marL = Number.parseInt(String(pPr["@_marL"]), 10);
      if (Number.isFinite(marL)) {
        textStyle.paragraphMarginLeft = marL / PptxHandlerRuntime.EMU_PER_PX;
      }
    }
    if (
      textStyle.paragraphMarginRight === undefined &&
      pPr?.["@_marR"] !== undefined
    ) {
      const marR = Number.parseInt(String(pPr["@_marR"]), 10);
      if (Number.isFinite(marR)) {
        textStyle.paragraphMarginRight = marR / PptxHandlerRuntime.EMU_PER_PX;
      }
    }
    if (
      textStyle.paragraphIndent === undefined &&
      pPr?.["@_indent"] !== undefined
    ) {
      const indent = Number.parseInt(String(pPr["@_indent"]), 10);
      if (Number.isFinite(indent)) {
        textStyle.paragraphIndent = indent / PptxHandlerRuntime.EMU_PER_PX;
      }
    }

    // Tab stops (a:tabLst > a:tab)
    if (!textStyle.tabStops) {
      const tabLst = pPr?.["a:tabLst"] as XmlObject | undefined;
      if (tabLst) {
        const tabNodes = this.ensureArray(tabLst["a:tab"]) as XmlObject[];
        if (tabNodes.length > 0) {
          textStyle.tabStops = tabNodes
            .filter((t) => t?.["@_pos"] !== undefined)
            .map((t) => {
              const posRaw = Number.parseInt(String(t["@_pos"]), 10);
              const position = Number.isFinite(posRaw)
                ? posRaw / PptxHandlerRuntime.EMU_PER_PX
                : 0;
              const algn = String(t["@_algn"] || "l").trim();
              const align =
                algn === "ctr" || algn === "r" || algn === "dec"
                  ? algn
                  : ("l" as const);
              const leaderVal = String(t["@_leader"] || "").trim();
              const leader =
                leaderVal === "dot" ||
                leaderVal === "hyphen" ||
                leaderVal === "underscore"
                  ? leaderVal
                  : undefined;
              return { position, align, ...(leader ? { leader } : {}) };
            });
        }
      }
    }

    // Additional paragraph properties
    if (pPr?.["@_defTabSz"] !== undefined && textStyle.defaultTabSize === undefined) {
      const defTabSz = Number.parseInt(String(pPr["@_defTabSz"]), 10);
      if (Number.isFinite(defTabSz)) {
        textStyle.defaultTabSize = defTabSz / PptxHandlerRuntime.EMU_PER_PX;
      }
    }
    if (pPr?.["@_eaLnBrk"] !== undefined && textStyle.eaLineBreak === undefined) {
      const eaVal = this.parseOptionalBooleanAttr(pPr["@_eaLnBrk"]);
      if (eaVal !== undefined) textStyle.eaLineBreak = eaVal;
    }
    if (pPr?.["@_latinLnBrk"] !== undefined && textStyle.latinLineBreak === undefined) {
      const latVal = this.parseOptionalBooleanAttr(pPr["@_latinLnBrk"]);
      if (latVal !== undefined) textStyle.latinLineBreak = latVal;
    }
    if (pPr?.["@_fontAlgn"] !== undefined && textStyle.fontAlignment === undefined) {
      const fontAlgn = String(pPr["@_fontAlgn"]).trim();
      if (fontAlgn) textStyle.fontAlignment = fontAlgn;
    }
    if (pPr?.["@_hangingPunct"] !== undefined && textStyle.hangingPunctuation === undefined) {
      const hpVal = this.parseOptionalBooleanAttr(pPr["@_hangingPunct"]);
      if (hpVal !== undefined) textStyle.hangingPunctuation = hpVal;
    }

    // Resolve run-level default styles
    const defaultRunStyle = this.extractTextRunStyle(
      pPr?.["a:defRPr"],
      paraAlign,
      ctx.slideRelationshipMap,
    );
    const level = Number.parseInt(String(pPr?.["@_lvl"] || "0"), 10);
    const levelKey = `a:lvl${Number.isFinite(level) ? Math.min(Math.max(level + 1, 1), 9) : 1}pPr`;
    const inheritedLevelStyle = this.extractTextRunStyle(
      ctx.inheritedTxBody?.["a:lstStyle"]?.[levelKey]?.["a:defRPr"],
      paraAlign,
      ctx.slideRelationshipMap,
    );
    const bodyLevelStyle = this.extractTextRunStyle(
      ctx.txBody?.["a:lstStyle"]?.[levelKey]?.["a:defRPr"],
      paraAlign,
      ctx.slideRelationshipMap,
    );
    const endParagraphStyle = this.extractTextRunStyle(
      p?.["a:endParaRPr"],
      paraAlign,
      ctx.slideRelationshipMap,
    );
    const mergedDefaultRunStyle = {
      ...ctx.bodyDefaultRunStyle,
      ...inheritedLevelStyle,
      ...bodyLevelStyle,
      ...endParagraphStyle,
      ...defaultRunStyle,
    } as TextStyle;

    // Apply placeholder level-specific defaults as fallback
    if (ctx.effectiveLevelStyles) {
      const normalizedLevel = Number.isFinite(level)
        ? Math.min(Math.max(level, 0), 8)
        : 0;
      const phLevel =
        ctx.effectiveLevelStyles[normalizedLevel] ??
        ctx.effectiveLevelStyles[-1];
      if (phLevel) {
        this.applyPlaceholderLevelDefaults(mergedDefaultRunStyle, phLevel);
        this.applyPlaceholderLevelDefaults(textStyle, phLevel);
      }
    }

    // Per-paragraph indentation (also checking placeholder level defaults)
    const parMarginLeft =
      pPr?.["@_marL"] !== undefined
        ? Number.parseInt(String(pPr["@_marL"]), 10) /
          PptxHandlerRuntime.EMU_PER_PX
        : undefined;
    const parIndent =
      pPr?.["@_indent"] !== undefined
        ? Number.parseInt(String(pPr["@_indent"]), 10) /
          PptxHandlerRuntime.EMU_PER_PX
        : undefined;
    let effectiveMarginLeft = parMarginLeft;
    let effectiveIndent = parIndent;
    if (ctx.effectiveLevelStyles) {
      const normalizedLevel = Number.isFinite(level)
        ? Math.min(Math.max(level, 0), 8)
        : 0;
      const phLevel =
        ctx.effectiveLevelStyles[normalizedLevel] ??
        ctx.effectiveLevelStyles[-1];
      if (phLevel) {
        if (
          effectiveMarginLeft === undefined &&
          phLevel.marginLeft !== undefined
        ) {
          effectiveMarginLeft = phLevel.marginLeft;
        }
        if (effectiveIndent === undefined && phLevel.indent !== undefined) {
          effectiveIndent = phLevel.indent;
        }
      }
    }

    return {
      paraAlign,
      mergedDefaultRunStyle,
      indent: { marginLeft: effectiveMarginLeft, indent: effectiveIndent },
    };
  }
}
