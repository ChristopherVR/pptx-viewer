import React from "react";

import type { TextStyle } from "../../../core";
import { normalizeHexColor } from "../../utils";
import { INPUT_CLS, COLOR_CLS } from "./TextPropertiesHelpers";

// ==========================================================================
// Props
// ==========================================================================

interface TextEffectsPanelProps {
  ts: TextStyle | undefined;
  onUpdateTextStyle: (updates: Partial<TextStyle>) => void;
  numChange: (
    fn: (v: number) => Partial<TextStyle>,
  ) => (e: React.ChangeEvent<HTMLInputElement>) => void;
}

// ==========================================================================
// Component
// ==========================================================================

export function TextEffectsPanel({
  ts,
  onUpdateTextStyle,
  numChange,
}: TextEffectsPanelProps): React.ReactElement {
  const hasShadow = Boolean(
    ts?.textShadowColor ||
    (typeof ts?.textShadowBlur === "number" && ts.textShadowBlur > 0),
  );
  const hasGlow = Boolean(
    ts?.textGlowColor ||
    (typeof ts?.textGlowRadius === "number" && ts.textGlowRadius > 0),
  );
  const hasReflection = Boolean(ts?.textReflection);

  return (
    <div className="mt-2 rounded border border-border bg-card p-2 space-y-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        Text Effects
      </div>

      {/* ── Text Shadow ── */}
      <div className="space-y-1.5">
        <label className="inline-flex items-center gap-2 text-foreground">
          <input
            type="checkbox"
            checked={hasShadow}
            onChange={(e) => {
              if (e.target.checked) {
                onUpdateTextStyle({
                  textShadowColor: "#000000",
                  textShadowBlur: 4,
                  textShadowOffsetX: 2,
                  textShadowOffsetY: 2,
                  textShadowOpacity: 0.5,
                });
              } else {
                onUpdateTextStyle({
                  textShadowColor: undefined,
                  textShadowBlur: undefined,
                  textShadowOffsetX: undefined,
                  textShadowOffsetY: undefined,
                  textShadowOpacity: undefined,
                });
              }
            }}
          />
          Text Shadow
        </label>
        {hasShadow && (
          <div className="grid grid-cols-2 gap-2 pl-4">
            <label className="flex flex-col gap-1">
              <span className="text-muted-foreground">Color</span>
              <input
                type="color"
                value={normalizeHexColor(ts?.textShadowColor, "#000000")}
                onChange={(e) =>
                  onUpdateTextStyle({ textShadowColor: e.target.value })
                }
                className={COLOR_CLS}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-muted-foreground">Opacity</span>
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={Number(ts?.textShadowOpacity ?? 0.5).toFixed(2)}
                onChange={numChange((v) => ({
                  textShadowOpacity: Math.max(0, Math.min(1, v)),
                }))}
                className={INPUT_CLS}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-muted-foreground">Blur</span>
              <input
                type="number"
                min={0}
                max={50}
                step={1}
                value={Math.round(ts?.textShadowBlur ?? 4)}
                onChange={numChange((v) => ({
                  textShadowBlur: Math.max(0, Math.min(50, v)),
                }))}
                className={INPUT_CLS}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-muted-foreground">Offset X</span>
              <input
                type="number"
                min={-50}
                max={50}
                step={1}
                value={Math.round(ts?.textShadowOffsetX ?? 2)}
                onChange={numChange((v) => ({ textShadowOffsetX: v }))}
                className={INPUT_CLS}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-muted-foreground">Offset Y</span>
              <input
                type="number"
                min={-50}
                max={50}
                step={1}
                value={Math.round(ts?.textShadowOffsetY ?? 2)}
                onChange={numChange((v) => ({ textShadowOffsetY: v }))}
                className={INPUT_CLS}
              />
            </label>
          </div>
        )}
      </div>

      {/* ── Text Glow ── */}
      <div className="space-y-1.5">
        <label className="inline-flex items-center gap-2 text-foreground">
          <input
            type="checkbox"
            checked={hasGlow}
            onChange={(e) => {
              if (e.target.checked) {
                onUpdateTextStyle({
                  textGlowColor: "#ffff00",
                  textGlowRadius: 6,
                  textGlowOpacity: 0.6,
                });
              } else {
                onUpdateTextStyle({
                  textGlowColor: undefined,
                  textGlowRadius: undefined,
                  textGlowOpacity: undefined,
                });
              }
            }}
          />
          Text Glow
        </label>
        {hasGlow && (
          <div className="grid grid-cols-2 gap-2 pl-4">
            <label className="flex flex-col gap-1">
              <span className="text-muted-foreground">Color</span>
              <input
                type="color"
                value={normalizeHexColor(ts?.textGlowColor, "#ffff00")}
                onChange={(e) =>
                  onUpdateTextStyle({ textGlowColor: e.target.value })
                }
                className={COLOR_CLS}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-muted-foreground">Opacity</span>
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={Number(ts?.textGlowOpacity ?? 0.6).toFixed(2)}
                onChange={numChange((v) => ({
                  textGlowOpacity: Math.max(0, Math.min(1, v)),
                }))}
                className={INPUT_CLS}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-muted-foreground">Size</span>
              <input
                type="number"
                min={1}
                max={50}
                step={1}
                value={Math.round(ts?.textGlowRadius ?? 6)}
                onChange={numChange((v) => ({
                  textGlowRadius: Math.max(1, Math.min(50, v)),
                }))}
                className={INPUT_CLS}
              />
            </label>
          </div>
        )}
      </div>

      {/* ── Text Reflection ── */}
      <div className="space-y-1.5">
        <label className="inline-flex items-center gap-2 text-foreground">
          <input
            type="checkbox"
            checked={hasReflection}
            onChange={(e) => {
              if (e.target.checked) {
                onUpdateTextStyle({
                  textReflection: true,
                  textReflectionBlur: 1,
                  textReflectionStartOpacity: 0.5,
                  textReflectionEndOpacity: 0,
                  textReflectionOffset: 3,
                });
              } else {
                onUpdateTextStyle({
                  textReflection: undefined,
                  textReflectionBlur: undefined,
                  textReflectionStartOpacity: undefined,
                  textReflectionEndOpacity: undefined,
                  textReflectionOffset: undefined,
                });
              }
            }}
          />
          Text Reflection
        </label>
        {hasReflection && (
          <div className="grid grid-cols-2 gap-2 pl-4">
            <label className="flex flex-col gap-1">
              <span className="text-muted-foreground">Blur</span>
              <input
                type="number"
                min={0}
                max={20}
                step={0.5}
                value={Number(ts?.textReflectionBlur ?? 1).toFixed(1)}
                onChange={numChange((v) => ({
                  textReflectionBlur: Math.max(0, Math.min(20, v)),
                }))}
                className={INPUT_CLS}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-muted-foreground">Offset</span>
              <input
                type="number"
                min={0}
                max={20}
                step={1}
                value={Math.round(ts?.textReflectionOffset ?? 3)}
                onChange={numChange((v) => ({
                  textReflectionOffset: Math.max(0, Math.min(20, v)),
                }))}
                className={INPUT_CLS}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-muted-foreground">Start Opacity</span>
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={Number(ts?.textReflectionStartOpacity ?? 0.5).toFixed(2)}
                onChange={numChange((v) => ({
                  textReflectionStartOpacity: Math.max(0, Math.min(1, v)),
                }))}
                className={INPUT_CLS}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-muted-foreground">End Opacity</span>
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={Number(ts?.textReflectionEndOpacity ?? 0).toFixed(2)}
                onChange={numChange((v) => ({
                  textReflectionEndOpacity: Math.max(0, Math.min(1, v)),
                }))}
                className={INPUT_CLS}
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
