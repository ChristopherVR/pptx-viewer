import {
  XmlObject,
  type PptxSmartArtDrawingShape,
  type PptxSmartArtQuickStyle,
} from "../../types";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeSmartArtXmlUtils";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  /**
   * Parse quick style from `ppt/diagrams/quickStyles*.xml`.
   */
  protected async parseSmartArtQuickStyle(
    slidePath: string,
    styleRelId: string,
  ): Promise<PptxSmartArtQuickStyle | undefined> {
    if (styleRelId.length === 0) return undefined;

    try {
      const stylePart = await this.readXmlPartByRelationshipId(
        slidePath,
        styleRelId,
      );
      if (!stylePart) return undefined;

      const styleDef = this.xmlLookupService.getChildByLocalName(
        stylePart.xml,
        "styleDef",
      );
      if (!styleDef) return undefined;

      const name =
        String(styleDef["@_title"] || styleDef["@_uniqueId"] || "").trim() ||
        undefined;

      let effectIntensity: string | undefined;
      const styleLbls = this.xmlLookupService.getChildrenArrayByLocalName(
        styleDef,
        "styleLbl",
      );
      for (const lbl of styleLbls) {
        const lblName = String(lbl?.["@_name"] || "").toLowerCase();
        if (lblName.includes("intense") || lblName.includes("3d")) {
          effectIntensity = "intense";
          break;
        }
        if (lblName.includes("moderate") || lblName.includes("semi")) {
          effectIntensity = "moderate";
          break;
        }
        if (lblName.includes("subtle") || lblName.includes("flat")) {
          effectIntensity = "subtle";
          break;
        }
      }

      return { name, effectIntensity };
    } catch {
      return undefined;
    }
  }

  /**
   * Parse pre-computed shapes from `ppt/diagrams/drawing*.xml`.
   */
  protected async parseSmartArtDrawingShapes(
    slidePath: string,
    drawingRelId: string,
  ): Promise<PptxSmartArtDrawingShape[]> {
    if (drawingRelId.length === 0) return [];

    try {
      const drawingPart = await this.readXmlPartByRelationshipId(
        slidePath,
        drawingRelId,
      );
      if (!drawingPart) return [];

      const drawing = this.xmlLookupService.getChildByLocalName(
        drawingPart.xml,
        "drawing",
      );
      const spTree = this.xmlLookupService.getChildByLocalName(
        drawing || drawingPart.xml,
        "spTree",
      );
      if (!spTree) return [];

      const shapes = this.xmlLookupService.getChildrenArrayByLocalName(
        spTree,
        "sp",
      );
      const emuPerPx = PptxHandlerRuntime.EMU_PER_PX;

      return shapes
        .map((sp, index) => {
          return this.parseDrawingShape(sp, index, emuPerPx);
        })
        .filter((entry): entry is PptxSmartArtDrawingShape => entry !== null);
    } catch {
      return [];
    }
  }

  private parseDrawingShape(
    sp: XmlObject,
    index: number,
    emuPerPx: number,
  ): PptxSmartArtDrawingShape | null {
    const spPr = this.xmlLookupService.getChildByLocalName(sp, "spPr");
    if (!spPr) return null;

    const xfrm = this.xmlLookupService.getChildByLocalName(spPr, "xfrm");
    const off = this.xmlLookupService.getChildByLocalName(xfrm, "off");
    const ext = this.xmlLookupService.getChildByLocalName(xfrm, "ext");
    if (!off || !ext) return null;

    const x = Math.round(parseInt(String(off["@_x"] || "0"), 10) / emuPerPx);
    const y = Math.round(parseInt(String(off["@_y"] || "0"), 10) / emuPerPx);
    const width = Math.round(
      parseInt(String(ext["@_cx"] || "0"), 10) / emuPerPx,
    );
    const height = Math.round(
      parseInt(String(ext["@_cy"] || "0"), 10) / emuPerPx,
    );
    if (width <= 0 || height <= 0) return null;

    const rotation = xfrm?.["@_rot"]
      ? parseInt(String(xfrm["@_rot"]), 10) / 60000
      : undefined;

    const prstGeom = this.xmlLookupService.getChildByLocalName(
      spPr,
      "prstGeom",
    );
    const shapeType = prstGeom ? String(prstGeom["@_prst"] || "rect") : "rect";

    const solidFill = this.xmlLookupService.getChildByLocalName(
      spPr,
      "solidFill",
    );
    const fillColor = this.parseColor(solidFill);

    const lnNode = this.xmlLookupService.getChildByLocalName(spPr, "ln");
    const lnFill = lnNode
      ? this.xmlLookupService.getChildByLocalName(lnNode, "solidFill")
      : undefined;
    const strokeColor = this.parseColor(lnFill);
    const strokeWidthRaw = lnNode
      ? parseInt(String(lnNode["@_w"] || ""), 10)
      : NaN;
    const strokeWidth =
      Number.isFinite(strokeWidthRaw) && strokeWidthRaw > 0
        ? strokeWidthRaw / 12700
        : undefined;

    const txBody = this.xmlLookupService.getChildByLocalName(sp, "txBody");
    const textValues: string[] = [];
    if (txBody) {
      this.collectLocalTextValues(txBody, "t", textValues);
    }
    const text = textValues.join("").trim() || undefined;

    const { fontSize, fontColor } = this.extractDrawingShapeTextStyle(txBody);

    const nvSpPr = this.xmlLookupService.getChildByLocalName(sp, "nvSpPr");
    const cNvPr = this.xmlLookupService.getChildByLocalName(nvSpPr, "cNvPr");
    const id = String(cNvPr?.["@_id"] || `dsp-${index}`);

    return {
      id,
      shapeType,
      x,
      y,
      width,
      height,
      rotation,
      fillColor: fillColor ?? undefined,
      strokeColor: strokeColor ?? undefined,
      strokeWidth,
      text,
      fontSize,
      fontColor,
    };
  }

  private extractDrawingShapeTextStyle(txBody: XmlObject | undefined): {
    fontSize: number | undefined;
    fontColor: string | undefined;
  } {
    let fontSize: number | undefined;
    let fontColor: string | undefined;
    if (!txBody) return { fontSize, fontColor };

    const paragraphs = this.xmlLookupService.getChildrenArrayByLocalName(
      txBody,
      "p",
    );
    for (const p of paragraphs) {
      const runs = this.xmlLookupService.getChildrenArrayByLocalName(p, "r");
      for (const r of runs) {
        const rPr = this.xmlLookupService.getChildByLocalName(r, "rPr");
        if (rPr && !fontSize) {
          const szRaw = parseInt(String(rPr["@_sz"] || ""), 10);
          if (Number.isFinite(szRaw) && szRaw > 0) {
            fontSize = szRaw / 100;
          }
          const rprFill = this.xmlLookupService.getChildByLocalName(
            rPr,
            "solidFill",
          );
          fontColor = this.parseColor(rprFill) ?? undefined;
        }
        if (fontSize) break;
      }
      if (fontSize) break;
    }

    return { fontSize, fontColor };
  }
}
