import React from "react";
import { useTranslation } from "react-i18next";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Arrow labels for direction tokens. */
export const DIR_ARROWS: Record<string, string> = {
  l: "\u2190",
  r: "\u2192",
  u: "\u2191",
  d: "\u2193",
  lu: "\u2196",
  ld: "\u2199",
  ru: "\u2197",
  rd: "\u2198",
  in: "\u25C9",
  out: "\u25CE",
  horz: "\u2194",
  vert: "\u2195",
};

/** Grid positions for 4/8-direction layout. */
const GRID_POSITIONS: Record<string, [number, number]> = {
  lu: [0, 0],
  u: [0, 1],
  ru: [0, 2],
  l: [1, 0],
  r: [1, 2],
  ld: [2, 0],
  d: [2, 1],
  rd: [2, 2],
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DirectionPickerProps {
  directions: readonly string[];
  value: string | undefined;
  onChange: (dir: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DirectionPicker({
  directions,
  value,
  onChange,
}: DirectionPickerProps): React.ReactElement {
  const { t } = useTranslation();

  if (directions.length <= 3) {
    return (
      <div className="flex gap-1">
        {directions.map((dir) => (
          <button
            key={dir}
            type="button"
            onClick={() => onChange(dir)}
            className={`px-2 py-1 rounded text-xs border ${
              value === dir
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted border-border hover:bg-accent"
            }`}
            title={t(`pptx.transition.dir.${dir}`, dir)}
          >
            {DIR_ARROWS[dir] ?? dir}
          </button>
        ))}
      </div>
    );
  }

  const cells: (string | null)[][] = [
    [null, null, null],
    [null, null, null],
    [null, null, null],
  ];

  for (const dir of directions) {
    const pos = GRID_POSITIONS[dir];
    if (pos) cells[pos[0]][pos[1]] = dir;
  }

  return (
    <div className="inline-grid grid-cols-3 gap-0.5">
      {cells.flatMap((row, ri) =>
        row.map((cell, ci) => {
          if (!cell) return <div key={`${ri}-${ci}`} className="w-6 h-6" />;
          return (
            <button
              key={cell}
              type="button"
              onClick={() => onChange(cell)}
              className={`w-6 h-6 rounded text-xs flex items-center justify-center border ${
                value === cell
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted border-border hover:bg-accent"
              }`}
              title={t(`pptx.transition.dir.${cell}`, cell)}
            >
              {DIR_ARROWS[cell] ?? cell}
            </button>
          );
        }),
      )}
    </div>
  );
}
