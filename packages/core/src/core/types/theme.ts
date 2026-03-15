/**
 * Theme object model — colour scheme, font scheme, and format scheme
 * parsed from `ppt/theme/theme1.xml`.
 *
 * The colour scheme provides the 12 canonical OOXML colour slots.
 * The font scheme defines major (heading) and minor (body) typefaces.
 * The format scheme holds fill, line, and effect style matrices at
 * three intensity levels (subtle, moderate, intense).
 *
 * @module pptx-types/theme
 */

// ==========================================================================
// Theme object model
// ==========================================================================

/**
 * The 12 OOXML theme colour scheme keys in canonical order.
 *
 * @example
 * ```ts
 * for (const key of THEME_COLOR_SCHEME_KEYS) {
 *   console.log(key, theme.colorScheme?.[key]);
 * }
 * // => e.g. "dk1 #000000", "lt1 #FFFFFF", "accent1 #4F81BD", …
 * ```
 */
export const THEME_COLOR_SCHEME_KEYS = [
  "dk1",
  "lt1",
  "dk2",
  "lt2",
  "accent1",
  "accent2",
  "accent3",
  "accent4",
  "accent5",
  "accent6",
  "hlink",
  "folHlink",
] as const;

/**
 * Resolved hex values for the 12 theme colour slots.
 *
 * @example
 * ```ts
 * const scheme: PptxThemeColorScheme = {
 *   dk1: "#000000", lt1: "#FFFFFF",
 *   dk2: "#1F497D", lt2: "#EEECE1",
 *   accent1: "#4F81BD", accent2: "#C0504D",
 *   accent3: "#9BBB59", accent4: "#8064A2",
 *   accent5: "#4BACC6", accent6: "#F79646",
 *   hlink: "#0000FF", folHlink: "#800080",
 * };
 * // => satisfies PptxThemeColorScheme
 * ```
 */
export interface PptxThemeColorScheme {
  dk1: string;
  lt1: string;
  dk2: string;
  lt2: string;
  accent1: string;
  accent2: string;
  accent3: string;
  accent4: string;
  accent5: string;
  accent6: string;
  hlink: string;
  folHlink: string;
}

/**
 * A font-family triplet for major or minor theme fonts.
 *
 * Supports Latin, East Asian, and Complex Script font families.
 *
 * @example
 * ```ts
 * const fonts: PptxThemeFontGroup = {
 *   latin: "Calibri Light",
 *   eastAsia: "MS PGothic",
 *   complexScript: "Arial",
 * };
 * // => satisfies PptxThemeFontGroup
 * ```
 */
export interface PptxThemeFontGroup {
  latin?: string;
  eastAsia?: string;
  complexScript?: string;
}

/**
 * Theme font scheme — major (headings) and minor (body) font families.
 *
 * @example
 * ```ts
 * const scheme: PptxThemeFontScheme = {
 *   majorFont: { latin: "Calibri Light" },
 *   minorFont: { latin: "Calibri", eastAsia: "MS PGothic" },
 * };
 * // => satisfies PptxThemeFontScheme
 * ```
 */
export interface PptxThemeFontScheme {
  majorFont?: PptxThemeFontGroup;
  minorFont?: PptxThemeFontGroup;
}

// --------------------------------------------------------------------------
// Theme Format Scheme (a:fmtScheme) — Fill, Line, Effect & Background styles
// --------------------------------------------------------------------------

/**
 * A single fill style entry from the theme format scheme.
 * Each entry is one of: solid, gradient, pattern, or no fill.
 * The raw XML node is also stored so that `phClr` substitution can happen
 * at resolution time.
 *
 * @example
 * ```ts
 * const solidFill: PptxThemeFillStyle = {
 *   kind: "solid",
 *   color: "#4F81BD",
 *   opacity: 1,
 * };
 *
 * const gradientFill: PptxThemeFillStyle = {
 *   kind: "gradient",
 *   gradientAngle: 90,
 *   gradientType: "linear",
 *   gradientStops: [
 *     { color: "#4F81BD", position: 0 },
 *     { color: "#1F497D", position: 1 },
 *   ],
 * };
 * // => satisfies PptxThemeFillStyle
 * ```
 */
export interface PptxThemeFillStyle {
  /** Discriminator for the fill type. */
  kind: "solid" | "gradient" | "pattern" | "none";
  /** Pre-resolved colour (may be `undefined` when `phClr`-dependent). */
  color?: string;
  opacity?: number;
  /** Gradient-specific fields (only present when `kind === "gradient"`). */
  gradientStops?: Array<{ color: string; position: number; opacity?: number }>;
  gradientAngle?: number;
  gradientType?: "linear" | "radial";
  gradientCss?: string;
  /** Pattern-specific fields (only present when `kind === "pattern"`). */
  patternPreset?: string;
  patternBackgroundColor?: string;
  /** Raw XML node preserved for `phClr` re-resolution. */
  rawNode?: unknown;
}

