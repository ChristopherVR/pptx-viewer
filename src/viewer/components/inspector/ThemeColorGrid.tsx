import React, { useMemo } from "react";

import type { PptxTheme } from "../../../core/types";
import { buildThemeColorGrid } from "../../utils/theme";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ThemeColorGridProps {
  /** Full theme object (if available). */
  theme: PptxTheme | undefined;
  /** Called when a colour is selected. Receives raw hex string. */
  onSelectColor: (hex: string) => void;
  /** Title label displayed above the grid. */
  label?: string;
  /** Currently selected colour (for highlight ring). */
  selectedColor?: string;
  /** Whether the grid should be disabled. */
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * A 12×6 theme colour picker grid matching PowerPoint's built-in
 * theme colour palette. Shows the 12 base scheme colours in the
 * first row, with 5 tint/shade variations below each.
 */
export function ThemeColorGrid({
  theme,
  onSelectColor,
  label = "Theme Colors",
  selectedColor,
  disabled,
}: ThemeColorGridProps): React.ReactElement | null {
  const grid = useMemo(() => {
    if (!theme?.colorScheme) return null;
    return buildThemeColorGrid(theme.colorScheme);
  }, [theme]);

  if (!grid) return null;

  const normalizedSelected = selectedColor?.toUpperCase().replace(/^#/, "");

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="flex flex-col gap-px">
        {grid.map((row, rowIdx) => (
          <div key={rowIdx} className="grid grid-cols-12 gap-px">
            {row.map((cell) => {
              const cellNorm = cell.hex.toUpperCase().replace(/^#/, "");
              const isSelected = normalizedSelected === cellNorm;
              return (
                <button
                  key={`${cell.schemeKey}-${rowIdx}`}
                  type="button"
                  disabled={disabled}
                  className={`h-4 w-full rounded-sm border transition-colors ${
                    isSelected
                      ? "border-primary ring-1 ring-primary"
                      : "border-border hover:border-foreground"
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                  style={{ backgroundColor: cell.hex }}
                  title={`${cell.colLabel} — ${cell.rowLabel} (${cell.hex})`}
                  onClick={() => onSelectColor(cell.hex)}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
