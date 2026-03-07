import React from "react";

import type { XmlObject } from "pptx-viewer-core";
import { colorWithOpacity } from "./color";
import { parseDrawingColor, parseDrawingColorOpacity } from "./drawing-color";
import { ensureArrayValue } from "./geometry";
import {
  parseGradientFillCss,
  parsePatternFillCss,
  parseCellBorders,
  parseCellTextEffects,
} from "./table-cell-fill";

// ── Cell text extraction ─────────────────────────────────────────────────

export function extractCellText(cellXml: XmlObject | undefined): string {
  if (!cellXml) return "";
  const txBody = cellXml["a:txBody"] as XmlObject | undefined;
  const paragraphs = ensureArrayValue(
    txBody?.["a:p"] as XmlObject | XmlObject[] | undefined,
  );
  const paragraphTexts: string[] = [];

  paragraphs.forEach((paragraph) => {
    const textParts: string[] = [];
    const runs = ensureArrayValue(
      paragraph["a:r"] as XmlObject | XmlObject[] | undefined,
    );
    runs.forEach((run) => {
      const value = run["a:t"];
      if (typeof value === "string") {
        textParts.push(value);
      } else if (value !== undefined) {
        textParts.push(String(value));
      }
    });

    const fields = ensureArrayValue(
      paragraph["a:fld"] as XmlObject | XmlObject[] | undefined,
    );
    fields.forEach((field) => {
      const value = field["a:t"];
      if (typeof value === "string") {
        textParts.push(value);
      } else if (value !== undefined) {
        textParts.push(String(value));
      }
    });

    paragraphTexts.push(textParts.join(""));
  });

  return paragraphTexts.join("\n");
}

// ── Paragraph alignment mapping ──────────────────────────────────────────

export function parseParagraphAlignment(
  value: unknown,
): React.CSSProperties["textAlign"] {
  const alignment = String(value || "").toLowerCase();
  if (alignment === "ctr") return "center";
  if (alignment === "r") return "right";
  if (alignment === "just" || alignment === "justify") return "justify";
  return "left";
}

// ── Full cell style extraction ───────────────────────────────────────────

