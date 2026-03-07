import { XmlObject, type PptxThemeFormatScheme } from "../../types";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeThemeFormatScheme";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  /**
   * Parse the `a:fmtScheme` element from the theme into a structured
   * {@link PptxThemeFormatScheme}.  Each sub-list (fillStyleLst, lnStyleLst,
   * effectStyleLst, bgFillStyleLst) contains up to three intensity levels
   * (subtle / moderate / intense) referenced by 1-based index.
   */
  protected parseFormatScheme(fmtScheme: XmlObject): PptxThemeFormatScheme {
    const name = String(fmtScheme["@_name"] || "").trim() || undefined;

    // --- Fill styles (a:fillStyleLst) ---
    const fillStyleLst = fmtScheme["a:fillStyleLst"] as XmlObject | undefined;
    const fillStyles = this.parseFillStyleList(fillStyleLst);

    // --- Line styles (a:lnStyleLst) ---
    const lnStyleLst = fmtScheme["a:lnStyleLst"] as XmlObject | undefined;
    const lineStyles = this.parseLineStyleList(lnStyleLst);

    // --- Effect styles (a:effectStyleLst) ---
    const effectStyleLst = fmtScheme["a:effectStyleLst"] as
      | XmlObject
      | undefined;
    const effectStyles = this.parseEffectStyleList(effectStyleLst);

    // --- Background fill styles (a:bgFillStyleLst) ---
    const bgFillStyleLst = fmtScheme["a:bgFillStyleLst"] as
      | XmlObject
      | undefined;
    const backgroundFillStyles = this.parseFillStyleList(bgFillStyleLst);

    return {
      name,
      fillStyles,
      lineStyles,
      effectStyles,
      backgroundFillStyles,
    };
  }

  /**
   * Extract a colour map override from a `p:clrMapOvr` node.
   * Returns `null` when the node is absent, empty, or specifies
   * `a:masterClrMapping` (meaning "inherit from master").
   */
  protected parseClrMapOverrideNode(
    clrMapOvr: XmlObject | undefined,
  ): Record<string, string> | null {
    if (!clrMapOvr) return null;

    // <a:masterClrMapping/> means "use the master's map" — no override.
    if (clrMapOvr["a:masterClrMapping"] !== undefined) return null;

    const overrideNode = clrMapOvr["a:overrideClrMapping"] as
      | XmlObject
      | undefined;
    if (!overrideNode) return null;

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

    const overrideMap: Record<string, string> = {};
    for (const key of aliasKeys) {
      const mapped = String(overrideNode[`@_${key}`] || "")
        .trim()
        .toLowerCase();
      if (mapped) {
        overrideMap[key] = mapped;
      }
    }

    return Object.keys(overrideMap).length > 0 ? overrideMap : null;
  }

  /**
   * Parse `p:clrMapOvr` from a slide's XML.  Returns a mapping from logical
   * colour name (bg1, tx1, ...) to the theme colour slot it should resolve to,
   * or `null` when the slide inherits from the master (`a:masterClrMapping`
   * or no override present).
   */
  protected parseSlideClrMapOverride(
    slideXml: XmlObject,
  ): Record<string, string> | null {
    const clrMapOvr = (slideXml["p:sld"] as XmlObject | undefined)?.[
      "p:clrMapOvr"
    ] as XmlObject | undefined;
    return this.parseClrMapOverrideNode(clrMapOvr);
  }

  /**
   * Parse `p:clrMapOvr` from a slide layout's XML.  Layouts can override
   * the master's colour map just like slides can.
   */
  protected parseLayoutClrMapOverride(
    layoutXml: XmlObject,
  ): Record<string, string> | null {
    const clrMapOvr = (layoutXml["p:sldLayout"] as XmlObject | undefined)?.[
      "p:clrMapOvr"
    ] as XmlObject | undefined;
    return this.parseClrMapOverrideNode(clrMapOvr);
  }

  /**
   * Apply a theme override for the duration of parsing a layout or slide.
   * Saves the current theme state, applies the override, and returns a
   * restore function that must be called when done.
   */
  protected applyThemeOverrideState(override: {
    colorOverrides?: Record<string, string>;
    formatSchemeOverride?: PptxThemeFormatScheme;
  }): () => void {
    const prevColorMap = { ...this.themeColorMap };
    const prevFontMap = { ...this.themeFontMap };
    const prevFormatScheme = this.themeFormatScheme;

    // Apply colour overrides
    if (override.colorOverrides) {
      for (const [key, value] of Object.entries(override.colorOverrides)) {
        if (key.startsWith("__fontOverride_")) {
          // Font override
          const fontKey = key.replace("__fontOverride_", "");
          this.themeFontMap[fontKey] = value;
          // Also set EA and CS variants
          if (fontKey === "mj-lt") {
            this.themeFontMap["mj-ea"] = value;
            this.themeFontMap["mj-cs"] = value;
          } else if (fontKey === "mn-lt") {
            this.themeFontMap["mn-ea"] = value;
            this.themeFontMap["mn-cs"] = value;
          }
        } else {
          this.themeColorMap[key] = value;
        }
      }
      // Re-apply aliases
      this.themeColorMap["tx1"] =
        this.themeColorMap["dk1"] || prevColorMap["dk1"];
      this.themeColorMap["bg1"] =
        this.themeColorMap["lt1"] || prevColorMap["lt1"];
      this.themeColorMap["tx2"] =
        this.themeColorMap["dk2"] || prevColorMap["dk2"];
      this.themeColorMap["bg2"] =
        this.themeColorMap["lt2"] || prevColorMap["lt2"];
    }

    // Apply format scheme override
    if (override.formatSchemeOverride) {
      this.themeFormatScheme = override.formatSchemeOverride;
    }

    // Return restore function
    return () => {
      this.themeColorMap = prevColorMap;
      this.themeFontMap = prevFontMap;
      this.themeFormatScheme = prevFormatScheme;
    };
  }

  /**
   * Load and apply a theme override part referenced from a layout's or
   * slide's relationships.  Theme overrides (`themeOverride*.xml`) can
   * replace the colour scheme, font scheme, and/or format scheme for
   * the scope of a specific layout or slide.
   *
   * The method caches results so each override file is parsed at most once.
   * Overrides are applied as temporary deltas: the caller should save and
   * restore `themeColorMap`, `themeFontMap`, and `themeFormatScheme` around
   * the scope where the override is active.
   */
  protected async loadThemeOverride(partBasePath: string): Promise<{
    colorOverrides?: Record<string, string>;
    formatSchemeOverride?: PptxThemeFormatScheme;
  } | null> {
    // Resolve relationship to find theme override file
    const rels = this.slideRelsMap.get(partBasePath);
    if (!rels) return null;

    let overridePath: string | undefined;
    for (const [, target] of rels) {
      if (target.includes("themeOverride")) {
        // Target is relative to the part, e.g. "../theme/themeOverride1.xml"
        const partDir = partBasePath.substring(
          0,
          partBasePath.lastIndexOf("/") + 1,
        );
        overridePath = this.resolvePath(partDir, target);
        break;
      }
    }
    if (!overridePath) return null;

    // Check cache
    const cached = this.themeOverrideCache.get(overridePath);
    if (cached) return cached;

    try {
      const overrideXml = await this.zip.file(overridePath)?.async("string");
      if (!overrideXml) return null;

      const overrideData = this.parser.parse(overrideXml) as XmlObject;
      const root = overrideData["a:themeOverride"] as XmlObject | undefined;
      if (!root) return null;

      const result: {
        colorOverrides?: Record<string, string>;
        formatSchemeOverride?: PptxThemeFormatScheme;
      } = {};

      // Colour scheme override
      const clrScheme = root["a:clrScheme"] as XmlObject | undefined;
      if (clrScheme) {
        const colorOverrides: Record<string, string> = {};
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
          const colorNode = clrScheme[`a:${key}`] as XmlObject | undefined;
          const parsed = this.parseColorChoice(colorNode);
          if (parsed) {
            colorOverrides[key] = parsed;
          }
        }
        if (Object.keys(colorOverrides).length > 0) {
          result.colorOverrides = colorOverrides;
        }
      }

      // Format scheme override
      const fmtScheme = root["a:fmtScheme"] as XmlObject | undefined;
      if (fmtScheme) {
        result.formatSchemeOverride = this.parseFormatScheme(fmtScheme);
      }

      // Font scheme override (apply to themeFontMap temporarily)
      const fontScheme = root["a:fontScheme"] as XmlObject | undefined;
      if (fontScheme) {
        const majorLatin = (
          fontScheme["a:majorFont"] as XmlObject | undefined
        )?.["a:latin"] as XmlObject | undefined;
        const minorLatin = (
          fontScheme["a:minorFont"] as XmlObject | undefined
        )?.["a:latin"] as XmlObject | undefined;
        const majorFont = this.normalizeTypefaceToken(
          String(majorLatin?.["@_typeface"] || ""),
        );
        const minorFont = this.normalizeTypefaceToken(
          String(minorLatin?.["@_typeface"] || ""),
        );
        if (!result.colorOverrides) {
          result.colorOverrides = {};
        }
        // Font overrides are stored alongside colour overrides for simplicity
        if (majorFont) {
          result.colorOverrides["__fontOverride_mj-lt"] = majorFont;
        }
        if (minorFont) {
          result.colorOverrides["__fontOverride_mn-lt"] = minorFont;
        }
      }

      this.themeOverrideCache.set(overridePath, result);
      return result;
    } catch (error) {
      console.warn(`Failed to load theme override at ${overridePath}:`, error);
      return null;
    }
  }
}
