import type { PptxTableCellStyle, XmlObject } from "../../types";

export interface TableCellTextStyleContext {
  emuPerPx: number;
  ensureArray: (value: unknown) => unknown[];
  parseColor: (
    colorNode: XmlObject | undefined,
    placeholderColor?: string,
  ) => string | undefined;
}

/** Apply vertical alignment and text direction from cell properties. */
export function applyCellAlignmentStyle(
  cellProperties: XmlObject | undefined,
  style: PptxTableCellStyle,
): boolean {
  if (!cellProperties) return false;
  let hasStyle = false;

  if (cellProperties["@_anchor"]) {
    const anchor = String(cellProperties["@_anchor"]);
    style.vAlign =
      anchor === "ctr" ? "middle" : anchor === "b" ? "bottom" : "top";
    hasStyle = true;
  }

  if (cellProperties["@_vert"]) {
    const vertical = String(cellProperties["@_vert"]);
    if (vertical === "vert") {
      style.textDirection = "vertical";
      hasStyle = true;
    } else if (vertical === "eaVert") {
      style.textDirection = "eaVert";
      hasStyle = true;
    } else if (vertical === "wordArtVert") {
      style.textDirection = "wordArtVert";
      hasStyle = true;
    } else if (vertical === "mongolianVert") {
      style.textDirection = "mongolianVert";
      hasStyle = true;
    } else if (vertical === "vert270") {
      style.textDirection = "vertical270";
      hasStyle = true;
    } else if (vertical === "wordArtVertRtl") {
      style.textDirection = "wordArtVertRtl";
      hasStyle = true;
    }
  }

  return hasStyle;
}

/** Apply text formatting from the first paragraph/run of a table cell. */
export function applyCellTextFormat(
  tableCell: XmlObject,
  style: PptxTableCellStyle,
  context: TableCellTextStyleContext,
): boolean {
  let hasStyle = false;

  const firstParagraph = (
    context.ensureArray(tableCell?.["a:txBody"]?.["a:p"]) as XmlObject[]
  )[0];
  if (!firstParagraph) return false;

  const paragraphAlign = firstParagraph["a:pPr"]?.["@_algn"];
  if (paragraphAlign === "ctr") {
    style.align = "center";
    hasStyle = true;
  } else if (paragraphAlign === "r") {
    style.align = "right";
    hasStyle = true;
  } else if (paragraphAlign === "just") {
    style.align = "justify";
    hasStyle = true;
  }

  const firstRun = (
    context.ensureArray(firstParagraph["a:r"]) as XmlObject[]
  )[0];
  const runProperties = firstRun?.["a:rPr"] as XmlObject | undefined;
  if (!runProperties) return hasStyle;

  hasStyle = applyRunProperties(runProperties, style, context) || hasStyle;

  return hasStyle;
}

function applyRunProperties(
  runProperties: XmlObject,
  style: PptxTableCellStyle,
  context: TableCellTextStyleContext,
): boolean {
  let hasStyle = false;

  if (runProperties["@_b"] === "1" || runProperties["@_b"] === true) {
    style.bold = true;
    hasStyle = true;
  }
  if (runProperties["@_i"] === "1" || runProperties["@_i"] === true) {
    style.italic = true;
    hasStyle = true;
  }
  if (runProperties["@_u"] && runProperties["@_u"] !== "none") {
    style.underline = true;
    hasStyle = true;
  }
  if (runProperties["@_sz"]) {
    style.fontSize = Math.round(
      parseInt(String(runProperties["@_sz"]), 10) / 100,
    );
    hasStyle = true;
  }
  if (runProperties["a:solidFill"]) {
    const textColor = context.parseColor(
      runProperties["a:solidFill"] as XmlObject,
    );
    if (textColor) {
      style.color = textColor;
      hasStyle = true;
    }
  }

  hasStyle = applyTextEffects(runProperties, style, context) || hasStyle;
  return hasStyle;
}

function applyTextEffects(
  runProperties: XmlObject,
  style: PptxTableCellStyle,
  context: TableCellTextStyleContext,
): boolean {
  const effectLst = runProperties["a:effectLst"] as XmlObject | undefined;
  if (!effectLst) return false;
  let hasStyle = false;

  const outerShdw = effectLst["a:outerShdw"] as XmlObject | undefined;
  if (outerShdw) {
    const shdwColor = context.parseColor(outerShdw);
    if (shdwColor) {
      style.textShadowColor = shdwColor;
      hasStyle = true;
    }
    const blurRad = parseInt(String(outerShdw["@_blurRad"] || "0"), 10);
    if (blurRad > 0) {
      style.textShadowBlur = Math.round(blurRad / context.emuPerPx);
      hasStyle = true;
    }
    const distVal = parseInt(String(outerShdw["@_dist"] || "0"), 10);
    const dirVal = parseInt(String(outerShdw["@_dir"] || "0"), 10);
    if (distVal > 0) {
      const angleRad = (dirVal / 60000) * (Math.PI / 180);
      style.textShadowOffsetX = Math.round(
        (distVal * Math.cos(angleRad)) / context.emuPerPx,
      );
      style.textShadowOffsetY = Math.round(
        (distVal * Math.sin(angleRad)) / context.emuPerPx,
      );
      hasStyle = true;
    }
  }

  const glow = effectLst["a:glow"] as XmlObject | undefined;
  if (glow) {
    const glowColor = context.parseColor(glow);
    if (glowColor) {
      style.textGlowColor = glowColor;
      hasStyle = true;
    }
    const glowRad = parseInt(String(glow["@_rad"] || "0"), 10);
    if (glowRad > 0) {
      style.textGlowRadius = Math.round(glowRad / context.emuPerPx);
      hasStyle = true;
    }
  }

  return hasStyle;
}