export function extractTableCellStyle(
  cellXml: XmlObject,
  fallbackStyle: React.CSSProperties,
): React.CSSProperties {
  const cellStyle: React.CSSProperties = { ...fallbackStyle };
  const txBody = cellXml["a:txBody"] as XmlObject | undefined;
  const paragraphs = ensureArrayValue(
    txBody?.["a:p"] as XmlObject | XmlObject[] | undefined,
  );
  const firstParagraph = paragraphs[0] as XmlObject | undefined;
  const paragraphProperties = firstParagraph?.["a:pPr"] as
    | XmlObject
    | undefined;
  const runs = ensureArrayValue(
    firstParagraph?.["a:r"] as XmlObject | XmlObject[] | undefined,
  );
  const firstRun = runs[0] as XmlObject | undefined;
  const runProps = (firstRun?.["a:rPr"] ||
    paragraphProperties?.["a:defRPr"]) as XmlObject | undefined;

  if (runProps?.["@_sz"]) {
    const pointSize = Number.parseInt(String(runProps["@_sz"]), 10) / 100;
    if (Number.isFinite(pointSize) && pointSize > 0) {
      cellStyle.fontSize = pointSize * (96 / 72);
    }
  }

  if (runProps?.["@_b"] !== undefined) {
    cellStyle.fontWeight = runProps["@_b"] === "1" ? 700 : 400;
  }
  if (runProps?.["@_i"] !== undefined) {
    cellStyle.fontStyle = runProps["@_i"] === "1" ? "italic" : "normal";
  }
  if (runProps?.["@_u"] !== undefined) {
    cellStyle.textDecorationLine =
      runProps["@_u"] === "sng" ? "underline" : "none";
  }

  const runColor =
    parseDrawingColor(runProps?.["a:solidFill"] as XmlObject | undefined) ||
    parseDrawingColor(runProps?.["a:highlight"] as XmlObject | undefined);
  if (runColor) {
    const opacity = parseDrawingColorOpacity(
      runProps?.["a:solidFill"] as XmlObject | undefined,
    );
    cellStyle.color = colorWithOpacity(runColor, opacity);
  }

  const fontFamily =
    ((runProps?.["a:latin"] as XmlObject | undefined)?.["@_typeface"] as
      | string
      | undefined) ||
    ((runProps?.["a:ea"] as XmlObject | undefined)?.["@_typeface"] as
      | string
      | undefined) ||
    ((runProps?.["a:cs"] as XmlObject | undefined)?.["@_typeface"] as
      | string
      | undefined);
  if (fontFamily) {
    cellStyle.fontFamily = fontFamily;
  }

  if (paragraphProperties?.["@_algn"]) {
    cellStyle.textAlign = parseParagraphAlignment(
      paragraphProperties["@_algn"],
    );
  }

  const cellProperties = cellXml["a:tcPr"] as XmlObject | undefined;

  // Solid fill takes priority
  const cellFill = parseDrawingColor(
    cellProperties?.["a:solidFill"] as XmlObject | undefined,
  );
  if (cellFill) {
    const opacity = parseDrawingColorOpacity(
      cellProperties?.["a:solidFill"] as XmlObject | undefined,
    );
    cellStyle.backgroundColor = colorWithOpacity(cellFill, opacity);
  } else {
    // Try gradient fill
    const gradCss = parseGradientFillCss(
      cellProperties?.["a:gradFill"] as XmlObject | undefined,
    );
    if (gradCss) {
      cellStyle.background = gradCss;
    } else {
      // Try pattern fill
      const pattCss = parsePatternFillCss(
        cellProperties?.["a:pattFill"] as XmlObject | undefined,
      );
      if (pattCss) {
        cellStyle.background = pattCss;
      }
    }
  }

  // Per-edge border parsing (width + color)
  const edgeBorders = parseCellBorders(cellProperties);
  Object.assign(cellStyle, edgeBorders);

  // Fallback: if no per-edge borders, try legacy single-color approach
  if (
    !cellStyle.borderLeftColor &&
    !cellStyle.borderRightColor &&
    !cellStyle.borderTopColor &&
    !cellStyle.borderBottomColor
  ) {
    const borderColor =
      parseDrawingColor(
        (cellProperties?.["a:lnL"] as XmlObject | undefined)?.[
          "a:solidFill"
        ] as XmlObject | undefined,
      ) ||
      parseDrawingColor(
        (cellProperties?.["a:lnR"] as XmlObject | undefined)?.[
          "a:solidFill"
        ] as XmlObject | undefined,
      ) ||
      parseDrawingColor(
        (cellProperties?.["a:lnT"] as XmlObject | undefined)?.[
          "a:solidFill"
        ] as XmlObject | undefined,
      ) ||
      parseDrawingColor(
        (cellProperties?.["a:lnB"] as XmlObject | undefined)?.[
          "a:solidFill"
        ] as XmlObject | undefined,
      );

    if (borderColor) {
      cellStyle.borderColor = borderColor;
    }
  }

  // Cell margins / padding from `marL`, `marR`, `marT`, `marB` (in EMU)
  if (cellProperties) {
    const marL = Number.parseInt(String(cellProperties["@_marL"] || ""), 10);
    const marR = Number.parseInt(String(cellProperties["@_marR"] || ""), 10);
    const marT = Number.parseInt(String(cellProperties["@_marT"] || ""), 10);
    const marB = Number.parseInt(String(cellProperties["@_marB"] || ""), 10);
    const toPx = (emu: number) => Math.round(emu / 12700);
    if (Number.isFinite(marL) && marL > 0) cellStyle.paddingLeft = toPx(marL);
    if (Number.isFinite(marR) && marR > 0) cellStyle.paddingRight = toPx(marR);
    if (Number.isFinite(marT) && marT > 0) cellStyle.paddingTop = toPx(marT);
    if (Number.isFinite(marB) && marB > 0) cellStyle.paddingBottom = toPx(marB);
  }

  // Vertical alignment from `anchor` attribute
  if (cellProperties?.["@_anchor"]) {
    const anchor = String(cellProperties["@_anchor"]);
    if (anchor === "ctr") cellStyle.verticalAlign = "middle";
    else if (anchor === "b") cellStyle.verticalAlign = "bottom";
    else cellStyle.verticalAlign = "top";
  }

  // Text direction from `vert` attribute
  if (cellProperties?.["@_vert"]) {
    const vert = String(cellProperties["@_vert"]);
    if (
      vert === "vert" ||
      vert === "eaVert" ||
      vert === "wordArtVert" ||
      vert === "mongolianVert"
    ) {
      cellStyle.writingMode = "vertical-rl";
    } else if (vert === "vert270" || vert === "wordArtVertRtl") {
      cellStyle.writingMode = "vertical-lr";
    }
  }

  // Cell text effects (shadow, glow) from first run's a:effectLst
  const textShadow = parseCellTextEffects(runProps);
  if (textShadow) {
    cellStyle.textShadow = textShadow;
  }

  return cellStyle;
}
