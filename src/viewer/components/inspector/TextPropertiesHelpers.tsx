import React from "react";
import {
  LuBold,
  LuItalic,
  LuUnderline,
  LuStrikethrough,
  LuAlignLeft,
  LuAlignCenter,
  LuAlignRight,
  LuAlignJustify,
} from "react-icons/lu";

import type {
  PptxElement,
  TextStyle,
  UnderlineStyle,
} from "../../../core";
import type { ListMode } from "../../utils";
import { normalizeHexColor } from "../../utils";

export interface TextPropertiesProps {
  selectedElement: PptxElement;
  selectedTextStyle: TextStyle | undefined;
  selectedTextAlignment: string;
  selectedListMode: ListMode;
  spellCheckEnabled: boolean;
  recentColors: string[];
  canEdit: boolean;
  onUpdateElement: (updates: Partial<PptxElement>) => void;
  onUpdateTextStyle: (updates: Partial<TextStyle>) => void;
  onSetTextColor: (color: string) => void;
  onToggleTextFlag: (flag: string) => void;
  onEditHyperlink: () => void;
  onApplyListMode: (mode: ListMode) => void;
  onSetTextAlignment: (align: string) => void;
}

export const INPUT_CLS = "bg-muted border border-border rounded px-2 py-1";
export const COLOR_CLS = "h-8 bg-muted border border-border rounded px-1";

export const STYLE_TOGGLES = [
  { key: "bold" as const, Icon: LuBold, label: "Bold" },
  { key: "italic" as const, Icon: LuItalic, label: "Italic" },
  { key: "underline" as const, Icon: LuUnderline, label: "Underline" },
  {
    key: "strikethrough" as const,
    Icon: LuStrikethrough,
    label: "Strikethrough",
  },
];

export const ALIGN_OPTIONS = [
  { value: "left", Icon: LuAlignLeft },
  { value: "center", Icon: LuAlignCenter },
  { value: "right", Icon: LuAlignRight },
  { value: "justify", Icon: LuAlignJustify },
] as const;

export const UNDERLINE_STYLES: Array<[UnderlineStyle, string]> = [
  ["sng", "Single"],
  ["dbl", "Double"],
  ["heavy", "Heavy"],
  ["dotted", "Dotted"],
  ["dottedHeavy", "Dotted Heavy"],
  ["dash", "Dash"],
  ["dashHeavy", "Dash Heavy"],
  ["dashLong", "Long Dash"],
  ["dashLongHeavy", "Long Dash Heavy"],
  ["dotDash", "Dot Dash"],
  ["dotDashHeavy", "Dot Dash Heavy"],
  ["dotDotDash", "Dot Dot Dash"],
  ["dotDotDashHeavy", "Dot Dot Dash Heavy"],
  ["wavy", "Wavy"],
  ["wavyHeavy", "Wavy Heavy"],
  ["wavyDbl", "Wavy Double"],
  ["none", "None"],
];

export const TEXT_DIRECTIONS: Array<[string, string]> = [
  ["horizontal", "Horizontal"],
  ["vertical", "Vertical"],
  ["vertical270", "Vertical 270"],
];

export const BASELINE_TOGGLES: Array<[string, number]> = [
  ["Superscript", 30000],
  ["Subscript", -25000],
];

export function createNumericChangeHandler(
  onUpdateTextStyle: (updates: Partial<TextStyle>) => void,
) {
  return (fn: (v: number) => Partial<TextStyle>) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Number(e.target.value);
      if (Number.isFinite(v)) onUpdateTextStyle(fn(v));
    };
}

