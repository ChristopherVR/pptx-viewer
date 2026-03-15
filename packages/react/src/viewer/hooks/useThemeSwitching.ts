/**
 * useThemeSwitching — React hook for switching presentation themes.
 *
 * Provides a list of built-in theme presets and functions to apply them
 * to the current presentation, updating all element colours immediately.
 */
import { useCallback, useMemo, type RefObject } from "react";
import {
  THEME_PRESETS,
  applyThemeToData,
  type PptxHandler,
  type PptxData,
  type PptxThemeColorScheme,
  type PptxThemeFontScheme,
  type PptxThemePreset,
} from "pptx-viewer-core";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseThemeSwitchingInput {
  /** Ref to the PptxHandler instance. */
  handlerRef: RefObject<PptxHandler | null>;
  /** Current parsed presentation data (null when nothing is loaded). */
  data: PptxData | null;
  /** Callback to update the presentation data after theme switch. */
  onDataChange: (newData: PptxData) => void;
  /** Optional callback fired when theme switch completes successfully. */
  onThemeChanged?: (preset: PptxThemePreset) => void;
}

export interface ThemeSwitchingResult {
  /** All available built-in theme presets. */
  presets: readonly PptxThemePreset[];

  /**
   * Apply a theme preset to the current presentation.
   * Updates both the in-memory ZIP and all resolved element colours.
   */
  switchToPreset: (preset: PptxThemePreset) => Promise<void>;

  /**
   * Apply a custom colour scheme (and optional font scheme) to the
   * current presentation.
   */
  switchToCustom: (
    colorScheme: PptxThemeColorScheme,
    fontScheme?: PptxThemeFontScheme,
    themeName?: string,
  ) => Promise<void>;

  /**
   * Get the preset matching the current presentation theme (if any).
   * Returns undefined if the current theme does not match a built-in preset.
   */
  currentPreset: PptxThemePreset | undefined;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compare two colour schemes for equality (case-insensitive hex comparison).
 */
function colorSchemesMatch(
  a: PptxThemeColorScheme | undefined,
  b: PptxThemeColorScheme,
): boolean {
  if (!a) return false;
  const normalize = (hex: string) =>
    hex.replace(/^#/, "").toUpperCase().slice(0, 6);
  return (
    normalize(a.dk1) === normalize(b.dk1) &&
    normalize(a.lt1) === normalize(b.lt1) &&
    normalize(a.dk2) === normalize(b.dk2) &&
    normalize(a.lt2) === normalize(b.lt2) &&
    normalize(a.accent1) === normalize(b.accent1) &&
    normalize(a.accent2) === normalize(b.accent2) &&
    normalize(a.accent3) === normalize(b.accent3) &&
    normalize(a.accent4) === normalize(b.accent4) &&
    normalize(a.accent5) === normalize(b.accent5) &&
    normalize(a.accent6) === normalize(b.accent6) &&
    normalize(a.hlink) === normalize(b.hlink) &&
    normalize(a.folHlink) === normalize(b.folHlink)
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * React hook providing theme switching capabilities for the PowerPoint viewer.
 *
 * @example
 * ```tsx
 * const { presets, switchToPreset, currentPreset } = useThemeSwitching({
 *   handlerRef,
 *   data,
 *   onDataChange: setData,
 * });
 *
 * return (
 *   <div>
 *     {presets.map(preset => (
 *       <button
 *         key={preset.id}
 *         onClick={() => switchToPreset(preset)}
 *         aria-pressed={preset.id === currentPreset?.id}
 *       >
 *         {preset.name}
 *       </button>
 *     ))}
 *   </div>
 * );
 * ```
 */
export function useThemeSwitching(
  input: UseThemeSwitchingInput,
): ThemeSwitchingResult {
  const { handlerRef, data, onDataChange, onThemeChanged } = input;

  const switchToPreset = useCallback(
    async (preset: PptxThemePreset) => {
      const handler = handlerRef.current;
      if (!handler || !data) return;

      try {
        // Update the ZIP-level theme data for save round-trip
        await handler.applyTheme(
          preset.colorScheme,
          preset.fontScheme,
          preset.name,
        );

        // Re-resolve all element colours in the parsed data
        const newData = applyThemeToData(
          data,
          preset.colorScheme,
          preset.fontScheme,
          preset.name,
        );

        onDataChange(newData);
        onThemeChanged?.(preset);
      } catch (error) {
        console.error("Failed to switch theme preset:", error);
      }
    },
    [handlerRef, data, onDataChange, onThemeChanged],
  );

  const switchToCustom = useCallback(
    async (
      colorScheme: PptxThemeColorScheme,
      fontScheme?: PptxThemeFontScheme,
      themeName?: string,
    ) => {
      const handler = handlerRef.current;
      if (!handler || !data) return;

      try {
        await handler.applyTheme(colorScheme, fontScheme ?? {}, themeName);

        const newData = applyThemeToData(
          data,
          colorScheme,
          fontScheme,
          themeName,
        );

        onDataChange(newData);
      } catch (error) {
        console.error("Failed to switch to custom theme:", error);
      }
    },
    [handlerRef, data, onDataChange],
  );

  const currentPreset = useMemo(() => {
    if (!data?.theme?.colorScheme) return undefined;
    return THEME_PRESETS.find((p) =>
      colorSchemesMatch(data.theme?.colorScheme, p.colorScheme),
    );
  }, [data?.theme?.colorScheme]);

  return {
    presets: THEME_PRESETS,
    switchToPreset,
    switchToCustom,
    currentPreset,
  };
}
