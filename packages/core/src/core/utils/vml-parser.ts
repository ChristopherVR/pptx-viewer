/**
 * VML (Vector Markup Language) shape parser.
 *
 * Converts legacy VML elements (`v:shape`, `v:rect`, `v:oval`, `v:line`,
 * `v:roundrect`, `v:polyline`, `v:arc`, `v:group`) found in older PPTX
 * files into the standard {@link PptxElement} types used by the viewer.
 *
 * VML is defined in ECMA-376 Part 4 and was the primary shape format
 * before DrawingML. Older .pptx files (pre-Office 2010) may contain VML
 * shapes as fallback content or as primary shape definitions.
 *
 * @module vml-parser
 */

import type {
  PptxElement,
  ShapePptxElement,
  GroupPptxElement,
  TextSegment,
  TextStyle,
  ShapeStyle,
  XmlObject,
} from "../types";

// ── Constants ────────────────────────────────────────────────────────

const EMU_PER_PX = 9525;
const PT_PER_PX = 0.75;

/** VML element tag names we recognise as renderable shapes. */
export const VML_SHAPE_TAGS = new Set([
  "v:shape",
  "v:rect",
  "v:oval",
  "v:line",
  "v:roundrect",
  "v:polyline",
  "v:arc",
  "v:group",
  "v:image",
]);

// ── CSS-style dimension parsing ──────────────────────────────────────

/**
 * Parse a CSS dimension string (e.g. "100pt", "2in", "150px", "50%")
 * and return the value in pixels. Percentages are resolved against
 * `containerPx` when provided, otherwise treated as 0.
 */
function parseCssDimension(
  value: string | undefined,
  containerPx?: number,
): number {
  if (!value) return 0;
  const trimmed = value.trim();
  if (trimmed.length === 0) return 0;

  // Try pure number (assumed px)
  const num = parseFloat(trimmed);
  if (!Number.isFinite(num)) return 0;

  if (trimmed.endsWith("pt")) return num / PT_PER_PX;
  if (trimmed.endsWith("in")) return num * 96;
  if (trimmed.endsWith("cm")) return num * (96 / 2.54);
  if (trimmed.endsWith("mm")) return num * (96 / 25.4);
  if (trimmed.endsWith("emu")) return num / EMU_PER_PX;
  if (trimmed.endsWith("%")) return containerPx ? (num / 100) * containerPx : 0;
  // px or unitless
  return num;
}

/**
 * Parse VML `style` attribute into a map of CSS property -> value.
 * Example: `"position:absolute;left:100pt;top:50pt;width:200pt;height:100pt"`
 */
function parseVmlStyle(styleAttr: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!styleAttr) return result;
  const parts = styleAttr.split(";");
  for (const part of parts) {
    const colonIdx = part.indexOf(":");
    if (colonIdx === -1) continue;
    const key = part.slice(0, colonIdx).trim().toLowerCase();
    const val = part.slice(colonIdx + 1).trim();
    if (key.length > 0 && val.length > 0) {
      result[key] = val;
    }
  }
  return result;
}

/**
 * Extract position and size from a VML style attribute.
 */
function extractVmlBounds(
  styleMap: Record<string, string>,
  containerW?: number,
  containerH?: number,
): { x: number; y: number; width: number; height: number } {
  return {
    x: Math.round(parseCssDimension(styleMap["left"], containerW)),
    y: Math.round(parseCssDimension(styleMap["top"], containerH)),
    width: Math.round(parseCssDimension(styleMap["width"], containerW)),
    height: Math.round(parseCssDimension(styleMap["height"], containerH)),
  };
}

/**
 * Extract rotation from a VML style attribute.
 * VML uses `rotation:<degrees>` in the CSS style.
 */
function extractVmlRotation(
  styleMap: Record<string, string>,
): number | undefined {
  const rot = styleMap["rotation"];
  if (!rot) return undefined;
  const deg = parseFloat(rot);
  return Number.isFinite(deg) && deg !== 0 ? deg : undefined;
}

