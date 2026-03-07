/**
 * 3-D effect properties, text warp (WordArt) presets, and scene/shape bevel
 * definitions parsed from OOXML `a:sp3d`, `a:scene3d`, and `a:bodyPr/a:prstTxWarp`.
 *
 * @module pptx-types/three-d
 */

// ==========================================================================
// 3D effect properties and text warp presets
// ==========================================================================

/**
 * Bevel preset type tokens from OOXML `a:bevelT/@prst` / `a:bevelB/@prst`.
 *
 * @example
 * ```ts
 * const bevel: BevelPresetType = "circle";
 * // => "circle" — one of: "circle" | "relaxedInset" | "cross" | "coolSlant" | "angle" | …
 * ```
 */
export type BevelPresetType =
  | "circle"
  | "relaxedInset"
  | "cross"
  | "coolSlant"
  | "angle"
  | "softRound"
  | "convex"
  | "slope"
  | "divot"
  | "riblet"
  | "hardEdge"
  | "artDeco"
  | "none";

/**
 * Material preset type tokens from OOXML `a:sp3d/@prstMaterial`.
 *
 * @example
 * ```ts
 * const mat: MaterialPresetType = "plastic";
 * // => "plastic" — one of: "matte" | "warmMatte" | "plastic" | "metal" | "dkEdge" | …
 * ```
 */
export type MaterialPresetType =
  | "matte"
  | "warmMatte"
  | "plastic"
  | "metal"
  | "dkEdge"
  | "softEdge"
  | "flat"
  | "softmetal"
  | "clear"
  | "powder"
  | "translucentPowder";

/**
 * 3D text body extrusion/bevel from `a:bodyPr/a:sp3d`.
 *
 * @example
 * ```ts
 * const text3d: Text3DStyle = {
 *   extrusionHeight: 57150,
 *   presetMaterial: "plastic",
 *   bevelTopType: "circle",
 *   bevelTopWidth: 25400,
 *   bevelTopHeight: 25400,
 * };
 * // => satisfies Text3DStyle
 * ```
 */
export interface Text3DStyle {
  /** Extrusion height (depth) in EMU. */
  extrusionHeight?: number;
  /** Extrusion colour as hex string. */
  extrusionColor?: string;
  /** Preset material, e.g. "matte", "plastic", "metal". */
  presetMaterial?: MaterialPresetType;
  /** Top bevel preset type. */
  bevelTopType?: BevelPresetType;
  /** Top bevel width in EMU. */
  bevelTopWidth?: number;
  /** Top bevel height in EMU. */
  bevelTopHeight?: number;
  /** Bottom bevel preset type. */
  bevelBottomType?: BevelPresetType;
  /** Bottom bevel width in EMU. */
  bevelBottomWidth?: number;
  /** Bottom bevel height in EMU. */
  bevelBottomHeight?: number;
}

/**
 * 3D scene/camera properties from `a:scene3d`.
 *
 * @example
 * ```ts
 * const scene: Pptx3DScene = {
 *   cameraPreset: "perspectiveFront",
 *   lightRigType: "threePt",
 *   lightRigDirection: "t",
 * };
 * // => satisfies Pptx3DScene
 * ```
 */
export interface Pptx3DScene {
  /** Camera preset type, e.g. "orthographicFront", "perspectiveFront". */
  cameraPreset?: string;
  /** Camera rotation around X axis in 1/60000 degrees. */
  cameraRotX?: number;
  /** Camera rotation around Y axis in 1/60000 degrees. */
  cameraRotY?: number;
  /** Camera rotation around Z axis in 1/60000 degrees. */
  cameraRotZ?: number;
  /** Light rig type, e.g. "threePt", "balanced", "harsh". */
  lightRigType?: string;
  /** Light rig direction, e.g. "t", "b", "l", "r", "tl". */
  lightRigDirection?: string;
  /** Whether a 3D backdrop plane is present (`a:backdrop`). */
  hasBackdrop?: boolean;
  /** Backdrop plane anchor X in EMU. */
  backdropAnchorX?: number;
  /** Backdrop plane anchor Y in EMU. */
  backdropAnchorY?: number;
  /** Backdrop plane anchor Z in EMU. */
  backdropAnchorZ?: number;
}

/**
 * 3D shape extrusion/bevel from `a:sp3d`.
 *
 * @example
 * ```ts
 * const shape3d: Pptx3DShape = {
 *   extrusionHeight: 76200,
 *   extrusionColor: "#4F81BD",
 *   presetMaterial: "metal",
 *   bevelTopType: "circle",
 *   bevelTopWidth: 12700,
 *   bevelTopHeight: 12700,
 * };
 * // => satisfies Pptx3DShape
 * ```
 */
export interface Pptx3DShape {
  /** Extrusion height in EMU. */
  extrusionHeight?: number;
  /** Extrusion colour. */
  extrusionColor?: string;
  /** Contour width in EMU. */
  contourWidth?: number;
  /** Contour colour. */
  contourColor?: string;
  /** Preset material, e.g. "matte", "warmMatte", "metal". */
  presetMaterial?: string;
  /** Top bevel type, e.g. "circle", "relaxedInset". */
  bevelTopType?: string;
  /** Top bevel width in EMU. */
  bevelTopWidth?: number;
  /** Top bevel height in EMU. */
  bevelTopHeight?: number;
  /** Bottom bevel type, e.g. "circle", "relaxedInset". */
  bevelBottomType?: string;
  /** Bottom bevel width in EMU. */
  bevelBottomWidth?: number;
  /** Bottom bevel height in EMU. */
  bevelBottomHeight?: number;
}

// ==========================================================================
// Text warp (WordArt) properties
// ==========================================================================

/**
 * Known OOXML preset text warp types (WordArt transforms).
 *
 * Falls back to `string` for unknown presets not yet catalogued.
 *
 * @example
 * ```ts
 * const warp: PptxTextWarpPreset = "textArchUp";
 * // => "textArchUp" — one of: "textNoShape" | "textPlain" | "textStop" | "textArchUp" | …
 * ```
 */
export type PptxTextWarpPreset =
  | "textNoShape"
  | "textPlain"
  | "textStop"
  | "textTriangle"
  | "textTriangleInverted"
  | "textChevron"
  | "textChevronInverted"
  | "textRingInside"
  | "textRingOutside"
  | "textArchUp"
  | "textArchDown"
  | "textCircle"
  | "textButton"
  | "textArchUpPour"
  | "textArchDownPour"
  | "textCirclePour"
  | "textButtonPour"
  | "textCurveUp"
  | "textCurveDown"
  | "textCanUp"
  | "textCanDown"
  | "textWave1"
  | "textWave2"
  | "textWave4"
  | "textDoubleWave1"
  | "textInflate"
  | "textDeflate"
  | "textInflateBottom"
  | "textDeflateBottom"
  | "textInflateTop"
  | "textDeflateTop"
  | "textFadeRight"
  | "textFadeLeft"
  | "textFadeUp"
  | "textFadeDown"
  | "textSlantUp"
  | "textSlantDown"
  | "textCascadeUp"
  | "textCascadeDown"
  | "textDeflateInflate"
  | "textDeflateInflateDeflate"
  | string; // Allow unknown presets
