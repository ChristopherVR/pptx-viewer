import type { XmlObject, PptxKinsoku } from "../types";

/**
 * Parse East Asian line-break settings from `p:kinsoku` in presentation XML.
 * Extracted from PptxHandlerRuntimePresentationStructure for testability.
 */
export function parseKinsoku(
  presentationXml: XmlObject | undefined,
): PptxKinsoku | undefined {
  const pres = presentationXml?.["p:presentation"] as XmlObject | undefined;
  if (!pres) return undefined;

  const kinsoku = pres["p:kinsoku"] as XmlObject | undefined;
  if (!kinsoku) return undefined;

  const result: PptxKinsoku = {};
  let hasProps = false;

  const lang = kinsoku["@_lang"];
  if (lang !== undefined) {
    const langStr = String(lang).trim();
    if (langStr.length > 0) {
      result.lang = langStr;
      hasProps = true;
    }
  }

  const invalStChars = kinsoku["@_invalStChars"];
  if (invalStChars !== undefined) {
    result.invalStChars = String(invalStChars);
    hasProps = true;
  }

  const invalEndChars = kinsoku["@_invalEndChars"];
  if (invalEndChars !== undefined) {
    result.invalEndChars = String(invalEndChars);
    hasProps = true;
  }

  return hasProps ? result : {};
}

/**
 * Apply kinsoku settings to a presentation XML object.
 * Extracted from PptxPresentationSaveBuilder for testability.
 */
export function applyKinsokuToXml(
  presentation: XmlObject,
  kinsoku: PptxKinsoku | undefined,
): void {
  if (!kinsoku) return;
  const k: XmlObject = (presentation["p:kinsoku"] as XmlObject) || {};

  if (kinsoku.lang !== undefined) {
    k["@_lang"] = kinsoku.lang;
  }
  if (kinsoku.invalStChars !== undefined) {
    k["@_invalStChars"] = kinsoku.invalStChars;
  }
  if (kinsoku.invalEndChars !== undefined) {
    k["@_invalEndChars"] = kinsoku.invalEndChars;
  }

  presentation["p:kinsoku"] = k;
}
