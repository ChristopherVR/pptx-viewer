import type { ShapeStyle } from "../../../core";
import { normalizeHexColor } from "../../utils";

// ---------------------------------------------------------------------------
// Helpers (self-contained to avoid circular deps)
// ---------------------------------------------------------------------------

const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EffectToggleCfg {
  label: string;
  /** i18n key for the toggle label. When present, rendered via `t()`. */
  i18nKey?: string;
  isOn: (s: ShapeStyle | undefined) => boolean;
  onEnable: (s: ShapeStyle | undefined) => Partial<ShapeStyle>;
  onDisable: (s?: ShapeStyle | undefined) => Partial<ShapeStyle>;
  fields: Array<{
    key: string;
    label: string;
    /** i18n key for the field label. When present, rendered via `t()`. */
    i18nKey?: string;
    type: "color" | "range" | "number" | "select" | "checkbox";
    min?: number;
    max?: number;
    step?: number;
    span2?: boolean;
    read: (s: ShapeStyle | undefined) => number | string | boolean;
    write: (
      v: number | string | boolean,
      s?: ShapeStyle | undefined,
    ) =>
      | Partial<ShapeStyle>
      | ((s: ShapeStyle | undefined) => Partial<ShapeStyle>);
    isPercent?: boolean;
    /** Options for "select" type fields. */
    options?: Array<{ value: string; label: string }>;
  }>;
}

export { BEVEL_TYPE_OPTIONS } from "./bevel-type-options";

// ---------------------------------------------------------------------------
// Shadow + Inner Shadow effect configs
// ---------------------------------------------------------------------------

