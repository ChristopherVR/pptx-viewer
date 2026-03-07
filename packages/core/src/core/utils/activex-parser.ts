import type { XmlObject, PptxActiveXControl } from "../types";

function ensureArray(val: unknown): XmlObject[] {
  if (val === undefined || val === null) return [];
  return Array.isArray(val) ? val : [val as XmlObject];
}

/**
 * Parse `p:controls > p:control` entries from a slide XML object.
 * Extracted from PptxHandlerRuntimeDocProperties for testability.
 */
export function parseActiveXControlsFromSlide(
  slideXml: XmlObject,
): PptxActiveXControl[] {
  try {
    const sld = slideXml["p:sld"] as XmlObject | undefined;
    const cSld = sld?.["p:cSld"] as XmlObject | undefined;
    if (!cSld) return [];

    const controls = cSld["p:controls"] as XmlObject | undefined;
    if (!controls) return [];

    const controlEntries = ensureArray(controls["p:control"]) as XmlObject[];
    if (controlEntries.length === 0) return [];

    const results: PptxActiveXControl[] = [];
    for (const entry of controlEntries) {
      const relId = String(entry["@_r:id"] || "").trim();
      if (!relId) continue;

      const name = entry["@_name"]
        ? String(entry["@_name"]).trim()
        : undefined;
      const shapeId = entry["@_spid"]
        ? String(entry["@_spid"]).trim()
        : undefined;

      results.push({ relId, name, shapeId, rawXml: entry });
    }
    return results;
  } catch (e) {
    console.warn("Failed to parse slide ActiveX controls:", e);
    return [];
  }
}