/**
 * Extract flip state from a VML style attribute.
 * VML uses `flip:x`, `flip:y`, or `flip:xy`.
 */
function extractVmlFlip(
  styleMap: Record<string, string>,
): { flipHorizontal?: boolean; flipVertical?: boolean } {
  const flip = (styleMap["flip"] || "").toLowerCase();
  return {
    flipHorizontal: flip.includes("x") || undefined,
    flipVertical: flip.includes("y") || undefined,
  };
}

// ── Color parsing ────────────────────────────────────────────────────

/**
 * Parse a VML color value to a CSS hex color.
 * VML supports named colors, `#RRGGBB`, `rgb(r,g,b)`, and some
 * special keywords like `fill`, `line`, etc.
 */
function parseVmlColor(color: string | undefined): string | undefined {
  if (!color) return undefined;
  const trimmed = color.trim().toLowerCase();
  if (trimmed.length === 0 || trimmed === "none") return undefined;

  // Already hex
  if (trimmed.startsWith("#")) {
    if (trimmed.length === 4) {
      // #RGB -> #RRGGBB
      return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
    }
    return trimmed;
  }

  // rgb(r,g,b)
  const rgbMatch = trimmed.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }

  // Named color map (common VML named colors)
  const namedColors: Record<string, string> = {
    black: "#000000",
    white: "#ffffff",
    red: "#ff0000",
    green: "#008000",
    blue: "#0000ff",
    yellow: "#ffff00",
    cyan: "#00ffff",
    magenta: "#ff00ff",
    silver: "#c0c0c0",
    gray: "#808080",
    grey: "#808080",
    maroon: "#800000",
    olive: "#808000",
    lime: "#00ff00",
    aqua: "#00ffff",
    teal: "#008080",
    navy: "#000080",
    fuchsia: "#ff00ff",
    purple: "#800080",
    orange: "#ffa500",
    window: "#ffffff",
    windowtext: "#000000",
    buttonface: "#f0f0f0",
    infobk: "#ffffe1",
  };
  return namedColors[trimmed] || undefined;
}

// ── Fill parsing ─────────────────────────────────────────────────────

/**
 * Extract fill properties from a VML element.
 * VML fill can be specified via:
 * - `fillcolor` attribute on the shape
 * - `filled` attribute ("f" or "false" means no fill)
 * - Child `v:fill` element with type, color, color2, opacity, etc.
 */
function extractVmlFill(node: XmlObject): Partial<ShapeStyle> {
  const style: Partial<ShapeStyle> = {};

  const filled = String(node["@_filled"] ?? "").toLowerCase();
  if (filled === "f" || filled === "false") {
    style.fillMode = "none";
    return style;
  }

  // Check for child v:fill element
  const vFill = node["v:fill"] as XmlObject | undefined;
  if (vFill) {
    const fillType = String(vFill["@_type"] || "solid").toLowerCase();
    const fillColor =
      parseVmlColor(String(vFill["@_color"] || "")) ||
      parseVmlColor(String(node["@_fillcolor"] || ""));

    if (fillType === "gradient" || fillType === "gradientradial") {
      style.fillMode = "gradient";
      style.fillColor = fillColor;
      const color2 = parseVmlColor(String(vFill["@_color2"] || ""));
      if (fillColor && color2) {
        style.fillGradientType =
          fillType === "gradientradial" ? "radial" : "linear";
        style.fillGradientStops = [
          { color: fillColor, position: 0 },
          { color: color2, position: 1 },
        ];
        const angle = parseFloat(String(vFill["@_angle"] || "0"));
        if (Number.isFinite(angle)) {
          style.fillGradientAngle = angle;
        }
      }
    } else if (fillType === "pattern" || fillType === "tile") {
      style.fillMode = "pattern";
      style.fillColor = fillColor;
    } else {
      // solid (default)
      style.fillMode = "solid";
      style.fillColor = fillColor;
    }

    // Opacity
    const opacityStr = String(vFill["@_opacity"] || "").trim();
    if (opacityStr.length > 0) {
      const opacity = parseVmlOpacity(opacityStr);
      if (opacity !== undefined) style.fillOpacity = opacity;
    }
  } else {
    // No v:fill child — use fillcolor attribute
    const fillColor = parseVmlColor(String(node["@_fillcolor"] || ""));
    if (fillColor) {
      style.fillMode = "solid";
      style.fillColor = fillColor;
    }
  }

  return style;
}

