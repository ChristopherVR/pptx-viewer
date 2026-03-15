import React from "react";

import type { XmlObject } from "pptx-viewer-core";
import { colorWithOpacity } from "./color";
import { parseDrawingColor, parseDrawingColorOpacity } from "./drawing-color";
import { ensureArrayValue } from "./geometry";

// ── Gradient / pattern fill helpers for table cells ──────────────────────

/**
 * Parse an `a:gradFill` element into a CSS `linear-gradient` or
 * `radial-gradient` background string.
 */
export function parseGradientFillCss(
  gradFill: XmlObject | undefined,
): string | undefined {
  if (!gradFill) return undefined;

  const gsLstRaw = gradFill["a:gsLst"] as XmlObject | undefined;
  if (!gsLstRaw) return undefined;

  const stops = ensureArrayValue(
    gsLstRaw["a:gs"] as XmlObject | XmlObject[] | undefined,
  );
  if (stops.length === 0) return undefined;

  const parsed = stops
    .map((gs) => {
      const pos = Number.parseInt(String(gs["@_pos"] || "0"), 10) / 1000;
      const color = parseDrawingColor(gs as XmlObject) ?? "#888888";
      const opacity = parseDrawingColorOpacity(gs as XmlObject);
      return { pos, color: colorWithOpacity(color, opacity) };
    })
    .sort((a, b) => a.pos - b.pos);

  const stopStrings = parsed
    .map((s) => `${s.color} ${s.pos.toFixed(1)}%`)
    .join(", ");

  // Linear gradient — extract angle from `a:lin`
  const lin = gradFill["a:lin"] as XmlObject | undefined;
  if (lin) {
    const angRaw = Number.parseInt(String(lin["@_ang"] || "0"), 10);
    const angleDeg = Math.round(angRaw / 60000);
    return `linear-gradient(${angleDeg}deg, ${stopStrings})`;
  }

  // Path gradient — map to radial with fillToRect positioning
  const path = gradFill["a:path"] as XmlObject | undefined;
  if (path) {
    const pathType = String(path["@_path"] || "circle");
    const fillToRect = path["a:fillToRect"] as XmlObject | undefined;

    // Parse fillToRect LTRB values (1/100000 units -> 0-1 fractions)
    let cx = 50;
    let cy = 50;
    if (fillToRect) {
      const l = Number.parseInt(String(fillToRect["@_l"] || "0"), 10) / 100000;
      const t = Number.parseInt(String(fillToRect["@_t"] || "0"), 10) / 100000;
      const r = Number.parseInt(String(fillToRect["@_r"] || "0"), 10) / 100000;
      const b = Number.parseInt(String(fillToRect["@_b"] || "0"), 10) / 100000;
      cx = ((l + (1 - r)) / 2) * 100;
      cy = ((t + (1 - b)) / 2) * 100;
    }
    const posX = `${Math.round(cx)}%`;
    const posY = `${Math.round(cy)}%`;

    if (pathType === "rect") {
      // Rectangular gradient: use elliptical radial sized to reach shape edges
      const semiX = Math.max(cx, 100 - cx);
      const semiY = Math.max(cy, 100 - cy);
      return `radial-gradient(${Math.round(semiX)}% ${Math.round(semiY)}% at ${posX} ${posY}, ${stopStrings})`;
    }
    if (pathType === "shape") {
      // Shape-following gradient: use farthest-side sizing
      return `radial-gradient(farthest-side at ${posX} ${posY}, ${stopStrings})`;
    }
    return `radial-gradient(circle at ${posX} ${posY}, ${stopStrings})`;
  }

  // Default to top-to-bottom linear
  return `linear-gradient(180deg, ${stopStrings})`;
}

/**
 * Parse an `a:pattFill` element into a CSS repeating-gradient that
 * approximates the OOXML pattern.
 */
export function parsePatternFillCss(
  pattFill: XmlObject | undefined,
): string | undefined {
  if (!pattFill) return undefined;

  const fgColor =
    parseDrawingColor(pattFill["a:fgClr"] as XmlObject | undefined) ??
    "#000000";
  const bgColor =
    parseDrawingColor(pattFill["a:bgClr"] as XmlObject | undefined) ??
    "#ffffff";
  const preset = String(pattFill["@_prst"] || "ltDnDiag");

  switch (preset) {
    case "ltHorz":
    case "horz":
    case "narHorz":
    case "dkHorz":
    case "wdUpDiag":
      return `repeating-linear-gradient(0deg, ${bgColor}, ${bgColor} 3px, ${fgColor} 3px, ${fgColor} 4px)`;
    case "ltVert":
    case "vert":
    case "narVert":
    case "dkVert":
    case "wdDnDiag":
      return `repeating-linear-gradient(90deg, ${bgColor}, ${bgColor} 3px, ${fgColor} 3px, ${fgColor} 4px)`;
    case "ltDnDiag":
    case "dnDiag":
    case "dkDnDiag":
      return `repeating-linear-gradient(135deg, ${bgColor}, ${bgColor} 3px, ${fgColor} 3px, ${fgColor} 4px)`;
    case "ltUpDiag":
    case "upDiag":
    case "dkUpDiag":
      return `repeating-linear-gradient(45deg, ${bgColor}, ${bgColor} 3px, ${fgColor} 3px, ${fgColor} 4px)`;
    case "dashHorz":
    case "dashVert":
    case "dashDnDiag":
    case "dashUpDiag":
      return `repeating-linear-gradient(135deg, ${bgColor}, ${bgColor} 4px, ${fgColor} 4px, ${fgColor} 6px, ${bgColor} 6px, ${bgColor} 10px)`;
    case "smCheck":
    case "lgCheck":
      return `repeating-conic-gradient(${fgColor} 0% 25%, ${bgColor} 0% 50%) 0 0 / 8px 8px`;
    case "smGrid":
    case "lgGrid":
      return `repeating-linear-gradient(0deg, ${fgColor} 0px, ${fgColor} 1px, transparent 1px, transparent 6px), repeating-linear-gradient(90deg, ${fgColor} 0px, ${fgColor} 1px, transparent 1px, transparent 6px), ${bgColor}`;
    case "dotGrid":
    case "pct5":
    case "pct10":
    case "pct20":
    case "pct25":
    case "pct30":
    case "pct40":
    case "pct50":
    case "pct60":
    case "pct70":
    case "pct75":
    case "pct80":
    case "pct90":
      return `radial-gradient(${fgColor} 1px, ${bgColor} 1px) 0 0 / 4px 4px`;
    case "smConfetti":
    case "lgConfetti":
    case "zigZag":
    case "wave":
    case "sphere":
    case "divot":
    case "shingle":
    case "weave":
    case "plaid":
    case "trellis":
      return `repeating-linear-gradient(45deg, ${bgColor}, ${bgColor} 2px, ${fgColor} 2px, ${fgColor} 3px)`;
    case "solidDmnd":
    case "openDmnd":
      return `repeating-conic-gradient(${fgColor} 0% 25%, ${bgColor} 0% 50%) 0 0 / 10px 10px`;
    default:
      return `repeating-linear-gradient(135deg, ${bgColor}, ${bgColor} 3px, ${fgColor} 3px, ${fgColor} 4px)`;
  }
}

