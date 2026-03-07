import type React from "react";
import type { PptxTableCellStyle } from "../../core";
import { getPatternSvg, normalizeHexColor } from "./color";

/**
 * Map OOXML dash preset to CSS border-style.
 */
export function ooxmlDashToCssBorderStyle(dashVal: string | undefined): string {
  if (!dashVal) return "solid";
  switch (dashVal) {
    case "dot":
    case "sysDot":
      return "dotted";
    case "dash":
    case "sysDash":
    case "lgDash":
    case "dashDot":
    case "lgDashDot":
    case "sysDashDot":
    case "lgDashDotDot":
    case "sysDashDotDot":
      return "dashed";
    default:
      return "solid";
  }
}

export function cellStyleToCss(
  style?: PptxTableCellStyle,
): React.CSSProperties {
  if (!style) return {};
  const css: React.CSSProperties = {};
  if (style.fontSize) css.fontSize = style.fontSize;
  if (style.bold) css.fontWeight = "bold";
  if (style.italic) css.fontStyle = "italic";
  if (style.underline) css.textDecorationLine = "underline";
  if (style.color) css.color = style.color;

  // Cell background fill — gradient and pattern take precedence
  if (style.gradientFillCss) {
    css.background = style.gradientFillCss;
  } else if (style.fillMode === "pattern" && style.patternFillPreset) {
    const fg = normalizeHexColor(style.patternFillForeground, "#000000");
    const bg = normalizeHexColor(style.patternFillBackground, "#ffffff");
    const svgPattern = getPatternSvg(style.patternFillPreset, fg, bg);
    if (svgPattern) {
      const encoded = encodeURIComponent(svgPattern);
      css.backgroundImage = `url("data:image/svg+xml,${encoded}")`;
      css.backgroundColor = bg;
    } else if (style.backgroundColor) {
      css.backgroundColor = style.backgroundColor;
    }
  } else if (style.backgroundColor) {
    css.backgroundColor = style.backgroundColor;
  }
  if (style.align) css.textAlign = style.align;
  if (style.vAlign) css.verticalAlign = style.vAlign;
  if (style.textDirection === "vertical") css.writingMode = "vertical-rl";
  else if (style.textDirection === "vertical270")
    css.writingMode = "vertical-lr";

  // Per-edge borders (width, color, dash style)
  const borderEdges = [
    {
      prefix: "borderTop",
      width: style.borderTopWidth,
      color: style.borderTopColor,
      dash: style.borderTopDash,
    },
    {
      prefix: "borderBottom",
      width: style.borderBottomWidth,
      color: style.borderBottomColor,
      dash: style.borderBottomDash,
    },
    {
      prefix: "borderLeft",
      width: style.borderLeftWidth,
      color: style.borderLeftColor,
      dash: style.borderLeftDash,
    },
    {
      prefix: "borderRight",
      width: style.borderRightWidth,
      color: style.borderRightColor,
      dash: style.borderRightDash,
    },
  ] as const;
  for (const edge of borderEdges) {
    if (edge.width || edge.color) {
      const w = edge.width ?? 1;
      const c = edge.color ?? style.borderColor ?? "#000000";
      const s = ooxmlDashToCssBorderStyle(edge.dash);
      (css as Record<string, string>)[edge.prefix] = `${w}px ${s} ${c}`;
    }
  }

  // Cell margins
  if (style.marginLeft) css.paddingLeft = style.marginLeft;
  if (style.marginRight) css.paddingRight = style.marginRight;
  if (style.marginTop) css.paddingTop = style.marginTop;
  if (style.marginBottom) css.paddingBottom = style.marginBottom;

  // Text effects (shadow/glow) via CSS text-shadow
  const textShadowParts: string[] = [];
  if (style.textShadowColor) {
    const offX = style.textShadowOffsetX ?? 1;
    const offY = style.textShadowOffsetY ?? 1;
    const blur = style.textShadowBlur ?? 0;
    textShadowParts.push(
      `${offX}px ${offY}px ${blur}px ${style.textShadowColor}`,
    );
  }
  if (style.textGlowColor) {
    const radius = style.textGlowRadius ?? 2;
    textShadowParts.push(`0px 0px ${radius}px ${style.textGlowColor}`);
  }
  if (textShadowParts.length > 0) {
    css.textShadow = textShadowParts.join(", ");
  }

  return css;
}
