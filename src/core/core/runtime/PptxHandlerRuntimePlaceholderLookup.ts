import {
  XmlObject,
  PlaceholderDefaults,
  PlaceholderTextLevelStyle,
} from "../../types";
import {
  type PlaceholderInfo,
  type PlaceholderLookupContext,
} from "./PptxHandlerRuntimeTypes";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeElementParsing";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  protected findPlaceholderInShapeTree(
    spTree: XmlObject | undefined,
    expected: PlaceholderInfo | null,
  ): PlaceholderLookupContext | undefined {
    if (!spTree) return undefined;

    const shapes = this.ensureArray(spTree["p:sp"]) as XmlObject[];
    for (const shape of shapes) {
      const info = this.extractPlaceholderInfo(
        shape?.["p:nvSpPr"]?.["p:nvPr"] as XmlObject | undefined,
      );
      if (!this.placeholderMatches(expected, info)) continue;
      return { shape };
    }

    const pictures = this.ensureArray(spTree["p:pic"]) as XmlObject[];
    for (const picture of pictures) {
      const info = this.extractPlaceholderInfo(
        picture?.["p:nvPicPr"]?.["p:nvPr"] as XmlObject | undefined,
      );
      if (!this.placeholderMatches(expected, info)) continue;
      return { picture };
    }

    return undefined;
  }

  protected findPlaceholderContext(
    slidePath: string,
    expected: PlaceholderInfo | null,
  ): PlaceholderLookupContext | undefined {
    const layoutPath = this.resolveLayoutPathForSlide(slidePath);
    if (!layoutPath) return undefined;

    const layoutXmlObj = this.layoutXmlMap.get(layoutPath);
    const layoutContext = this.findPlaceholderInShapeTree(
      layoutXmlObj?.["p:sldLayout"]?.["p:cSld"]?.["p:spTree"] as
        | XmlObject
        | undefined,
      expected,
    );
    if (layoutContext) {
      return layoutContext;
    }

    const masterPath = this.resolveMasterPathForLayout(layoutPath);
    if (!masterPath) return undefined;
    const masterXmlObj = this.masterXmlMap.get(masterPath);
    return this.findPlaceholderInShapeTree(
      masterXmlObj?.["p:sldMaster"]?.["p:cSld"]?.["p:spTree"] as
        | XmlObject
        | undefined,
      expected,
    );
  }

  protected mergeXmlObjects(
    base: XmlObject | undefined,
    override: XmlObject | undefined,
  ): XmlObject | undefined {
    if (!base && !override) return undefined;
    if (!base) return override ? { ...override } : undefined;
    if (!override) return { ...base };

    const merged: XmlObject = { ...base };
    for (const [key, value] of Object.entries(override)) {
      const existing = merged[key];
      if (
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        existing &&
        typeof existing === "object" &&
        !Array.isArray(existing)
      ) {
        merged[key] = this.mergeXmlObjects(
          existing as XmlObject,
          value as XmlObject,
        );
      } else {
        merged[key] = value;
      }
    }
    return merged;
  }

  protected readFlipState(xfrm: XmlObject | undefined): {
    flipHorizontal: boolean;
    flipVertical: boolean;
  } {
    if (!xfrm) {
      return {
        flipHorizontal: false,
        flipVertical: false,
      };
    }

    return {
      flipHorizontal: this.parseBooleanAttr(xfrm["@_flipH"]),
      flipVertical: this.parseBooleanAttr(xfrm["@_flipV"]),
    };
  }

  /**
   * Build a cache-map key for a placeholder.  Prefers `idx` when present,
   * otherwise falls back to `type`.
   */
  protected buildPlaceholderDefaultsKey(phInfo: PlaceholderInfo): string {
    if (phInfo.idx !== undefined) {
      return phInfo.type ? `${phInfo.type}_${phInfo.idx}` : `_${phInfo.idx}`;
    }
    return phInfo.type ?? "body";
  }

  /**
   * Look up merged {@link PlaceholderDefaults} for a shape's placeholder
   * reference. Checks the layout cache first, then the master cache, and
   * merges them so that layout values take priority over master values.
   */
  protected lookupPlaceholderDefaults(
    slidePath: string,
    phInfo: PlaceholderInfo,
  ): PlaceholderDefaults | undefined {
    const layoutPath = this.resolveLayoutPathForSlide(slidePath);
    if (!layoutPath) return undefined;

    const phKey = this.buildPlaceholderDefaultsKey(phInfo);

    const layoutMap = this.layoutPlaceholderDefaultsCache.get(layoutPath);
    const layoutDefaults = layoutMap?.get(phKey);

    const masterPath = this.resolveMasterPathForLayout(layoutPath);
    const masterMap = masterPath
      ? this.masterPlaceholderDefaultsCache.get(masterPath)
      : undefined;
    const masterDefaults = masterMap?.get(phKey);

    if (!layoutDefaults && !masterDefaults) return undefined;
    if (!masterDefaults) return layoutDefaults;
    if (!layoutDefaults) return masterDefaults;

    // Merge: layout wins over master
    const merged: PlaceholderDefaults = {
      type: layoutDefaults.type,
      idx: layoutDefaults.idx ?? masterDefaults.idx,
      bodyInsetLeft:
        layoutDefaults.bodyInsetLeft ?? masterDefaults.bodyInsetLeft,
      bodyInsetTop: layoutDefaults.bodyInsetTop ?? masterDefaults.bodyInsetTop,
      bodyInsetRight:
        layoutDefaults.bodyInsetRight ?? masterDefaults.bodyInsetRight,
      bodyInsetBottom:
        layoutDefaults.bodyInsetBottom ?? masterDefaults.bodyInsetBottom,
      textAnchor: layoutDefaults.textAnchor ?? masterDefaults.textAnchor,
      autoFit: layoutDefaults.autoFit ?? masterDefaults.autoFit,
      textWrap: layoutDefaults.textWrap ?? masterDefaults.textWrap,
      promptText: layoutDefaults.promptText ?? masterDefaults.promptText,
    };

    // Merge level styles (layout levels override master levels, per-field)
    if (layoutDefaults.levelStyles || masterDefaults.levelStyles) {
      const mergedLevels: Record<number, PlaceholderTextLevelStyle> = {};
      const allLevelKeys = new Set([
        ...Object.keys(layoutDefaults.levelStyles ?? {}),
        ...Object.keys(masterDefaults.levelStyles ?? {}),
      ]);
      for (const keyStr of allLevelKeys) {
        const key = Number.parseInt(keyStr, 10);
        const layoutLevel = layoutDefaults.levelStyles?.[key];
        const masterLevel = masterDefaults.levelStyles?.[key];
        if (layoutLevel && masterLevel) {
          mergedLevels[key] = { ...masterLevel, ...layoutLevel };
        } else {
          mergedLevels[key] = (layoutLevel ?? masterLevel)!;
        }
      }
      merged.levelStyles = mergedLevels;
    }

    return merged;
  }
}
