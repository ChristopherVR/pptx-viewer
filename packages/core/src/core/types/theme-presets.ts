/**
 * Built-in theme presets modelled after common PowerPoint themes.
 *
 * Each preset provides:
 * - A display name
 * - A 12-colour scheme (dk1, dk2, lt1, lt2, accent1-6, hlink, folHlink)
 * - A font scheme (major/heading + minor/body font families)
 *
 * These presets can be passed directly to
 * {@link PptxHandlerCore.switchTheme} or the React `useThemeSwitching` hook
 * to apply a complete theme in one step.
 *
 * @module pptx-types/theme-presets
 */

import type { PptxThemeColorScheme, PptxThemeFontScheme } from "./theme";

// ==========================================================================
// Theme preset type
// ==========================================================================

/**
 * A complete theme preset that can be applied to a presentation.
 *
 * @example
 * ```ts
 * import { THEME_PRESETS } from "pptx-viewer-core";
 *
 * const office = THEME_PRESETS.find(p => p.id === "office");
 * await handler.switchTheme(office.colorScheme, office.fontScheme, office.name);
 * ```
 */
export interface PptxThemePreset {
  /** Unique identifier for the preset. */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** The 12-colour scheme. */
  colorScheme: PptxThemeColorScheme;
  /** Heading and body font families. */
  fontScheme: PptxThemeFontScheme;
}

// ==========================================================================
// Built-in presets
// ==========================================================================

/**
 * Office — the default PowerPoint 2016+ theme.
 */
const OFFICE_PRESET: PptxThemePreset = {
  id: "office",
  name: "Office",
  colorScheme: {
    dk1: "#000000",
    lt1: "#FFFFFF",
    dk2: "#44546A",
    lt2: "#E7E6E6",
    accent1: "#4472C4",
    accent2: "#ED7D31",
    accent3: "#A5A5A5",
    accent4: "#FFC000",
    accent5: "#5B9BD5",
    accent6: "#70AD47",
    hlink: "#0563C1",
    folHlink: "#954F72",
  },
  fontScheme: {
    majorFont: { latin: "Calibri Light" },
    minorFont: { latin: "Calibri" },
  },
};

/**
 * Facet — geometric and clean with teal accent.
 */
const FACET_PRESET: PptxThemePreset = {
  id: "facet",
  name: "Facet",
  colorScheme: {
    dk1: "#000000",
    lt1: "#FFFFFF",
    dk2: "#2C3E50",
    lt2: "#DADEDF",
    accent1: "#90C226",
    accent2: "#54A021",
    accent3: "#E6B91E",
    accent4: "#E76618",
    accent5: "#C42F1A",
    accent6: "#918655",
    hlink: "#99CA3C",
    folHlink: "#B9D181",
  },
  fontScheme: {
    majorFont: { latin: "Trebuchet MS" },
    minorFont: { latin: "Trebuchet MS" },
  },
};

/**
 * Integral — professional with muted blues.
 */
const INTEGRAL_PRESET: PptxThemePreset = {
  id: "integral",
  name: "Integral",
  colorScheme: {
    dk1: "#000000",
    lt1: "#FFFFFF",
    dk2: "#335B74",
    lt2: "#DFE3E5",
    accent1: "#1CADE4",
    accent2: "#2683C6",
    accent3: "#27CED7",
    accent4: "#42BA97",
    accent5: "#3E8853",
    accent6: "#62A39F",
    hlink: "#6BB76D",
    folHlink: "#B5D1CC",
  },
  fontScheme: {
    majorFont: { latin: "Tw Cen MT Condensed" },
    minorFont: { latin: "Tw Cen MT" },
  },
};

/**
 * Ion — vibrant with bright colours.
 */
const ION_PRESET: PptxThemePreset = {
  id: "ion",
  name: "Ion",
  colorScheme: {
    dk1: "#000000",
    lt1: "#FFFFFF",
    dk2: "#1B1D2C",
    lt2: "#D4D4D8",
    accent1: "#B01513",
    accent2: "#EA6312",
    accent3: "#E6B729",
    accent4: "#6AAC90",
    accent5: "#54849A",
    accent6: "#9E5E9B",
    hlink: "#58C1BA",
    folHlink: "#F4B183",
  },
  fontScheme: {
    majorFont: { latin: "Century Gothic" },
    minorFont: { latin: "Century Gothic" },
  },
};

