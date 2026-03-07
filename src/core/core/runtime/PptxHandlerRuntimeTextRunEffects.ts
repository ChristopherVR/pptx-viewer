import { TextStyle, XmlObject } from "../../types";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeTextStyleUtils";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  /**
   * Parse hyperlink-related properties (a:hlinkClick, a:hlinkMouseOver) from
   * run-level XML and apply them to the given TextStyle.
   */
  protected applyHyperlinkStyle(
    style: TextStyle,
    runProperties: XmlObject,
    relationshipMap?: Map<string, string>,
  ): void {
    const hyperlinkNode = runProperties["a:hlinkClick"] as
      | XmlObject
      | undefined;
    const hyperlinkRelationshipId = String(
      hyperlinkNode?.["@_r:id"] || hyperlinkNode?.["@_id"] || "",
    ).trim();
    if (hyperlinkRelationshipId.length > 0) {
      style.hyperlinkRId = hyperlinkRelationshipId;
      const hyperlinkTarget = relationshipMap?.get(hyperlinkRelationshipId);
      if (hyperlinkTarget) {
        style.hyperlink = hyperlinkTarget;
      }
    }
    const tooltip = String(hyperlinkNode?.["@_tooltip"] || "").trim();
    if (tooltip) {
      style.hyperlinkTooltip = tooltip;
    }
    // Additional hyperlink attributes
    if (hyperlinkNode) {
      const invalidUrl = String(hyperlinkNode["@_invalidUrl"] || "").trim();
      if (invalidUrl) style.hyperlinkInvalidUrl = invalidUrl;
      const tgtFrame = String(hyperlinkNode["@_tgtFrame"] || "").trim();
      if (tgtFrame) style.hyperlinkTargetFrame = tgtFrame;
      const historyAttr = hyperlinkNode["@_history"];
      if (historyAttr !== undefined) {
        const hVal = String(historyAttr).trim().toLowerCase();
        style.hyperlinkHistory = hVal !== "0" && hVal !== "false";
      }
      const highlightClick = hyperlinkNode["@_highlightClick"];
      if (highlightClick !== undefined) {
        const hcVal = String(highlightClick).trim().toLowerCase();
        style.hyperlinkHighlightClick = hcVal === "1" || hcVal === "true";
      }
      const endSnd = hyperlinkNode["@_endSnd"];
      if (endSnd !== undefined) {
        const esVal = String(endSnd).trim().toLowerCase();
        style.hyperlinkEndSound = esVal === "1" || esVal === "true";
      }
    }
    const actionStr = String(hyperlinkNode?.["@_action"] || "").trim();
    if (actionStr) {
      style.hyperlinkAction = actionStr;
      // For action hyperlinks without an explicit URL (ppaction:// verbs),
      // derive a user-visible hyperlink so the link is clickable.
      if (!style.hyperlink && actionStr.startsWith("ppaction://")) {
        style.hyperlink = actionStr;
      }
    }
    // Resolve internal slide jump targets from action hyperlinks
    if (
      actionStr === "ppaction://hlinksldjump" &&
      hyperlinkRelationshipId.length > 0 &&
      relationshipMap
    ) {
      const slideTarget = relationshipMap.get(hyperlinkRelationshipId);
      if (slideTarget) {
        const slideMatch = slideTarget.match(/slide(\d+)\.xml$/i);
        if (slideMatch) {
          style.hyperlinkTargetSlideIndex = parseInt(slideMatch[1], 10) - 1;
        }
      }
    }

    const hlinkMouseOver = runProperties["a:hlinkMouseOver"] as
      | XmlObject
      | undefined;
    if (hlinkMouseOver) {
      const mouseOverRelId = String(
        hlinkMouseOver["@_r:id"] || hlinkMouseOver["@_id"] || "",
      ).trim();
      if (mouseOverRelId.length > 0) {
        const mouseOverTarget = relationshipMap?.get(mouseOverRelId);
        if (mouseOverTarget) {
          style.hyperlinkMouseOver = mouseOverTarget;
        } else {
          style.hyperlinkMouseOver = mouseOverRelId;
        }
      }
    }
  }

  /**
   * Parse text-run-level effects (a:effectLst on a:rPr) — outer shadow, glow,
   * and reflection — and apply them to the given TextStyle.
   */
  protected applyTextRunEffects(
    style: TextStyle,
    runEffectList: XmlObject,
  ): void {
    // Outer shadow
    const outerShdw = runEffectList["a:outerShdw"] as XmlObject | undefined;
    if (outerShdw) {
      const shdwColor = this.parseColor(outerShdw);
      if (shdwColor) style.textShadowColor = shdwColor;
      const shdwOpacity = this.extractColorOpacity(outerShdw);
      if (shdwOpacity !== undefined) style.textShadowOpacity = shdwOpacity;
      const blurRaw = Number.parseInt(String(outerShdw["@_blurRad"] || ""), 10);
      if (Number.isFinite(blurRaw) && blurRaw >= 0) {
        style.textShadowBlur = blurRaw / PptxHandlerRuntimeBase.EMU_PER_PX;
      }
      const distRaw = Number.parseInt(String(outerShdw["@_dist"] || ""), 10);
      const dirRaw = Number.parseInt(String(outerShdw["@_dir"] || ""), 10);
      if (Number.isFinite(distRaw) && distRaw >= 0) {
        const dist = distRaw / PptxHandlerRuntimeBase.EMU_PER_PX;
        const dirRad =
          ((Number.isFinite(dirRaw) ? dirRaw / 60000 : 0) * Math.PI) / 180;
        style.textShadowOffsetX =
          Math.round(Math.cos(dirRad) * dist * 100) / 100;
        style.textShadowOffsetY =
          Math.round(Math.sin(dirRad) * dist * 100) / 100;
      }
    }
    // Glow
    const glowNode = runEffectList["a:glow"] as XmlObject | undefined;
    if (glowNode) {
      const glowColor = this.parseColor(glowNode);
      if (glowColor) style.textGlowColor = glowColor;
      const glowOpacity = this.extractColorOpacity(glowNode);
      if (glowOpacity !== undefined) style.textGlowOpacity = glowOpacity;
      const radRaw = Number.parseInt(String(glowNode["@_rad"] || ""), 10);
      if (Number.isFinite(radRaw) && radRaw >= 0) {
        style.textGlowRadius = radRaw / PptxHandlerRuntimeBase.EMU_PER_PX;
      }
    }
    // Reflection
    const reflNode = runEffectList["a:reflection"] as XmlObject | undefined;
    if (reflNode) {
      style.textReflection = true;
      const blurRaw = Number.parseInt(String(reflNode["@_blurRad"] || ""), 10);
      if (Number.isFinite(blurRaw) && blurRaw >= 0) {
        style.textReflectionBlur = blurRaw / PptxHandlerRuntimeBase.EMU_PER_PX;
      }
      const stA = Number.parseInt(String(reflNode["@_stA"] || ""), 10);
      if (Number.isFinite(stA)) style.textReflectionStartOpacity = stA / 100000;
      const endA = Number.parseInt(String(reflNode["@_endA"] || ""), 10);
      if (Number.isFinite(endA)) style.textReflectionEndOpacity = endA / 100000;
      const distRaw = Number.parseInt(String(reflNode["@_dist"] || ""), 10);
      if (Number.isFinite(distRaw) && distRaw >= 0) {
        style.textReflectionOffset =
          distRaw / PptxHandlerRuntimeBase.EMU_PER_PX;
      }
    }

    // Inner shadow
    const innerShdw = runEffectList["a:innerShdw"] as XmlObject | undefined;
    if (innerShdw) {
      const color = this.parseColor(innerShdw);
      if (color) style.textInnerShadowColor = color;
      const opacity = this.extractColorOpacity(innerShdw);
      if (opacity !== undefined) style.textInnerShadowOpacity = opacity;
      const isBlurRaw = Number.parseInt(String(innerShdw["@_blurRad"] || ""), 10);
      if (Number.isFinite(isBlurRaw) && isBlurRaw >= 0) {
        style.textInnerShadowBlur = isBlurRaw / PptxHandlerRuntimeBase.EMU_PER_PX;
      }
      const isDistRaw = Number.parseInt(String(innerShdw["@_dist"] || ""), 10);
      const isDirRaw = Number.parseInt(String(innerShdw["@_dir"] || ""), 10);
      if (Number.isFinite(isDistRaw) && isDistRaw >= 0) {
        const isDist = isDistRaw / PptxHandlerRuntimeBase.EMU_PER_PX;
        const isDirRad =
          ((Number.isFinite(isDirRaw) ? isDirRaw / 60000 : 0) * Math.PI) / 180;
        style.textInnerShadowOffsetX =
          Math.round(Math.cos(isDirRad) * isDist * 100) / 100;
        style.textInnerShadowOffsetY =
          Math.round(Math.sin(isDirRad) * isDist * 100) / 100;
      }
    }

    // Preset shadow
    const prstShdw = runEffectList["a:prstShdw"] as XmlObject | undefined;
    if (prstShdw) {
      const prst = String(prstShdw["@_prst"] || "").trim();
      if (prst) style.textPresetShadowName = prst;
      const color = this.parseColor(prstShdw);
      if (color) style.textPresetShadowColor = color;
      const opacity = this.extractColorOpacity(prstShdw);
      if (opacity !== undefined) style.textPresetShadowOpacity = opacity;
      const psDist = Number.parseInt(String(prstShdw["@_dist"] || ""), 10);
      if (Number.isFinite(psDist) && psDist >= 0) {
        style.textPresetShadowDistance = psDist / PptxHandlerRuntimeBase.EMU_PER_PX;
      }
      const psDir = Number.parseInt(String(prstShdw["@_dir"] || ""), 10);
      if (Number.isFinite(psDir)) {
        style.textPresetShadowDirection = psDir / 60000;
      }
    }

    // Blur
    const blurNode = runEffectList["a:blur"] as XmlObject | undefined;
    if (blurNode) {
      const radRaw = Number.parseInt(String(blurNode["@_rad"] || ""), 10);
      if (Number.isFinite(radRaw) && radRaw >= 0) {
        style.textBlurRadius = radRaw / PptxHandlerRuntimeBase.EMU_PER_PX;
      }
    }

    // Alpha modification fixed
    const alphaModFix = runEffectList["a:alphaModFix"] as XmlObject | undefined;
    if (alphaModFix) {
      const amt = Number.parseInt(String(alphaModFix["@_amt"] || ""), 10);
      if (Number.isFinite(amt)) {
        style.textAlphaModFix = amt / 1000;
      }
    }

    // Alpha modulation
    const alphaMod = runEffectList["a:alphaMod"] as XmlObject | undefined;
    if (alphaMod) {
      const amt = Number.parseInt(String(alphaMod["@_amt"] || ""), 10);
      if (Number.isFinite(amt)) {
        style.textAlphaMod = amt / 1000;
      }
    }

    // Hue/saturation/luminance
    const hslNode = runEffectList["a:hsl"] as XmlObject | undefined;
    if (hslNode) {
      const hue = Number.parseInt(String(hslNode["@_hue"] || ""), 10);
      if (Number.isFinite(hue)) style.textHslHue = hue / 60000;
      const sat = Number.parseInt(String(hslNode["@_sat"] || ""), 10);
      if (Number.isFinite(sat)) style.textHslSaturation = sat / 1000;
      const lum = Number.parseInt(String(hslNode["@_lum"] || ""), 10);
      if (Number.isFinite(lum)) style.textHslLuminance = lum / 1000;
    }

    // Colour change
    const clrChange = runEffectList["a:clrChange"] as XmlObject | undefined;
    if (clrChange) {
      const from = this.parseColor(clrChange["a:clrFrom"] as XmlObject | undefined);
      const to = this.parseColor(clrChange["a:clrTo"] as XmlObject | undefined);
      if (from) style.textClrChangeFrom = from;
      if (to) style.textClrChangeTo = to;
    }

    // Duotone
    const duotoneNode = runEffectList["a:duotone"] as XmlObject | undefined;
    if (duotoneNode) {
      const colorNodes = [
        ...this.ensureArray(duotoneNode["a:srgbClr"]),
        ...this.ensureArray(duotoneNode["a:schemeClr"]),
        ...this.ensureArray(duotoneNode["a:prstClr"]),
      ] as XmlObject[];
      if (colorNodes.length >= 2) {
        style.textDuotone = {
          color1: this.parseColor(colorNodes[0]) || "#000000",
          color2: this.parseColor(colorNodes[1]) || "#ffffff",
        };
      }
    }
  }
}
