import type React from "react";

import type {
  PptxElement,
  ParsedTableStyleEntry,
  ParsedTableStyleFill,
  ParsedTableStyleText,
  ParsedTableStyleMap,
  PptxTheme,
  PptxThemeColorScheme,
} from "pptx-viewer-core";
import { tintColor, shadeColor } from "./theme";

// ── Table band/header styling ────────────────────────────────────────────

/** Context for resolving table style colours from the theme. */
export interface TableStyleContext {
  tableStyleMap?: ParsedTableStyleMap;
  theme?: PptxTheme;
}

/**
 * Resolve a `ParsedTableStyleFill` to a CSS hex colour string using
 * the presentation theme's colour scheme.  Falls back to a default
 * scheme colour map when no theme is provided.
 */
function resolveTableStyleFillColor(
  fill: ParsedTableStyleFill | undefined,
  colorScheme: PptxThemeColorScheme | undefined,
): string | undefined {
  if (!fill) return undefined;
  const key = fill.schemeColor;
  // Resolve base colour from theme scheme or default palette
  const base = colorScheme
    ? (colorScheme as unknown as Record<string, string | undefined>)[key]
    : undefined;
  if (!base) return undefined;

  let color = base;
  // Tint: 0-100 000 maps to 0.0-1.0
  if (fill.tint !== undefined && fill.tint > 0) {
    color = tintColor(color, fill.tint / 100_000);
  }
  // Shade: 0-100 000 maps to 0.0-1.0
  if (fill.shade !== undefined && fill.shade > 0) {
    color = shadeColor(color, 1 - fill.shade / 100_000);
  }
  return color;
}

/**
 * Apply text properties from a `ParsedTableStyleText` to CSS properties.
 */
function applyTableStyleText(
  text: ParsedTableStyleText | undefined,
  colorScheme: PptxThemeColorScheme | undefined,
  style: React.CSSProperties,
): boolean {
  if (!text) return false;
  let applied = false;

  if (text.bold) {
    style.fontWeight = 700;
    applied = true;
  }
  if (text.italic) {
    style.fontStyle = "italic";
    applied = true;
  }
  if (text.fontSchemeColor && colorScheme) {
    const base = (colorScheme as unknown as Record<string, string | undefined>)[
      text.fontSchemeColor
    ];
    if (base) {
      let color = base;
      if (text.fontTint !== undefined && text.fontTint > 0) {
        color = tintColor(color, text.fontTint / 100_000);
      }
      if (text.fontShade !== undefined && text.fontShade > 0) {
        color = shadeColor(color, 1 - text.fontShade / 100_000);
      }
      style.color = color;
      applied = true;
    }
  }

  return applied;
}

/**
 * Look up the `ParsedTableStyleEntry` for an element's table style ID.
 */
function resolveTableStyleEntry(
  tableStyleId: string | undefined,
  tableStyleMap: ParsedTableStyleMap | undefined,
): ParsedTableStyleEntry | undefined {
  if (!tableStyleId || !tableStyleMap) return undefined;
  // Try as-is first, then normalise to upper-case with braces
  const direct = tableStyleMap[tableStyleId];
  if (direct) return direct;
  const normalised = tableStyleId.trim().toUpperCase();
  const withBraces = normalised.startsWith("{")
    ? normalised
    : `{${normalised}}`;
  return tableStyleMap[withBraces];
}

/**
 * Returns override styles for a cell based on table properties (banded
 * rows/columns, header row, total row, first/last column emphasis).
 *
 * When `styleCtx` is provided the colours are resolved from the actual
 * OOXML table style definition + theme colour scheme instead of using
 * hardcoded fallback colours.
 */
