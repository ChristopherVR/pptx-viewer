import type { PptxTableCellStyle, XmlObject } from "../../types";

export interface TableCellFillBorderContext {
  emuPerPx: number;
  ensureArray: (value: unknown) => unknown[];
  parseColor: (
    colorNode: XmlObject | undefined,
    placeholderColor?: string,
  ) => string | undefined;
  extractGradientFillCss?: (gradFill: XmlObject) => string | undefined;
  extractGradientStops?: (
    gradFill: XmlObject,
  ) => Array<{ color: string; position: number; opacity?: number }>;
  extractGradientType?: (gradFill: XmlObject) => "linear" | "radial";
  extractGradientAngle?: (gradFill: XmlObject) => number;
  extractGradientPathType?: (
    gradFill: XmlObject,
  ) => "circle" | "rect" | "shape" | undefined;
  extractGradientFocalPoint?: (
    gradFill: XmlObject,
  ) => { x: number; y: number } | undefined;
}

/** Apply fill styles (solid, gradient, pattern) to a table cell style. */
export function applyCellFillStyle(
  cellProperties: XmlObject | undefined,
  style: PptxTableCellStyle,
  context: TableCellFillBorderContext,
): boolean {
  let hasStyle = false;

  if (cellProperties?.["a:solidFill"]) {
    const fillColor = context.parseColor(
      cellProperties["a:solidFill"] as XmlObject,
    );
    if (fillColor) {
      style.fillMode = "solid";
      style.backgroundColor = fillColor;
      hasStyle = true;
    }
  }

  if (cellProperties?.["a:gradFill"]) {
    const gradFill = cellProperties["a:gradFill"] as XmlObject;
    style.fillMode = "gradient";
    hasStyle = true;
    if (context.extractGradientStops) {
      style.gradientFillStops = context.extractGradientStops(gradFill);
    }
    if (context.extractGradientType) {
      style.gradientFillType = context.extractGradientType(gradFill);
    }
    if (context.extractGradientAngle) {
      style.gradientFillAngle = context.extractGradientAngle(gradFill);
    }
    if (context.extractGradientPathType) {
      style.gradientFillPathType = context.extractGradientPathType(gradFill);
    }
    if (context.extractGradientFocalPoint) {
      style.gradientFillFocalPoint =
        context.extractGradientFocalPoint(gradFill);
    }
    if (context.extractGradientFillCss) {
      style.gradientFillCss = context.extractGradientFillCss(gradFill);
    }
    // Fallback backgroundColor from first gradient stop
    const gradStops = context.ensureArray(
      gradFill?.["a:gsLst"]?.["a:gs"],
    ) as XmlObject[];
    if (gradStops.length > 0 && !style.backgroundColor) {
      const firstStopColor = context.parseColor(gradStops[0]);
      if (firstStopColor) {
        style.backgroundColor = firstStopColor;
      }
    }
  }

  if (cellProperties?.["a:pattFill"]) {
    const pattFill = cellProperties["a:pattFill"] as XmlObject;
    const fgColor = context.parseColor(
      pattFill["a:fgClr"] as XmlObject | undefined,
    );
    const bgColor = context.parseColor(
      pattFill["a:bgClr"] as XmlObject | undefined,
    );
    const preset = String(pattFill["@_prst"] || "").trim() || undefined;
    if (preset || fgColor || bgColor) {
      style.fillMode = "pattern";
      style.patternFillPreset = preset;
      style.patternFillForeground = fgColor;
      style.patternFillBackground = bgColor;
      if (!style.backgroundColor) {
        style.backgroundColor = fgColor || bgColor;
      }
      hasStyle = true;
    }
  }

  return hasStyle;
}

