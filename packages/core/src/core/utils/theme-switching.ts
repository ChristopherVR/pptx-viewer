/**
 * Theme switching utility — re-resolves scheme colour references across
 * all elements in a presentation when the theme colour map changes.
 *
 * The core challenge: elements store both a resolved hex colour and
 * (implicitly through the original OOXML) a scheme colour reference.
 * When the theme changes, every resolved colour that was derived from a
 * scheme reference needs to be recalculated.
 *
 * This module provides a pure-function approach: given the old and new
 * colour maps, it walks all slides and patches resolved colours.
 *
 * @module utils/theme-switching
 */

import type {
  PptxSlide,
  PptxElement,
  PptxThemeColorScheme,
  PptxThemeFontScheme,
  ShapeStyle,
  TextStyle,
  TextSegment,
  PptxData,
  PptxTableData,
  PptxTableRow,
  PptxTableCell,
  PptxTableCellStyle,
} from "../types";
import { THEME_COLOR_SCHEME_KEYS } from "../types/theme";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Normalise a hex colour to uppercase 6-digit form without the `#` prefix
 * for comparison purposes.
 */
function normalizeHex(hex: string | undefined): string {
  if (!hex) return "";
  return hex.replace(/^#/, "").toUpperCase().slice(0, 6);
}

/**
 * Build a mapping from old resolved hex values to new resolved hex values.
 * This allows O(1) colour substitution when walking elements.
 *
 * The map covers all 12 scheme keys plus the standard aliases
 * (tx1 -> dk1, bg1 -> lt1, tx2 -> dk2, bg2 -> lt2).
 */
function buildColorRemapTable(
  oldColorMap: Record<string, string>,
  newColorMap: Record<string, string>,
): Map<string, string> {
  const remap = new Map<string, string>();

  // Build a complete old->new mapping for all scheme keys
  const allKeys = [
    ...THEME_COLOR_SCHEME_KEYS,
    "tx1",
    "bg1",
    "tx2",
    "bg2",
  ];

  for (const key of allKeys) {
    const oldVal = normalizeHex(oldColorMap[key]);
    const newVal = normalizeHex(newColorMap[key]);
    if (oldVal && newVal && oldVal !== newVal) {
      // Map both with and without # prefix
      remap.set(oldVal, `#${newVal}`);
      remap.set(`#${oldVal}`, `#${newVal}`);
    }
  }

  return remap;
}

/**
 * If the given colour matches an old theme colour, return the new
 * theme colour. Otherwise return the original colour unchanged.
 */
function remapColor(
  color: string | undefined,
  remap: Map<string, string>,
): string | undefined {
  if (!color) return color;
  const normalized = normalizeHex(color);
  const remapped = remap.get(normalized) ?? remap.get(`#${normalized}`);
  return remapped ?? color;
}

// ---------------------------------------------------------------------------
// ShapeStyle colour re-resolution
// ---------------------------------------------------------------------------

/**
 * Re-resolve all theme-derived colours in a ShapeStyle.
 */
function remapShapeStyleColors(
  style: ShapeStyle | undefined,
  remap: Map<string, string>,
): ShapeStyle | undefined {
  if (!style) return style;

  const patched = { ...style };

  // Fill colours
  patched.fillColor = remapColor(patched.fillColor, remap);
  patched.strokeColor = remapColor(patched.strokeColor, remap);

  // Shadow
  patched.shadowColor = remapColor(patched.shadowColor, remap);
  patched.innerShadowColor = remapColor(patched.innerShadowColor, remap);
  patched.glowColor = remapColor(patched.glowColor, remap);

  // Line-level effects
  patched.lineShadowColor = remapColor(patched.lineShadowColor, remap);
  patched.lineGlowColor = remapColor(patched.lineGlowColor, remap);

  // Pattern fill
  patched.fillPatternBackgroundColor = remapColor(
    patched.fillPatternBackgroundColor,
    remap,
  );

  // Gradient stops
  if (patched.fillGradientStops) {
    patched.fillGradientStops = patched.fillGradientStops.map((stop) => ({
      ...stop,
      color: remapColor(stop.color, remap) ?? stop.color,
    }));

    // Rebuild gradient CSS if stops changed
    if (patched.fillGradient && patched.fillGradientStops.length > 0) {
      patched.fillGradient = buildSimpleGradientCss(
        patched.fillGradientStops,
        patched.fillGradientType ?? "linear",
        patched.fillGradientAngle ?? 0,
      );
    }
  }

  return patched;
}

/**
 * Build a simple CSS gradient string from stops (for inline style usage).
 */
function buildSimpleGradientCss(
  stops: Array<{ color: string; position: number; opacity?: number }>,
  type: "linear" | "radial",
  angle: number,
): string {
  const stopStrs = stops
    .map((s) => `${s.color} ${Math.round(s.position * 100)}%`)
    .join(", ");
  if (type === "radial") {
    return `radial-gradient(circle, ${stopStrs})`;
  }
  return `linear-gradient(${angle}deg, ${stopStrs})`;
}

// ---------------------------------------------------------------------------
// TextStyle colour re-resolution
// ---------------------------------------------------------------------------

/**
 * Re-resolve all theme-derived colours in a TextStyle.
 */
function remapTextStyleColors(
  style: TextStyle | undefined,
  remap: Map<string, string>,
): TextStyle | undefined {
  if (!style) return style;

  const patched = { ...style };
  patched.color = remapColor(patched.color, remap);
  patched.underlineColor = remapColor(patched.underlineColor, remap);
  patched.highlightColor = remapColor(patched.highlightColor, remap);
  patched.textOutlineColor = remapColor(patched.textOutlineColor, remap);
  patched.textFillPatternForeground = remapColor(
    patched.textFillPatternForeground,
    remap,
  );
  patched.textFillPatternBackground = remapColor(
    patched.textFillPatternBackground,
    remap,
  );

  // Text gradient stops
  if (patched.textFillGradientStops) {
    patched.textFillGradientStops = patched.textFillGradientStops.map(
      (stop) => ({
        ...stop,
        color: remapColor(stop.color, remap) ?? stop.color,
      }),
    );
  }

  return patched;
}

/**
 * Re-resolve colours in text segments.
 */
function remapTextSegments(
  segments: TextSegment[] | undefined,
  remap: Map<string, string>,
): TextSegment[] | undefined {
  if (!segments) return segments;

  return segments.map((seg) => {
    if (!seg.style) return seg;
    const remapped = remapTextStyleColors(seg.style, remap);
    return {
      ...seg,
      style: remapped ?? seg.style,
    };
  });
}

// ---------------------------------------------------------------------------
// Element-level re-resolution
// ---------------------------------------------------------------------------

/**
 * Re-resolve all theme-derived colours in a single element.
 * Handles all element types including nested group children.
 */
function remapElementColors(
  element: PptxElement,
  remap: Map<string, string>,
): PptxElement {
  const patched = { ...element } as Record<string, unknown>;

  // ShapeStyle (present on shape, text, connector, image elements)
  if ("shapeStyle" in element && element.shapeStyle) {
    patched.shapeStyle = remapShapeStyleColors(
      element.shapeStyle as ShapeStyle,
      remap,
    );
  }

  // TextStyle (present on text, shape, connector elements)
  if ("textStyle" in element && element.textStyle) {
    patched.textStyle = remapTextStyleColors(
      element.textStyle as TextStyle,
      remap,
    );
  }

  // Text segments (present on text, shape, connector elements)
  if ("textSegments" in element && element.textSegments) {
    patched.textSegments = remapTextSegments(
      element.textSegments as TextSegment[],
      remap,
    );
  }

  // Group children — recurse
  if (element.type === "group" && element.children) {
    patched.children = element.children.map((child) =>
      remapElementColors(child, remap),
    );
    // Group fill
    if (element.groupFill) {
      patched.groupFill = remapShapeStyleColors(element.groupFill, remap);
    }
  }

  // Table cells
  if (element.type === "table" && element.tableData) {
    patched.tableData = remapTableColors(element.tableData, remap);
  }

  return patched as unknown as PptxElement;
}

/**
 * Re-resolve colours in a single table cell style.
 */
function remapCellStyleColors(
  style: PptxTableCellStyle | undefined,
  remap: Map<string, string>,
): PptxTableCellStyle | undefined {
  if (!style) return style;
  const patched = { ...style };
  patched.color = remapColor(patched.color, remap);
  patched.backgroundColor = remapColor(patched.backgroundColor, remap);
  patched.borderColor = remapColor(patched.borderColor, remap);
  patched.borderTopColor = remapColor(patched.borderTopColor, remap);
  patched.borderBottomColor = remapColor(patched.borderBottomColor, remap);
  patched.borderLeftColor = remapColor(patched.borderLeftColor, remap);
  patched.borderRightColor = remapColor(patched.borderRightColor, remap);
  patched.patternFillForeground = remapColor(
    patched.patternFillForeground,
    remap,
  );
  patched.patternFillBackground = remapColor(
    patched.patternFillBackground,
    remap,
  );
  return patched;
}

/**
 * Re-resolve colours in table data (cell fills, text, borders).
 */
function remapTableColors(
  tableData: PptxTableData,
  remap: Map<string, string>,
): PptxTableData {
  return {
    ...tableData,
    rows: tableData.rows.map(
      (row: PptxTableRow): PptxTableRow => ({
        ...row,
        cells: row.cells.map(
          (cell: PptxTableCell): PptxTableCell => ({
            ...cell,
            style: remapCellStyleColors(cell.style, remap),
          }),
        ),
      }),
    ),
  };
}

// ---------------------------------------------------------------------------
// Slide-level re-resolution
// ---------------------------------------------------------------------------

/**
 * Re-resolve all theme-derived colours in a slide.
 */
function remapSlideColors(
  slide: PptxSlide,
  remap: Map<string, string>,
): PptxSlide {
  const patched = { ...slide };

  // Slide background
  if (patched.backgroundColor) {
    patched.backgroundColor = remapColor(patched.backgroundColor, remap);
  }

  // Slide elements
  if (patched.elements) {
    patched.elements = patched.elements.map((el) =>
      remapElementColors(el, remap),
    );
  }

  return patched;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the new colour map from a PptxThemeColorScheme, including aliases.
 */
export function buildThemeColorMap(
  colorScheme: PptxThemeColorScheme,
): Record<string, string> {
  const map: Record<string, string> = {};

  for (const key of THEME_COLOR_SCHEME_KEYS) {
    map[key] = normalizeHex(colorScheme[key]);
  }

  // Standard aliases
  map.tx1 = map.dk1;
  map.bg1 = map.lt1;
  map.tx2 = map.dk2;
  map.bg2 = map.lt2;

  return map;
}

/**
 * Re-resolve all theme-derived colours across all slides when
 * switching from one colour scheme to another.
 *
 * This function does NOT modify its inputs — it returns new slide
 * objects with the colours patched.
 *
 * @param slides - Current slides with colours resolved from the old theme.
 * @param oldColorMap - The colour map from the old/current theme
 *   (typically `pptxData.themeColorMap`).
 * @param newColorScheme - The new colour scheme to apply.
 * @returns New slides array with all scheme-derived colours re-resolved.
 *
 * @example
 * ```ts
 * import { reResolveSlideColors, THEME_PRESETS } from "pptx-viewer-core";
 *
 * const ion = THEME_PRESETS.find(p => p.id === "ion")!;
 * const newSlides = reResolveSlideColors(
 *   data.slides,
 *   data.themeColorMap ?? {},
 *   ion.colorScheme,
 * );
 * ```
 */
export function reResolveSlideColors(
  slides: PptxSlide[],
  oldColorMap: Record<string, string>,
  newColorScheme: PptxThemeColorScheme,
): PptxSlide[] {
  const newMap = buildThemeColorMap(newColorScheme);
  const remap = buildColorRemapTable(oldColorMap, newMap);

  // If no colours actually changed, return the original array.
  if (remap.size === 0) return slides;

  return slides.map((slide) => remapSlideColors(slide, remap));
}

/**
 * Apply a theme switch to a full PptxData object.
 *
 * Updates:
 * 1. All element colours across all slides
 * 2. The `themeColorMap` on the PptxData
 * 3. The `theme` object on the PptxData (colorScheme and optionally fontScheme + name)
 *
 * This function does NOT modify its input — it returns a new PptxData.
 *
 * @param data - The current parsed presentation data.
 * @param newColorScheme - The new colour scheme.
 * @param newFontScheme - Optional new font scheme.
 * @param themeName - Optional new theme name.
 * @returns A new PptxData with the theme applied.
 *
 * @example
 * ```ts
 * import { applyThemeToData, THEME_PRESETS } from "pptx-viewer-core";
 *
 * const facet = THEME_PRESETS.find(p => p.id === "facet")!;
 * const newData = applyThemeToData(data, facet.colorScheme, facet.fontScheme, facet.name);
 * ```
 */
export function applyThemeToData(
  data: PptxData,
  newColorScheme: PptxThemeColorScheme,
  newFontScheme?: PptxThemeFontScheme,
  themeName?: string,
): PptxData {
  const oldColorMap = data.themeColorMap ?? {};
  const newColorMap = buildThemeColorMap(newColorScheme);
  const newSlides = reResolveSlideColors(data.slides, oldColorMap, newColorScheme);

  const newTheme = {
    ...data.theme,
    colorScheme: newColorScheme,
    ...(newFontScheme && { fontScheme: newFontScheme }),
    ...(themeName && { name: themeName }),
  };

  return {
    ...data,
    slides: newSlides,
    themeColorMap: newColorMap,
    theme: newTheme,
  };
}