export function getTableCellBandStyle(
  element: PptxElement,
  rowIndex: number,
  cellIndex: number,
  rowCount: number,
  columnCount: number,
  styleCtx?: TableStyleContext,
): React.CSSProperties | undefined {
  if (element.type !== "table") return undefined;
  const td = element.tableData;
  if (!td) return undefined;

  const styleEntry = resolveTableStyleEntry(
    td.tableStyleId,
    styleCtx?.tableStyleMap,
  );
  const colorScheme = styleCtx?.theme?.colorScheme;

  // Helper: resolve a section fill to a CSS colour, or fall back
  const resolveFill = (
    fill: ParsedTableStyleFill | undefined,
    fallback: string,
  ): string => resolveTableStyleFillColor(fill, colorScheme) ?? fallback;

  const style: React.CSSProperties = {};
  let applied = false;

  // ── Whole-table fill and text (background for all cells) ─────
  if (styleEntry?.wholeTblFill) {
    const wholeBg = resolveFill(styleEntry.wholeTblFill, "");
    if (wholeBg) {
      style.backgroundColor = wholeBg;
      applied = true;
    }
  }
  if (applyTableStyleText(styleEntry?.wholeTblText, colorScheme, style)) {
    applied = true;
  }

  // ── Banded rows (skip header row if present) ─────────────────
  const bandStartRow = td.firstRowHeader ? 1 : 0;
  const bandEndRow = td.lastRow ? rowCount - 1 : rowCount;
  if (td.bandedRows && rowIndex >= bandStartRow && rowIndex < bandEndRow) {
    const bandIndex = rowIndex - bandStartRow;
    const rowCycle = Math.max(td.bandRowCycle ?? 1, 1);
    const bandGroup = Math.floor(bandIndex / rowCycle) % 2;
    if (bandGroup === 0) {
      const band1Bg = resolveFill(
        styleEntry?.band1HFill,
        "rgba(217, 226, 243, 0.5)",
      );
      style.backgroundColor = band1Bg;
      applied = true;
    } else if (styleEntry?.band2HFill) {
      const band2Bg = resolveFill(styleEntry.band2HFill, "");
      if (band2Bg) {
        style.backgroundColor = band2Bg;
        applied = true;
      }
    }
  }

  // ── Banded columns ──────────────────────────────────────────
  if (td.bandedColumns) {
    const isFirstCol = td.firstCol;
    const isLastCol = td.lastCol;
    const colBandIndex =
      isFirstCol && cellIndex > 0 ? cellIndex - 1 : cellIndex;
    // Skip first/last col positions if they have their own emphasis
    const skipCol =
      (isFirstCol && cellIndex === 0) ||
      (isLastCol && cellIndex === columnCount - 1);
    if (!skipCol) {
      const colCycle = Math.max(td.bandColCycle ?? 1, 1);
      const colBandGroup = Math.floor(colBandIndex / colCycle) % 2;
      if (colBandGroup === 0) {
        if (!style.backgroundColor || !td.bandedRows) {
          const band1Bg = resolveFill(
            styleEntry?.band1VFill,
            "rgba(217, 226, 243, 0.35)",
          );
          style.backgroundColor = band1Bg;
          applied = true;
        }
      } else if (styleEntry?.band2VFill) {
        if (!style.backgroundColor || !td.bandedRows) {
          const band2Bg = resolveFill(styleEntry.band2VFill, "");
          if (band2Bg) {
            style.backgroundColor = band2Bg;
            applied = true;
          }
        }
      }
    }
  }

  // ── Header row (first row) ──────────────────────────────────
  if (td.firstRowHeader && rowIndex === 0) {
    style.fontWeight = 700;
    const headerBg = resolveFill(
      styleEntry?.firstRowFill,
      "rgba(68, 114, 196, 0.85)",
    );
    style.backgroundColor = headerBg;
    style.color = "#ffffff";
    applyTableStyleText(styleEntry?.firstRowText, colorScheme, style);
    applied = true;
  }

  // ── Total / last row emphasis ───────────────────────────────
  if (td.lastRow && rowIndex === rowCount - 1) {
    style.fontWeight = 700;
    if (styleEntry?.lastRowFill) {
      const lastRowBg = resolveFill(styleEntry.lastRowFill, "");
      if (lastRowBg) {
        style.backgroundColor = lastRowBg;
      }
    }
    style.borderTopWidth = 2;
    style.borderTopColor = resolveFill(
      styleEntry?.firstRowFill,
      "rgba(68, 114, 196, 0.7)",
    );
    style.borderTopStyle = "solid";
    applyTableStyleText(styleEntry?.lastRowText, colorScheme, style);
    applied = true;
  }

  // ── First column emphasis ───────────────────────────────────
  if (td.firstCol && cellIndex === 0) {
    style.fontWeight = 700;
    if (styleEntry?.firstColFill) {
      const firstColBg = resolveFill(styleEntry.firstColFill, "");
      if (firstColBg) {
        style.backgroundColor = firstColBg;
      }
    }
    applyTableStyleText(styleEntry?.firstColText, colorScheme, style);
    applied = true;
  }

  // ── Last column emphasis ────────────────────────────────────
  if (td.lastCol && cellIndex === columnCount - 1) {
    style.fontWeight = 700;
    if (styleEntry?.lastColFill) {
      const lastColBg = resolveFill(styleEntry.lastColFill, "");
      if (lastColBg) {
        style.backgroundColor = lastColBg;
      }
    }
    applyTableStyleText(styleEntry?.lastColText, colorScheme, style);
    applied = true;
  }

  return applied ? style : undefined;
}
