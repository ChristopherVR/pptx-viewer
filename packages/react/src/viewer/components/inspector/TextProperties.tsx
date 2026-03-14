import React from "react";
import { LuLink2 } from "react-icons/lu";

import type { PptxElement } from "pptx-viewer-core";
import { hasTextProperties } from "pptx-viewer-core";
import {
  FONT_FAMILY_OPTIONS,
  THEME_COLOR_SWATCHES,
  DEFAULT_TEXT_FONT_SIZE,
  DEFAULT_FONT_FAMILY,
} from "../../constants";
import {
  createUniformTextSegments,
  toCssWritingMode,
  toCssTextOrientation,
  normalizeHexColor,
} from "../../utils";
import {
  INPUT_CLS,
  COLOR_CLS,
  STYLE_TOGGLES,
  ALIGN_OPTIONS,
  createNumericChangeHandler,
  AdvancedTextFormatting,
  TextWarpGallery,
  TextEffectsPanel,
} from "./TextPropertiesHelpers";
import type { TextPropertiesProps } from "./TextPropertiesHelpers";
import { TextFormattingGrid } from "./TextFormattingGrid";
import { Text3DProperties } from "./properties/Text3DProperties";

export type { TextPropertiesProps };

/**
 * Comprehensive text editing panel for elements with text content.
 *
 * Renders controls for:
 * - Text content editing (textarea with writing mode/RTL support)
 * - Font size, color, and family selection
 * - Hyperlink editing
 * - Style toggles (bold, italic, underline, strikethrough, etc.)
 * - Text alignment buttons
 * - List mode, line spacing, paragraph spacing, text direction
 * - Advanced formatting (letter spacing, baseline, etc.)
 * - Text warp effects gallery
 * - Text shadow/glow/reflection effects
 * - 3D text properties
 *
 * Returns null if the selected element does not support text properties.
 *
 * @param props - {@link TextPropertiesProps}
 * @returns The text properties panel, or null for non-text elements.
 */