/**
 * Parse a VML opacity value. VML uses fractional notation like "0.5"
 * or "65536f" (fixed-point where 65536 = 1.0), or percentage "50%".
 */
function parseVmlOpacity(value: string): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (trimmed.endsWith("f")) {
    const fixed = parseFloat(trimmed.slice(0, -1));
    return Number.isFinite(fixed) ? fixed / 65536 : undefined;
  }
  if (trimmed.endsWith("%")) {
    const pct = parseFloat(trimmed.slice(0, -1));
    return Number.isFinite(pct) ? pct / 100 : undefined;
  }
  const num = parseFloat(trimmed);
  return Number.isFinite(num) ? Math.min(1, Math.max(0, num)) : undefined;
}

// ── Stroke parsing ───────────────────────────────────────────────────

/**
 * Extract stroke properties from a VML element.
 * VML stroke can be specified via:
 * - `strokecolor`, `strokeweight` attributes on the shape
 * - `stroked` attribute ("f" or "false" means no stroke)
 * - Child `v:stroke` element with color, weight, dashstyle, etc.
 */
function extractVmlStroke(node: XmlObject): Partial<ShapeStyle> {
  const style: Partial<ShapeStyle> = {};

  const stroked = String(node["@_stroked"] ?? "").toLowerCase();
  if (stroked === "f" || stroked === "false") {
    style.strokeWidth = 0;
    return style;
  }

  // Check for child v:stroke element
  const vStroke = node["v:stroke"] as XmlObject | undefined;
  if (vStroke) {
    const strokeColor =
      parseVmlColor(String(vStroke["@_color"] || "")) ||
      parseVmlColor(String(node["@_strokecolor"] || ""));
    if (strokeColor) style.strokeColor = strokeColor;

    const weight = String(
      vStroke["@_weight"] || node["@_strokeweight"] || "",
    ).trim();
    if (weight.length > 0) {
      style.strokeWidth = parseCssDimension(weight);
    }

    // Dash style mapping
    const dashStyle = String(vStroke["@_dashstyle"] || "").toLowerCase();
    if (dashStyle && dashStyle !== "solid") {
      const dashMap: Record<string, ShapeStyle["strokeDash"]> = {
        dash: "dash",
        dot: "dot",
        dashdot: "dashDot",
        longdash: "lgDash",
        longdashdot: "lgDashDot",
        longdashdotdot: "lgDashDotDot",
        shortdash: "dash",
        shortdot: "sysDot",
        shortdashdot: "dashDot",
        shortdashdotdot: "sysDashDotDot",
      };
      style.strokeDash = dashMap[dashStyle];
    }

    // Opacity
    const opacityStr = String(vStroke["@_opacity"] || "").trim();
    if (opacityStr.length > 0) {
      const opacity = parseVmlOpacity(opacityStr);
      if (opacity !== undefined) style.strokeOpacity = opacity;
    }

    // Arrow heads
    const startArrow = String(vStroke["@_startarrow"] || "").toLowerCase();
    const endArrow = String(vStroke["@_endarrow"] || "").toLowerCase();
    if (startArrow && startArrow !== "none") {
      style.connectorStartArrow = mapVmlArrowType(startArrow);
    }
    if (endArrow && endArrow !== "none") {
      style.connectorEndArrow = mapVmlArrowType(endArrow);
    }
  } else {
    // No v:stroke child — use attributes
    const strokeColor = parseVmlColor(String(node["@_strokecolor"] || ""));
    if (strokeColor) style.strokeColor = strokeColor;

    const weight = String(node["@_strokeweight"] || "").trim();
    if (weight.length > 0) {
      style.strokeWidth = parseCssDimension(weight);
    }
  }

  // Default stroke if stroked is not explicitly false and no width set
  if (style.strokeWidth === undefined && stroked !== "f") {
    style.strokeWidth = 1;
  }

  return style;
}

