import React from "react";

import { cn } from "../../utils";
import type {
  PptxPresentationProperties,
  PptxThemeOption,
} from "pptx-viewer-core";
import type { CanvasSize } from "../../types";
import { CARD, HEADING, INPUT, BTN } from "./inspector-pane-constants";

// ---------------------------------------------------------------------------
// Checkbox helper
// ---------------------------------------------------------------------------

export function CheckboxRow({
  label,
  disabled,
  checked,
  onChange,
}: {
  label: string;
  disabled: boolean;
  checked: boolean;
  onChange: (val: boolean) => void;
}): React.ReactElement {
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <input
        type="checkbox"
        disabled={disabled}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

// ---------------------------------------------------------------------------
// Presentation Settings Card
// ---------------------------------------------------------------------------

export function PresentationSettingsCard({
  presentationProperties,
  canEdit,
  onUpdate,
}: {
  presentationProperties: PptxPresentationProperties;
  canEdit: boolean;
  onUpdate: (patch: Partial<PptxPresentationProperties>) => void;
}): React.ReactElement {
  return (
    <div className={CARD}>
      <div className={HEADING}>Presentation</div>
      <div className="space-y-1.5 text-[11px]">
        <label className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Show Type</span>
          <select
            disabled={!canEdit}
            className={cn(INPUT, "w-28")}
            value={presentationProperties.showType ?? "presented"}
            onChange={(e) =>
              onUpdate({
                showType: e.target.value as "presented" | "browsed" | "kiosk",
              })
            }
          >
            <option value="presented">Presented</option>
            <option value="browsed">Browsed</option>
            <option value="kiosk">Kiosk</option>
          </select>
        </label>
        <CheckboxRow
          label="Loop Continuously"
          disabled={!canEdit}
          checked={Boolean(presentationProperties.loopContinuously)}
          onChange={(v) => onUpdate({ loopContinuously: v })}
        />
        <CheckboxRow
          label="Show Narration"
          disabled={!canEdit}
          checked={presentationProperties.showWithNarration !== false}
          onChange={(v) => onUpdate({ showWithNarration: v })}
        />
        <CheckboxRow
          label="Show Animation"
          disabled={!canEdit}
          checked={presentationProperties.showWithAnimation !== false}
          onChange={(v) => onUpdate({ showWithAnimation: v })}
        />
        <CheckboxRow
          label="Frame Slides"
          disabled={!canEdit}
          checked={Boolean(presentationProperties.printFrameSlides)}
          onChange={(v) => onUpdate({ printFrameSlides: v })}
        />
        <label className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Slides/Page</span>
          <input
            type="number"
            min={1}
            max={16}
            disabled={!canEdit}
            className={cn(INPUT, "w-20")}
            value={presentationProperties.printSlidesPerPage ?? 1}
            onChange={(e) =>
              onUpdate({ printSlidesPerPage: Number(e.target.value) })
            }
          />
        </label>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Theme Selector Card
// ---------------------------------------------------------------------------

export function ThemeSelectorCard({
  themeOptions,
  selectedThemePath,
  setSelectedThemePath,
  canEdit,
  onApplyTheme,
}: {
  themeOptions: PptxThemeOption[];
  selectedThemePath: string;
  setSelectedThemePath: (path: string) => void;
  canEdit: boolean;
  onApplyTheme: (path: string, allMasters: boolean) => void;
}): React.ReactElement {
  return (
    <div className={CARD}>
      <div className={HEADING}>Theme</div>
      <div className="space-y-2 text-[11px]">
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground">Theme</span>
          <select
            disabled={themeOptions.length === 0}
            className={INPUT}
            value={selectedThemePath}
            onChange={(e) => setSelectedThemePath(e.target.value)}
          >
            {themeOptions.length === 0 ? (
              <option value="">No themes</option>
            ) : (
              themeOptions.map((opt) => (
                <option key={opt.path} value={opt.path}>
                  {opt.name || opt.path.split("/").pop()}
                </option>
              ))
            )}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            className={BTN}
            disabled={!canEdit || !selectedThemePath}
            onClick={() => onApplyTheme(selectedThemePath, false)}
          >
            Apply First Master
          </button>
          <button
            type="button"
            className={BTN}
            disabled={!canEdit || !selectedThemePath}
            onClick={() => onApplyTheme(selectedThemePath, true)}
          >
            Apply All Masters
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slide Size Card
// ---------------------------------------------------------------------------

export function SlideSizeCard({
  canvasSize,
  canEdit,
  onUpdate,
}: {
  canvasSize: CanvasSize;
  canEdit: boolean;
  onUpdate: (size: CanvasSize) => void;
}): React.ReactElement {
  return (
    <div className={CARD}>
      <div className={HEADING}>Slide Size</div>
      <div className="grid grid-cols-2 gap-1.5 text-[11px]">
        {(
          [
            ["W", "width"],
            ["H", "height"],
          ] as const
        ).map(([label, key]) => (
          <label key={key} className="flex items-center gap-1">
            <span className="text-muted-foreground">{label}</span>
            <input
              type="number"
              className={INPUT}
              disabled={!canEdit}
              value={canvasSize[key]}
              onChange={(e) =>
                onUpdate({ ...canvasSize, [key]: Number(e.target.value) })
              }
            />
          </label>
        ))}
      </div>
    </div>
  );
}