/**
 * Organic — warm and natural earth tones.
 */
const ORGANIC_PRESET: PptxThemePreset = {
  id: "organic",
  name: "Organic",
  colorScheme: {
    dk1: "#000000",
    lt1: "#FFFFFF",
    dk2: "#4A3B2A",
    lt2: "#E8DED1",
    accent1: "#83992A",
    accent2: "#3C9770",
    accent3: "#44709D",
    accent4: "#A23C33",
    accent5: "#D97828",
    accent6: "#DEB340",
    hlink: "#A0B552",
    folHlink: "#C4A656",
  },
  fontScheme: {
    majorFont: { latin: "Garamond" },
    minorFont: { latin: "Garamond" },
  },
};

/**
 * Retrospect — bold retro style with strong contrast.
 */
const RETROSPECT_PRESET: PptxThemePreset = {
  id: "retrospect",
  name: "Retrospect",
  colorScheme: {
    dk1: "#000000",
    lt1: "#FFFFFF",
    dk2: "#637052",
    lt2: "#CCD1B9",
    accent1: "#E48312",
    accent2: "#BD582C",
    accent3: "#865640",
    accent4: "#9B8357",
    accent5: "#C2BC80",
    accent6: "#94A088",
    hlink: "#E48312",
    folHlink: "#BD582C",
  },
  fontScheme: {
    majorFont: { latin: "Calibri Light" },
    minorFont: { latin: "Calibri" },
  },
};

/**
 * Slate — modern monochrome with blue accent.
 */
const SLATE_PRESET: PptxThemePreset = {
  id: "slate",
  name: "Slate",
  colorScheme: {
    dk1: "#000000",
    lt1: "#FFFFFF",
    dk2: "#212745",
    lt2: "#B4B7C8",
    accent1: "#4E67C8",
    accent2: "#5ECCF3",
    accent3: "#A7EA52",
    accent4: "#5DCEAF",
    accent5: "#FF8021",
    accent6: "#F14124",
    hlink: "#56C7AA",
    folHlink: "#59A8D1",
  },
  fontScheme: {
    majorFont: { latin: "Century Gothic" },
    minorFont: { latin: "Century Gothic" },
  },
};

/**
 * Metropolitan — sophisticated with warm grays.
 */
const METROPOLITAN_PRESET: PptxThemePreset = {
  id: "metropolitan",
  name: "Metropolitan",
  colorScheme: {
    dk1: "#000000",
    lt1: "#FFFFFF",
    dk2: "#162F3A",
    lt2: "#E0E9ED",
    accent1: "#1FA7DA",
    accent2: "#FF5C15",
    accent3: "#FFBA00",
    accent4: "#FD625E",
    accent5: "#945ECF",
    accent6: "#13A10E",
    hlink: "#1FA7DA",
    folHlink: "#945ECF",
  },
  fontScheme: {
    majorFont: { latin: "Calibri Light" },
    minorFont: { latin: "Calibri" },
  },
};

/**
 * All built-in theme presets.
 *
 * @example
 * ```ts
 * import { THEME_PRESETS } from "pptx-viewer-core";
 *
 * // List available theme names
 * console.log(THEME_PRESETS.map(p => p.name));
 * // => ["Office", "Facet", "Integral", "Ion", "Organic", "Retrospect", "Slate", "Metropolitan"]
 *
 * // Apply a preset
 * const preset = THEME_PRESETS.find(p => p.id === "ion");
 * if (preset) {
 *   await handler.switchTheme(preset.colorScheme, preset.fontScheme, preset.name);
 * }
 * ```
 */
export const THEME_PRESETS: readonly PptxThemePreset[] = [
  OFFICE_PRESET,
  FACET_PRESET,
  INTEGRAL_PRESET,
  ION_PRESET,
  ORGANIC_PRESET,
  RETROSPECT_PRESET,
  SLATE_PRESET,
  METROPOLITAN_PRESET,
] as const;
