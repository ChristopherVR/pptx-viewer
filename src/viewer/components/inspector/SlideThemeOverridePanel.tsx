import React, { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { PptxSlide, PptxTheme } from "../../../core/types";
import {
  COLOR_MAP_ALIAS_KEYS,
  DEFAULT_COLOR_MAP,
  hasNonTrivialOverride,
  type ColorMapAliasKey,
} from "../../../core/utils/theme-override-utils";
import { THEME_COLOR_SCHEME_KEYS } from "../../../core/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SlideThemeOverridePanelProps {
  activeSlide: PptxSlide | undefined;
  theme: PptxTheme | undefined;
  canEdit: boolean;
  onUpdateSlide: (updates: Partial<PptxSlide>) => void;
}

// ---------------------------------------------------------------------------
// Friendly labels for the alias keys
// ---------------------------------------------------------------------------

const ALIAS_LABELS: Record<ColorMapAliasKey, string> = {
  bg1: "Background 1",
  tx1: "Text 1",
  bg2: "Background 2",
  tx2: "Text 2",
  accent1: "Accent 1",
  accent2: "Accent 2",
  accent3: "Accent 3",
  accent4: "Accent 4",
  accent5: "Accent 5",
  accent6: "Accent 6",
  hlink: "Hyperlink",
  folHlink: "Followed Hyperlink",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Inspector panel section that allows enabling / editing a per-slide
 * colour-map override (`p:clrMapOvr / a:overrideClrMapping`).
 */
export function SlideThemeOverridePanel({
  activeSlide,
  theme,
  canEdit,
  onUpdateSlide,
}: SlideThemeOverridePanelProps): React.ReactElement | null {
  const { t } = useTranslation();

  const override = activeSlide?.clrMapOverride;
  const isOverrideActive = hasNonTrivialOverride(override);

  /** All possible target slots a logical alias can point to. */
  const targetSlotOptions = useMemo(() => [...THEME_COLOR_SCHEME_KEYS], []);

  const handleToggle = useCallback(
    (enabled: boolean) => {
      if (enabled) {
        // Activate with default mapping (identity)
        const defaultMap: Record<string, string> = {};
        for (const key of COLOR_MAP_ALIAS_KEYS) {
          defaultMap[key] = DEFAULT_COLOR_MAP[key];
        }
        onUpdateSlide({ clrMapOverride: defaultMap });
      } else {
        onUpdateSlide({ clrMapOverride: undefined });
      }
    },
    [onUpdateSlide],
  );

  const handleAliasChange = useCallback(
    (alias: ColorMapAliasKey, targetSlot: string) => {
      const current = override ?? {};
      const next = { ...current, [alias]: targetSlot };
      // Fill in defaults for any missing aliases
      for (const key of COLOR_MAP_ALIAS_KEYS) {
        if (!next[key]) {
          next[key] = DEFAULT_COLOR_MAP[key];
        }
      }
      onUpdateSlide({ clrMapOverride: next });
    },
    [override, onUpdateSlide],
  );

  /**
   * Resolve a theme colour slot to its hex value for preview.
   */
  const resolveSlotColor = useCallback(
    (slot: string): string | undefined => {
      if (!theme?.colorScheme) return undefined;
      const cs = theme.colorScheme;
      return cs[slot as keyof typeof cs];
    },
    [theme],
  );

  if (!activeSlide) return null;

  return (
    <div className="space-y-2">
      <label className="inline-flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          disabled={!canEdit}
          checked={isOverrideActive}
          onChange={(e) => handleToggle(e.target.checked)}
        />
        {t("pptx.themeOverride.enableOverride")}
      </label>

      {isOverrideActive && override && (
        <div className="space-y-1.5">
          {COLOR_MAP_ALIAS_KEYS.map((alias) => {
            const currentTarget = override[alias] ?? DEFAULT_COLOR_MAP[alias];
            const resolvedHex = resolveSlotColor(currentTarget);

            return (
              <div key={alias} className="flex items-center gap-2 text-[11px]">
                <span
                  className="w-24 truncate text-muted-foreground"
                  title={ALIAS_LABELS[alias]}
                >
                  {ALIAS_LABELS[alias]}
                </span>
                <div
                  className="h-4 w-4 rounded-sm border border-border shrink-0"
                  style={{
                    backgroundColor: resolvedHex
                      ? `#${resolvedHex.replace(/^#/, "")}`
                      : undefined,
                  }}
                />
                <select
                  disabled={!canEdit}
                  className="flex-1 bg-muted border border-border rounded px-1 py-0.5 text-[11px]"
                  value={currentTarget}
                  onChange={(e) => handleAliasChange(alias, e.target.value)}
                >
                  {targetSlotOptions.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
