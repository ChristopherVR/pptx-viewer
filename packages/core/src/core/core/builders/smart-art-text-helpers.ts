import type { XmlObject } from "../../types";

/**
 * Extract text content from a SmartArt point node.
 * Traverses the `dgm:t` element and collects text from all `a:t` elements
 * within the paragraph structure (`a:p` / `a:r` / `a:t`).
 */
export function extractTextFromPoint(point: XmlObject): string | undefined {
  const textValues: string[] = [];
  collectLocalTextValues(point, "t", textValues);

  const resolvedText = textValues.find((entry) => entry.trim().length > 0);
  return resolvedText?.trim();
}

/**
 * Recursively collect text values from XML objects.
 * Searches for elements with local name `targetName` and extracts
 * text from nested `a:t` elements.
 */
export function collectLocalTextValues(
  obj: XmlObject | undefined,
  targetName: string,
  out: string[],
): void {
  if (!obj || typeof obj !== "object") return;

  for (const key of Object.keys(obj)) {
    const localName = getLocalName(key);
    if (localName === targetName) {
      extractParagraphText(obj[key] as XmlObject, out);
    } else if (typeof obj[key] === "object") {
      collectLocalTextValues(obj[key] as XmlObject, targetName, out);
    }
  }
}

/**
 * Extract text from a paragraph structure.
 * Handles DrawingML text structure: `a:p` / `a:r` / `a:t`
 */
export function extractParagraphText(
  paragraph: XmlObject | undefined,
  out: string[],
): void {
  if (!paragraph || typeof paragraph !== "object") return;

  // Handle array of paragraphs
  if (Array.isArray(paragraph)) {
    for (const p of paragraph) {
      extractParagraphText(p, out);
    }
    return;
  }

  // Look for `a:p` elements
  const pList = paragraph["a:p"];
  if (pList) {
    extractParagraphText(pList as XmlObject, out);
    return;
  }

  // Look for `a:r` elements
  const runs = paragraph["a:r"];
  if (runs) {
    if (Array.isArray(runs)) {
      for (const run of runs) {
        const textNode = (run as XmlObject)["a:t"];
        if (textNode) {
          out.push(String(textNode));
        }
      }
    } else {
      const textNode = (runs as XmlObject)["a:t"];
      if (textNode) {
        out.push(String(textNode));
      }
    }
  }
}

/**
 * Extract local name from qualified XML tag name.
 * Converts "dgm:pt" → "pt", "a:p" → "p", etc.
 */
export function getLocalName(qualifiedName: string): string {
  const colonIndex = qualifiedName.indexOf(":");
  return colonIndex >= 0 ? qualifiedName.slice(colonIndex + 1) : qualifiedName;
}