/** Map VML arrow type names to DrawingML connector arrow types. */
function mapVmlArrowType(
  vmlType: string,
): "triangle" | "arrow" | "stealth" | "diamond" | "oval" | "none" {
  const map: Record<
    string,
    "triangle" | "arrow" | "stealth" | "diamond" | "oval" | "none"
  > = {
    block: "triangle",
    classic: "stealth",
    open: "arrow",
    diamond: "diamond",
    oval: "oval",
  };
  return map[vmlType] || "triangle";
}

// ── Text parsing ─────────────────────────────────────────────────────

/**
 * Extract text content from a VML `v:textbox` child element.
 * VML text boxes contain HTML-like content wrapped in `<div>` or `<p>`.
 * We extract plain text and basic styling.
 */
function extractVmlText(node: XmlObject): {
  text: string;
  textStyle: TextStyle;
  textSegments: TextSegment[];
} | null {
  const textbox = node["v:textbox"] as XmlObject | undefined;
  if (!textbox) return null;

  // VML textbox can contain div > p structure or direct text
  const textContent = extractTextFromXmlNode(textbox);
  if (!textContent || textContent.trim().length === 0) return null;

  const textStyle: TextStyle = {};
  const textSegments: TextSegment[] = [];

  // Check textbox inset for margins
  const inset = String(textbox["@_inset"] || "").trim();
  if (inset.length > 0) {
    const parts = inset.split(",").map((s) => s.trim());
    if (parts.length >= 4) {
      textStyle.bodyInsetLeft = parseCssDimension(parts[0]);
      textStyle.bodyInsetTop = parseCssDimension(parts[1]);
      textStyle.bodyInsetRight = parseCssDimension(parts[2]);
      textStyle.bodyInsetBottom = parseCssDimension(parts[3]);
    }
  }

  // Check textbox style for writing direction
  const tbStyle = parseVmlStyle(String(textbox["@_style"] || ""));
  if (tbStyle["layout-flow"] === "vertical") {
    textStyle.writingMode = "vertical";
  }

  // Build segments from the text content
  textSegments.push({
    text: textContent,
    style: { ...textStyle },
  });

  return {
    text: textContent,
    textStyle,
    textSegments,
  };
}

/**
 * Recursively extract plain text from an XML node.
 * Handles nested div/p/span/b/i elements and #text nodes.
 */
function extractTextFromXmlNode(node: XmlObject | string | undefined): string {
  if (!node) return "";
  if (typeof node === "string") return node;

  const parts: string[] = [];

  // Direct text
  if (node["#text"] !== undefined) {
    parts.push(String(node["#text"]));
  }

  // Process known container tags
  const containerTags = [
    "div",
    "p",
    "span",
    "b",
    "i",
    "u",
    "font",
    "body",
    "html",
  ];
  for (const tag of containerTags) {
    const children = node[tag];
    if (children) {
      const arr = Array.isArray(children) ? children : [children];
      for (const child of arr) {
        const childText = extractTextFromXmlNode(child as XmlObject);
        if (childText.length > 0) {
          parts.push(childText);
        }
      }
    }
  }

  return parts.join("\n").replace(/\n{3,}/g, "\n\n");
}

// ── Shape type mapping ───────────────────────────────────────────────

/**
 * Map a VML `spt` (shape type) number or `type` reference to a
 * DrawingML preset geometry name.
 */
