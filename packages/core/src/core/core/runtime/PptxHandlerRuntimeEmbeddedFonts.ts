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
import {
  isEotFormat,
  extractFontFromEot,
  parseEotHeader,
} from "../../utils/eot-parser";

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

        // Per ECMA-376 Part 2 §14.2.1, the obfuscation GUID is in the fontKey attribute
        const fontKey = String(variantEl["@_fontKey"] || "").trim() || undefined;

        const font = await this.extractEmbeddedFontVariant(
          typeface,
          rId,
          variant.bold,
          variant.italic,
          relsMap,
          fontKey,
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
    fontKey?: string,
  ): Promise<PptxEmbeddedFont | null> {
    const fontPath = relsMap.get(rId);
    if (!fontPath) return null;

    try {
      const fontBinary = await this.zip.file(fontPath)?.async("uint8array");
      if (!fontBinary || fontBinary.length === 0) return null;

      let fontData: Uint8Array;

      // ── Strategy 1: EOT (Embedded OpenType) container ──────────
      // Some PPTX producers (e.g. Google Slides) embed fonts in EOT
      // format rather than using simple OOXML XOR obfuscation.
      if (isEotFormat(fontBinary)) {
        const extracted = extractFontFromEot(fontBinary);
        if (extracted) {
          fontData = extracted.fontData;
        } else {
          // EOT with MTX/BSGP compression — can't decompress.
          // Return null so the Google Fonts / system font fallback is used.
          const header = parseEotHeader(fontBinary);
          console.info(
            `[pptx-viewer] Embedded font "${typeface}" uses EOT format` +
              (header?.isCompressed ? " with MTX compression" : "") +
              ` — will use web font fallback`,
          );
          return null;
        }
      } else {
        // ── Strategy 2: OOXML XOR obfuscation (ECMA-376 Part 2 §14.2.1) ──
        const guidFromKey = fontKey
          ? (extractGuidFromPartName(fontKey) ??
            fontKey.replace(/[{}]/g, "").trim())
          : null;
        const guidFromPath = extractGuidFromPartName(fontPath);
        const guid = guidFromKey || guidFromPath;

        if (guid) {
          fontData = deobfuscateFont(fontBinary, guid);
        } else {
          // No GUID available — can't deobfuscate
          console.warn(
            `[pptx-viewer] Embedded font "${typeface}" at "${fontPath}" ` +
              `has no fontKey attribute and no GUID in filename — skipping`,
          );
          return null;
        }
      }

      // ── Validate sfnt header ──────────────────────────────────────
      if (fontData.length < 4) return null;
      const v0 = fontData[0],
        v1 = fontData[1],
        v2 = fontData[2],
        v3 = fontData[3];
      const isTrueType =
        v0 === 0x00 && v1 === 0x01 && v2 === 0x00 && v3 === 0x00;
      const isOTTO =
        v0 === 0x4f && v1 === 0x54 && v2 === 0x54 && v3 === 0x4f;
      const isTTC =
        v0 === 0x74 && v1 === 0x74 && v2 === 0x63 && v3 === 0x66;
      const isWOFF =
        v0 === 0x77 &&
        v1 === 0x4f &&
        v2 === 0x46 &&
        (v3 === 0x46 || v3 === 0x32);
      if (!(isTrueType || isOTTO || isTTC || isWOFF)) {
        console.warn(
          `[pptx-viewer] Embedded font "${typeface}" has invalid sfnt header ` +
            `[${v0.toString(16)},${v1.toString(16)},${v2.toString(16)},${v3.toString(16)}] ` +
            `after processing — skipping (web font fallback will be used)`,
        );
        return null;
      }

      // ── Build data URL ────────────────────────────────────────────
      const format = detectFontFormat(fontData);
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
