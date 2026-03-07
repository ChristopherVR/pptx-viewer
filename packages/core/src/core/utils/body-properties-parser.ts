import type { XmlObject, TextStyle } from "../types";

/**
 * Parse additional boolean body properties from a:bodyPr attributes.
 * Handles: compatLnSpc, forceAA, upright, fromWordArt
 */
export function parseBodyPrBooleanAttrs(
  bodyPr: XmlObject,
  textStyle: TextStyle,
): void {
  const parseBoolAttr = (attr: string): boolean | undefined => {
    const raw = bodyPr[attr];
    if (raw === undefined) return undefined;
    const val = String(raw).trim().toLowerCase();
    return val === "1" || val === "true";
  };

  const compatLnSpc = parseBoolAttr("@_compatLnSpc");
  if (compatLnSpc !== undefined) textStyle.compatibleLineSpacing = compatLnSpc;

  const forceAA = parseBoolAttr("@_forceAA");
  if (forceAA !== undefined) textStyle.forceAntiAlias = forceAA;

  const upright = parseBoolAttr("@_upright");
  if (upright !== undefined) textStyle.upright = upright;

  const fromWordArt = parseBoolAttr("@_fromWordArt");
  if (fromWordArt !== undefined) textStyle.fromWordArt = fromWordArt;
}

/**
 * Write body property boolean attributes to bodyPr XML object.
 */
export function writeBodyPrBooleanAttrs(
  bodyPr: XmlObject,
  textStyle: TextStyle | undefined,
): void {
  if (!textStyle) return;
  if (textStyle.compatibleLineSpacing !== undefined)
    bodyPr["@_compatLnSpc"] = textStyle.compatibleLineSpacing ? "1" : "0";
  if (textStyle.forceAntiAlias !== undefined)
    bodyPr["@_forceAA"] = textStyle.forceAntiAlias ? "1" : "0";
  if (textStyle.upright !== undefined)
    bodyPr["@_upright"] = textStyle.upright ? "1" : "0";
  if (textStyle.fromWordArt !== undefined)
    bodyPr["@_fromWordArt"] = textStyle.fromWordArt ? "1" : "0";
}
