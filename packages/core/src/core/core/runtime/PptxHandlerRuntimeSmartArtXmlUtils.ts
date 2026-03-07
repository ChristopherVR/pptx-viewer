import {
  XmlObject,
  type PptxSmartArtChrome,
  type PptxSmartArtColorTransform,
} from "../../types";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeComments";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  protected async readXmlPartByRelationshipId(
    slidePath: string,
    relationshipId: string,
  ): Promise<{ xml: XmlObject; partPath: string } | undefined> {
    const normalizedRelationshipId = String(relationshipId || "").trim();
    if (normalizedRelationshipId.length === 0) return undefined;

    const relationships = this.slideRelsMap.get(slidePath);
    const target = relationships?.get(normalizedRelationshipId);
    if (!target) return undefined;

    const partPath = this.resolveImagePath(slidePath, target);
    const xmlString = await this.zip.file(partPath)?.async("string");
    if (!xmlString) return undefined;

    return {
      xml: this.parser.parse(xmlString) as XmlObject,
      partPath,
    };
  }

  protected collectLocalTextValues(
    node: unknown,
    localName: string,
    output: string[],
  ): void {
    if (node === null || node === undefined) return;
    if (Array.isArray(node)) {
      node.forEach((entry) => {
        this.collectLocalTextValues(entry, localName, output);
      });
      return;
    }
    if (typeof node !== "object") return;

    const objectNode = node as XmlObject;
    for (const [key, value] of Object.entries(objectNode)) {
      if (this.compatibilityService.getXmlLocalName(key) === localName) {
        if (typeof value === "string" || typeof value === "number") {
          const textValue = String(value).trim();
          if (textValue.length > 0) {
            output.push(textValue);
          }
          continue;
        }
      }
      this.collectLocalTextValues(value, localName, output);
    }
  }

  /**
   * Parse background and outline chrome from `dgm:bg` and `dgm:whole`.
   */
  protected parseSmartArtChrome(
    dataModel: XmlObject | undefined,
  ): PptxSmartArtChrome | undefined {
    if (!dataModel) return undefined;

    const bg = this.xmlLookupService.getChildByLocalName(dataModel, "bg");
    const whole = this.xmlLookupService.getChildByLocalName(dataModel, "whole");
    if (!bg && !whole) return undefined;

    const chrome: PptxSmartArtChrome = {};

    if (bg) {
      const solidFill = this.xmlLookupService.getChildByLocalName(
        bg,
        "solidFill",
      );
      const bgColor = this.parseColor(solidFill);
      if (bgColor) {
        chrome.backgroundColor = bgColor;
      }
    }

    if (whole) {
      const lnNode = this.xmlLookupService.getChildByLocalName(whole, "ln");
      if (lnNode) {
        const solidFill = this.xmlLookupService.getChildByLocalName(
          lnNode,
          "solidFill",
        );
        const outlineColor = this.parseColor(solidFill);
        if (outlineColor) {
          chrome.outlineColor = outlineColor;
        }
        const widthRaw = parseInt(String(lnNode["@_w"] || ""), 10);
        if (Number.isFinite(widthRaw) && widthRaw > 0) {
          chrome.outlineWidth = widthRaw / 12700; // EMU to pt
        }
      }
    }

    return chrome.backgroundColor || chrome.outlineColor ? chrome : undefined;
  }

  /**
   * Parse colour transform from `ppt/diagrams/colors*.xml`.
   */
  protected parseSmartArtColorTransform(
    slidePath: string,
    colorsRelId: string,
  ): Promise<PptxSmartArtColorTransform | undefined> {
    return this.parseSmartArtColorTransformImpl(slidePath, colorsRelId);
  }

  private async parseSmartArtColorTransformImpl(
    slidePath: string,
    colorsRelId: string,
  ): Promise<PptxSmartArtColorTransform | undefined> {
    if (colorsRelId.length === 0) return undefined;

    try {
      const colorsPart = await this.readXmlPartByRelationshipId(
        slidePath,
        colorsRelId,
      );
      if (!colorsPart) return undefined;

      const colorsDef = this.xmlLookupService.getChildByLocalName(
        colorsPart.xml,
        "colorsDef",
      );
      if (!colorsDef) return undefined;

      const name =
        String(colorsDef["@_title"] || colorsDef["@_uniqueId"] || "").trim() ||
        undefined;
      const fillColors: string[] = [];
      const lineColors: string[] = [];

      const styleLbls = this.xmlLookupService.getChildrenArrayByLocalName(
        colorsDef,
        "styleLbl",
      );
      for (const lbl of styleLbls) {
        const fillClrLst = this.xmlLookupService.getChildByLocalName(
          lbl,
          "fillClrLst",
        );
        const linClrLst = this.xmlLookupService.getChildByLocalName(
          lbl,
          "linClrLst",
        );

        if (fillClrLst) {
          const color =
            this.parseColor(fillClrLst) ??
            this.resolveSmartArtSchemeColor(
              this.xmlLookupService.getChildByLocalName(
                fillClrLst,
                "schemeClr",
              ),
            );
          if (color) fillColors.push(color);
        }

        if (linClrLst) {
          const color =
            this.parseColor(linClrLst) ??
            this.resolveSmartArtSchemeColor(
              this.xmlLookupService.getChildByLocalName(linClrLst, "schemeClr"),
            );
          if (color) lineColors.push(color);
        }
      }

      if (fillColors.length === 0 && lineColors.length === 0) return undefined;

      return { name, fillColors, lineColors };
    } catch {
      return undefined;
    }
  }

  /**
   * Resolve a scheme colour reference to a hex value using the theme colour map.
   */
  protected resolveSmartArtSchemeColor(
    schemeClr: XmlObject | undefined,
  ): string | undefined {
    if (!schemeClr) return undefined;
    const val = String(schemeClr["@_val"] || "").trim();
    if (val.length === 0) return undefined;
    const mapped = this.themeColorMap[val];
    if (mapped) return mapped.startsWith("#") ? mapped : `#${mapped}`;
    return undefined;
  }
}
