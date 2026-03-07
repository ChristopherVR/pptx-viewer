import {
  XmlObject,
  hslToRgb,
  applyDrawingColorTransforms as applyFullColorTransforms,
  PRESET_COLOR_MAP,
} from "pptx-viewer-core";
import { clampUnitInterval } from "./color";
import { parseDrawingPercent } from "./style";

export const DEFAULT_SCHEME_COLOR_MAP: Record<string, string> = {
  dk1: "#000000",
  lt1: "#FFFFFF",
  dk2: "#1F497D",
  lt2: "#EEECE1",
  accent1: "#4472C4",
  accent2: "#ED7D31",
  accent3: "#A5A5A5",
  accent4: "#FFC000",
  accent5: "#5B9BD5",
  accent6: "#70AD47",
  hlink: "#0563C1",
  folHlink: "#954F72",
  tx1: "#000000",
  tx2: "#44546A",
  bg1: "#FFFFFF",
  bg2: "#E7E6E6",
  phclr: "#4472C4",
};

// Re-export PRESET_COLOR_MAP from the editor barrel for backward compatibility
export { PRESET_COLOR_MAP } from "pptx-viewer-core";

/**
 * Apply all 26 OOXML drawing colour transforms to a base colour.
 * Delegates to the comprehensive implementation in the editor core.
 */
export function applyDrawingColorTransforms(
  baseColor: string,
  colorNode: XmlObject,
): string {
  return applyFullColorTransforms(baseColor, colorNode);
}

export function parseDrawingColorChoice(
  colorNode: XmlObject | undefined,
): string | undefined {
  if (!colorNode) return undefined;

  if (colorNode["a:scrgbClr"]) {
    const scrgb = colorNode["a:scrgbClr"] as XmlObject;
    const red = parseDrawingPercent(scrgb["@_r"]);
    const green = parseDrawingPercent(scrgb["@_g"]);
    const blue = parseDrawingPercent(scrgb["@_b"]);
    if (red !== undefined && green !== undefined && blue !== undefined) {
      const toHex = (value: number) =>
        Math.min(255, Math.max(0, Math.round(value)))
          .toString(16)
          .padStart(2, "0")
          .toUpperCase();
      const base = `#${toHex(red * 255)}${toHex(green * 255)}${toHex(blue * 255)}`;
      return applyDrawingColorTransforms(base, scrgb);
    }
  }

  if (colorNode["a:srgbClr"]) {
    const srgb = colorNode["a:srgbClr"] as XmlObject;
    const value = String(srgb["@_val"] || "").trim();
    if (/^[0-9a-fA-F]{6}$/.test(value)) {
      return applyDrawingColorTransforms(`#${value.toUpperCase()}`, srgb);
    }
  }

  if (colorNode["a:sysClr"]) {
    const systemColor = colorNode["a:sysClr"] as XmlObject;
    const lastColor = String(systemColor["@_lastClr"] || "").trim();
    if (/^[0-9a-fA-F]{6}$/.test(lastColor)) {
      return applyDrawingColorTransforms(
        `#${lastColor.toUpperCase()}`,
        systemColor,
      );
    }
  }

  if (colorNode["a:schemeClr"]) {
    const schemeColor = colorNode["a:schemeClr"] as XmlObject;
    const schemeValue = String(schemeColor["@_val"] || "")
      .trim()
      .toLowerCase();
    if (!schemeValue) return undefined;
    const base = DEFAULT_SCHEME_COLOR_MAP[schemeValue];
    if (!base) return undefined;
    return applyDrawingColorTransforms(base, schemeColor);
  }

  if (colorNode["a:hslClr"]) {
    const hslNode = colorNode["a:hslClr"] as XmlObject;
    const hueRaw = Number.parseFloat(String(hslNode["@_hue"] ?? ""));
    const satRaw = Number.parseFloat(String(hslNode["@_sat"] ?? ""));
    const lumRaw = Number.parseFloat(String(hslNode["@_lum"] ?? ""));
    if (
      Number.isFinite(hueRaw) &&
      Number.isFinite(satRaw) &&
      Number.isFinite(lumRaw)
    ) {
      const h = hueRaw / 60000;
      const s = clampUnitInterval(satRaw / 100000);
      const l = clampUnitInterval(lumRaw / 100000);
      const rgb = hslToRgb(h, s, l);
      const toHex = (value: number) =>
        Math.min(255, Math.max(0, Math.round(value)))
          .toString(16)
          .padStart(2, "0")
          .toUpperCase();
      const base = `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
      return applyDrawingColorTransforms(base, hslNode);
    }
  }

  if (colorNode["a:prstClr"]) {
    const preset = String(
      (colorNode["a:prstClr"] as XmlObject | undefined)?.["@_val"] || "",
    ).toLowerCase();
    const mapped = PRESET_COLOR_MAP[preset];
    if (!mapped) return undefined;
    return applyDrawingColorTransforms(
      mapped,
      colorNode["a:prstClr"] as XmlObject,
    );
  }

  return undefined;
}

export function parseDrawingColor(
  colorNode: XmlObject | undefined,
): string | undefined {
  if (!colorNode) return undefined;
  const direct = parseDrawingColorChoice(colorNode);
  if (direct) return direct;
  if (colorNode["a:solidFill"]) {
    return parseDrawingColorChoice(colorNode["a:solidFill"] as XmlObject);
  }
  return undefined;
}

export function parseDrawingColorOpacity(
  colorNode: XmlObject | undefined,
): number | undefined {
  if (!colorNode) return undefined;
  const colorChoice =
    (colorNode["a:scrgbClr"] as XmlObject | undefined) ||
    (colorNode["a:srgbClr"] as XmlObject | undefined) ||
    (colorNode["a:schemeClr"] as XmlObject | undefined) ||
    (colorNode["a:hslClr"] as XmlObject | undefined) ||
    (colorNode["a:prstClr"] as XmlObject | undefined) ||
    (colorNode["a:sysClr"] as XmlObject | undefined);
  if (!colorChoice) return undefined;

  const alpha = parseDrawingPercent(
    (colorChoice["a:alpha"] as XmlObject | undefined)?.["@_val"],
  );
  const alphaMod = parseDrawingPercent(
    (colorChoice["a:alphaMod"] as XmlObject | undefined)?.["@_val"],
  );
  const alphaOff = parseDrawingPercent(
    (colorChoice["a:alphaOff"] as XmlObject | undefined)?.["@_val"],
  );
  if (alpha === undefined && alphaMod === undefined && alphaOff === undefined) {
    return undefined;
  }

  let opacity = alpha ?? 1;
  if (alphaMod !== undefined) {
    opacity *= alphaMod;
  }
  if (alphaOff !== undefined) {
    opacity += alphaOff;
  }
  return clampUnitInterval(opacity);
}
