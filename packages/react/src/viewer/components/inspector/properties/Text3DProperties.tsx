import React from "react";
import { useTranslation } from "react-i18next";

import type {
  TextStyle,
  Text3DStyle,
  BevelPresetType,
  MaterialPresetType,
} from "pptx-viewer-core";
import { normalizeHexColor } from "../../../utils";

const INPUT_CLS = "bg-muted border border-border rounded px-2 py-1";
const COLOR_CLS = "h-8 bg-muted border border-border rounded px-1";

/** EMU per typographic point (1pt = 12700 EMU). */
const EMU_PER_PT = 12700;

const BEVEL_PRESETS: ReadonlyArray<{ value: BevelPresetType; label: string }> =
  [
    { value: "none", label: "None" },
    { value: "circle", label: "Circle" },
    { value: "relaxedInset", label: "Relaxed Inset" },
    { value: "cross", label: "Cross" },
    { value: "coolSlant", label: "Cool Slant" },
    { value: "angle", label: "Angle" },
    { value: "softRound", label: "Soft Round" },
    { value: "convex", label: "Convex" },
    { value: "slope", label: "Slope" },
    { value: "divot", label: "Divot" },
    { value: "riblet", label: "Riblet" },
    { value: "hardEdge", label: "Hard Edge" },
    { value: "artDeco", label: "Art Deco" },
  ];

const MATERIAL_PRESETS: ReadonlyArray<{
  value: MaterialPresetType | "";
  label: string;
}> = [
  { value: "", label: "None" },
  { value: "matte", label: "Matte" },
  { value: "warmMatte", label: "Warm Matte" },
  { value: "plastic", label: "Plastic" },
  { value: "metal", label: "Metal" },
  { value: "dkEdge", label: "Dark Edge" },
  { value: "softEdge", label: "Soft Edge" },
  { value: "flat", label: "Flat" },
  { value: "softmetal", label: "Soft Metal" },
  { value: "clear", label: "Clear" },
  { value: "powder", label: "Powder" },
  { value: "translucentPowder", label: "Translucent Powder" },
];

interface Text3DPropertiesProps {
  ts: TextStyle | undefined;
  onUpdateTextStyle: (updates: Partial<TextStyle>) => void;
}

/** Convert EMU to points for display. */
function emuToPt(emu: number | undefined): number {
  if (!emu) return 0;
  return Math.round(emu / EMU_PER_PT);
}

/** Convert points to EMU for storage. */
function ptToEmu(pt: number): number {
  return Math.round(pt * EMU_PER_PT);
}

