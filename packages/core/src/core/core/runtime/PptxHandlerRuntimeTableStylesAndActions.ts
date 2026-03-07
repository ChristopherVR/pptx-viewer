import { XmlObject, type PptxAction, TextStyle } from "../../types";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeElementActions";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  /**
   * Parse a single `a:hlinkClick` or `a:hlinkHover` node into a `PptxAction`.
   */
  protected parseAction(
    hlinkNode: XmlObject | undefined,
    slideRelationshipMap: Map<string, string> | undefined,
    slidePaths: string[],
  ): PptxAction | undefined {
    if (!hlinkNode) return undefined;

    const rId = String(hlinkNode["@_r:id"] || hlinkNode["@_id"] || "").trim();
    const actionAttr = String(hlinkNode["@_action"] || "").trim();
    const tooltipAttr = String(hlinkNode["@_tooltip"] || "").trim();
    const highlightClickAttr = String(
      hlinkNode["@_highlightClick"] || "",
    ).trim();

    if (
      rId.length === 0 &&
      actionAttr.length === 0 &&
      tooltipAttr.length === 0
    ) {
      return undefined;
    }

    const action: PptxAction = {};
    if (rId.length > 0) action.rId = rId;
    if (actionAttr.length > 0) action.action = actionAttr;
    if (tooltipAttr.length > 0) action.tooltip = tooltipAttr;
    if (highlightClickAttr === "1" || highlightClickAttr === "true") {
      action.highlightClick = true;
    }

    const sndNode = hlinkNode["a:snd"] as XmlObject | undefined;
    const soundRId = String(
      sndNode?.["@_r:embed"] || sndNode?.["@_r:link"] || "",
    ).trim();
    if (soundRId.length > 0) {
      action.soundRId = soundRId;
    }

    // Resolve relationship target
    if (rId.length > 0 && slideRelationshipMap) {
      const target = slideRelationshipMap.get(rId);
      if (target) {
        action.url = target;
        // Detect internal slide jumps
        const slideFileMatch = target.match(/slide(\d+)\.xml$/i);
        if (slideFileMatch) {
          const slideNum = parseInt(slideFileMatch[1], 10);
          const matchIdx = slidePaths.findIndex((p) => {
            const m = p.match(/slide(\d+)\.xml$/i);
            return m ? parseInt(m[1], 10) === slideNum : false;
          });
          if (matchIdx >= 0) {
            action.targetSlideIndex = matchIdx;
          }
        }
      }
    }
    if (action.soundRId && slideRelationshipMap) {
      const soundTarget = slideRelationshipMap.get(action.soundRId);
      if (soundTarget) {
        action.soundPath = soundTarget;
      }
    }

    return action;
  }

  /**
   * Parse `a:hlinkClick` and `a:hlinkHover` from a `p:cNvPr` node
   * and return `{ actionClick, actionHover }` for the element.
   */
  protected parseElementActions(
    cNvPr: XmlObject | undefined,
    slideRelationshipMap: Map<string, string> | undefined,
    slidePaths: string[],
  ): { actionClick?: PptxAction; actionHover?: PptxAction } {
    if (!cNvPr) return {};
    const result: { actionClick?: PptxAction; actionHover?: PptxAction } = {};
    const hlinkClick = cNvPr["a:hlinkClick"] as XmlObject | undefined;
    const hlinkHover = cNvPr["a:hlinkHover"] as XmlObject | undefined;
    const parsedClick = this.parseAction(
      hlinkClick,
      slideRelationshipMap,
      slidePaths,
    );
    const parsedHover = this.parseAction(
      hlinkHover,
      slideRelationshipMap,
      slidePaths,
    );
    if (parsedClick) result.actionClick = parsedClick;
    if (parsedHover) result.actionHover = parsedHover;
    return result;
  }

  protected parseColor(
    colorNode: XmlObject | undefined,
    placeholderColor?: string,
  ): string | undefined {
    return this.colorStyleCodec.parseColor(colorNode, placeholderColor);
  }

  /**
   * Extract text-level fill variants from a run properties node.
   * Handles gradient fills, pattern fills, and image fills on text runs.
   */
  protected extractTextFillVariants(
    rPr: XmlObject | undefined,
  ): Pick<
    TextStyle,
    | "textFillGradient"
    | "textFillGradientStops"
    | "textFillGradientAngle"
    | "textFillGradientType"
    | "textFillPattern"
    | "textFillPatternForeground"
    | "textFillPatternBackground"
  > {
    const result: Pick<
      TextStyle,
      | "textFillGradient"
      | "textFillGradientStops"
      | "textFillGradientAngle"
      | "textFillGradientType"
      | "textFillPattern"
      | "textFillPatternForeground"
      | "textFillPatternBackground"
    > = {};
    if (!rPr) return result;

    // Text gradient fill
    const gradFill = rPr["a:gradFill"] as XmlObject | undefined;
    if (gradFill) {
      const gsLst = gradFill["a:gsLst"];
      if (gsLst) {
        const stops = this.ensureArray(gsLst["a:gs"]);
        if (stops.length >= 2) {
          const cssStops = stops.map((gs: XmlObject) => {
            const pos = parseInt(String(gs["@_pos"] || "0")) / 1000;
            const color = this.parseColor(gs) || "#000000";
            return `${color} ${pos}%`;
          });
          const angle = gradFill["a:lin"]
            ? parseInt(String(gradFill["a:lin"]["@_ang"] || "0")) / 60000
            : 0;
          const gradType = gradFill["a:path"] ? "radial" : "linear";
          result.textFillGradient = `linear-gradient(${angle}deg, ${cssStops.join(", ")})`;

          // Store structured data for round-trip serialization
          const structuredStops: NonNullable<TextStyle["textFillGradientStops"]> = [];
          for (const gs of stops) {
            const gsObj = gs as XmlObject;
            const color = this.parseColor(gsObj) || "#000000";
            const posRaw = parseInt(String(gsObj["@_pos"] || "0"), 10);
            const position = Number.isFinite(posRaw) ? (posRaw / 100000) * 100 : 0;
            const opacity = this.extractColorOpacity(gsObj);
            structuredStops.push({ color, position, ...(opacity !== undefined ? { opacity } : {}) });
          }
          result.textFillGradientStops = structuredStops;
          result.textFillGradientAngle = angle;
          result.textFillGradientType = gradType;
        }
      }
    }

    // Text pattern fill
    const pattFill = rPr["a:pattFill"] as XmlObject | undefined;
    if (pattFill) {
      result.textFillPattern = String(pattFill["@_prst"] || "");
      const fgClr = pattFill["a:fgClr"];
      const bgClr = pattFill["a:bgClr"];
      if (fgClr) result.textFillPatternForeground = this.parseColor(fgClr);
      if (bgClr) result.textFillPatternBackground = this.parseColor(bgClr);
    }

    return result;
  }

  protected extractColorOpacity(
    colorNode: XmlObject | undefined,
  ): number | undefined {
    return this.colorStyleCodec.extractColorOpacity(colorNode);
  }
}
