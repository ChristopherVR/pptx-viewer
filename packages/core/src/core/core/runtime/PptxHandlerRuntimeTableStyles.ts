import {
  PptxSlide,
  XmlObject,
  type ParsedTableStyleFill,
  type ParsedTableStyleText,
  type PptxExportOptions,
  type ParsedTableStyleEntry,
  type ParsedTableStyleMap,
} from "../../types";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeState";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  /**
   * Export slides to a raster/vector format.
   *
   * This is a stub that signals export intent. Actual rendering requires a
   * platform-specific canvas or PDF library (e.g. Puppeteer, node-canvas,
   * pdfkit). Host applications should override or extend this method with
   * their own rendering pipeline.
   *
   * @param _slides  The slides to export.
   * @param _options Export options (format, DPI, slide indices, etc.).
   * @returns A map of slide index → exported binary data.
   */
  async exportSlides(
    slides: PptxSlide[],
    options: PptxExportOptions,
  ): Promise<Map<number, Uint8Array>> {
    this.compatibilityService.reportWarning({
      code: "EXPORT_BACKEND_UNAVAILABLE",
      message:
        `Export to "${options.format}" requires a platform-specific rendering backend. ` +
        "No export backend is configured in this runtime.",
      severity: "warning",
      scope: "presentation",
    });

    const targetIndices =
      options.slideIndices && options.slideIndices.length > 0
        ? options.slideIndices
        : slides.map((_, index) => index);

    const result = new Map<number, Uint8Array>();
    for (const index of targetIndices) {
      if (!Number.isInteger(index) || index < 0 || index >= slides.length) {
        continue;
      }
      result.set(index, new Uint8Array());
    }
    return result;
  }

  /**
   * Normalize a table style GUID to uppercase with braces.
   */
  protected normalizeTableStyleGuid(guid: string): string {
    const trimmed = guid.trim().toUpperCase();
    if (trimmed.startsWith("{")) return trimmed;
    return `{${trimmed}}`;
  }

  /**
   * Derive the dominant accent key from a set of table style fills.
   */
  protected deriveTableStyleAccentKey(
    ...fills: (ParsedTableStyleFill | undefined)[]
  ): string | undefined {
    for (const fill of fills) {
      if (fill?.schemeColor?.startsWith("accent")) {
        return fill.schemeColor;
      }
    }
    return undefined;
  }

  /**
   * Extract fill information from a table style section element
   * (e.g. `a:wholeTbl`, `a:band1H`, `a:firstRow`).
   */
  protected extractTableStyleSectionFill(
    section: XmlObject | undefined,
  ): ParsedTableStyleFill | undefined {
    if (!section) return undefined;
    const tcStyle = section["a:tcStyle"] as XmlObject | undefined;
    if (!tcStyle) return undefined;
    const fill = tcStyle["a:fill"] as XmlObject | undefined;
    if (!fill) return undefined;
    const solidFill = fill["a:solidFill"] as XmlObject | undefined;
    if (!solidFill) return undefined;
    const schemeClr = solidFill["a:schemeClr"] as XmlObject | undefined;
    if (!schemeClr) return undefined;
    const schemeColor = String(schemeClr["@_val"] || "").trim() || undefined;
    if (!schemeColor) return undefined;

    const tintRaw = schemeClr["a:tint"] as XmlObject | undefined;
    const tint = tintRaw
      ? parseInt(String(tintRaw["@_val"] || "0"), 10) || undefined
      : undefined;
    const shadeRaw = schemeClr["a:shade"] as XmlObject | undefined;
    const shade = shadeRaw
      ? parseInt(String(shadeRaw["@_val"] || "0"), 10) || undefined
      : undefined;

    return { schemeColor, tint, shade };
  }

  /**
   * Extract text properties from a:tcTxStyle in a table style section.
   */
  protected extractTableStyleSectionText(
    section: XmlObject | undefined,
  ): ParsedTableStyleText | undefined {
    if (!section) return undefined;
    const tcTxStyle = section["a:tcTxStyle"] as XmlObject | undefined;
    if (!tcTxStyle) return undefined;

    const result: ParsedTableStyleText = {};
    let hasProps = false;

    if (tcTxStyle["@_b"] === "on") {
      result.bold = true;
      hasProps = true;
    }
    if (tcTxStyle["@_i"] === "on") {
      result.italic = true;
      hasProps = true;
    }

    const fontClr = tcTxStyle["a:fontRef"] as XmlObject | undefined;
    const schemeClr = (fontClr?.["a:schemeClr"] ??
      tcTxStyle["a:schemeClr"]) as XmlObject | undefined;
    if (schemeClr) {
      const val = String(schemeClr["@_val"] || "").trim();
      if (val) {
        result.fontSchemeColor = val;
        hasProps = true;
        const tintNode = schemeClr["a:tint"] as XmlObject | undefined;
        if (tintNode) {
          result.fontTint =
            parseInt(String(tintNode["@_val"] || "0"), 10) || undefined;
        }
        const shadeNode = schemeClr["a:shade"] as XmlObject | undefined;
        if (shadeNode) {
          result.fontShade =
            parseInt(String(shadeNode["@_val"] || "0"), 10) || undefined;
        }
      }
    }

    return hasProps ? result : undefined;
  }

  protected ensureArray(val: unknown): XmlObject[] {
    if (!val) return [];
    const arr = Array.isArray(val) ? val : [val];
    return arr as XmlObject[];
  }

  /**
   * Parse `ppt/tableStyles.xml` into a map of style GUID → style entry.
   */
  protected async parseTableStyles(): Promise<ParsedTableStyleMap | undefined> {
    const xmlStr = await this.zip.file("ppt/tableStyles.xml")?.async("string");
    if (!xmlStr) return undefined;

    try {
      const parsed = this.parser.parse(xmlStr) as XmlObject;
      const styleLst = parsed["a:tblStyleLst"] as XmlObject | undefined;
      if (!styleLst) return undefined;

      const styles = this.ensureArray(styleLst["a:tblStyle"]);
      if (styles.length === 0) return undefined;

      const map: Record<string, ParsedTableStyleEntry> = {};
      for (const style of styles) {
        const rawId = String((style as XmlObject)["@_styleId"] || "").trim();
        if (!rawId) continue;

        const styleId = this.normalizeTableStyleGuid(rawId);
        const styleName =
          String((style as XmlObject)["@_styleName"] || "").trim() || undefined;

        const wholeTblFill = this.extractTableStyleSectionFill(
          (style as XmlObject)["a:wholeTbl"] as XmlObject | undefined,
        );
        const band1HFill = this.extractTableStyleSectionFill(
          (style as XmlObject)["a:band1H"] as XmlObject | undefined,
        );
        const band2HFill = this.extractTableStyleSectionFill(
          (style as XmlObject)["a:band2H"] as XmlObject | undefined,
        );
        const band1VFill = this.extractTableStyleSectionFill(
          (style as XmlObject)["a:band1V"] as XmlObject | undefined,
        );
        const band2VFill = this.extractTableStyleSectionFill(
          (style as XmlObject)["a:band2V"] as XmlObject | undefined,
        );
        const firstRowFill = this.extractTableStyleSectionFill(
          (style as XmlObject)["a:firstRow"] as XmlObject | undefined,
        );
        const lastRowFill = this.extractTableStyleSectionFill(
          (style as XmlObject)["a:lastRow"] as XmlObject | undefined,
        );
        const firstColFill = this.extractTableStyleSectionFill(
          (style as XmlObject)["a:firstCol"] as XmlObject | undefined,
        );
        const lastColFill = this.extractTableStyleSectionFill(
          (style as XmlObject)["a:lastCol"] as XmlObject | undefined,
        );

        const accentKey = this.deriveTableStyleAccentKey(
          wholeTblFill,
          band1HFill,
          band1VFill,
          firstRowFill,
        );

        // Extract per-role text styling (a:tcTxStyle)
        const sectionNames = [
          "wholeTbl",
          "firstRow",
          "lastRow",
          "firstCol",
          "lastCol",
          "band1H",
          "band2H",
          "band1V",
          "band2V",
        ] as const;
        const textProps: Partial<
          Record<
            `${(typeof sectionNames)[number]}Text`,
            ParsedTableStyleText
          >
        > = {};
        for (const name of sectionNames) {
          const text = this.extractTableStyleSectionText(
            (style as XmlObject)[`a:${name}`] as XmlObject | undefined,
          );
          if (text) {
            textProps[`${name}Text`] = text;
          }
        }

        const entry: ParsedTableStyleEntry = {
          styleId,
          styleName,
          accentKey,
          wholeTblFill,
          band1HFill,
          band2HFill,
          band1VFill,
          band2VFill,
          firstRowFill,
          lastRowFill,
          firstColFill,
          lastColFill,
          ...textProps,
        };
        map[styleId] = entry;
      }

      return Object.keys(map).length > 0 ? map : undefined;
    } catch (e) {
      console.warn("Failed to parse ppt/tableStyles.xml:", e);
      return undefined;
    }
  }
}