function mapVmlShapeType(
  sptValue: string | undefined,
  typeRef: string | undefined,
): string {
  if (sptValue) {
    const spt = parseInt(sptValue, 10);
    if (Number.isFinite(spt)) {
      const sptMap: Record<number, string> = {
        1: "rect",
        2: "parallelogram",
        3: "trapezoid",
        4: "diamond",
        5: "pentagon",
        6: "hexagon",
        7: "heptagon",
        8: "octagon",
        9: "decagon",
        10: "dodecagon",
        13: "cube",
        16: "can",
        20: "straightConnector1",
        21: "bentConnector3",
        22: "curvedConnector3",
        23: "line",
        24: "line",
        32: "rect",
        33: "rect",
        34: "rect",
        75: "rect", // text box
        109: "cloudCallout",
        110: "borderCallout1",
        172: "ellipse",
        173: "rect",
        183: "sun",
        184: "moon",
        185: "bracketPair",
        186: "bracePair",
        187: "star4",
        188: "star5",
        189: "star8",
        202: "rect", // text box
      };
      return sptMap[spt] || "rect";
    }
  }

  // type="#_x0000_t75" -> extract number
  if (typeRef) {
    const match = typeRef.match(/_x0000_t(\d+)/);
    if (match) {
      return mapVmlShapeType(match[1], undefined);
    }
  }

  return "rect";
}

/**
 * Map VML tag name to a DrawingML preset geometry name.
 */
function vmlTagToShapeType(tag: string): string {
  switch (tag) {
    case "v:rect":
      return "rect";
    case "v:oval":
      return "ellipse";
    case "v:roundrect":
      return "roundRect";
    case "v:line":
      return "line";
    case "v:polyline":
      return "custom";
    case "v:arc":
      return "arc";
    default:
      return "rect";
  }
}

// ── VML path parsing ─────────────────────────────────────────────────

/**
 * Convert a VML `path` attribute (v attribute on v:shape) to an SVG
 * path data string. VML path commands are similar to SVG but use
 * some different keywords.
 *
 * VML commands: m (moveTo), l (lineTo), c (curveTo), x (close),
 * e (end), qb (quadBezier), t (relative lineTo), r (relative curveTo),
 * nf (no fill), ns (no stroke), etc.
 */
