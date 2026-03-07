import type { ShapeStyle, XmlObject } from "../../types";

export interface DagSpecificContext {
  parseColor: (
    colorNode: XmlObject | undefined,
    placeholderColor?: string,
  ) => string | undefined;
  ensureArray: (value: unknown) => XmlObject[];
}

export function extractDagGrayscale(
  dag: XmlObject,
  style: Partial<ShapeStyle>,
): void {
  if (dag["a:grayscl"] !== undefined) {
    style.dagGrayscale = true;
  }
}

export function extractDagBiLevel(
  dag: XmlObject,
  style: Partial<ShapeStyle>,
): void {
  const biLevel = dag["a:biLevel"] as XmlObject | undefined;
  if (!biLevel) return;
  const thresh = biLevel["@_thresh"];
  if (thresh !== undefined) {
    const pct = parseInt(String(thresh)) / 1000;
    if (Number.isFinite(pct)) {
      style.dagBiLevel = Math.max(0, Math.min(100, pct));
    }
  }
}

export function extractDagLuminance(
  dag: XmlObject,
  style: Partial<ShapeStyle>,
): void {
  const lum = dag["a:lum"] as XmlObject | undefined;
  if (!lum) return;

  const bright = lum["@_bright"];
  if (bright !== undefined) {
    const val = parseInt(String(bright)) / 1000;
    if (Number.isFinite(val)) {
      style.dagLumBrightness = val;
    }
  }
  const contrast = lum["@_contrast"];
  if (contrast !== undefined) {
    const val = parseInt(String(contrast)) / 1000;
    if (Number.isFinite(val)) {
      style.dagLumContrast = val;
    }
  }
}

export function extractDagHsl(
  dag: XmlObject,
  style: Partial<ShapeStyle>,
): void {
  const hsl = dag["a:hsl"] as XmlObject | undefined;
  if (!hsl) return;

  const hue = hsl["@_hue"];
  if (hue !== undefined) {
    // Hue is in 60000ths of a degree
    const val = parseInt(String(hue)) / 60000;
    if (Number.isFinite(val)) {
      style.dagHslHue = val;
    }
  }
  const sat = hsl["@_sat"];
  if (sat !== undefined) {
    // Saturation in 1/1000ths of a percent
    const val = parseInt(String(sat)) / 1000;
    if (Number.isFinite(val)) {
      style.dagHslSaturation = val;
    }
  }
  const lum = hsl["@_lum"];
  if (lum !== undefined) {
    const val = parseInt(String(lum)) / 1000;
    if (Number.isFinite(val)) {
      style.dagHslLuminance = val;
    }
  }
}

export function extractDagAlphaModFix(
  dag: XmlObject,
  style: Partial<ShapeStyle>,
): void {
  const alphaModFix = dag["a:alphaModFix"] as XmlObject | undefined;
  if (!alphaModFix) return;

  const amt = alphaModFix["@_amt"];
  if (amt !== undefined) {
    // amt is in 1/1000ths of a percent (e.g. 50000 = 50%)
    const pct = parseInt(String(amt)) / 1000;
    if (Number.isFinite(pct)) {
      style.dagAlphaModFix = pct;
    }
  }
}

export function extractDagTint(
  dag: XmlObject,
  style: Partial<ShapeStyle>,
): void {
  const tint = dag["a:tint"] as XmlObject | undefined;
  if (!tint) return;

  const hue = tint["@_hue"];
  if (hue !== undefined) {
    const val = parseInt(String(hue)) / 60000;
    if (Number.isFinite(val)) {
      style.dagTintHue = val;
    }
  }
  const amt = tint["@_amt"];
  if (amt !== undefined) {
    const val = parseInt(String(amt)) / 1000;
    if (Number.isFinite(val)) {
      style.dagTintAmount = val;
    }
  }
}

export function extractDagDuotone(
  dag: XmlObject,
  style: Partial<ShapeStyle>,
  context: DagSpecificContext,
): void {
  const duotone = dag["a:duotone"] as XmlObject | undefined;
  if (!duotone) return;

  const colorNodes: XmlObject[] = [
    ...context.ensureArray(duotone["a:srgbClr"]),
    ...context.ensureArray(duotone["a:schemeClr"]),
    ...context.ensureArray(duotone["a:prstClr"]),
  ];
  if (colorNodes.length >= 2) {
    style.dagDuotone = {
      color1: context.parseColor(colorNodes[0]) || "#000000",
      color2: context.parseColor(colorNodes[1]) || "#ffffff",
    };
  }
}

export function extractDagFillOverlay(
  dag: XmlObject,
  style: Partial<ShapeStyle>,
): void {
  const fillOverlay = dag["a:fillOverlay"] as XmlObject | undefined;
  if (!fillOverlay) return;

  const blend = String(fillOverlay["@_blend"] || "")
    .trim()
    .toLowerCase();
  const validBlends = ["over", "mult", "screen", "darken", "lighten"];
  if (validBlends.includes(blend)) {
    style.dagFillOverlayBlend = blend as ShapeStyle["dagFillOverlayBlend"];
  }
}
