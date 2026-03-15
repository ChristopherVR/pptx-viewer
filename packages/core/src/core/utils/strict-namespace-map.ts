/**
 * Strict OOXML Conformance - Namespace Normalization & Round-Trip
 *
 * Office 365 can save files in "Strict Open XML" mode (ISO/IEC 29500 Strict)
 * which uses different namespace URIs than Transitional (ECMA-376).
 *
 * This module provides bidirectional mapping between Strict and Transitional
 * namespace URIs, enabling:
 *  - Load: normalize Strict URIs to Transitional for internal processing
 *  - Save: convert Transitional URIs back to Strict for round-trip fidelity
 *
 * Reference: ECMA-376 5th Edition, Part 1, Annex A & B.
 */

/** OOXML conformance class. */
export type OoxmlConformanceClass = "strict" | "transitional";

// ---------------------------------------------------------------------------
// Strict ↔ Transitional namespace URI mappings
// ---------------------------------------------------------------------------

/**
 * Bidirectional namespace mapping entries.
 * Each pair is [Strict URI, Transitional URI].
 */
const NAMESPACE_PAIRS: ReadonlyArray<[string, string]> = [
  // -- PresentationML --
  [
    "http://purl.oclc.org/ooxml/presentationml/main",
    "http://schemas.openxmlformats.org/presentationml/2006/main",
  ],

  // -- DrawingML --
  [
    "http://purl.oclc.org/ooxml/drawingml/main",
    "http://schemas.openxmlformats.org/drawingml/2006/main",
  ],
  [
    "http://purl.oclc.org/ooxml/drawingml/chart",
    "http://schemas.openxmlformats.org/drawingml/2006/chart",
  ],
  [
    "http://purl.oclc.org/ooxml/drawingml/chartDrawing",
    "http://schemas.openxmlformats.org/drawingml/2006/chartDrawing",
  ],
  [
    "http://purl.oclc.org/ooxml/drawingml/diagram",
    "http://schemas.openxmlformats.org/drawingml/2006/diagram",
  ],
  [
    "http://purl.oclc.org/ooxml/drawingml/lockedCanvas",
    "http://schemas.openxmlformats.org/drawingml/2006/lockedCanvas",
  ],
  [
    "http://purl.oclc.org/ooxml/drawingml/picture",
    "http://schemas.openxmlformats.org/drawingml/2006/picture",
  ],
  [
    "http://purl.oclc.org/ooxml/drawingml/spreadsheetDrawing",
    "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing",
  ],
  [
    "http://purl.oclc.org/ooxml/drawingml/wordprocessingDrawing",
    "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing",
  ],

  // -- Relationships --
  [
    "http://purl.oclc.org/ooxml/officeDocument/relationships",
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  ],
  [
    "http://purl.oclc.org/ooxml/officeDocument/relationships/chart",
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart",
  ],
  [
    "http://purl.oclc.org/ooxml/officeDocument/relationships/comments",
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments",
  ],
  [
    "http://purl.oclc.org/ooxml/officeDocument/relationships/customXml",
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/customXml",
  ],
  [
    "http://purl.oclc.org/ooxml/officeDocument/relationships/diagramColors",
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/diagramColors",
  ],
  [
    "http://purl.oclc.org/ooxml/officeDocument/relationships/diagramData",
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/diagramData",
  ],
  [
    "http://purl.oclc.org/ooxml/officeDocument/relationships/diagramLayout",
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/diagramLayout",
  ],
  [
    "http://purl.oclc.org/ooxml/officeDocument/relationships/diagramStyle",
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/diagramStyle",
  ],
  [
    "http://purl.oclc.org/ooxml/officeDocument/relationships/extended-properties",
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties",
  ],
  [
    "http://purl.oclc.org/ooxml/officeDocument/relationships/font",
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/font",
  ],
  [
    "http://purl.oclc.org/ooxml/officeDocument/relationships/handoutMaster",
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/handoutMaster",
  ],
  [
    "http://purl.oclc.org/ooxml/officeDocument/relationships/hyperlink",
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink",
  ],
  [
    "http://purl.oclc.org/ooxml/officeDocument/relationships/image",
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image",
  ],
  [
    "http://purl.oclc.org/ooxml/officeDocument/relationships/media",
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/media",
  ],
  [
    "http://purl.oclc.org/ooxml/officeDocument/relationships/notesMaster",
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesMaster",
  ],
  [
    "http://purl.oclc.org/ooxml/officeDocument/relationships/notesSlide",
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide",
  ],
  [
    "http://purl.oclc.org/ooxml/officeDocument/relationships/oleObject",
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/oleObject",
  ],
  [
    "http://purl.oclc.org/ooxml/officeDocument/relationships/presProps",
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/presProps",
  ],
  [
    "http://purl.oclc.org/ooxml/officeDocument/relationships/slide",
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide",
  ],
  [
    "http://purl.oclc.org/ooxml/officeDocument/relationships/slideLayout",
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout",
  ],
  [
    "http://purl.oclc.org/ooxml/officeDocument/relationships/slideMaster",
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster",
  ],
  [
    "http://purl.oclc.org/ooxml/officeDocument/relationships/tags",
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags",
  ],
  [
    "http://purl.oclc.org/ooxml/officeDocument/relationships/theme",
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme",
  ],
  [
    "http://purl.oclc.org/ooxml/officeDocument/relationships/themeOverride",
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/themeOverride",
  ],
  [
    "http://purl.oclc.org/ooxml/officeDocument/relationships/video",
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/video",
  ],
  [
    "http://purl.oclc.org/ooxml/officeDocument/relationships/audio",
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/audio",
  ],
  [
    "http://purl.oclc.org/ooxml/officeDocument/relationships/viewProps",
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/viewProps",
  ],
  [
    "http://purl.oclc.org/ooxml/officeDocument/relationships/tableStyles",
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/tableStyles",
  ],

  // -- OfficeDocument core --
  [
    "http://purl.oclc.org/ooxml/officeDocument/math",
    "http://schemas.openxmlformats.org/officeDocument/2006/math",
  ],
  [
    "http://purl.oclc.org/ooxml/officeDocument/bibliography",
    "http://schemas.openxmlformats.org/officeDocument/2006/bibliography",
  ],
  [
    "http://purl.oclc.org/ooxml/officeDocument/custom-properties",
    "http://schemas.openxmlformats.org/officeDocument/2006/custom-properties",
  ],
  [
    "http://purl.oclc.org/ooxml/officeDocument/extended-properties",
    "http://schemas.openxmlformats.org/officeDocument/2006/extended-properties",
  ],
  [
    "http://purl.oclc.org/ooxml/officeDocument/docPropsVTypes",
    "http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes",
  ],

  // -- Package-level relationships --
  [
    "http://purl.oclc.org/ooxml/officeDocument/relationships/officeDocument",
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument",
  ],
  [
    "http://purl.oclc.org/ooxml/package/relationships",
    "http://schemas.openxmlformats.org/package/2006/relationships",
  ],
  [
    "http://purl.oclc.org/ooxml/package/relationships/metadata/core-properties",
    "http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties",
  ],
  [
    "http://purl.oclc.org/ooxml/package/relationships/digital-signature/origin",
    "http://schemas.openxmlformats.org/package/2006/relationships/digital-signature/origin",
  ],
  [
    "http://purl.oclc.org/ooxml/package/relationships/digital-signature/signature",
    "http://schemas.openxmlformats.org/package/2006/relationships/digital-signature/signature",
  ],

  // -- SpreadsheetML (for embedded charts / workbooks) --
  [
    "http://purl.oclc.org/ooxml/spreadsheetml/main",
    "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
  ],

  // -- WordprocessingML (for embedded docs) --
  [
    "http://purl.oclc.org/ooxml/wordprocessingml/main",
    "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
  ],

  // -- Markup Compatibility --
  [
    "http://purl.oclc.org/ooxml/markup-compatibility/2006",
    "http://schemas.openxmlformats.org/markup-compatibility/2006",
  ],
];

