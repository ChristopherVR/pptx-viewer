import {
  XmlObject,
  type PptxThemeColorScheme,
  type PptxThemeFontScheme,
} from "../../types";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeThemeLoading";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  // ---------------------------------------------------------------------------
  // Theme editing — update colour scheme, font scheme, and name in the zip
  // ---------------------------------------------------------------------------

  /**
   * Resolve the primary theme file path and return its parsed XML data.
   * Returns both the file path and the parsed XML object, or undefined
   * if no theme file exists.
   */
  private async getPrimaryThemeXml(): Promise<
    { path: string; data: XmlObject } | undefined
  > {
    const themeFiles = this.zip.file(/^ppt\/theme\/theme\d+\.xml$/);
    if (!themeFiles || themeFiles.length === 0) return undefined;
    const preferredPath = await this.resolvePrimaryThemePath();
    const file = preferredPath
      ? (themeFiles.find((f) => f.name === preferredPath) ?? themeFiles[0])
      : themeFiles[0];
    const xml = await file.async("string");
    return { path: file.name, data: this.parser.parse(xml) as XmlObject };
  }

  /**
   * Build an OOXML colour node (`a:srgbClr`) from a hex string.
   */
  private buildSrgbClrNode(hex: string): XmlObject {
    const clean = hex.replace(/^#/, "").toUpperCase();
    return { "a:srgbClr": { "@_val": clean } };
  }

  /**
   * Update the theme's colour scheme in-memory and in the zip.
   * Also updates `themeColorMap` so subsequent renders use the new colours.
   */
  public async updateThemeColorScheme(
    colorScheme: PptxThemeColorScheme,
  ): Promise<void> {
    const result = await this.getPrimaryThemeXml();
    if (!result) return;
    const { path, data } = result;
    const root = data["a:theme"] as XmlObject | undefined;
    const themeElements = root?.["a:themeElements"] as XmlObject | undefined;
    if (!themeElements) return;

    const clrScheme = (themeElements["a:clrScheme"] ?? {}) as XmlObject;
    const schemeKeys: Array<keyof PptxThemeColorScheme> = [
      "dk1",
      "lt1",
      "dk2",
      "lt2",
      "accent1",
      "accent2",
      "accent3",
      "accent4",
      "accent5",
      "accent6",
      "hlink",
      "folHlink",
    ];
    for (const key of schemeKeys) {
      clrScheme[`a:${key}`] = this.buildSrgbClrNode(colorScheme[key]);
    }
    themeElements["a:clrScheme"] = clrScheme;
    this.zip.file(path, this.builder.build(data));

    // Update internal color map
    for (const key of schemeKeys) {
      this.themeColorMap[key] = colorScheme[key]
        .replace(/^#/, "")
        .toUpperCase();
    }
    this.themeColorMap["tx1"] = this.themeColorMap["dk1"];
    this.themeColorMap["bg1"] = this.themeColorMap["lt1"];
    this.themeColorMap["tx2"] = this.themeColorMap["dk2"];
    this.themeColorMap["bg2"] = this.themeColorMap["lt2"];
  }

  /**
   * Update the theme's font scheme in-memory and in the zip.
   */
  public async updateThemeFontScheme(
    fontScheme: PptxThemeFontScheme,
  ): Promise<void> {
    const result = await this.getPrimaryThemeXml();
    if (!result) return;
    const { path, data } = result;
    const root = data["a:theme"] as XmlObject | undefined;
    const themeElements = root?.["a:themeElements"] as XmlObject | undefined;
    if (!themeElements) return;

    const fntScheme = (themeElements["a:fontScheme"] ?? {}) as XmlObject;

    if (fontScheme.majorFont?.latin) {
      const majorFont = (fntScheme["a:majorFont"] ?? {}) as XmlObject;
      majorFont["a:latin"] = { "@_typeface": fontScheme.majorFont.latin };
      if (!majorFont["a:ea"]) majorFont["a:ea"] = { "@_typeface": "" };
      if (!majorFont["a:cs"]) majorFont["a:cs"] = { "@_typeface": "" };
      fntScheme["a:majorFont"] = majorFont;
    }
    if (fontScheme.minorFont?.latin) {
      const minorFont = (fntScheme["a:minorFont"] ?? {}) as XmlObject;
      minorFont["a:latin"] = { "@_typeface": fontScheme.minorFont.latin };
      if (!minorFont["a:ea"]) minorFont["a:ea"] = { "@_typeface": "" };
      if (!minorFont["a:cs"]) minorFont["a:cs"] = { "@_typeface": "" };
      fntScheme["a:minorFont"] = minorFont;
    }
    themeElements["a:fontScheme"] = fntScheme;
    this.zip.file(path, this.builder.build(data));

    // Update internal font map
    if (fontScheme.majorFont?.latin) {
      this.themeFontMap["mj-lt"] = fontScheme.majorFont.latin;
      this.themeFontMap["mj-ea"] = fontScheme.majorFont.latin;
      this.themeFontMap["mj-cs"] = fontScheme.majorFont.latin;
    }
    if (fontScheme.minorFont?.latin) {
      this.themeFontMap["mn-lt"] = fontScheme.minorFont.latin;
      this.themeFontMap["mn-ea"] = fontScheme.minorFont.latin;
      this.themeFontMap["mn-cs"] = fontScheme.minorFont.latin;
    }
  }

  /**
   * Update the theme name in the zip.
   */
  public async updateThemeName(name: string): Promise<void> {
    const result = await this.getPrimaryThemeXml();
    if (!result) return;
    const { path, data } = result;
    const root = data["a:theme"] as XmlObject | undefined;
    if (!root) return;
    root["@_name"] = name;
    this.zip.file(path, this.builder.build(data));
  }

  /**
   * Apply a complete theme (both colors and fonts) to the presentation.
   * This is a convenience method that combines updateThemeColorScheme
   * and updateThemeFontScheme.
   */
  public async applyTheme(
    colorScheme: PptxThemeColorScheme,
    fontScheme: PptxThemeFontScheme,
    themeName?: string,
  ): Promise<void> {
    await this.updateThemeColorScheme(colorScheme);
    await this.updateThemeFontScheme(fontScheme);
    if (themeName) {
      await this.updateThemeName(themeName);
    }
  }
}