export function Text3DProperties({
  ts,
  onUpdateTextStyle,
}: Text3DPropertiesProps): React.ReactElement {
  const { t } = useTranslation();
  const t3d = ts?.text3d;
  const hasExtrusion = Boolean(t3d?.extrusionHeight && t3d.extrusionHeight > 0);

  const update3d = (partial: Partial<Text3DStyle>) => {
    const merged: Text3DStyle = { ...(ts?.text3d ?? {}), ...partial };
    onUpdateTextStyle({ text3d: merged });
  };

  const clear3d = () => {
    onUpdateTextStyle({ text3d: undefined });
  };

  return (
    <div className="mt-2 rounded border border-border bg-card p-2 space-y-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {t("pptx.text3d.title")}
      </div>

      {/* ── Extrusion toggle ── */}
      <div className="space-y-1.5">
        <label className="inline-flex items-center gap-2 text-foreground">
          <input
            type="checkbox"
            checked={hasExtrusion}
            onChange={(e) => {
              if (e.target.checked) {
                update3d({ extrusionHeight: ptToEmu(6) });
              } else {
                clear3d();
              }
            }}
          />
          {t("pptx.text3d.extrusion")}
        </label>
        {hasExtrusion && (
          <div className="grid grid-cols-2 gap-2 pl-4">
            <label className="flex flex-col gap-1">
              <span className="text-muted-foreground">
                {t("pptx.text3d.extrusionDepth")}
              </span>
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={emuToPt(t3d?.extrusionHeight)}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v)) {
                    update3d({
                      extrusionHeight: ptToEmu(Math.max(0, Math.min(100, v))),
                    });
                  }
                }}
                className={INPUT_CLS}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-muted-foreground">
                {t("pptx.text3d.extrusionColor")}
              </span>
              <input
                type="color"
                value={normalizeHexColor(t3d?.extrusionColor, "#888888")}
                onChange={(e) => update3d({ extrusionColor: e.target.value })}
                className={COLOR_CLS}
              />
            </label>
          </div>
        )}
      </div>

      {/* ── Top Bevel ── */}
      {hasExtrusion && (
        <BevelSection
          label={t("pptx.text3d.bevelTop")}
          bevelType={t3d?.bevelTopType}
          bevelWidth={t3d?.bevelTopWidth}
          bevelHeight={t3d?.bevelTopHeight}
          onTypeChange={(v) =>
            update3d({
              bevelTopType: v || undefined,
            })
          }
          onWidthChange={(v) => update3d({ bevelTopWidth: ptToEmu(v) })}
          onHeightChange={(v) => update3d({ bevelTopHeight: ptToEmu(v) })}
          t={t}
        />
      )}

      {/* ── Bottom Bevel ── */}
      {hasExtrusion && (
        <BevelSection
          label={t("pptx.text3d.bevelBottom")}
          bevelType={t3d?.bevelBottomType}
          bevelWidth={t3d?.bevelBottomWidth}
          bevelHeight={t3d?.bevelBottomHeight}
          onTypeChange={(v) =>
            update3d({
              bevelBottomType: v || undefined,
            })
          }
          onWidthChange={(v) => update3d({ bevelBottomWidth: ptToEmu(v) })}
          onHeightChange={(v) => update3d({ bevelBottomHeight: ptToEmu(v) })}
          t={t}
        />
      )}

      {/* ── Material ── */}
      {hasExtrusion && (
        <label className="flex flex-col gap-1 pl-4">
          <span className="text-muted-foreground">
            {t("pptx.text3d.material")}
          </span>
          <select
            value={t3d?.presetMaterial ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              update3d({
                presetMaterial: v ? (v as MaterialPresetType) : undefined,
              });
            }}
            className={INPUT_CLS}
          >
            {MATERIAL_PRESETS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

// ── Bevel sub-section (reused for top + bottom) ─────────────────────────

interface BevelSectionProps {
  label: string;
  bevelType: BevelPresetType | undefined;
  bevelWidth: number | undefined;
  bevelHeight: number | undefined;
  onTypeChange: (v: BevelPresetType) => void;
  onWidthChange: (v: number) => void;
  onHeightChange: (v: number) => void;
  t: (key: string) => string;
}

function BevelSection({
  label,
  bevelType,
  bevelWidth,
  bevelHeight,
  onTypeChange,
  onWidthChange,
  onHeightChange,
  t,
}: BevelSectionProps): React.ReactElement {
  return (
    <div className="space-y-1 pl-4">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <div className="grid grid-cols-3 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground">
            {t("pptx.text3d.bevelType")}
          </span>
          <select
            value={bevelType ?? "none"}
            onChange={(e) => onTypeChange(e.target.value as BevelPresetType)}
            className={INPUT_CLS}
          >
            {BEVEL_PRESETS.map(({ value, label: l }) => (
              <option key={value} value={value}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground">
            {t("pptx.text3d.bevelWidth")}
          </span>
          <input
            type="number"
            min={0}
            max={50}
            step={1}
            value={emuToPt(bevelWidth)}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v))
                onWidthChange(Math.max(0, Math.min(50, v)));
            }}
            className={INPUT_CLS}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground">
            {t("pptx.text3d.bevelHeight")}
          </span>
          <input
            type="number"
            min={0}
            max={50}
            step={1}
            value={emuToPt(bevelHeight)}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v))
                onHeightChange(Math.max(0, Math.min(50, v)));
            }}
            className={INPUT_CLS}
          />
        </label>
      </div>
    </div>
  );
}
