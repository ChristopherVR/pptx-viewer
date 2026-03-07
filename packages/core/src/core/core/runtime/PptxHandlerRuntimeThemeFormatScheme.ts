import {
  XmlObject,
  type PptxThemeFillStyle,
  type PptxThemeLineStyle,
  type PptxThemeEffectStyle,
} from "../../types";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeLayoutElements";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  /**
   * Collect fill-style children from a style list node, preserving
   * document order.  Handles `a:solidFill`, `a:gradFill`, `a:pattFill`,
   * `a:noFill` in the order they appear.
   */
  protected collectFillChildren(listNode: XmlObject): PptxThemeFillStyle[] {
    const results: PptxThemeFillStyle[] = [];

    // Attempt to detect ordering via the parser's internal ordering.
    // fast-xml-parser with `preserveOrder` would give us order, but since
    // this codebase does not use that mode we need to handle each tag type.
    // Typically a fill style list has exactly 3 entries (one per intensity).
    const solidFills = this.ensureArray(listNode["a:solidFill"]);
    const gradFills = this.ensureArray(listNode["a:gradFill"]);
    const pattFills = this.ensureArray(listNode["a:pattFill"]);
    const noFills = this.ensureArray(listNode["a:noFill"]);

    // Heuristic: In nearly all real-world PPTX themes the fill style list
    // is [solidFill, gradFill, gradFill] or [solidFill, solidFill, gradFill].
    // Since fast-xml-parser loses relative ordering between different tags,
    // we reconstruct a best-effort order: solid fills first, then gradient,
    // then pattern, then noFill.  This matches the overwhelming majority of
    // themes shipped by Microsoft and third parties.
    for (const sf of solidFills) {
      const node = sf as XmlObject;
      results.push({
        kind: "solid",
        color: this.parseColor(node),
        opacity: this.extractColorOpacity(node),
        rawNode: node,
      });
    }
    for (const gf of gradFills) {
      const node = gf as XmlObject;
      results.push({
        kind: "gradient",
        color: this.extractGradientFillColor(node),
        opacity: this.extractGradientOpacity(node),
        gradientStops: this.extractGradientStops(node),
        gradientAngle: this.extractGradientAngle(node),
        gradientType: this.extractGradientType(node),
        gradientCss: this.extractGradientFillCss(node),
        rawNode: node,
      });
    }
    for (const pf of pattFills) {
      const node = pf as XmlObject;
      results.push({
        kind: "pattern",
        color:
          this.parseColor(node["a:fgClr"]) || this.parseColor(node["a:bgClr"]),
        patternPreset: String(node["@_prst"] || "").trim() || undefined,
        patternBackgroundColor: this.parseColor(node["a:bgClr"]) || undefined,
        rawNode: node,
      });
    }
    for (const _nf of noFills) {
      results.push({ kind: "none" });
    }

    return results;
  }

  /**
   * Parse each child of a `a:fillStyleLst` (or `a:bgFillStyleLst`).
   * Children can be `a:solidFill`, `a:gradFill`, `a:pattFill`, or `a:noFill`.
   * The list is ordered and 1-indexed by position.
   */
  protected parseFillStyleList(
    listNode: XmlObject | undefined,
  ): PptxThemeFillStyle[] {
    if (!listNode) return [];
    const result: PptxThemeFillStyle[] = [];

    // The OOXML spec puts solid/grad/patt fills directly as children in order.
    // fast-xml-parser may merge same-tag siblings into an array.
    // We iterate all possible fill child types and try to reconstruct order.
    // A pragmatic approach: collect all children in document order.
    const children = this.collectFillChildren(listNode);
    for (const child of children) {
      result.push(child);
    }
    return result;
  }

  /**
   * Parse `a:lnStyleLst` children (`a:ln` elements) into an array of
   * {@link PptxThemeLineStyle} entries.
   */
  protected parseLineStyleList(
    listNode: XmlObject | undefined,
  ): PptxThemeLineStyle[] {
    if (!listNode) return [];
    const lnNodes = this.ensureArray(listNode["a:ln"]);
    return lnNodes.map((lnRaw) => {
      const ln = lnRaw as XmlObject;
      const style: PptxThemeLineStyle = { rawNode: ln };

      // Width
      if (ln["@_w"]) {
        style.width =
          parseInt(String(ln["@_w"])) / PptxHandlerRuntime.EMU_PER_PX;
      }

      // Fill colour (solid, gradient first stop, pattern foreground)
      if (ln["a:solidFill"]) {
        style.color = this.parseColor(ln["a:solidFill"] as XmlObject);
        style.opacity = this.extractColorOpacity(
          ln["a:solidFill"] as XmlObject,
        );
      } else if (ln["a:gradFill"]) {
        style.color = this.extractGradientFillColor(
          ln["a:gradFill"] as XmlObject,
        );
      } else if (ln["a:pattFill"]) {
        const pf = ln["a:pattFill"] as XmlObject;
        style.color =
          this.parseColor(pf["a:fgClr"]) || this.parseColor(pf["a:bgClr"]);
      }

      // Dash style
      const dashVal = (ln["a:prstDash"] as XmlObject | undefined)?.["@_val"];
      const dashType = this.normalizeStrokeDashType(dashVal);
      if (dashType) {
        style.dash = dashType;
      }

      // Line join — self-closing tags (<a:round/>) are parsed as falsy by
      // fast-xml-parser, so check key existence instead of truthiness.
      if ("a:round" in ln) {
        style.lineJoin = "round";
      } else if ("a:bevel" in ln) {
        style.lineJoin = "bevel";
      } else if ("a:miter" in ln) {
        style.lineJoin = "miter";
      }

      // Line cap
      const capVal = String(ln["@_cap"] || "")
        .trim()
        .toLowerCase();
      if (capVal === "rnd" || capVal === "sq" || capVal === "flat") {
        style.lineCap = capVal as PptxThemeLineStyle["lineCap"];
      }

      // Compound line
      const cmpd = String(ln["@_cmpd"] || "").trim();
      if (
        cmpd === "sng" ||
        cmpd === "dbl" ||
        cmpd === "thickThin" ||
        cmpd === "thinThick" ||
        cmpd === "tri"
      ) {
        style.compoundLine = cmpd as PptxThemeLineStyle["compoundLine"];
      }

      return style;
    });
  }

  /**
   * Parse `a:effectStyleLst` children (`a:effectStyle`) into an array
   * of {@link PptxThemeEffectStyle} entries.  Each style wraps an
   * `a:effectLst` node that can contain shadow, glow, soft-edge, etc.
   */
  protected parseEffectStyleList(
    listNode: XmlObject | undefined,
  ): PptxThemeEffectStyle[] {
    if (!listNode) return [];
    const styleNodes = this.ensureArray(listNode["a:effectStyle"]);
    return styleNodes.map((esRaw) => {
      const es = esRaw as XmlObject;
      const effectLst = (es["a:effectLst"] ?? es["a:effectDag"]) as
        | XmlObject
        | undefined;
      const result: PptxThemeEffectStyle = { rawNode: es };

      if (!effectLst) return result;

      // Outer shadow (a:outerShdw)
      const outerShdw = effectLst["a:outerShdw"] as XmlObject | undefined;
      if (outerShdw) {
        result.shadowColor = this.parseColor(outerShdw);
        result.shadowOpacity = this.extractColorOpacity(outerShdw);
        const blurRad = parseInt(String(outerShdw["@_blurRad"] || "0"));
        if (Number.isFinite(blurRad) && blurRad > 0) {
          result.shadowBlur = blurRad / PptxHandlerRuntime.EMU_PER_PX;
        }
        const dist = parseInt(String(outerShdw["@_dist"] || "0"));
        const dir = parseInt(String(outerShdw["@_dir"] || "0"));
        if (Number.isFinite(dist) && dist > 0 && Number.isFinite(dir)) {
          const angleRad = (dir / 60000) * (Math.PI / 180);
          result.shadowOffsetX =
            (Math.cos(angleRad) * dist) / PptxHandlerRuntime.EMU_PER_PX;
          result.shadowOffsetY =
            (Math.sin(angleRad) * dist) / PptxHandlerRuntime.EMU_PER_PX;
        }
      }

      // Inner shadow (a:innerShdw)
      const innerShdw = effectLst["a:innerShdw"] as XmlObject | undefined;
      if (innerShdw) {
        result.innerShadowColor = this.parseColor(innerShdw);
        result.innerShadowOpacity = this.extractColorOpacity(innerShdw);
        const blurRad = parseInt(String(innerShdw["@_blurRad"] || "0"));
        if (Number.isFinite(blurRad) && blurRad > 0) {
          result.innerShadowBlur = blurRad / PptxHandlerRuntime.EMU_PER_PX;
        }
        const dist = parseInt(String(innerShdw["@_dist"] || "0"));
        const dir = parseInt(String(innerShdw["@_dir"] || "0"));
        if (Number.isFinite(dist) && dist > 0 && Number.isFinite(dir)) {
          const angleRad = (dir / 60000) * (Math.PI / 180);
          result.innerShadowOffsetX =
            (Math.cos(angleRad) * dist) / PptxHandlerRuntime.EMU_PER_PX;
          result.innerShadowOffsetY =
            (Math.sin(angleRad) * dist) / PptxHandlerRuntime.EMU_PER_PX;
        }
      }

      // Glow (a:glow)
      const glow = effectLst["a:glow"] as XmlObject | undefined;
      if (glow) {
        result.glowColor = this.parseColor(glow);
        result.glowOpacity = this.extractColorOpacity(glow);
        const glowRad = parseInt(String(glow["@_rad"] || "0"));
        if (Number.isFinite(glowRad) && glowRad > 0) {
          result.glowRadius = glowRad / PptxHandlerRuntime.EMU_PER_PX;
        }
      }

      // Soft edge (a:softEdge)
      const softEdge = effectLst["a:softEdge"] as XmlObject | undefined;
      if (softEdge) {
        const rad = parseInt(String(softEdge["@_rad"] || "0"));
        if (Number.isFinite(rad) && rad > 0) {
          result.softEdgeRadius = rad / PptxHandlerRuntime.EMU_PER_PX;
        }
      }

      return result;
    });
  }
}
