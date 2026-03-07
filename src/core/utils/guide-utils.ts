/**
 * Drawing guide parsing and serialization utilities.
 *
 * Handles extraction of drawing guides from OOXML slide extension lists
 * (`p14:sldGuideLst`, `p15:sldGuideLst`) and serialization back to XML.
 *
 * OOXML guide format:
 *   <p:extLst>
 *     <p:ext uri="{...}">
 *       <p14:sldGuideLst>
 *         <p14:guide id="1" orient="horz" pos="2880" />
 *       </p14:sldGuideLst>
 *     </p:ext>
 *   </p:extLst>
 *
 * Position is in 1/8th of a point (12700 EMU = 1 point, pos unit = 1/8 pt).
 * PowerPoint stores guide positions as twelfths-of-a-point in the `pos`
 * attribute: 1 pos unit = 12700 / 8 EMU = 1587.5 EMU.
 */

import type { PptxDrawingGuide, XmlObject } from "../types";

/** EMU per CSS pixel at 96 DPI. */
const EMU_PER_PX = 914400 / 96; // = 9525

/**
 * Conversion factor: the `pos` attribute in guide XML is in 1/8th of a point.
 * 1 point = 12700 EMU.  So 1 pos unit = 12700 / 8 = 1587.5 EMU.
 */
const EMU_PER_POS_UNIT = 12700 / 8;

/** Extension URI for Office 2010 slide guide list. */
export const P14_GUIDE_URI = "{72B1D4B2-8646-4E06-B1EF-53B0C71A9B0A}";
/** Extension URI for Office 2013 slide guide list (unused but recognized). */
export const P15_GUIDE_URI = "{2D200454-25E2-4014-A478-2F8E8D3F5837}";

/**
 * Known XML tag names for guide lists across namespaces.
 */
const GUIDE_LIST_TAGS = [
  "p14:sldGuideLst",
  "p15:sldGuideLst",
  "p14:guideLst",
  "p15:guideLst",
  "sldGuideLst",
  "guideLst",
];

const GUIDE_TAGS = ["p14:guide", "p15:guide", "guide"];

/**
 * Parse drawing guides from a slide's XML object.
 *
 * Looks in `p:sld > p:extLst > p:ext` for guide list extensions.
 */
export function parseSlideDrawingGuides(
  slideXml: XmlObject,
): PptxDrawingGuide[] {
  const sld = slideXml["p:sld"] as XmlObject | undefined;
  if (!sld) return [];

  const extLst = sld["p:extLst"] as XmlObject | undefined;
  if (!extLst) return [];

  const extEntries = normalizeArray(extLst["p:ext"]);
  const guides: PptxDrawingGuide[] = [];

  for (const ext of extEntries) {
    const uri = String(ext["@_uri"] ?? "");
    if (uri !== P14_GUIDE_URI && uri !== P15_GUIDE_URI) continue;

    const guideList = findGuideList(ext);
    if (!guideList) continue;

    const guideNodes = findGuideNodes(guideList);
    for (const node of guideNodes) {
      const guide = parseGuideNode(node);
      if (guide) guides.push(guide);
    }
  }

  return guides;
}

/**
 * Parse drawing guides from the presentation-level XML.
 *
 * Looks in `p:presentation > p:extLst > p:ext`.
 */
export function parsePresentationDrawingGuides(
  presentationXml: XmlObject,
): PptxDrawingGuide[] {
  const pres = presentationXml["p:presentation"] as XmlObject | undefined;
  if (!pres) return [];

  const extLst = pres["p:extLst"] as XmlObject | undefined;
  if (!extLst) return [];

  const extEntries = normalizeArray(extLst["p:ext"]);
  const guides: PptxDrawingGuide[] = [];

  for (const ext of extEntries) {
    const uri = String(ext["@_uri"] ?? "");
    if (uri !== P14_GUIDE_URI && uri !== P15_GUIDE_URI) continue;

    const guideList = findGuideList(ext);
    if (!guideList) continue;

    const guideNodes = findGuideNodes(guideList);
    for (const node of guideNodes) {
      const guide = parseGuideNode(node);
      if (guide) guides.push(guide);
    }
  }

  return guides;
}

/**
 * Convert a guide position in EMU to CSS pixels.
 */
export function guideEmuToPx(emu: number): number {
  return emu / EMU_PER_PX;
}

/**
 * Convert a CSS pixel position to guide position in EMU.
 */
export function guidePxToEmu(px: number): number {
  return Math.round(px * EMU_PER_PX);
}

/**
 * Build OOXML extension element for guide list serialization.
 *
 * Returns an XML object representing `<p:ext uri="..."><p14:sldGuideLst>...</p14:sldGuideLst></p:ext>`.
 */
export function buildGuideListExtension(guides: PptxDrawingGuide[]): XmlObject {
  const guideNodes = guides.map((g) => {
    const pos = Math.round(g.positionEmu / EMU_PER_POS_UNIT);
    const node: XmlObject = {
      "@_id": g.id,
      "@_pos": String(pos),
    };
    if (g.orientation === "horz") {
      node["@_orient"] = "horz";
    }
    // Default orientation is vertical, so we omit orient for vertical guides
    if (g.color) {
      node["a:srgbClr"] = { "@_val": g.color.replace("#", "") };
    }
    return node;
  });

  return {
    "@_uri": P14_GUIDE_URI,
    "p14:sldGuideLst": {
      "p14:guide": guideNodes.length === 1 ? guideNodes[0] : guideNodes,
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

function normalizeArray(value: unknown): XmlObject[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as XmlObject[];
  return [value as XmlObject];
}

function findGuideList(ext: XmlObject): XmlObject | undefined {
  for (const tag of GUIDE_LIST_TAGS) {
    const list = ext[tag] as XmlObject | undefined;
    if (list) return list;
  }
  return undefined;
}

function findGuideNodes(guideList: XmlObject): XmlObject[] {
  for (const tag of GUIDE_TAGS) {
    const nodes = guideList[tag];
    if (nodes) return normalizeArray(nodes);
  }
  return [];
}

function parseGuideNode(node: XmlObject): PptxDrawingGuide | undefined {
  const pos = parseInt(String(node["@_pos"] ?? "0"), 10);
  if (isNaN(pos)) return undefined;

  const orient = String(node["@_orient"] ?? "vert");
  const orientation: "horz" | "vert" = orient === "horz" ? "horz" : "vert";

  const positionEmu = Math.round(pos * EMU_PER_POS_UNIT);

  // Parse optional colour
  let color: string | undefined;
  const srgbClr = node["a:srgbClr"] as XmlObject | undefined;
  if (srgbClr) {
    const val = String(srgbClr["@_val"] ?? "");
    if (val) color = `#${val}`;
  }

  // Use id from XML or generate one
  const id = String(
    node["@_id"] ??
      `guide-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );

  return { id, orientation, positionEmu, color };
}