function convertVmlPathToSvg(
  vmlPath: string | undefined,
  coordSizeW: number,
  coordSizeH: number,
  targetW: number,
  targetH: number,
): string | undefined {
  if (!vmlPath) return undefined;

  const scaleX = coordSizeW > 0 ? targetW / coordSizeW : 1;
  const scaleY = coordSizeH > 0 ? targetH / coordSizeH : 1;

  // Tokenize the VML path
  const tokens = vmlPath.match(/[a-zA-Z]+|[-+]?\d+/g);
  if (!tokens) return undefined;

  const parts: string[] = [];
  let i = 0;

  while (i < tokens.length) {
    const cmd = tokens[i];
    switch (cmd) {
      case "m": {
        // moveTo
        if (i + 2 < tokens.length) {
          const x = parseInt(tokens[i + 1], 10) * scaleX;
          const y = parseInt(tokens[i + 2], 10) * scaleY;
          parts.push(`M ${x} ${y}`);
          i += 3;
        } else {
          i++;
        }
        break;
      }
      case "l": {
        // lineTo — can have multiple coordinate pairs
        i++;
        while (
          i + 1 < tokens.length &&
          /^[-+]?\d+$/.test(tokens[i]) &&
          /^[-+]?\d+$/.test(tokens[i + 1])
        ) {
          const x = parseInt(tokens[i], 10) * scaleX;
          const y = parseInt(tokens[i + 1], 10) * scaleY;
          parts.push(`L ${x} ${y}`);
          i += 2;
        }
        break;
      }
      case "c": {
        // curveTo — 3 coordinate pairs per curve
        i++;
        while (i + 5 < tokens.length && /^[-+]?\d+$/.test(tokens[i])) {
          const x1 = parseInt(tokens[i], 10) * scaleX;
          const y1 = parseInt(tokens[i + 1], 10) * scaleY;
          const x2 = parseInt(tokens[i + 2], 10) * scaleX;
          const y2 = parseInt(tokens[i + 3], 10) * scaleY;
          const x = parseInt(tokens[i + 4], 10) * scaleX;
          const y = parseInt(tokens[i + 5], 10) * scaleY;
          parts.push(`C ${x1} ${y1} ${x2} ${y2} ${x} ${y}`);
          i += 6;
        }
        break;
      }
      case "x":
        // close path
        parts.push("Z");
        i++;
        break;
      case "e":
        // end — just stop
        i = tokens.length;
        break;
      case "t": {
        // relative lineTo
        i++;
        while (
          i + 1 < tokens.length &&
          /^[-+]?\d+$/.test(tokens[i]) &&
          /^[-+]?\d+$/.test(tokens[i + 1])
        ) {
          const dx = parseInt(tokens[i], 10) * scaleX;
          const dy = parseInt(tokens[i + 1], 10) * scaleY;
          parts.push(`l ${dx} ${dy}`);
          i += 2;
        }
        break;
      }
      case "r": {
        // relative curveTo
        i++;
        while (i + 5 < tokens.length && /^[-+]?\d+$/.test(tokens[i])) {
          const dx1 = parseInt(tokens[i], 10) * scaleX;
          const dy1 = parseInt(tokens[i + 1], 10) * scaleY;
          const dx2 = parseInt(tokens[i + 2], 10) * scaleX;
          const dy2 = parseInt(tokens[i + 3], 10) * scaleY;
          const dx = parseInt(tokens[i + 4], 10) * scaleX;
          const dy = parseInt(tokens[i + 5], 10) * scaleY;
          parts.push(`c ${dx1} ${dy1} ${dx2} ${dy2} ${dx} ${dy}`);
          i += 6;
        }
        break;
      }
      case "qb": {
        // quad bezier
        i++;
        while (
          i + 1 < tokens.length &&
          /^[-+]?\d+$/.test(tokens[i]) &&
          /^[-+]?\d+$/.test(tokens[i + 1])
        ) {
          const x = parseInt(tokens[i], 10) * scaleX;
          const y = parseInt(tokens[i + 1], 10) * scaleY;
          parts.push(`Q ${x} ${y}`);
          i += 2;
        }
        break;
      }
      case "nf":
      case "ns":
        // no fill / no stroke hints — skip
        i++;
        break;
      default:
        // Unknown command or coordinate — skip
        i++;
        break;
    }
  }

  return parts.length > 0 ? parts.join(" ") : undefined;
}

// ── VML line parsing ─────────────────────────────────────────────────

/**
 * Parse a `v:line` element which uses `from` and `to` attributes
 * instead of CSS style position/size.
 */
function parseVmlLine(node: XmlObject): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const from = String(node["@_from"] || "0,0");
  const to = String(node["@_to"] || "0,0");

  const [fromX, fromY] = from.split(",").map((s) => parseCssDimension(s.trim()));
  const [toX, toY] = to.split(",").map((s) => parseCssDimension(s.trim()));

  const x = Math.min(fromX, toX);
  const y = Math.min(fromY, toY);
  const width = Math.abs(toX - fromX) || 1;
  const height = Math.abs(toY - fromY) || 1;

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  };
}

// ── VML polyline parsing ─────────────────────────────────────────────

/**
 * Parse a `v:polyline` element. The `points` attribute contains a
 * comma/space-separated list of coordinate pairs.
 */
function parseVmlPolylinePoints(
  node: XmlObject,
  width: number,
  height: number,
): string | undefined {
  const pointsStr = String(node["@_points"] || "").trim();
  if (pointsStr.length === 0) return undefined;

  // Points can be comma or space separated
  const values = pointsStr.split(/[\s,]+/).map(Number).filter(Number.isFinite);
  if (values.length < 4) return undefined;

  const parts: string[] = [];
  for (let i = 0; i < values.length - 1; i += 2) {
    const cmd = i === 0 ? "M" : "L";
    parts.push(`${cmd} ${values[i]} ${values[i + 1]}`);
  }

  return parts.join(" ");
}

