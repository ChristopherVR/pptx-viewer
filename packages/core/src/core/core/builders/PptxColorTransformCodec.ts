import type { XmlObject } from "../../types";
import { PRESET_COLOR_MAP, SYSTEM_COLOR_MAP } from "../../constants";
import { hslToRgb, parseDrawingHueDegrees } from "../../color/color-utils";
import { applyDrawingColorTransforms } from "../../color/color-transforms";

export interface PptxColorTransformCodecContext {
  resolveThemeColor: (schemeKey: string) => string | undefined;
}

export interface IPptxColorTransformCodec {
  parseColorChoice(
    colorChoice: XmlObject | undefined,
    placeholderColor?: string,
  ): string | undefined;
  parseColor(
    colorNode: XmlObject | undefined,
    placeholderColor?: string,
  ): string | undefined;
  percentAttrToUnit(value: unknown): number | undefined;
  clampUnitInterval(value: number): number;
  hexToRgb(hex: string): { r: number; g: number; b: number } | undefined;
  rgbToHex(r: number, g: number, b: number): string;
  applyColorTransforms(baseColor: string, colorNode: XmlObject): string;
}

export class PptxColorTransformCodec implements IPptxColorTransformCodec {
  private readonly context: PptxColorTransformCodecContext;

  public constructor(context: PptxColorTransformCodecContext) {
    this.context = context;
  }

  public parseColorChoice(
    colorChoice: XmlObject | undefined,
    placeholderColor?: string,
  ): string | undefined {
    if (!colorChoice) return undefined;

    if (colorChoice["a:scrgbClr"]) {
      const scrgb = colorChoice["a:scrgbClr"] as XmlObject;
      const red = this.percentAttrToUnit(scrgb["@_r"]);
      const green = this.percentAttrToUnit(scrgb["@_g"]);
      const blue = this.percentAttrToUnit(scrgb["@_b"]);
      if (red !== undefined && green !== undefined && blue !== undefined) {
        const base = this.rgbToHex(red * 255, green * 255, blue * 255);
        return this.applyColorTransforms(base, scrgb);
      }
    }

    if (colorChoice["a:srgbClr"]) {
      const srgb = colorChoice["a:srgbClr"] as XmlObject;
      const value = String(srgb["@_val"] || "").trim();
      if (/^[0-9a-fA-F]{6}$/.test(value)) {
        return this.applyColorTransforms(`#${value.toUpperCase()}`, srgb);
      }
    }

    if (colorChoice["a:sysClr"]) {
      const systemColor = colorChoice["a:sysClr"] as XmlObject;
      const lastColor = String(systemColor["@_lastClr"] || "").trim();
      if (/^[0-9a-fA-F]{6}$/.test(lastColor)) {
        return this.applyColorTransforms(
          `#${lastColor.toUpperCase()}`,
          systemColor,
        );
      }
      // Fallback: resolve @_val system color name
      const sysVal = String(systemColor["@_val"] || "").trim();
      if (sysVal) {
        const mapped = SYSTEM_COLOR_MAP[sysVal];
        if (mapped) {
          return this.applyColorTransforms(mapped, systemColor);
        }
      }
    }

    if (colorChoice["a:prstClr"]) {
      const presetColor = colorChoice["a:prstClr"] as XmlObject;
      const presetName = String(presetColor["@_val"] || "").toLowerCase();
      const mappedColor = PRESET_COLOR_MAP[presetName];
      if (mappedColor) {
        return this.applyColorTransforms(mappedColor, presetColor);
      }
    }

    if (colorChoice["a:schemeClr"]) {
      const scheme = colorChoice["a:schemeClr"] as XmlObject;
      const schemeKey = String(scheme["@_val"] || "")
        .trim()
        .toLowerCase();
      if (!schemeKey) return undefined;

      const baseColor =
        schemeKey === "phclr"
          ? placeholderColor || this.context.resolveThemeColor("accent1")
          : this.context.resolveThemeColor(schemeKey);
      if (!baseColor) return undefined;
      return this.applyColorTransforms(baseColor, scheme);
    }

    // OOXML_PARITY: a:hslClr now supported
    if (colorChoice["a:hslClr"]) {
      const hslNode = colorChoice["a:hslClr"] as XmlObject;
      const hue = parseDrawingHueDegrees(hslNode["@_hue"]);
      const sat = this.percentAttrToUnit(hslNode["@_sat"]);
      const lum = this.percentAttrToUnit(hslNode["@_lum"]);
      if (hue !== undefined && sat !== undefined && lum !== undefined) {
        const rgb = hslToRgb(hue, sat, lum);
        const base = this.rgbToHex(rgb.r, rgb.g, rgb.b);
        return this.applyColorTransforms(base, hslNode);
      }
    }

    return undefined;
  }

  public parseColor(
    colorNode: XmlObject | undefined,
    placeholderColor?: string,
  ): string | undefined {
    if (!colorNode) return undefined;
    return this.parseColorChoice(colorNode, placeholderColor);
  }

  public percentAttrToUnit(value: unknown): number | undefined {
    const parsedValue = Number.parseFloat(String(value ?? "").trim());
    if (!Number.isFinite(parsedValue)) return undefined;
    return Math.min(1, Math.max(0, parsedValue / 100000));
  }

  public clampUnitInterval(value: number): number {
    return Math.min(1, Math.max(0, value));
  }

  public hexToRgb(
    hex: string,
  ): { r: number; g: number; b: number } | undefined {
    const normalized = hex.replace("#", "");
    if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return undefined;
    return {
      r: Number.parseInt(normalized.slice(0, 2), 16),
      g: Number.parseInt(normalized.slice(2, 4), 16),
      b: Number.parseInt(normalized.slice(4, 6), 16),
    };
  }

  public rgbToHex(r: number, g: number, b: number): string {
    const toHex = (channelValue: number): string =>
      this.clampColorChannel(channelValue)
        .toString(16)
        .padStart(2, "0")
        .toUpperCase();
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  public applyColorTransforms(baseColor: string, colorNode: XmlObject): string {
    return applyDrawingColorTransforms(baseColor, colorNode);
  }

  private clampColorChannel(value: number): number {
    return Math.min(255, Math.max(0, Math.round(value)));
  }
}