/**
 * Map an OOXML `a:prstDash/@val` value to a CSS `border-style` keyword.
 */
function ooxmlDashToCss(dashVal: string | undefined): string {
  if (!dashVal) return "solid";
  switch (dashVal) {
    case "dot":
    case "sysDot":
      return "dotted";
    case "dash":
    case "sysDash":
    case "lgDash":
      return "dashed";
    case "dashDot":
    case "lgDashDot":
    case "sysDashDot":
    case "lgDashDotDot":
    case "sysDashDotDot":
      return "dashed";
    case "solid":
      return "solid";
    default:
      return "solid";
  }
}

/**
 * Parse per-edge border properties from a table cell `a:tcPr`.
 * Returns CSS properties for each edge individually (width, style, color).
 */
export function parseCellBorders(
  cellProperties: XmlObject | undefined,
): React.CSSProperties {
  if (!cellProperties) return {};
  const borderStyle: React.CSSProperties = {};

  const edges = [
    { xml: "a:lnL", prefix: "borderLeft" as const },
    { xml: "a:lnR", prefix: "borderRight" as const },
    { xml: "a:lnT", prefix: "borderTop" as const },
    { xml: "a:lnB", prefix: "borderBottom" as const },
  ];

  for (const edge of edges) {
    const ln = cellProperties[edge.xml] as XmlObject | undefined;
    if (!ln) continue;

    const widthEmu = Number.parseInt(String(ln["@_w"] || "0"), 10);
    const widthPx = Math.max(1, Math.round(widthEmu / 12700));

    const prstDash = ln["a:prstDash"] as XmlObject | undefined;
    const dashVal = prstDash ? String(prstDash["@_val"] || "") : undefined;
    const cssBorderStyle = ooxmlDashToCss(dashVal);

    const color = parseDrawingColor(ln["a:solidFill"] as XmlObject | undefined);
    if (color) {
      const opacity = parseDrawingColorOpacity(
        ln["a:solidFill"] as XmlObject | undefined,
      );
      const key = `${edge.prefix}` as keyof React.CSSProperties;
      (borderStyle as Record<string, string>)[key] =
        `${widthPx}px ${cssBorderStyle} ${colorWithOpacity(color, opacity)}`;
    }
  }

  return borderStyle;
}

/**
 * Parse the `a:effectLst` from a run's properties and return a CSS
 * `textShadow` value combining outer-shadow and glow effects.
 */
export function parseCellTextEffects(
  runProps: XmlObject | undefined,
): string | undefined {
  const effectLst = runProps?.["a:effectLst"] as XmlObject | undefined;
  if (!effectLst) return undefined;

  const textShadowParts: string[] = [];
  const outerShdw = effectLst["a:outerShdw"] as XmlObject | undefined;
  if (outerShdw) {
    const shdwColor = parseDrawingColor(outerShdw);
    if (shdwColor) {
      const blurRad = Number.parseInt(
        String(outerShdw["@_blurRad"] || "0"),
        10,
      );
      const blurPx = blurRad > 0 ? Math.round(blurRad / 12700) : 0;
      const distVal = Number.parseInt(String(outerShdw["@_dist"] || "0"), 10);
      const dirVal = Number.parseInt(String(outerShdw["@_dir"] || "0"), 10);
      let offX = 0;
      let offY = 0;
      if (distVal > 0) {
        const angleRad = (dirVal / 60000) * (Math.PI / 180);
        offX = Math.round((distVal * Math.cos(angleRad)) / 12700);
        offY = Math.round((distVal * Math.sin(angleRad)) / 12700);
      }
      textShadowParts.push(`${offX}px ${offY}px ${blurPx}px ${shdwColor}`);
    }
  }
  const glow = effectLst["a:glow"] as XmlObject | undefined;
  if (glow) {
    const glowColor = parseDrawingColor(glow);
    if (glowColor) {
      const glowRad = Number.parseInt(String(glow["@_rad"] || "0"), 10);
      const glowPx = glowRad > 0 ? Math.round(glowRad / 12700) : 2;
      textShadowParts.push(`0px 0px ${glowPx}px ${glowColor}`);
    }
  }
  return textShadowParts.length > 0 ? textShadowParts.join(", ") : undefined;
}
