import React from "react";
import { LuCheck } from "react-icons/lu";

import { cn } from "../../utils";
import type { ThemeDefinition } from "./theme-gallery-types";

export interface ThemeThumbnailProps {
  theme: ThemeDefinition;
  selected: boolean;
  onClick: () => void;
}

export function ThemeThumbnail({
  theme,
  selected,
  onClick,
}: ThemeThumbnailProps): React.ReactElement {
  const { colorScheme } = theme;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex flex-col rounded-lg border-2 transition-all overflow-hidden",
        selected
          ? "border-primary shadow-lg scale-[1.02]"
          : "border-border hover:border-primary/50 hover:shadow-md",
      )}
      title={theme.name}
    >
      {/* Color preview bars */}
      <div className="h-24 flex flex-col">
        {/* Title/header bar with accent colors */}
        <div className="h-10 flex">
          <div
            className="flex-1"
            style={{ backgroundColor: colorScheme.accent1 }}
          />
          <div
            className="flex-1"
            style={{ backgroundColor: colorScheme.accent2 }}
          />
          <div
            className="flex-1"
            style={{ backgroundColor: colorScheme.accent3 }}
          />
        </div>
        {/* Content area with dark/light colors */}
        <div className="flex-1 flex">
          <div className="w-1/3" style={{ backgroundColor: colorScheme.dk2 }} />
          <div
            className="flex-1"
            style={{ backgroundColor: colorScheme.lt2 }}
          />
        </div>
      </div>

      {/* Theme name */}
      <div className="bg-background border-t border-border px-2 py-1.5">
        <p className="text-xs font-medium text-foreground text-center">
          {theme.name}
        </p>
      </div>

      {/* Selected indicator */}
      {selected && (
        <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-1">
          <LuCheck className="w-3 h-3" />
        </div>
      )}
    </button>
  );
}