// ── Main parsing functions ───────────────────────────────────────────

/**
 * Parse a single VML shape element into a {@link PptxElement}.
 *
 * @param tag - The VML tag name (e.g. "v:shape", "v:rect")
 * @param node - The parsed XML node
 * @param idPrefix - ID prefix for the generated element
 * @param index - Index within this tag type (for unique IDs)
 */
export function parseVmlElement(
  tag: string,
  node: XmlObject,
  idPrefix: string,
  index: number,
): PptxElement | null {
  try {
    if (tag === "v:group") {
      return parseVmlGroup(node, idPrefix, index);
    }

    const id = `${idPrefix}vml-${index}`;
    const styleMap = parseVmlStyle(String(node["@_style"] || ""));

    // Position and size
    let bounds: { x: number; y: number; width: number; height: number };
    if (tag === "v:line") {
      bounds = parseVmlLine(node);
    } else {
      bounds = extractVmlBounds(styleMap);
    }

    // coordsize for path scaling
    const coordsize = String(node["@_coordsize"] || "").trim();
    let coordW = bounds.width;
    let coordH = bounds.height;
    if (coordsize.length > 0) {
      const parts = coordsize.split(/[\s,]+/);
      if (parts.length >= 2) {
        coordW = parseInt(parts[0], 10) || bounds.width;
        coordH = parseInt(parts[1], 10) || bounds.height;
      }
    }

    // Rotation and flip
    const rotation = extractVmlRotation(styleMap);
    const { flipHorizontal, flipVertical } = extractVmlFlip(styleMap);

    // Shape type
    let shapeType: string;
    if (
      tag === "v:shape" ||
      tag === "v:image"
    ) {
      shapeType = mapVmlShapeType(
        String(node["@_o:spt"] || node["@_spt"] || ""),
        String(node["@_type"] || ""),
      );
    } else {
      shapeType = vmlTagToShapeType(tag);
    }

    // For v:roundrect, extract arc size as adjustment
    let shapeAdjustments: Record<string, number> | undefined;
    if (tag === "v:roundrect") {
      const arcsize = String(node["@_arcsize"] || "").trim();
      if (arcsize.length > 0) {
        let pct = parseFloat(arcsize);
        // VML arcsize is a fraction (0-1) or percentage string
        if (arcsize.endsWith("%")) {
          pct = parseFloat(arcsize) / 100;
        }
        if (Number.isFinite(pct)) {
          // DrawingML roundRect adj is in 50000ths (0-50000 range)
          shapeAdjustments = { adj: Math.round(pct * 50000) };
        }
      }
    }

    // Path data
    let pathData: string | undefined;
    let pathWidth: number | undefined;
    let pathHeight: number | undefined;

    if (tag === "v:shape") {
      const vmlPath = String(node["@_path"] || "").trim();
      if (vmlPath.length > 0) {
        pathData = convertVmlPathToSvg(
          vmlPath,
          coordW,
          coordH,
          bounds.width,
          bounds.height,
        );
        if (pathData) {
          shapeType = "custom";
          pathWidth = bounds.width;
          pathHeight = bounds.height;
        }
      }
    } else if (tag === "v:polyline") {
      pathData = parseVmlPolylinePoints(node, bounds.width, bounds.height);
      if (pathData) {
        shapeType = "custom";
        pathWidth = bounds.width;
        pathHeight = bounds.height;
      }
    }

    // Fill and stroke
    const fillStyle = extractVmlFill(node);
    const strokeStyle = extractVmlStroke(node);
    const shapeStyle: ShapeStyle = { ...fillStyle, ...strokeStyle };

    // Opacity from style
    const visibilityHidden =
      styleMap["visibility"] === "hidden" ||
      styleMap["display"] === "none";

    // Text
    const textResult = extractVmlText(node);

    // Build element
    const element: ShapePptxElement = {
      type: "shape",
      id,
      x: bounds.x,
      y: bounds.y,
      width: bounds.width || 100,
      height: bounds.height || 100,
      shapeType,
      shapeStyle,
      shapeAdjustments,
      pathData,
      pathWidth,
      pathHeight,
      rotation,
      flipHorizontal,
      flipVertical,
      hidden: visibilityHidden || undefined,
      text: textResult?.text,
      textStyle: textResult?.textStyle,
      textSegments: textResult?.textSegments,
      rawXml: node,
    };

    return element;
  } catch (e) {
    console.warn(`[pptx] Skipping VML element (${tag}):`, e);
    return null;
  }
}

