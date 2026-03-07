import React from "react";

import type { RangeSliderProps } from "./image-properties-types";

// ---------------------------------------------------------------------------
// Range slider used by image adjustment panels
// ---------------------------------------------------------------------------

export function RangeSlider({
  label,
  disabled,
  value,
  onChange,
}: RangeSliderProps): React.ReactElement {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-muted-foreground">{label}</span>
      <input
        type="range"
        min={-100}
        max={100}
        disabled={disabled}
        className="accent-primary"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