/** Apply border styles (4 sides + diagonals) to a table cell style. */
export function applyCellBorderStyle(
  cellProperties: XmlObject | undefined,
  style: PptxTableCellStyle,
  context: TableCellFillBorderContext,
): boolean {
  if (!cellProperties) return false;
  let hasStyle = false;

  const borderSides = [
    {
      node: cellProperties["a:lnT"] as XmlObject | undefined,
      prefix: "borderTop",
    },
    {
      node: cellProperties["a:lnB"] as XmlObject | undefined,
      prefix: "borderBottom",
    },
    {
      node: cellProperties["a:lnL"] as XmlObject | undefined,
      prefix: "borderLeft",
    },
    {
      node: cellProperties["a:lnR"] as XmlObject | undefined,
      prefix: "borderRight",
    },
  ] as const;

  for (const { node, prefix } of borderSides) {
    if (!node) continue;

    const widthEmu = parseInt(String(node["@_w"] || "0"), 10);
    if (widthEmu > 0) {
      (style as Record<string, unknown>)[`${prefix}Width`] = Math.round(
        widthEmu / context.emuPerPx,
      );
      hasStyle = true;
    }

    const color = context.parseColor(
      node["a:solidFill"] as XmlObject | undefined,
    );
    if (color) {
      (style as Record<string, unknown>)[`${prefix}Color`] = color;
      hasStyle = true;
    }

    const prstDash = node["a:prstDash"] as XmlObject | undefined;
    if (prstDash) {
      const dashVal = String(prstDash["@_val"] || "");
      if (dashVal) {
        (style as Record<string, unknown>)[`${prefix}Dash`] = dashVal;
        hasStyle = true;
      }
    }
  }

  // Keep legacy borderColor as first found for backward compat
  const firstBorderColor =
    style.borderTopColor ||
    style.borderBottomColor ||
    style.borderLeftColor ||
    style.borderRightColor;
  if (firstBorderColor) {
    style.borderColor = firstBorderColor;
  }

  // Diagonal borders
  const diagDown = cellProperties["a:lnTlToBr"] as XmlObject | undefined;
  if (diagDown) {
    const color = context.parseColor(
      diagDown["a:solidFill"] as XmlObject | undefined,
    );
    const w = parseInt(String(diagDown["@_w"] || "0"), 10);
    if (color) {
      style.borderDiagDownColor = color;
      hasStyle = true;
    }
    if (w > 0) {
      style.borderDiagDownWidth = Math.round(w / context.emuPerPx);
      hasStyle = true;
    }
  }
  const diagUp = cellProperties["a:lnBlToTr"] as XmlObject | undefined;
  if (diagUp) {
    const color = context.parseColor(
      diagUp["a:solidFill"] as XmlObject | undefined,
    );
    const w = parseInt(String(diagUp["@_w"] || "0"), 10);
    if (color) {
      style.borderDiagUpColor = color;
      hasStyle = true;
    }
    if (w > 0) {
      style.borderDiagUpWidth = Math.round(w / context.emuPerPx);
      hasStyle = true;
    }
  }

  return hasStyle;
}

/** Apply cell margin styles from `a:tcMar` and direct attributes. */
export function applyCellMarginStyle(
  cellProperties: XmlObject | undefined,
  style: PptxTableCellStyle,
  context: TableCellFillBorderContext,
): boolean {
  if (!cellProperties) return false;
  let hasStyle = false;

  const tcMar = cellProperties["a:tcMar"] as XmlObject | undefined;
  if (tcMar) {
    const parseMargin = (node: XmlObject | undefined): number | undefined => {
      if (!node) return undefined;
      const w = parseInt(String(node["@_w"] || "0"), 10);
      return w > 0 ? Math.round(w / context.emuPerPx) : undefined;
    };
    const ml = parseMargin(tcMar["a:marL"] as XmlObject | undefined);
    const mr = parseMargin(tcMar["a:marR"] as XmlObject | undefined);
    const mt = parseMargin(tcMar["a:marT"] as XmlObject | undefined);
    const mb = parseMargin(tcMar["a:marB"] as XmlObject | undefined);
    if (ml !== undefined) {
      style.marginLeft = ml;
      hasStyle = true;
    }
    if (mr !== undefined) {
      style.marginRight = mr;
      hasStyle = true;
    }
    if (mt !== undefined) {
      style.marginTop = mt;
      hasStyle = true;
    }
    if (mb !== undefined) {
      style.marginBottom = mb;
      hasStyle = true;
    }
  }

  // Direct margin attributes on a:tcPr as fallback
  const directMargins = [
    { attr: "@_marL", key: "marginLeft" as const },
    { attr: "@_marR", key: "marginRight" as const },
    { attr: "@_marT", key: "marginTop" as const },
    { attr: "@_marB", key: "marginBottom" as const },
  ] as const;
  for (const { attr, key } of directMargins) {
    if (style[key] === undefined && cellProperties[attr]) {
      const v = parseInt(String(cellProperties[attr]), 10);
      if (v > 0) {
        style[key] = Math.round(v / context.emuPerPx);
        hasStyle = true;
      }
    }
  }

  return hasStyle;
}