/**
 * Parse a `v:group` element as a {@link GroupPptxElement}.
 * Groups contain nested VML shapes and apply a coordinate transform.
 */
function parseVmlGroup(
  node: XmlObject,
  idPrefix: string,
  index: number,
): GroupPptxElement | null {
  try {
    const id = `${idPrefix}vml-group-${index}`;
    const styleMap = parseVmlStyle(String(node["@_style"] || ""));
    const bounds = extractVmlBounds(styleMap);

    // coordorigin and coordsize define the child coordinate space
    const coordOrigin = String(node["@_coordorigin"] || "0,0");
    const coordSize = String(node["@_coordsize"] || "");

    const [originX, originY] = coordOrigin
      .split(/[\s,]+/)
      .map((s) => parseFloat(s) || 0);

    let childScaleX = 1;
    let childScaleY = 1;
    if (coordSize.length > 0) {
      const [csW, csH] = coordSize
        .split(/[\s,]+/)
        .map((s) => parseFloat(s) || 0);
      if (csW > 0) childScaleX = bounds.width / csW;
      if (csH > 0) childScaleY = bounds.height / csH;
    }

    // Parse children
    const children: PptxElement[] = [];
    for (const childTag of VML_SHAPE_TAGS) {
      const childNodes = node[childTag];
      if (!childNodes) continue;
      const arr = Array.isArray(childNodes) ? childNodes : [childNodes];
      for (let ci = 0; ci < arr.length; ci++) {
        const child = parseVmlElement(
          childTag,
          arr[ci] as XmlObject,
          `${id}-`,
          ci,
        );
        if (child) {
          // Transform child coordinates from group coord space to parent
          child.x = (child.x - originX) * childScaleX;
          child.y = (child.y - originY) * childScaleY;
          child.width = child.width * childScaleX;
          child.height = child.height * childScaleY;
          children.push(child);
        }
      }
    }

    if (children.length === 0) return null;

    const rotation = extractVmlRotation(styleMap);

    return {
      type: "group",
      id,
      x: bounds.x,
      y: bounds.y,
      width: bounds.width || Math.max(...children.map((c) => c.x + c.width)),
      height:
        bounds.height || Math.max(...children.map((c) => c.y + c.height)),
      children,
      rotation,
      rawXml: node,
    };
  } catch (e) {
    console.warn(`[pptx] Skipping VML group:`, e);
    return null;
  }
}

// ── Bulk parsing ─────────────────────────────────────────────────────

/**
 * Scan a parsed XML container (such as a shape tree) for any VML
 * shape elements and convert them to {@link PptxElement} instances.
 *
 * This is called from the shape tree parsing code to pick up VML
 * shapes that exist alongside (or instead of) DrawingML shapes.
 *
 * @param container - The parsed XML object to scan for VML elements
 * @param idPrefix - ID prefix for generated element IDs
 * @returns Array of parsed VML elements
 */
export function parseVmlElements(
  container: Record<string, unknown>,
  idPrefix: string = "",
): PptxElement[] {
  const elements: PptxElement[] = [];

  for (const tag of VML_SHAPE_TAGS) {
    const nodes = container[tag];
    if (!nodes) continue;
    const arr = Array.isArray(nodes) ? nodes : [nodes];
    for (let i = 0; i < arr.length; i++) {
      const element = parseVmlElement(tag, arr[i] as XmlObject, idPrefix, i);
      if (element) {
        elements.push(element);
      }
    }
  }

  return elements;
}