interface AdvancedTextFormattingProps {
  ts: TextStyle | undefined;
  canEdit: boolean;
  onUpdateTextStyle: (updates: Partial<TextStyle>) => void;
  numChange: (
    fn: (v: number) => Partial<TextStyle>,
  ) => (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function AdvancedTextFormatting({
  ts,
  canEdit,
  onUpdateTextStyle,
  numChange,
}: AdvancedTextFormattingProps): React.ReactElement {
  return (
    <div className="mt-2 rounded border border-border bg-card p-2 space-y-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        Advanced Text
      </div>

      {/* Superscript / Subscript */}
      <div className="grid grid-cols-2 gap-2">
        {BASELINE_TOGGLES.map(([label, baseline]) => (
          <label
            key={label}
            className="inline-flex items-center gap-2 text-foreground"
          >
            <input
              type="checkbox"
              checked={ts?.baseline === baseline}
              onChange={() =>
                onUpdateTextStyle({
                  baseline: ts?.baseline === baseline ? 0 : baseline,
                })
              }
            />
            {label}
          </label>
        ))}
      </div>

      {/* Highlight */}
      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground">Highlight</span>
        <input
          type="color"
          value={normalizeHexColor(ts?.highlightColor, "#ffff00")}
          onChange={(e) =>
            onUpdateTextStyle({ highlightColor: e.target.value })
          }
          disabled={!canEdit}
          className={COLOR_CLS}
        />
      </label>

      {/* Underline Style + Colour */}
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground">Underline Style</span>
          <select
            value={ts?.underlineStyle || "sng"}
            disabled={!canEdit}
            onChange={(e) =>
              onUpdateTextStyle({
                underline: true,
                underlineStyle: e.target.value as UnderlineStyle,
              })
            }
            className={INPUT_CLS}
          >
            {UNDERLINE_STYLES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground">Underline Colour</span>
          <input
            type="color"
            value={ts?.underlineColor || ts?.color || "#000000"}
            onChange={(e) =>
              onUpdateTextStyle({ underlineColor: e.target.value })
            }
            className={COLOR_CLS}
          />
        </label>
      </div>

      {/* Text Outline */}
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground">Outline Width</span>
          <input
            type="number"
            min={0}
            max={10}
            step={0.5}
            value={ts?.textOutlineWidth ?? 0}
            onChange={(e) =>
              onUpdateTextStyle({
                textOutlineWidth: parseFloat(e.target.value) || 0,
              })
            }
            className={INPUT_CLS}
          />
        </label>
        {(ts?.textOutlineWidth ?? 0) > 0 && (
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">Outline Colour</span>
            <input
              type="color"
              value={ts?.textOutlineColor || "#000000"}
              onChange={(e) =>
                onUpdateTextStyle({ textOutlineColor: e.target.value })
              }
              className={COLOR_CLS}
            />
          </label>
        )}
      </div>

      {/* Character Spacing */}
      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground">Character Spacing</span>
        <input
          type="number"
          min={-1000}
          max={5000}
          step={50}
          value={Math.round(ts?.characterSpacing ?? 0)}
          disabled={!canEdit}
          onChange={numChange((v) => ({ characterSpacing: v }))}
          className={INPUT_CLS}
        />
      </label>

      {/* Paragraph Margins & Indent */}
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground">Left Margin</span>
          <input
            type="number"
            min={0}
            max={500}
            step={4}
            value={Math.round(ts?.paragraphMarginLeft ?? 0)}
            disabled={!canEdit}
            onChange={numChange((v) => ({
              paragraphMarginLeft: Math.max(0, Math.min(500, v)),
            }))}
            className={INPUT_CLS}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground">First Indent</span>
          <input
            type="number"
            min={-500}
            max={500}
            step={4}
            value={Math.round(ts?.paragraphIndent ?? 0)}
            disabled={!canEdit}
            onChange={numChange((v) => ({
              paragraphIndent: Math.max(-500, Math.min(500, v)),
            }))}
            className={INPUT_CLS}
          />
        </label>
      </div>

      {/* Auto-fit */}
      <label className="inline-flex items-center gap-2 text-foreground">
        <input
          type="checkbox"
          checked={Boolean(ts?.autoFit)}
          disabled={!canEdit}
          onChange={(e) => onUpdateTextStyle({ autoFit: e.target.checked })}
        />
        Auto-fit text to shape
      </label>
    </div>
  );
}

// ==========================================================================
// Re-exports for backward compatibility
// ==========================================================================

export {
  TextWarpGallery,
  TEXT_WARP_PRESETS,
  warpPreviewPath,
} from "./TextWarpGallery";
export { TextEffectsPanel } from "./TextEffectsPanel";
