import type { XmlObject, PptxThemeColorScheme } from "../types";
import { THEME_COLOR_SCHEME_KEYS } from "../types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * The 12 logical colour-map alias keys used in `p:clrMap` and
 * `a:overrideClrMapping`.  Each alias maps to a theme colour slot
 * (e.g. `bg1` → `lt1`).
 */
export const COLOR_MAP_ALIAS_KEYS = [
  "bg1",
  "tx1",
  "bg2",
  "tx2",
  "accent1",
  "accent2",
  "accent3",
  "accent4",
  "accent5",
  "accent6",
  "hlink",
  "folHlink",
] as const;

export type ColorMapAliasKey = (typeof COLOR_MAP_ALIAS_KEYS)[number];

/**
 * The default colour-map used by PowerPoint when no override is
 * present.  Alias → theme colour slot.
 */
export const DEFAULT_COLOR_MAP: Record<ColorMapAliasKey, string> = {
  bg1: "lt1",
  tx1: "dk1",
  bg2: "lt2",
  tx2: "dk2",
  accent1: "accent1",
  accent2: "accent2",
  accent3: "accent3",
  accent4: "accent4",
  accent5: "accent5",
  accent6: "accent6",
  hlink: "hlink",
  folHlink: "folHlink",
};

// ---------------------------------------------------------------------------
// Build XML
// ---------------------------------------------------------------------------

/**
 * Build a `p:clrMapOvr` XML object from a colour-map override record.
 *
 * - When `override` is `null` or empty, returns `<a:masterClrMapping/>`
 *   (inherit from master — the OOXML default).
 * - When keys are provided, returns `<a:overrideClrMapping .../>` with
 *   all 12 alias attributes populated.  Missing keys fall back to the
 *   standard default mapping.
 *
 * @returns An `XmlObject` suitable for assigning to `slideNode["p:clrMapOvr"]`.
 */
export function buildClrMapOverrideXml(
  override: Record<string, string> | null | undefined,
): XmlObject {
  if (!override || Object.keys(override).length === 0) {
    return { "a:masterClrMapping": {} };
  }

  const attrs: Record<string, string> = {};
  for (const key of COLOR_MAP_ALIAS_KEYS) {
    // Use the override value if present; otherwise fall back to default
    attrs[`@_${key}`] = override[key] ?? DEFAULT_COLOR_MAP[key];
  }

  return { "a:overrideClrMapping": attrs };
}

// ---------------------------------------------------------------------------
// Merge helpers
// ---------------------------------------------------------------------------

/**
 * Merge a colour-map override into a base theme colour scheme to
 * produce the effective per-slide colour scheme.
 *
 * The override maps logical aliases (e.g. `bg1`) to theme colour
 * slots (e.g. `dk1`), effectively re-wiring which colour each alias
 * resolves to.
 *
 * @param base     The presentation-level theme colour scheme.
 * @param override Per-slide `clrMapOverride` record (`alias → slot`).
 * @returns A new `PptxThemeColorScheme` with overrides applied.
 */
export function mergeThemeColorOverride(
  base: PptxThemeColorScheme,
  override: Record<string, string> | null | undefined,
): PptxThemeColorScheme {
  if (!override || Object.keys(override).length === 0) {
    return { ...base };
  }

  // Build a lookup of slot → colour from the base scheme.
  const slotLookup: Record<string, string> = {};
  for (const key of THEME_COLOR_SCHEME_KEYS) {
    slotLookup[key] = base[key];
  }
  // Also add alias defaults so overrides like `bg1 → dk1` can resolve
  slotLookup["bg1"] = base.lt1;
  slotLookup["tx1"] = base.dk1;
  slotLookup["bg2"] = base.lt2;
  slotLookup["tx2"] = base.dk2;

  const result: PptxThemeColorScheme = { ...base };

  // For each override entry, resolve the target slot to a colour.
  for (const [alias, targetSlot] of Object.entries(override)) {
    const resolvedColor =
      slotLookup[targetSlot] ?? base[targetSlot as keyof PptxThemeColorScheme];
    if (!resolvedColor) continue;

    // Map the alias back to its canonical scheme key position.
    switch (alias) {
      case "bg1":
        result.lt1 = resolvedColor;
        break;
      case "tx1":
        result.dk1 = resolvedColor;
        break;
      case "bg2":
        result.lt2 = resolvedColor;
        break;
      case "tx2":
        result.dk2 = resolvedColor;
        break;
      default: {
        // Direct scheme key overrides (accent1–accent6, hlink, folHlink)
        const schemeKey = alias as keyof PptxThemeColorScheme;
        if (schemeKey in result) {
          result[schemeKey] = resolvedColor;
        }
        break;
      }
    }
  }

  return result;
}

/**
 * Check whether an override record represents a non-identity mapping
 * (i.e., at least one alias maps to a different slot than the default).
 */
export function hasNonTrivialOverride(
  override: Record<string, string> | null | undefined,
): boolean {
  if (!override) return false;
  for (const key of COLOR_MAP_ALIAS_KEYS) {
    const overrideValue = override[key];
    if (overrideValue && overrideValue !== DEFAULT_COLOR_MAP[key]) {
      return true;
    }
  }
  return false;
}