export const SHADOW_EFFECT_CONFIGS: EffectToggleCfg[] = [
  /* Shadow */
  {
    label: "Shadow",
    isOn: (s) => Boolean(s?.shadowColor) && s?.shadowColor !== "transparent",
    onEnable: (s) => {
      let angle = s?.shadowAngle ?? 315;
      let distance = s?.shadowDistance ?? 5.66;
      const offsetX = s?.shadowOffsetX ?? 4;
      const offsetY = s?.shadowOffsetY ?? 4;
      if (
        s?.shadowAngle == null &&
        s?.shadowDistance == null &&
        (offsetX !== 0 || offsetY !== 0)
      ) {
        distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
        angle = ((Math.atan2(offsetY, offsetX) * 180) / Math.PI + 360) % 360;
      }
      return {
        shadowColor: normalizeHexColor(s?.shadowColor, "#000000"),
        shadowOpacity: s?.shadowOpacity ?? 0.35,
        shadowBlur: s?.shadowBlur ?? 6,
        shadowAngle: angle,
        shadowDistance: distance,
        shadowOffsetX: offsetX,
        shadowOffsetY: offsetY,
        shadowRotateWithShape: s?.shadowRotateWithShape ?? true,
      };
    },
    onDisable: () => ({ shadowColor: "transparent" }),
    fields: [
      {
        key: "sc",
        label: "Shadow Color",
        type: "color",
        read: (s) => normalizeHexColor(s?.shadowColor, "#000000"),
        write: (v) => ({ shadowColor: String(v) }),
      },
      {
        key: "so",
        label: "Shadow Opacity",
        type: "range",
        min: 0,
        max: 100,
        isPercent: true,
        read: (s) => Math.round((s?.shadowOpacity ?? 0.35) * 100),
        write: (v) => ({ shadowOpacity: Number(v) / 100 }),
      },
      {
        key: "sb",
        label: "Shadow Blur",
        type: "number",
        min: 0,
        max: 96,
        read: (s) => Math.round(s?.shadowBlur ?? 6),
        write: (v) => ({ shadowBlur: clamp(Number(v), 0, 96) }),
      },
      {
        key: "sa",
        label: "Shadow Angle",
        type: "number",
        min: 0,
        max: 359,
        read: (s) => {
          if (typeof s?.shadowAngle === "number") {
            return Math.round(s.shadowAngle) % 360;
          }
          const x = s?.shadowOffsetX ?? 4;
          const y = s?.shadowOffsetY ?? 4;
          return Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360);
        },
        write: (v) => {
          const angle = Number(v) % 360;
          return (s: ShapeStyle | undefined) => {
            const dist =
              typeof s?.shadowDistance === "number" ? s.shadowDistance : 5.66;
            const angleRad = (angle * Math.PI) / 180;
            return {
              shadowAngle: angle,
              shadowDistance: dist,
              shadowOffsetX: Math.cos(angleRad) * dist,
              shadowOffsetY: Math.sin(angleRad) * dist,
            };
          };
        },
      },
      {
        key: "sd",
        label: "Shadow Distance",
        type: "number",
        min: 0,
        max: 100,
        read: (s) => {
          if (typeof s?.shadowDistance === "number") {
            return Math.round(s.shadowDistance * 10) / 10;
          }
          const x = s?.shadowOffsetX ?? 4;
          const y = s?.shadowOffsetY ?? 4;
          return Math.round(Math.sqrt(x * x + y * y) * 10) / 10;
        },
        write: (v) => {
          return (s: ShapeStyle | undefined) => {
            const distance = clamp(Number(v), 0, 100);
            const angle =
              typeof s?.shadowAngle === "number" ? s.shadowAngle : 315;
            const angleRad = (angle * Math.PI) / 180;
            return {
              shadowAngle: angle,
              shadowDistance: distance,
              shadowOffsetX: Math.cos(angleRad) * distance,
              shadowOffsetY: Math.sin(angleRad) * distance,
            };
          };
        },
      },
      {
        key: "sr",
        label: "Rotate with Shape",
        type: "checkbox",
        read: (s) => s?.shadowRotateWithShape ?? true,
        write: (v) => ({ shadowRotateWithShape: Boolean(v) }),
      },
      {
        key: "sx",
        label: "Shadow X",
        type: "number",
        min: -96,
        max: 96,
        read: (s) => Math.round(s?.shadowOffsetX ?? 4),
        write: (v) => {
          return (s: ShapeStyle | undefined) => {
            const offsetX = clamp(Number(v), -96, 96);
            const offsetY = s?.shadowOffsetY ?? 4;
            const distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
            const angle =
              ((Math.atan2(offsetY, offsetX) * 180) / Math.PI + 360) % 360;
            return {
              shadowOffsetX: offsetX,
              shadowAngle: angle,
              shadowDistance: distance,
            };
          };
        },
      },
      {
        key: "sy",
        label: "Shadow Y",
        type: "number",
        min: -96,
        max: 96,
        span2: true,
        read: (s) => Math.round(s?.shadowOffsetY ?? 4),
        write: (v) => {
          return (s: ShapeStyle | undefined) => {
            const offsetY = clamp(Number(v), -96, 96);
            const offsetX = s?.shadowOffsetX ?? 4;
            const distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
            const angle =
              ((Math.atan2(offsetY, offsetX) * 180) / Math.PI + 360) % 360;
            return {
              shadowOffsetY: offsetY,
              shadowAngle: angle,
              shadowDistance: distance,
            };
          };
        },
      },
    ],
  },
  /* Inner Shadow */
  {
    label: "Inner Shadow",
    isOn: (s) =>
      Boolean(s?.innerShadowColor) && s?.innerShadowColor !== "transparent",
    onEnable: (s) => ({
      innerShadowColor: normalizeHexColor(s?.innerShadowColor, "#000000"),
      innerShadowOpacity: s?.innerShadowOpacity ?? 0.5,
      innerShadowBlur: s?.innerShadowBlur ?? 5,
      innerShadowOffsetX: s?.innerShadowOffsetX ?? 0,
      innerShadowOffsetY: s?.innerShadowOffsetY ?? 0,
    }),
    onDisable: () => ({ innerShadowColor: "transparent" }),
    fields: [
      {
        key: "isc",
        label: "Color",
        type: "color",
        read: (s) => normalizeHexColor(s?.innerShadowColor, "#000000"),
        write: (v) => ({ innerShadowColor: String(v) }),
      },
      {
        key: "iso",
        label: "Opacity",
        type: "range",
        min: 0,
        max: 100,
        isPercent: true,
        read: (s) => Math.round((s?.innerShadowOpacity ?? 0.5) * 100),
        write: (v) => ({ innerShadowOpacity: Number(v) / 100 }),
      },
      {
        key: "isb",
        label: "Blur",
        type: "number",
        min: 0,
        max: 96,
        read: (s) => Math.round(s?.innerShadowBlur ?? 5),
        write: (v) => ({ innerShadowBlur: clamp(Number(v), 0, 96) }),
      },
      {
        key: "isx",
        label: "Offset X",
        type: "number",
        min: -96,
        max: 96,
        read: (s) => Math.round(s?.innerShadowOffsetX ?? 0),
        write: (v) => ({
          innerShadowOffsetX: clamp(Number(v), -96, 96),
        }),
      },
      {
        key: "isy",
        label: "Offset Y",
        type: "number",
        min: -96,
        max: 96,
        span2: true,
        read: (s) => Math.round(s?.innerShadowOffsetY ?? 0),
        write: (v) => ({
          innerShadowOffsetY: clamp(Number(v), -96, 96),
        }),
      },
    ],
  },
];