/**
 * Comprehensive map of Strict Open XML namespace URIs to their Transitional
 * equivalents. Covers PresentationML, DrawingML, Relationships, OfficeDocument,
 * SpreadsheetML (for embedded charts), and WordprocessingML.
 */
const STRICT_TO_TRANSITIONAL_NS: ReadonlyMap<string, string> = new Map(
  NAMESPACE_PAIRS,
);

/**
 * Reverse map: Transitional namespace URIs → Strict equivalents.
 * Used during save to convert back to Strict conformance.
 */
const TRANSITIONAL_TO_STRICT_NS: ReadonlyMap<string, string> = new Map(
  NAMESPACE_PAIRS.map(([strict, transitional]) => [transitional, strict]),
);


// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Convert a Strict Open XML namespace URI to its Transitional equivalent.
 * If the URI is already Transitional (or unknown), it is returned unchanged.
 */
export function normalizeNamespaceUri(uri: string): string {
  return STRICT_TO_TRANSITIONAL_NS.get(uri) ?? uri;
}

/**
 * Check whether a URI belongs to the Strict Open XML namespace family.
 */
export function isStrictNamespaceUri(uri: string): boolean {
  return uri.startsWith("http://purl.oclc.org/ooxml/");
}

/**
 * Detect whether a parsed XML object tree contains Strict Open XML
 * namespace declarations. Checks `@_xmlns` and `@_xmlns:*` attributes
 * on the first-level root element.
 */
export function detectStrictConformance(
  xmlObj: Record<string, unknown>,
): boolean {
  // Walk top-level keys (usually just the root element + "?xml")
  for (const key of Object.keys(xmlObj)) {
    const child = xmlObj[key];
    if (typeof child !== "object" || child === null || Array.isArray(child))
      continue;
    const node = child as Record<string, unknown>;
    for (const attrKey of Object.keys(node)) {
      if (!attrKey.startsWith("@_xmlns")) continue;
      const value = String(node[attrKey] || "");
      if (isStrictNamespaceUri(value)) return true;
    }
  }
  return false;
}