/**
 * A single line style entry from `a:lnStyleLst`.
 * Provides width, dash, join, cap, and optional fill colour.
 *
 * @example
 * ```ts
 * const line: PptxThemeLineStyle = {
 *   width: 1.5,
 *   color: "#4F81BD",
 *   dash: "solid",
 *   lineJoin: "round",
 *   lineCap: "flat",
 * };
 * // => satisfies PptxThemeLineStyle
 * ```
 */
export interface PptxThemeLineStyle {
  /** Line width in pixels (converted from EMU). */
  width?: number;
  color?: string;
  opacity?: number;
  dash?: string;
  lineJoin?: "round" | "bevel" | "miter";
  lineCap?: "flat" | "rnd" | "sq";
  compoundLine?: "sng" | "dbl" | "thickThin" | "thinThick" | "tri";
  /** Raw XML node preserved for `phClr` re-resolution. */
  rawNode?: unknown;
}

/**
 * A single effect style entry from `a:effectStyleLst`.
 * Each entry may define shadow, glow, soft-edge, reflection, blur,
 * and optionally a 3-D scene/shape.
 *
 * @example
 * ```ts
 * const dropShadow: PptxThemeEffectStyle = {
 *   shadowColor: "#000000",
 *   shadowBlur: 4,
 *   shadowOffsetX: 2,
 *   shadowOffsetY: 3,
 *   shadowOpacity: 0.4,
 * };
 * // => satisfies PptxThemeEffectStyle
 * ```
 */
export interface PptxThemeEffectStyle {
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowOpacity?: number;
  glowColor?: string;
  glowRadius?: number;
  glowOpacity?: number;
  softEdgeRadius?: number;
  innerShadowColor?: string;
  innerShadowOpacity?: number;
  innerShadowBlur?: number;
  innerShadowOffsetX?: number;
  innerShadowOffsetY?: number;
  reflectionBlurRadius?: number;
  reflectionStartOpacity?: number;
  reflectionEndOpacity?: number;
  reflectionEndPosition?: number;
  reflectionDirection?: number;
  reflectionRotation?: number;
  reflectionDistance?: number;
  /** 3D scene/camera from `a:scene3d` on the effect style (idx 3 typically). */
  scene3d?: import("./three-d").Pptx3DScene;
  /** 3D shape extrusion/bevel from `a:sp3d` on the effect style (idx 3 typically). */
  shape3d?: import("./three-d").Pptx3DShape;
  /** Raw XML node preserved for `phClr` re-resolution. */
  rawNode?: unknown;
}

/**
 * The full parsed format scheme from `a:fmtScheme` inside `a:themeElements`.
 * Contains three fill style lists and one line/effect style list each,
 * at three intensity levels: subtle (idx 1), moderate (idx 2), intense (idx 3).
 *
 * OOXML reference indices:
 * - fillStyleLst:   idx 1-3  (used by `a:fillRef @idx` 1-3)
 * - lnStyleLst:     idx 1-3  (used by `a:lnRef @idx` 1-3)
 * - effectStyleLst:  idx 1-3  (used by `a:effectRef @idx` 1-3)
 * - bgFillStyleLst:  idx 1-3  (used by `a:fillRef @idx` 1001-1003)
 *
 * @example
 * ```ts
 * const fmt: PptxThemeFormatScheme = {
 *   name: "Office",
 *   fillStyles: [solidFill, gradientFill, intenseFill],
 *   lineStyles: [thinLine, mediumLine, thickLine],
 *   effectStyles: [subtle, moderate, intense],
 *   backgroundFillStyles: [solidBg, gradientBg, intenseBg],
 * };
 * // => satisfies PptxThemeFormatScheme
 * ```
 */
export interface PptxThemeFormatScheme {
  /** The `@name` attribute of the format scheme. */
  name?: string;
  /** Fill styles at indices 1-3 (subtle, moderate, intense). */
  fillStyles: PptxThemeFillStyle[];
  /** Line styles at indices 1-3. */
  lineStyles: PptxThemeLineStyle[];
  /** Effect styles at indices 1-3. */
  effectStyles: PptxThemeEffectStyle[];
  /** Background fill styles at indices 1-3 (referenced via idx 1001-1003). */
  backgroundFillStyles: PptxThemeFillStyle[];
}

/**
 * Full parsed theme object available to renderers.
 *
 * @example
 * ```ts
 * const theme: PptxTheme = {
 *   name: "Office Theme",
 *   colorScheme: { dk1: "#000", lt1: "#FFF", /* … *\/ },
 *   fontScheme: {
 *     majorFont: { latin: "Calibri Light" },
 *     minorFont: { latin: "Calibri" },
 *   },
 * };
 * // => satisfies PptxTheme
 * ```
 */
export interface PptxTheme {
  /** Theme name from `a:theme @name`. */
  name?: string;
  /** Resolved colour scheme. */
  colorScheme?: PptxThemeColorScheme;
  /** Resolved font scheme. */
  fontScheme?: PptxThemeFontScheme;
  /** Format scheme — fill, line, effect and background fill style matrices. */
  formatScheme?: PptxThemeFormatScheme;
}
