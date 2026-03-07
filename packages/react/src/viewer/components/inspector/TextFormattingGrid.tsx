import React from "react";

import type { TextStyle } from "pptx-viewer-core";
import {
  INPUT_CLS,
  TEXT_DIRECTIONS,
  createNumericChangeHandler,
} from "./TextPropertiesHelpers";
import type { ListMode } from "../../utils";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TextFormattingGridProps {
  ts: TextStyle | undefined;
  selectedListMode: ListMode;
  spellCheckEnabled: boolean;
  onUpdateTextStyle: (updates: Partial<TextStyle>) => void;
  onApplyListMode: (mode: ListMode) => void;
  onToggleTextFlag: (flag: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TextFormattingGrid({
  ts,
  selectedListMode,
  spellCheckEnabled,
  onUpdateTextStyle,
  onApplyListMode,
  onToggleTextFlag,
}: TextFormattingGridProps): React.ReactElement {
  const numChange = createNumericChangeHandler(onUpdateTextStyle);

  return (
    <div className="grid grid-cols-2 gap-2">
      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground">List</span>
        <select
          value={selectedListMode}
          onChange={(e) => onApplyListMode(e.target.value as ListMode)}
          className={INPUT_CLS}
        >
          <option value="none">None</option>
          <option value="bullet">Bulleted</option>
          <option value="number">Numbered</option>
          {/* TODO: Add Picture Bullet UI
           * - Add "Picture Bullet" option here
           * - Implement file picker dialog to upload image
           * - Store image in ppt/media/ with unique filename
           * - Create relationship in slide's .rels file
           * - Set bulletInfo.imageRelId on selected paragraphs
           * - See docs/pptx-openxml-implementation-roadmap.md section 9.1 for details
           */}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground">Line Spacing</span>
        <input
          type="number"
          min={0.8}
          max={4}
          step={0.05}
          value={Number(ts?.lineSpacing ?? 1.25).toFixed(2)}
          onChange={numChange((v) => ({
            lineSpacing: Math.max(0.8, Math.min(4, v)),
          }))}
          className={INPUT_CLS}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground">Paragraph Before</span>
        <input
          type="number"
          min={0}
          max={96}
          step={1}
          value={Math.round(ts?.paragraphSpacingBefore || 0)}
          onChange={numChange((v) => ({
            paragraphSpacingBefore: Math.max(0, Math.min(96, v)),
          }))}
          className={INPUT_CLS}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground">Paragraph After</span>
        <input
          type="number"
          min={0}
          max={96}
          step={1}
          value={Math.round(ts?.paragraphSpacingAfter || 0)}
          onChange={numChange((v) => ({
            paragraphSpacingAfter: Math.max(0, Math.min(96, v)),
          }))}
          className={INPUT_CLS}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground">Direction</span>
        <select
          value={ts?.rtl ? "rtl" : "ltr"}
          onChange={(e) => onUpdateTextStyle({ rtl: e.target.value === "rtl" })}
          className={INPUT_CLS}
        >
          <option value="ltr">Left to Right</option>
          <option value="rtl">Right to Left</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground">Text Flow</span>
        <select
          value={ts?.textDirection || "horizontal"}
          onChange={(e) => {
            const d = e.target.value as TextStyle["textDirection"];
            onUpdateTextStyle({
              textDirection: d === "horizontal" ? undefined : d,
            });
          }}
          className={INPUT_CLS}
        >
          {TEXT_DIRECTIONS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground">Columns</span>
        <input
          type="number"
          min={1}
          max={6}
          step={1}
          value={Math.max(1, Number(ts?.columnCount || 1))}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (!Number.isFinite(v)) return;
            const n = Math.max(1, Math.min(6, Math.round(v)));
            onUpdateTextStyle({ columnCount: n > 1 ? n : undefined });
          }}
          className={INPUT_CLS}
        />
      </label>
      <label className="inline-flex items-center gap-2 text-foreground">
        <input
          type="checkbox"
          checked={spellCheckEnabled}
          onChange={() => onToggleTextFlag("spellCheck")}
        />
        Spell Check
      </label>
    </div>
  );
}
