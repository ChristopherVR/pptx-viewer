import {
  XmlObject,
  type PptxTheme,
  type PptxThemeColorScheme,
  type PptxThemeFontScheme,
  type PptxThemeOption,
} from "../../types";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeThemeRefResolution";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  protected async resolvePrimaryThemePath(): Promise<string | undefined> {
    const masterFiles = this.zip.file(
      /^ppt\/slideMasters\/slideMaster\d+\.xml$/,
    );
    if (!masterFiles || masterFiles.length === 0) return undefined;
    const masterPath = masterFiles[0].name;
    const relsPath = masterPath.replace(
      /ppt\/slideMasters\/(slideMaster\d+)\.xml/,
      "ppt/slideMasters/_rels/$1.xml.rels",
    );
    const relsXml = this.zip.file(relsPath);
    if (!relsXml) return undefined;
    const relsData = this.parser.parse(
      // eslint-disable-next-line no-await-in-loop
      await relsXml.async("string"),
    ) as XmlObject;
    const relNodes = this.ensureArray(
      relsData?.Relationships?.Relationship,
    ) as XmlObject[];
    for (const rel of relNodes) {
      const target = String(rel["@_Target"] || "");
      if (!target.includes("theme")) continue;
      const themePath = target.startsWith("..")
        ? this.resolvePath(
            masterPath.substring(0, masterPath.lastIndexOf("/") + 1),
            target,
          )
        : target.startsWith("/")
          ? target.slice(1)
          : `ppt/${target.replace(/^\.?\//, "")}`;
      if (themePath.startsWith("ppt/theme/")) {
        return themePath;
      }
    }
    return undefined;
  }

  protected async parseThemeOptions(): Promise<PptxThemeOption[]> {
    const themeFiles = this.zip.file(/^ppt\/theme\/theme\d+\.xml$/);
    if (!themeFiles || themeFiles.length === 0) return [];
    const options: PptxThemeOption[] = [];
    for (const file of themeFiles) {
      try {
        const xml = await file.async("string");
        const data = this.parser.parse(xml) as XmlObject;
        const root = data["a:theme"] as XmlObject | undefined;
        const name = String(root?.["@_name"] || "").trim();
        options.push({
          path: file.name,
          name: name.length > 0 ? name : undefined,
        });
      } catch {
        options.push({ path: file.name });
      }
    }
    return options;
  }

  /**
   * Public API — scan the in-memory ZIP for `ppt/theme/theme*.xml` parts
   * and return their paths and display names.  Delegates to the
   * protected {@link parseThemeOptions}.
   */
  public async getAvailableThemes(): Promise<PptxThemeOption[]> {
    return this.parseThemeOptions();
  }

  /**
   * Build a structured PptxTheme object from the already-parsed
   * themeColorMap and themeFontMap for consumption by renderers / UI.
   */
  protected buildThemeObject(): PptxTheme | undefined {
    const hasColors = Object.keys(this.themeColorMap).length > 0;
    const hasFonts = Object.keys(this.themeFontMap).length > 0;
    if (!hasColors && !hasFonts) return undefined;

    let colorScheme: PptxThemeColorScheme | undefined;
    if (hasColors) {
      colorScheme = {
        dk1: this.themeColorMap["dk1"] || "",
        lt1: this.themeColorMap["lt1"] || "",
        dk2: this.themeColorMap["dk2"] || "",
        lt2: this.themeColorMap["lt2"] || "",
        accent1: this.themeColorMap["accent1"] || "",
        accent2: this.themeColorMap["accent2"] || "",
        accent3: this.themeColorMap["accent3"] || "",
        accent4: this.themeColorMap["accent4"] || "",
        accent5: this.themeColorMap["accent5"] || "",
        accent6: this.themeColorMap["accent6"] || "",
        hlink: this.themeColorMap["hlink"] || "",
        folHlink: this.themeColorMap["folHlink"] || "",
      };
    }

    let fontScheme: PptxThemeFontScheme | undefined;
    if (hasFonts) {
      fontScheme = {
        majorFont: {
          latin: this.themeFontMap["mj-lt"],
          eastAsia: this.themeFontMap["mj-ea"],
          complexScript: this.themeFontMap["mj-cs"],
        },
        minorFont: {
          latin: this.themeFontMap["mn-lt"],
          eastAsia: this.themeFontMap["mn-ea"],
          complexScript: this.themeFontMap["mn-cs"],
        },
      };
    }

    return {
      colorScheme,
      fontScheme,
      formatScheme: this.themeFormatScheme,
    };
  }

  protected async applySlideMasterColorMap(
    defaultMap: Record<string, string>,
  ): Promise<void> {
    const masterFiles = this.zip.file(
      /^ppt\/slideMasters\/slideMaster\d+\.xml$/,
    );
    if (!masterFiles || masterFiles.length === 0) return;

    try {
      const masterXml = await masterFiles[0].async("string");
      const masterData = this.parser.parse(masterXml) as XmlObject;
      const clrMap = masterData?.["p:sldMaster"]?.["p:clrMap"] as
        | XmlObject
        | undefined;
      if (!clrMap) return;

      const aliasKeys = [
        "bg1",
        "tx1",
        "bg2",
        "tx2",
        "accent1",
        "accent2",
        "accent3",
        "accent4",
        "accent5",
        "accent6",
        "hlink",
        "folHlink",
      ];

      for (const aliasKey of aliasKeys) {
        const mappedKey = String(clrMap[`@_${aliasKey}`] || "")
          .trim()
          .toLowerCase();
        if (!mappedKey) continue;
        const mappedColor =
          this.themeColorMap[mappedKey] || defaultMap[mappedKey];
        if (mappedColor) {
          this.themeColorMap[aliasKey] = mappedColor;
        }
      }
    } catch (error) {
      console.warn("Failed to parse slide master color map:", error);
    }
  }

  protected async loadThemeData(): Promise<void> {
    const themeFiles = this.zip.file(/^ppt\/theme\/theme\d+\.xml$/);
    if (!themeFiles || themeFiles.length === 0) return;

    const preferredThemePath = await this.resolvePrimaryThemePath();
    const preferredThemeFile = preferredThemePath
      ? themeFiles.find((file) => file.name === preferredThemePath)
      : undefined;
    const themeFile = preferredThemeFile ?? themeFiles[0];
    const themeXml = await themeFile.async("string");
    const themeData = this.parser.parse(themeXml) as XmlObject;
    const themeRoot = themeData["a:theme"] as XmlObject | undefined;
    const themeElements = themeRoot?.["a:themeElements"] as
      | XmlObject
      | undefined;
    const colorScheme = themeElements?.["a:clrScheme"] as XmlObject | undefined;
    const fontScheme = themeElements?.["a:fontScheme"] as XmlObject | undefined;

    const defaultMap = this.getDefaultSchemeColorMap();
    this.themeColorMap = { ...defaultMap };

    if (colorScheme) {
      const schemeKeys = [
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
        const colorNode = colorScheme[`a:${key}`] as XmlObject | undefined;
        const parsed = this.parseColorChoice(colorNode);
        if (parsed) {
          this.themeColorMap[key] = parsed;
        }
      }
    }

    // Theme aliases used throughout DrawingML map back to the main dark/light slots.
    this.themeColorMap["tx1"] = this.themeColorMap["dk1"] || defaultMap["dk1"];
    this.themeColorMap["bg1"] = this.themeColorMap["lt1"] || defaultMap["lt1"];
    this.themeColorMap["tx2"] = this.themeColorMap["dk2"] || defaultMap["dk2"];
    this.themeColorMap["bg2"] = this.themeColorMap["lt2"] || defaultMap["lt2"];
    await this.applySlideMasterColorMap(defaultMap);

    const majorLatin = (fontScheme?.["a:majorFont"] as XmlObject | undefined)?.[
      "a:latin"
    ] as XmlObject | undefined;
    const minorLatin = (fontScheme?.["a:minorFont"] as XmlObject | undefined)?.[
      "a:latin"
    ] as XmlObject | undefined;

    const majorFont = this.normalizeTypefaceToken(
      String(majorLatin?.["@_typeface"] || ""),
    );
    const minorFont = this.normalizeTypefaceToken(
      String(minorLatin?.["@_typeface"] || ""),
    );

    this.themeFontMap = {};
    if (majorFont) {
      this.themeFontMap["mj-lt"] = majorFont;
      this.themeFontMap["mj-ea"] = majorFont;
      this.themeFontMap["mj-cs"] = majorFont;
    }
    if (minorFont) {
      this.themeFontMap["mn-lt"] = minorFont;
      this.themeFontMap["mn-ea"] = minorFont;
      this.themeFontMap["mn-cs"] = minorFont;
    }

    // Parse the format scheme (fill styles, line styles, effect styles,
    // background fill styles) from a:fmtScheme.
    const fmtScheme = themeElements?.["a:fmtScheme"] as XmlObject | undefined;
    if (fmtScheme) {
      this.themeFormatScheme = this.parseFormatScheme(fmtScheme);
    }
  }
}
