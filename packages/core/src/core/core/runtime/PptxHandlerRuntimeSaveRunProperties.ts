import { XmlObject, TextStyle } from "../../types";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeSaveSlideUtils";
import { buildTextRunEffectListXml } from "./text-run-effect-xml-builder";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  protected createRunPropertiesFromTextStyle(
    style: TextStyle | undefined,
    resolveHyperlinkRelationshipId?: (target: string) => string | undefined,
  ): XmlObject {
    const runProps: XmlObject = {
      "@_lang": style?.language || "en-US",
      "@_dirty": "0",
    };
    if (!style) return runProps;

    if (typeof style.fontSize === "number" && Number.isFinite(style.fontSize)) {
      runProps["@_sz"] = String(Math.round(style.fontSize * (72 / 96) * 100));
    }
    if (style.bold !== undefined) {
      runProps["@_b"] = style.bold ? "1" : "0";
    }
    if (style.italic !== undefined) {
      runProps["@_i"] = style.italic ? "1" : "0";
    }
    if (style.underline) {
      runProps["@_u"] = style.underlineStyle || "sng";
    }
    if (style.strikethrough !== undefined) {
      runProps["@_strike"] = style.strikethrough
        ? style.strikeType || "sngStrike"
        : "noStrike";
    }
    // Superscript / subscript baseline
    if (typeof style.baseline === "number" && style.baseline !== 0) {
      runProps["@_baseline"] = String(style.baseline);
    }
    // Character spacing
    if (
      typeof style.characterSpacing === "number" &&
      style.characterSpacing !== 0
    ) {
      runProps["@_spc"] = String(style.characterSpacing);
    }
    // Kerning
    if (typeof style.kerning === "number" && style.kerning !== 0) {
      runProps["@_kern"] = String(style.kerning);
    }
    // Text caps
    if (style.textCaps && style.textCaps !== "none") {
      runProps["@_cap"] = style.textCaps;
    }
    if (style.rtl !== undefined) {
      runProps["@_rtl"] = style.rtl ? "1" : "0";
    }
    // Run metadata
    if (style.kumimoji !== undefined) {
      runProps["@_kumimoji"] = style.kumimoji ? "1" : "0";
    }
    if (style.normalizeHeight !== undefined) {
      runProps["@_normalizeH"] = style.normalizeHeight ? "1" : "0";
    }
    if (style.noProof !== undefined) {
      runProps["@_noProof"] = style.noProof ? "1" : "0";
    }
    if (style.dirty !== undefined) {
      runProps["@_dirty"] = style.dirty ? "1" : "0";
    }
    if (style.spellingError !== undefined) {
      runProps["@_err"] = style.spellingError ? "1" : "0";
    }
    if (style.smartTagClean !== undefined) {
      runProps["@_smtClean"] = style.smartTagClean ? "1" : "0";
    }
    if (style.bookmark) {
      runProps["@_bmk"] = style.bookmark;
    }
    if (style.fontFamily) {
      runProps["a:latin"] = { "@_typeface": style.fontFamily };
      runProps["a:ea"] = {
        "@_typeface": style.eastAsiaFont || style.fontFamily,
      };
      runProps["a:cs"] = {
        "@_typeface": style.complexScriptFont || style.fontFamily,
      };
    }
    // Symbol font
    if (style.symbolFont) {
      runProps["a:sym"] = { "@_typeface": style.symbolFont };
    }
    if (style.color) {
      runProps["a:solidFill"] = {
        "a:srgbClr": {
          "@_val": style.color.replace("#", ""),
        },
      };
    }
    if (style.highlightColor) {
      runProps["a:highlight"] = {
        "a:srgbClr": {
          "@_val": style.highlightColor.replace("#", ""),
        },
      };
    }
    // Text gradient fill round-trip from structured data
    if (
      style.textFillGradientStops &&
      style.textFillGradientStops.length > 0
    ) {
      const gradStops = style.textFillGradientStops
        .filter((stop) => Boolean(stop?.color))
        .map((stop) => {
          const rawPos = (stop.position ?? 0) / 100;
          const posVal = Math.round(
            Math.max(0, Math.min(1, rawPos)) * 100000,
          );
          const stopXml: XmlObject = {
            "@_pos": String(posVal),
            "a:srgbClr": {
              "@_val": String(stop.color || "").replace("#", ""),
            },
          };
          if (
            typeof stop.opacity === "number" &&
            Number.isFinite(stop.opacity) &&
            stop.opacity < 1
          ) {
            (stopXml["a:srgbClr"] as XmlObject)["a:alpha"] = {
              "@_val": String(Math.round(stop.opacity * 100000)),
            };
          }
          return stopXml;
        });
      if (gradStops.length > 0) {
        const gradFillXml: XmlObject = {
          "a:gsLst": { "a:gs": gradStops },
        };
        const gradType = style.textFillGradientType || "linear";
        if (gradType === "linear") {
          const angle =
            typeof style.textFillGradientAngle === "number" &&
            Number.isFinite(style.textFillGradientAngle)
              ? style.textFillGradientAngle
              : 0;
          gradFillXml["a:lin"] = {
            "@_ang": String(Math.round(angle * 60000)),
            "@_scaled": "1",
          };
        } else {
          gradFillXml["a:path"] = { "@_path": "circle" };
        }
        runProps["a:gradFill"] = gradFillXml;
      }
    }

    // Text pattern fill
    if (style.textFillPattern) {
      const pattFill: XmlObject = { "@_prst": style.textFillPattern };
      if (style.textFillPatternForeground) {
        pattFill["a:fgClr"] = {
          "a:srgbClr": {
            "@_val": style.textFillPatternForeground.replace("#", ""),
          },
        };
      }
      if (style.textFillPatternBackground) {
        pattFill["a:bgClr"] = {
          "a:srgbClr": {
            "@_val": style.textFillPatternBackground.replace("#", ""),
          },
        };
      }
      runProps["a:pattFill"] = pattFill;
    }
    // Underline colour
    if (style.underline && style.underlineColor) {
      runProps["a:uFill"] = {
        "a:solidFill": {
          "a:srgbClr": {
            "@_val": style.underlineColor.replace("#", ""),
          },
        },
      };
    }
    // Text outline
    if (style.textOutlineWidth || style.textOutlineColor) {
      const lnObj: XmlObject = {};
      if (
        typeof style.textOutlineWidth === "number" &&
        style.textOutlineWidth > 0
      ) {
        lnObj["@_w"] = String(
          Math.round(style.textOutlineWidth * PptxHandlerRuntime.EMU_PER_PX),
        );
      }
      if (style.textOutlineColor) {
        lnObj["a:solidFill"] = {
          "a:srgbClr": {
            "@_val": style.textOutlineColor.replace("#", ""),
          },
        };
      }
      runProps["a:ln"] = lnObj;
    }
    // Text run effects → a:effectLst
    const textEffectLst = buildTextRunEffectListXml(style);
    if (textEffectLst) {
      runProps["a:effectLst"] = textEffectLst;
    }
    if (style.hyperlink && resolveHyperlinkRelationshipId) {
      const hyperlinkTarget = String(style.hyperlink).trim();
      // Action hyperlinks (ppaction:// verbs) don't need relationship IDs
      if (hyperlinkTarget.startsWith("ppaction://")) {
        const hlinkNode: XmlObject = {
          "@_action": hyperlinkTarget,
        };
        if (style.hyperlinkTooltip) {
          hlinkNode["@_tooltip"] = style.hyperlinkTooltip;
        }
        // Some action links (e.g. hlinksldjump) still need an rId
        if (style.hyperlinkRId) {
          hlinkNode["@_r:id"] = style.hyperlinkRId;
        }
        this.applyHyperlinkExtraAttrs(hlinkNode, style);
        runProps["a:hlinkClick"] = hlinkNode;
      } else if (hyperlinkTarget.length > 0) {
        const hyperlinkRelationshipId =
          resolveHyperlinkRelationshipId(hyperlinkTarget);
        if (hyperlinkRelationshipId) {
          const hlinkNode: XmlObject = {
            "@_r:id": hyperlinkRelationshipId,
          };
          if (style.hyperlinkTooltip) {
            hlinkNode["@_tooltip"] = style.hyperlinkTooltip;
          }
          if (style.hyperlinkAction) {
            hlinkNode["@_action"] = style.hyperlinkAction;
          }
          this.applyHyperlinkExtraAttrs(hlinkNode, style);
          runProps["a:hlinkClick"] = hlinkNode;
        }
      }
    }
    if (style.hyperlinkMouseOver && resolveHyperlinkRelationshipId) {
      const mouseOverTarget = String(style.hyperlinkMouseOver).trim();
      if (mouseOverTarget.length > 0) {
        const mouseOverRelId = resolveHyperlinkRelationshipId(mouseOverTarget);
        if (mouseOverRelId) {
          runProps["a:hlinkMouseOver"] = {
            "@_r:id": mouseOverRelId,
          };
        }
      }
    }

    return runProps;
  }

  private applyHyperlinkExtraAttrs(hlinkNode: XmlObject, style: TextStyle): void {
    if (style.hyperlinkInvalidUrl) {
      hlinkNode["@_invalidUrl"] = style.hyperlinkInvalidUrl;
    }
    if (style.hyperlinkTargetFrame) {
      hlinkNode["@_tgtFrame"] = style.hyperlinkTargetFrame;
    }
    if (style.hyperlinkHistory !== undefined) {
      hlinkNode["@_history"] = style.hyperlinkHistory ? "1" : "0";
    }
    if (style.hyperlinkHighlightClick !== undefined) {
      hlinkNode["@_highlightClick"] = style.hyperlinkHighlightClick ? "1" : "0";
    }
    if (style.hyperlinkEndSound !== undefined) {
      hlinkNode["@_endSnd"] = style.hyperlinkEndSound ? "1" : "0";
    }
  }
}
