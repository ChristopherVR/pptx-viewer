import {
  BEVEL_TYPE_OPTIONS,
  type EffectToggleCfg,
} from "./fill-stroke-effect-configs";

// ---------------------------------------------------------------------------
// Helper (self-contained to avoid circular deps)
// ---------------------------------------------------------------------------

const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

// ---------------------------------------------------------------------------
// Glow / Soft Edge / Reflection / Blur / Bevel 3D configs
// ---------------------------------------------------------------------------

export const VISUAL_EFFECT_CONFIGS: EffectToggleCfg[] = [
  /* Glow */
  {
    label: "Glow",
    isOn: (s) => Boolean(s?.glowColor) && s?.glowColor !== "transparent",
    onEnable: (s) => ({
      glowColor:
        s?.glowColor && s.glowColor !== "transparent" ? s.glowColor : "#ffff00",
      glowOpacity: s?.glowOpacity ?? 0.75,
      glowRadius: s?.glowRadius ?? 6,
    }),
    onDisable: () => ({ glowColor: "transparent", glowRadius: 0 }),
    fields: [
      {
        key: "gc",
        label: "Glow Color",
        type: "color",
        read: (s) =>
          s?.glowColor && s.glowColor !== "transparent"
            ? s.glowColor
            : "#ffff00",
        write: (v) => ({ glowColor: String(v) }),
      },
      {
        key: "go",
        label: "Glow Opacity",
        type: "range",
        min: 0,
        max: 100,
        isPercent: true,
        read: (s) => Math.round((s?.glowOpacity ?? 0.75) * 100),
        write: (v) => ({ glowOpacity: Number(v) / 100 }),
      },
      {
        key: "gr",
        label: "Glow Radius",
        type: "number",
        min: 0,
        max: 96,
        span2: true,
        read: (s) => Math.round(s?.glowRadius ?? 6),
        write: (v) => ({ glowRadius: clamp(Number(v), 0, 96) }),
      },
    ],
  },
  /* Soft Edge */
  {
    label: "Soft Edge",
    i18nKey: "pptx.inspector.softEdge",
    isOn: (s) => typeof s?.softEdgeRadius === "number" && s.softEdgeRadius > 0,
    onEnable: () => ({ softEdgeRadius: 6 }),
    onDisable: () => ({ softEdgeRadius: 0 }),
    fields: [
      {
        key: "se",
        label: "Soft Edge Radius",
        i18nKey: "pptx.inspector.softEdgeRadius",
        type: "number",
        min: 0,
        max: 96,
        span2: true,
        read: (s) => Math.round(s?.softEdgeRadius ?? 6),
        write: (v) => ({ softEdgeRadius: clamp(Number(v), 0, 96) }),
      },
    ],
  },
  /* Reflection */
  {
    label: "Reflection",
    isOn: (s) =>
      (s?.reflectionBlurRadius ?? 0) > 0 ||
      (s?.reflectionStartOpacity ?? 0) > 0,
    onEnable: () => ({
      reflectionBlurRadius: 3,
      reflectionStartOpacity: 50,
      reflectionEndOpacity: 0,
      reflectionEndPosition: 50,
      reflectionDirection: 90,
      reflectionDistance: 0,
    }),
    onDisable: () => ({
      reflectionBlurRadius: 0,
      reflectionStartOpacity: 0,
      reflectionEndOpacity: 0,
      reflectionEndPosition: 0,
      reflectionDirection: 0,
      reflectionDistance: 0,
    }),
    fields: [
      {
        key: "rb",
        label: "Blur",
        type: "number",
        min: 0,
        max: 20,
        step: 0.5,
        read: (s) => s?.reflectionBlurRadius ?? 3,
        write: (v) => ({ reflectionBlurRadius: clamp(Number(v), 0, 20) }),
      },
      {
        key: "rs",
        label: "Start Opacity %",
        type: "number",
        min: 0,
        max: 100,
        read: (s) => s?.reflectionStartOpacity ?? 50,
        write: (v) => ({ reflectionStartOpacity: clamp(Number(v), 0, 100) }),
      },
      {
        key: "re",
        label: "End Opacity %",
        type: "number",
        min: 0,
        max: 100,
        read: (s) => s?.reflectionEndOpacity ?? 0,
        write: (v) => ({ reflectionEndOpacity: clamp(Number(v), 0, 100) }),
      },
      {
        key: "rd",
        label: "Distance",
        type: "number",
        min: 0,
        max: 50,
        read: (s) => s?.reflectionDistance ?? 0,
        write: (v) => ({ reflectionDistance: clamp(Number(v), 0, 50) }),
      },
      {
        key: "rdir",
        label: "Direction",
        type: "number",
        min: 0,
        max: 360,
        read: (s) => s?.reflectionDirection ?? 90,
        write: (v) => ({ reflectionDirection: clamp(Number(v), 0, 360) }),
      },
      {
        key: "rrot",
        label: "Rotation",
        type: "number",
        min: 0,
        max: 360,
        span2: true,
        read: (s) => s?.reflectionRotation ?? 0,
        write: (v) => ({ reflectionRotation: clamp(Number(v), 0, 360) }),
      },
    ],
  },
  /* Blur */
  {
    label: "Blur",
    isOn: (s) => (s?.blurRadius ?? 0) > 0,
    onEnable: () => ({ blurRadius: 4 }),
    onDisable: () => ({ blurRadius: 0 }),
    fields: [
      {
        key: "bl",
        label: "Blur Radius",
        type: "number",
        min: 0,
        max: 50,
        span2: true,
        read: (s) => Math.round(s?.blurRadius ?? 4),
        write: (v) => ({ blurRadius: clamp(Number(v), 0, 50) }),
      },
    ],
  },
  /* Bevel / 3D */
  {
    label: "Bevel / 3D",
    isOn: (s) =>
      Boolean(s?.shape3d?.bevelTopType) && s?.shape3d?.bevelTopType !== "none",
    onEnable: (s) => ({
      shape3d: {
        ...s?.shape3d,
        bevelTopType: s?.shape3d?.bevelTopType || "circle",
        bevelTopWidth: s?.shape3d?.bevelTopWidth ?? 76200,
        bevelTopHeight: s?.shape3d?.bevelTopHeight ?? 76200,
      },
    }),
    onDisable: (s) => ({
      shape3d: {
        ...s?.shape3d,
        bevelTopType: undefined,
        bevelTopWidth: undefined,
        bevelTopHeight: undefined,
      },
    }),
    fields: [
      {
        key: "btype",
        label: "Bevel Type",
        type: "select",
        span2: true,
        options: BEVEL_TYPE_OPTIONS,
        read: (s) => s?.shape3d?.bevelTopType ?? "circle",
        write: (v, s) => ({
          shape3d: { ...s?.shape3d, bevelTopType: String(v) },
        }),
      },
      {
        key: "bw",
        label: "Bevel Width (EMU)",
        type: "number",
        min: 0,
        max: 500000,
        step: 12700,
        read: (s) => s?.shape3d?.bevelTopWidth ?? 76200,
        write: (v, s) => ({
          shape3d: {
            ...s?.shape3d,
            bevelTopWidth: clamp(Number(v), 0, 500000),
          },
        }),
      },
      {
        key: "bh",
        label: "Bevel Height (EMU)",
        type: "number",
        min: 0,
        max: 500000,
        step: 12700,
        span2: true,
        read: (s) => s?.shape3d?.bevelTopHeight ?? 76200,
        write: (v, s) => ({
          shape3d: {
            ...s?.shape3d,
            bevelTopHeight: clamp(Number(v), 0, 500000),
          },
        }),
      },
    ],
  },
];
