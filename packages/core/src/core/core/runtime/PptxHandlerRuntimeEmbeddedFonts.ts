import {
  XmlObject,
  type PptxEmbeddedFont,
  PptxLayoutOption,
} from "../../types";
import {
  deobfuscateFont,
  detectFontFormat,
  extractGuidFromPartName,
} from "../../utils/font-deobfuscation";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimePresentationStructure";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  protected async getEmbeddedFonts(): Promise<PptxEmbeddedFont[]> {
    const embeddedFontEntries = this.ensureArray(
      (this.presentationData?.["p:presentation"] as XmlObject | undefined)?.[
        "p:embeddedFontLst"
      ]?.["p:embeddedFont"],
    ) as XmlObject[];

    if (embeddedFontEntries.length === 0) return [];

    // Load presentation rels to resolve rIds → font file paths
    const relsMap = await this.loadPresentationFontRels();
    if (relsMap.size === 0) return [];

    const results: PptxEmbeddedFont[] = [];
    for (const entry of embeddedFontEntries) {
      const typeface = String(entry?.["p:font"]?.["@_typeface"] || "").trim();
      if (!typeface) continue;

      const variants: Array<{
        key: string;
        bold: boolean;
        italic: boolean;
      }> = [
        { key: "p:regular", bold: false, italic: false },
        { key: "p:bold", bold: true, italic: false },
        { key: "p:italic", bold: false, italic: true },
        { key: "p:boldItalic", bold: true, italic: true },
      ];

      for (const variant of variants) {
        const variantEl = entry?.[variant.key] as XmlObject | undefined;
        if (!variantEl) continue;
        const rId = String(variantEl["@_r:id"] || "").trim();
        if (!rId) continue;

        const font = await this.extractEmbeddedFontVariant(
          typeface,
          rId,
          variant.bold,
          variant.italic,
          relsMap,
        );
        if (font) results.push(font);
      }
    }

    return results;
  }

  /** Load the presentation.xml.rels and build a map of rId → target path. */
  private async loadPresentationFontRels(): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    try {
      const relsXml = await this.zip
        .file("ppt/_rels/presentation.xml.rels")
        ?.async("string");
      if (!relsXml) return map;

      const relsData = this.parser.parse(relsXml) as XmlObject;
      const rels = this.ensureArray(
        relsData?.Relationships?.Relationship,
      ) as XmlObject[];
      for (const rel of rels) {
        const type = String(rel?.["@_Type"] || "");
        if (!type.includes("/font")) continue;
        const id = String(rel?.["@_Id"] || "");
        const target = String(rel?.["@_Target"] || "");
        if (id && target) {
          map.set(
            id,
            target.startsWith("/") ? target.substring(1) : `ppt/${target}`,
          );
        }
      }
    } catch {
      // silently fail — fonts are optional
    }
    return map;
  }

  /** Extract, de-obfuscate, and encode a single font variant. */
  private async extractEmbeddedFontVariant(
    typeface: string,
    rId: string,
    bold: boolean,
    italic: boolean,
    relsMap: Map<string, string>,
  ): Promise<PptxEmbeddedFont | null> {
    const fontPath = relsMap.get(rId);
    if (!fontPath) return null;

    try {
      const fontBinary = await this.zip.file(fontPath)?.async("uint8array");
      if (!fontBinary || fontBinary.length === 0) return null;

      // Attempt de-obfuscation if GUID is present in the file name
      const guid = extractGuidFromPartName(fontPath);
      const fontData = guid ? deobfuscateFont(fontBinary, guid) : fontBinary;
      const format = detectFontFormat(fontData);

      // Convert to base64 data URL
      const mimeType =
        format === "woff2"
          ? "font/woff2"
          : format === "woff"
            ? "font/woff"
            : format === "opentype"
              ? "font/otf"
              : "font/ttf";

      const base64 = this.uint8ArrayToBase64(fontData);
      const dataUrl = `data:${mimeType};base64,${base64}`;

      return { name: typeface, dataUrl, bold, italic, format };
    } catch {
      return null;
    }
  }

  /** Convert Uint8Array to base64 string. */
  private uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
      for (let j = 0; j < chunk.length; j++) {
        binary += String.fromCharCode(chunk[j]);
      }
    }
    return btoa(binary);
  }

  public getLayoutOptions(): PptxLayoutOption[] {
    const options: PptxLayoutOption[] = [];
    for (const [path, xmlObj] of this.layoutXmlMap.entries()) {
      const sldLayout = (xmlObj as XmlObject)["p:sldLayout"] as XmlObject | undefined;
      const name = String(sldLayout?.["p:cSld"]?.["@_name"] || "").trim() || path;
      const type = sldLayout?.["@_type"] != null
        ? String(sldLayout["@_type"]).trim()
        : undefined;
      options.push({ path, name, ...(type ? { type } : {}) });
    }
    return options;
  }
}