export function TextProperties({
  selectedElement,
  selectedTextStyle,
  selectedTextAlignment,
  selectedListMode,
  spellCheckEnabled,
  recentColors,
  canEdit,
  onUpdateElement,
  onUpdateTextStyle,
  onSetTextColor,
  onToggleTextFlag,
  onEditHyperlink,
  onApplyListMode,
  onSetTextAlignment,
}: TextPropertiesProps): React.ReactElement | null {
  // Only render for elements that have text properties (shapes, text boxes, etc.)
  if (!hasTextProperties(selectedElement)) return null;
  const ts = selectedTextStyle;
  // Convert OOXML text direction to CSS writing-mode (e.g. "eaVert" -> "vertical-rl")
  const writingMode = toCssWritingMode(ts?.textDirection);
  const textOrientation = toCssTextOrientation(ts?.textDirection);

  // Factory for numeric input onChange handlers that clamp and dispatch text style updates
  const numChange = createNumericChangeHandler(onUpdateTextStyle);

  return (
    <>
      {/* Text Content */}
      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground">Text</span>
        <textarea
          value={selectedElement.text || ""}
          spellCheck={spellCheckEnabled}
          dir={ts?.rtl ? "rtl" : "ltr"}
          onChange={(e) => {
            onUpdateElement({
              text: e.target.value,
              textSegments: createUniformTextSegments(
                e.target.value,
                selectedElement.textStyle,
              ),
            } as Partial<PptxElement>);
          }}
          rows={5}
          style={{
            writingMode: writingMode || undefined,
            textOrientation: textOrientation || undefined,
          }}
          className={`${INPUT_CLS} resize-y`}
        />
      </label>

      {/* Font Size & Text Color */}
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground">Font Size</span>
          <input
            type="number"
            min={8}
            value={Math.round(ts?.fontSize || DEFAULT_TEXT_FONT_SIZE)}
            onChange={numChange((v) => ({ fontSize: Math.max(8, v) }))}
            className={INPUT_CLS}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground">Text Color</span>
          <input
            type="color"
            value={normalizeHexColor(ts?.color)}
            onChange={(e) => onSetTextColor(e.target.value)}
            className={COLOR_CLS}
          />
          <div className="mt-1 flex flex-wrap gap-1">
            {THEME_COLOR_SWATCHES.map((c) => (
              <button
                key={`theme-${c}`}
                type="button"
                className="h-5 w-5 rounded border border-border"
                style={{ backgroundColor: c }}
                title={`Use ${c}`}
                onClick={() => onSetTextColor(c)}
              />
            ))}
            {recentColors.map((c) => (
              <button
                key={`recent-${c}`}
                type="button"
                className="h-5 w-5 rounded border border-primary"
                style={{ backgroundColor: c }}
                title={`Recent ${c}`}
                onClick={() => onSetTextColor(c)}
              />
            ))}
          </div>
        </label>
      </div>

      {/* Font Family */}
      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground">Font Family</span>
        <select
          value={ts?.fontFamily || ""}
          onChange={(e) => {
            const f = e.target.value.trim();
            onUpdateTextStyle({ fontFamily: f.length > 0 ? f : undefined });
          }}
          className={INPUT_CLS}
        >
          <option value="">Default ({DEFAULT_FONT_FAMILY})</option>
          {FONT_FAMILY_OPTIONS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
          {ts?.fontFamily && !FONT_FAMILY_OPTIONS.includes(ts.fontFamily) && (
            <option value={ts.fontFamily}>{ts.fontFamily}</option>
          )}
        </select>
      </label>

      {/* Hyperlink */}
      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground">Hyperlink</span>
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={ts?.hyperlink || ""}
            placeholder="https://example.com"
            onChange={(e) => {
              const h = e.target.value.trim();
              onUpdateTextStyle({ hyperlink: h.length > 0 ? h : undefined });
            }}
            className={`flex-1 ${INPUT_CLS}`}
          />
          <button
            type="button"
            onClick={onEditHyperlink}
            className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-[11px] text-foreground hover:bg-border"
          >
            <LuLink2 className="h-3.5 w-3.5" /> Edit
          </button>
        </div>
      </label>

      {/* Style Toggles + Alignment */}
      <div className="flex flex-wrap items-center gap-1">
        {STYLE_TOGGLES.map(({ key, Icon, label }) => (
          <button
            key={key}
            type="button"
            title={label}
            className={`p-1.5 rounded ${ts?.[key] ? "bg-primary text-primary-foreground" : "bg-muted text-foreground hover:bg-accent"}`}
            onClick={() => onUpdateTextStyle({ [key]: !ts?.[key] })}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-border" />
        {ALIGN_OPTIONS.map(({ value, Icon }) => (
          <button
            key={value}
            type="button"
            title={value}
            className={`p-1.5 rounded ${selectedTextAlignment === value ? "bg-primary text-primary-foreground" : "bg-muted text-foreground hover:bg-accent"}`}
            onClick={() => onSetTextAlignment(value)}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>

      {/* List / Line Spacing / Paragraph / Direction / Text Flow / Columns / Spell Check */}
      <TextFormattingGrid
        ts={ts}
        selectedListMode={selectedListMode}
        spellCheckEnabled={spellCheckEnabled}
        onUpdateTextStyle={onUpdateTextStyle}
        onApplyListMode={onApplyListMode}
        onToggleTextFlag={onToggleTextFlag}
      />

      {/* ── Advanced Text Formatting ── */}
      <AdvancedTextFormatting
        ts={ts}
        canEdit={canEdit}
        onUpdateTextStyle={onUpdateTextStyle}
        numChange={numChange}
      />

      {/* ── Text Warp Gallery ── */}
      <TextWarpGallery ts={ts} onUpdateTextStyle={onUpdateTextStyle} />

      {/* ── Text Effects ── */}
      <TextEffectsPanel
        ts={ts}
        onUpdateTextStyle={onUpdateTextStyle}
        numChange={numChange}
      />

      {/* ── 3D Text ── */}
      <Text3DProperties ts={ts} onUpdateTextStyle={onUpdateTextStyle} />
    </>
  );
}