/**
 * Recursively normalize all Strict namespace URIs within a parsed XML
 * object tree to their Transitional equivalents.
 *
 * Normalizes:
 *  - `@_xmlns` and `@_xmlns:*` attribute values (namespace declarations)
 *  - `@_Type` attribute values on Relationship elements (relationship type URIs)
 *  - `@_uri` attribute values (extension URIs that may use Strict form)
 *
 * The transformation is performed **in-place** for efficiency.
 */
export function normalizeStrictXml(
  node: Record<string, unknown>,
): Record<string, unknown> {
  if (typeof node !== "object" || node === null || Array.isArray(node)) {
    return node;
  }

  for (const key of Object.keys(node)) {
    const value = node[key];

    // Normalize namespace declaration attribute values
    if (key.startsWith("@_xmlns")) {
      if (typeof value === "string") {
        const mapped = STRICT_TO_TRANSITIONAL_NS.get(value);
        if (mapped) {
          node[key] = mapped;
        }
      }
      continue;
    }

    // Normalize relationship type attribute values
    if (key === "@_Type" && typeof value === "string") {
      const mapped = STRICT_TO_TRANSITIONAL_NS.get(value);
      if (mapped) {
        node[key] = mapped;
      }
      continue;
    }

    // Normalize @_uri attribute values (e.g., on extension elements)
    if (key === "@_uri" && typeof value === "string") {
      const mapped = STRICT_TO_TRANSITIONAL_NS.get(value);
      if (mapped) {
        node[key] = mapped;
      }
      continue;
    }

    // Skip other scalar attributes
    if (key.startsWith("@_")) continue;

    // Recurse into child objects
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "object" && item !== null) {
          normalizeStrictXml(item as Record<string, unknown>);
        }
      }
    } else if (typeof value === "object" && value !== null) {
      normalizeStrictXml(value as Record<string, unknown>);
    }
  }

  return node;
}

/**
 * Convert a Transitional Open XML namespace URI to its Strict equivalent.
 * If the URI is already Strict (or unknown), it is returned unchanged.
 */
export function toStrictNamespaceUri(uri: string): string {
  return TRANSITIONAL_TO_STRICT_NS.get(uri) ?? uri;
}

/**
 * Check whether a URI belongs to the Transitional Open XML namespace family.
 */
export function isTransitionalNamespaceUri(uri: string): boolean {
  return TRANSITIONAL_TO_STRICT_NS.has(uri);
}

/**
 * Recursively convert all Transitional namespace URIs within a parsed XML
 * object tree to their Strict equivalents.
 *
 * Converts:
 *  - `@_xmlns` and `@_xmlns:*` attribute values (namespace declarations)
 *  - `@_Type` attribute values on Relationship elements (relationship type URIs)
 *  - `@_uri` attribute values (extension URIs)
 *
 * Also sets `conformance="strict"` on the root `p:presentation` element
 * when `setConformance` is true.
 *
 * The transformation is performed **in-place** for efficiency.
 */
export function convertXmlToStrict(
  node: Record<string, unknown>,
  setConformance = false,
): Record<string, unknown> {
  if (typeof node !== "object" || node === null || Array.isArray(node)) {
    return node;
  }

  // Optionally set conformance attribute on p:presentation root
  if (setConformance && "p:presentation" in node) {
    const presentation = node["p:presentation"] as Record<string, unknown>;
    if (typeof presentation === "object" && presentation !== null) {
      presentation["@_conformance"] = "strict";
    }
  }

  for (const key of Object.keys(node)) {
    const value = node[key];

    // Convert namespace declaration attribute values
    if (key.startsWith("@_xmlns")) {
      if (typeof value === "string") {
        const mapped = TRANSITIONAL_TO_STRICT_NS.get(value);
        if (mapped) {
          node[key] = mapped;
        }
      }
      continue;
    }

    // Convert relationship type attribute values
    if (key === "@_Type" && typeof value === "string") {
      const mapped = TRANSITIONAL_TO_STRICT_NS.get(value);
      if (mapped) {
        node[key] = mapped;
      }
      continue;
    }

    // Convert @_uri attribute values
    if (key === "@_uri" && typeof value === "string") {
      const mapped = TRANSITIONAL_TO_STRICT_NS.get(value);
      if (mapped) {
        node[key] = mapped;
      }
      continue;
    }

    // Skip other scalar attributes
    if (key.startsWith("@_")) continue;

    // Recurse into child objects
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "object" && item !== null) {
          convertXmlToStrict(item as Record<string, unknown>);
        }
      }
    } else if (typeof value === "object" && value !== null) {
      convertXmlToStrict(value as Record<string, unknown>);
    }
  }

  return node;
}

