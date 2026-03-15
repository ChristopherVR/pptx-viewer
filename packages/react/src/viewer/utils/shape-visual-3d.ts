import React from "react";

import type { MaterialPresetType } from "pptx-viewer-core";
import { EMU_PER_PX } from "../constants";
import { getMaterialCssOverrides } from "./material-presets";

// ── Parameter interfaces ─────────────────────────────────────────────────

interface Scene3dParams {
  cameraPreset?: string;
  cameraRotX?: number;
  cameraRotY?: number;
  cameraRotZ?: number;
  lightRigType?: string;
  lightRigDirection?: string;
  hasBackdrop?: boolean;
}

interface Shape3dParams {
  extrusionHeight?: number;
  extrusionColor?: string;
  contourWidth?: number;
  contourColor?: string;
  bevelTopType?: string;
  bevelTopWidth?: number;
  bevelTopHeight?: number;
  bevelBottomType?: string;
  bevelBottomWidth?: number;
  bevelBottomHeight?: number;
  presetMaterial?: string;
}

// ── Constants ────────────────────────────────────────────────────────────

/**
 * Maximum stacked shadow layers for extrusion (performance guard).
 * Raised from 20 to 40 for better fidelity with large extrusion depths.
 * Each layer is a single box-shadow, so 40 is still performant.
 */
const MAX_EXTRUSION_LAYERS = 40;

// ── Camera Preset Mapping ────────────────────────────────────────────────

/**
 * Camera preset configuration: CSS perspective distance and base rotation
 * angles (in degrees). These approximate the OOXML camera preset positions.
 */
interface CameraPresetConfig {
  /** CSS perspective value, or `undefined` for orthographic (no foreshortening). */
  perspective?: string;
  /** Base rotation around X axis in degrees. */
  rotateX: number;
  /** Base rotation around Y axis in degrees. */
  rotateY: number;
  /** Base rotation around Z axis in degrees. */
  rotateZ: number;
}

const CAMERA_PRESET_MAP: Record<string, CameraPresetConfig> = {
  // Orthographic (no perspective distortion)
  orthographicFront: { rotateX: 0, rotateY: 0, rotateZ: 0 },

  // Perspective front/back
  perspectiveFront: {
    perspective: "1000px",
    rotateX: 0,
    rotateY: 0,
    rotateZ: 0,
  },

  // Perspective from above/below
  perspectiveAbove: {
    perspective: "1000px",
    rotateX: -20,
    rotateY: 0,
    rotateZ: 0,
  },
  perspectiveBelow: {
    perspective: "1000px",
    rotateX: 20,
    rotateY: 0,
    rotateZ: 0,
  },

  // Perspective from sides
  perspectiveLeft: {
    perspective: "1000px",
    rotateX: 0,
    rotateY: 20,
    rotateZ: 0,
  },
  perspectiveRight: {
    perspective: "1000px",
    rotateX: 0,
    rotateY: -20,
    rotateZ: 0,
  },

  // Perspective diagonal views
  perspectiveAboveLeftFacing: {
    perspective: "1000px",
    rotateX: -20,
    rotateY: 25,
    rotateZ: 0,
  },
  perspectiveAboveRightFacing: {
    perspective: "1000px",
    rotateX: -20,
    rotateY: -25,
    rotateZ: 0,
  },
  perspectiveContrastingLeftFacing: {
    perspective: "800px",
    rotateX: -15,
    rotateY: 30,
    rotateZ: 0,
  },
  perspectiveContrastingRightFacing: {
    perspective: "800px",
    rotateX: -15,
    rotateY: -30,
    rotateZ: 0,
  },
  perspectiveHeroicLeftFacing: {
    perspective: "600px",
    rotateX: -10,
    rotateY: 35,
    rotateZ: 0,
  },
  perspectiveHeroicRightFacing: {
    perspective: "600px",
    rotateX: -10,
    rotateY: -35,
    rotateZ: 0,
  },
  perspectiveHeroicExtremeLeftFacing: {
    perspective: "500px",
    rotateX: -8,
    rotateY: 45,
    rotateZ: 0,
  },
  perspectiveHeroicExtremeRightFacing: {
    perspective: "500px",
    rotateX: -8,
    rotateY: -45,
    rotateZ: 0,
  },
  perspectiveRelaxed: {
    perspective: "1200px",
    rotateX: -10,
    rotateY: 0,
    rotateZ: 0,
  },
  perspectiveRelaxedModerately: {
    perspective: "1400px",
    rotateX: -5,
    rotateY: 0,
    rotateZ: 0,
  },

  // Isometric views
  isometricLeftDown: {
    perspective: "1200px",
    rotateX: -35,
    rotateY: 45,
    rotateZ: 0,
  },
  isometricRightUp: {
    perspective: "1200px",
    rotateX: -35,
    rotateY: -45,
    rotateZ: 0,
  },
  isometricTopUp: {
    perspective: "1200px",
    rotateX: -55,
    rotateY: 0,
    rotateZ: 45,
  },
  isometricTopDown: {
    perspective: "1200px",
    rotateX: -55,
    rotateY: 0,
    rotateZ: -45,
  },
  isometricBottomUp: {
    perspective: "1200px",
    rotateX: 55,
    rotateY: 0,
    rotateZ: 45,
  },
  isometricBottomDown: {
    perspective: "1200px",
    rotateX: 55,
    rotateY: 0,
    rotateZ: -45,
  },
  isometricOffAxis1Left: {
    perspective: "1200px",
    rotateX: -30,
    rotateY: 30,
    rotateZ: 0,
  },
  isometricOffAxis1Right: {
    perspective: "1200px",
    rotateX: -30,
    rotateY: -30,
    rotateZ: 0,
  },
  isometricOffAxis1Top: {
    perspective: "1200px",
    rotateX: -45,
    rotateY: 0,
    rotateZ: 30,
  },
  isometricOffAxis2Left: {
    perspective: "1200px",
    rotateX: -30,
    rotateY: 20,
    rotateZ: 0,
  },
  isometricOffAxis2Right: {
    perspective: "1200px",
    rotateX: -30,
    rotateY: -20,
    rotateZ: 0,
  },
  isometricOffAxis2Top: {
    perspective: "1200px",
    rotateX: -45,
    rotateY: 0,
    rotateZ: -30,
  },
  isometricOffAxis3Left: {
    perspective: "1200px",
    rotateX: -25,
    rotateY: 35,
    rotateZ: 0,
  },
  isometricOffAxis3Right: {
    perspective: "1200px",
    rotateX: -25,
    rotateY: -35,
    rotateZ: 0,
  },
  isometricOffAxis3Bottom: {
    perspective: "1200px",
    rotateX: 45,
    rotateY: 0,
    rotateZ: 30,
  },
  isometricOffAxis4Left: {
    perspective: "1200px",
    rotateX: -25,
    rotateY: 25,
    rotateZ: 0,
  },
  isometricOffAxis4Right: {
    perspective: "1200px",
    rotateX: -25,
    rotateY: -25,
    rotateZ: 0,
  },
  isometricOffAxis4Bottom: {
    perspective: "1200px",
    rotateX: 45,
    rotateY: 0,
    rotateZ: -30,
  },

  // Oblique views
  obliqueTopLeft: {
    perspective: "900px",
    rotateX: -20,
    rotateY: 20,
    rotateZ: 0,
  },
  obliqueTop: {
    perspective: "900px",
    rotateX: -25,
    rotateY: 0,
    rotateZ: 0,
  },
  obliqueTopRight: {
    perspective: "900px",
    rotateX: -20,
    rotateY: -20,
    rotateZ: 0,
  },
  obliqueLeft: {
    perspective: "900px",
    rotateX: 0,
    rotateY: 25,
    rotateZ: 0,
  },
  obliqueRight: {
    perspective: "900px",
    rotateX: 0,
    rotateY: -25,
    rotateZ: 0,
  },
  obliqueBottomLeft: {
    perspective: "900px",
    rotateX: 20,
    rotateY: 20,
    rotateZ: 0,
  },
  obliqueBottom: {
    perspective: "900px",
    rotateX: 25,
    rotateY: 0,
    rotateZ: 0,
  },
  obliqueBottomRight: {
    perspective: "900px",
    rotateX: 20,
    rotateY: -20,
    rotateZ: 0,
  },
};

/**
 * Resolve camera preset name and explicit rotation overrides into final
 * CSS perspective + rotation values.
 */
export function getCameraTransform(scene3d: Scene3dParams | undefined): {
  perspective?: string;
  rotateX: number;
  rotateY: number;
  rotateZ: number;
} {
  if (!scene3d) return { rotateX: 0, rotateY: 0, rotateZ: 0 };

  // Start from camera preset defaults
  const preset = scene3d.cameraPreset
    ? CAMERA_PRESET_MAP[scene3d.cameraPreset]
    : undefined;

  let perspective = preset?.perspective;
  let rotateX = preset?.rotateX ?? 0;
  let rotateY = preset?.rotateY ?? 0;
  let rotateZ = preset?.rotateZ ?? 0;

  // Explicit rotation angles override preset defaults (values in 1/60000 degrees)
  if (scene3d.cameraRotX) {
    rotateX = -(scene3d.cameraRotX / 60000);
  }
  if (scene3d.cameraRotY) {
    rotateY = scene3d.cameraRotY / 60000;
  }
  if (scene3d.cameraRotZ) {
    rotateZ = scene3d.cameraRotZ / 60000;
  }

  // If we have explicit rotations but no preset, apply a default perspective
  if (!perspective && (rotateX !== 0 || rotateY !== 0 || rotateZ !== 0)) {
    perspective = "800px";
  }

  return { perspective, rotateX, rotateY, rotateZ };
}

// ── Light Rig Mapping ────────────────────────────────────────────────────

/**
 * Light rig configuration for CSS gradient overlays that simulate directional
 * lighting. Each rig returns a semi-transparent gradient to overlay on the shape.
 */
interface LightRigCssConfig {
  /** Gradient overlay for lighting direction simulation. */
  backgroundImage?: string;
  /** Additional filter adjustments for the lighting mood. */
  filter?: string;
}

const LIGHT_RIG_MAP: Record<string, LightRigCssConfig> = {
  // 3-point lighting: highlight top-left, fill right, back bottom
  threePt: {
    backgroundImage:
      "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 40%, rgba(0,0,0,0.06) 100%)",
  },
  // Balanced: even soft illumination
  balanced: {
    backgroundImage:
      "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 50%, rgba(0,0,0,0.04) 100%)",
  },
  // Harsh: strong directional with deep shadows
  harsh: {
    backgroundImage:
      "linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 30%, rgba(0,0,0,0.15) 100%)",
    filter: "contrast(1.08)",
  },
  // Flat: no directional light
  flat: {},
  // Flood: bright, even illumination
  flood: {
    filter: "brightness(1.08)",
  },
  // Contrasting: strong key and fill
  contrasting: {
    backgroundImage:
      "linear-gradient(120deg, rgba(255,255,255,0.18) 0%, transparent 35%, rgba(0,0,0,0.12) 100%)",
    filter: "contrast(1.1)",
  },
  // Morning: warm, low-angle light from the left
  morning: {
    backgroundImage:
      "linear-gradient(90deg, rgba(255,240,200,0.15) 0%, transparent 50%, rgba(0,0,0,0.05) 100%)",
  },
  // Sunrise: warm golden light from below-left
  sunrise: {
    backgroundImage:
      "linear-gradient(45deg, rgba(255,220,180,0.15) 0%, transparent 50%, rgba(0,0,0,0.06) 100%)",
  },
  // Sunset: warm orange tint from the right
  sunset: {
    backgroundImage:
      "linear-gradient(270deg, rgba(255,180,100,0.12) 0%, transparent 50%, rgba(0,0,0,0.06) 100%)",
  },
  // Chilly: cool blue tint
  chilly: {
    backgroundImage:
      "linear-gradient(180deg, rgba(180,200,255,0.1) 0%, transparent 50%, rgba(0,0,0,0.06) 100%)",
  },
  // Freezing: strong cold tint
  freezing: {
    backgroundImage:
      "linear-gradient(180deg, rgba(160,190,255,0.15) 0%, transparent 40%, rgba(0,0,0,0.08) 100%)",
    filter: "saturate(0.9)",
  },
  // Glow: soft ambient glow
  glow: {
    backgroundImage:
      "radial-gradient(ellipse at center, rgba(255,255,255,0.1) 0%, transparent 70%)",
  },
  // Bright room: well-lit interior
  brightRoom: {
    backgroundImage:
      "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 60%)",
    filter: "brightness(1.05)",
  },
  // Soft: diffused, low-contrast light
  soft: {
    backgroundImage:
      "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 50%)",
    filter: "contrast(0.95)",
  },
  // Two-point: key from left, fill from right
  twoPt: {
    backgroundImage:
      "linear-gradient(90deg, rgba(255,255,255,0.1) 0%, transparent 40%, rgba(255,255,255,0.06) 100%)",
  },
  // Legacy flat variants
  legacyFlat1: {},
  legacyFlat2: {},
  legacyFlat3: {},
  legacyFlat4: {},
  // Legacy normal variants
  legacyNormal1: {
    backgroundImage:
      "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%)",
  },
  legacyNormal2: {
    backgroundImage:
      "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 50%)",
  },
  legacyNormal3: {
    backgroundImage:
      "linear-gradient(120deg, rgba(255,255,255,0.1) 0%, transparent 50%)",
  },
  legacyNormal4: {
    backgroundImage:
      "linear-gradient(150deg, rgba(255,255,255,0.1) 0%, transparent 50%)",
  },
  // Legacy harsh variants
  legacyHarsh1: {
    backgroundImage:
      "linear-gradient(135deg, rgba(255,255,255,0.18) 0%, transparent 30%, rgba(0,0,0,0.12) 100%)",
    filter: "contrast(1.1)",
  },
  legacyHarsh2: {
    backgroundImage:
      "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 30%, rgba(0,0,0,0.1) 100%)",
    filter: "contrast(1.08)",
  },
  legacyHarsh3: {
    backgroundImage:
      "linear-gradient(120deg, rgba(255,255,255,0.18) 0%, transparent 30%, rgba(0,0,0,0.12) 100%)",
    filter: "contrast(1.1)",
  },
  legacyHarsh4: {
    backgroundImage:
      "linear-gradient(150deg, rgba(255,255,255,0.18) 0%, transparent 30%, rgba(0,0,0,0.12) 100%)",
    filter: "contrast(1.1)",
  },
};

/**
 * Rotate the light-rig gradient direction based on `lightRigDirection`.
 * The direction token shifts the gradient origin (e.g. "t" = light from top,
 * "bl" = light from bottom-left).
 */
function getLightDirectionAngle(direction: string | undefined): number {
  switch (direction) {
    case "t":
      return 180; // light from top → gradient top-to-bottom
    case "b":
      return 0; // light from bottom
    case "l":
      return 90; // light from left
    case "r":
      return 270; // light from right
    case "tl":
      return 135; // light from top-left (default for most rigs)
    case "tr":
      return 225; // light from top-right
    case "bl":
      return 45; // light from bottom-left
    case "br":
      return 315; // light from bottom-right
    default:
      return 135; // default: top-left
  }
}

/**
 * Get light rig CSS overrides for a given light rig type and direction.
 */
export function getLightRigCss(
  lightRigType: string | undefined,
  lightRigDirection: string | undefined,
): LightRigCssConfig {
  if (!lightRigType) return {};
  const config = LIGHT_RIG_MAP[lightRigType];
  if (!config) return {};

  // If the config has a gradient and a custom direction, rotate the gradient
  if (config.backgroundImage && lightRigDirection) {
    const angle = getLightDirectionAngle(lightRigDirection);
    // Replace the angle in the gradient — only for linear-gradient
    if (config.backgroundImage.startsWith("linear-gradient(")) {
      const withoutPrefix = config.backgroundImage.replace(
        /^linear-gradient\(\d+deg/,
        `linear-gradient(${angle}deg`,
      );
      return { ...config, backgroundImage: withoutPrefix };
    }
  }

  return config;
}

// ── Bevel Preset Mapping ─────────────────────────────────────────────────

/**
 * Bevel CSS configuration per preset type. Returns the inset box-shadow
 * layers that approximate the bevel appearance.
 */
function getBevelShadow(
  bevelType: string,
  bW: number,
  bH: number,
  isBottom: boolean,
): string {
  // For bottom bevel, highlight and shadow directions are reversed
  const hlDir = isBottom ? -1 : 1;
  const shDir = isBottom ? 1 : -1;
  const hlOpacity = isBottom ? 0.2 : 0.3;
  const shOpacity = isBottom ? 0.3 : 0.2;

  switch (bevelType) {
    case "circle":
      // Rounded smooth bevel — larger blur for soft edge
      return [
        `inset ${hlDir * bW}px ${hlDir * bH}px ${Math.max(bW, bH) + 2}px rgba(255,255,255,${hlOpacity + 0.1})`,
        `inset ${shDir * bW}px ${shDir * bH}px ${Math.max(bW, bH) + 2}px rgba(0,0,0,${shOpacity + 0.05})`,
      ].join(", ");

    case "relaxedInset":
      // Soft inset — subtle, low-contrast
      return [
        `inset ${hlDir * bW}px ${hlDir * bH}px ${Math.max(bW, bH) + 4}px rgba(255,255,255,${hlOpacity - 0.05})`,
        `inset ${shDir * bW}px ${shDir * bH}px ${Math.max(bW, bH) + 4}px rgba(0,0,0,${shOpacity - 0.05})`,
      ].join(", ");

    case "hardEdge":
      // Sharp bevel — minimal blur, high contrast
      return [
        `inset ${hlDir * bW}px ${hlDir * bH}px 0 rgba(255,255,255,${hlOpacity + 0.15})`,
        `inset ${shDir * bW}px ${shDir * bH}px 0 rgba(0,0,0,${shOpacity + 0.15})`,
      ].join(", ");

    case "cross":
      // Cross bevel — dual axis highlight/shadow
      return [
        `inset ${hlDir * bW}px 0 ${bW}px rgba(255,255,255,${hlOpacity})`,
        `inset 0 ${hlDir * bH}px ${bH}px rgba(255,255,255,${hlOpacity})`,
        `inset ${shDir * bW}px 0 ${bW}px rgba(0,0,0,${shOpacity})`,
        `inset 0 ${shDir * bH}px ${bH}px rgba(0,0,0,${shOpacity})`,
      ].join(", ");

    case "coolSlant":
      // Slanted bevel — asymmetric highlight
      return [
        `inset ${hlDir * bW}px ${hlDir * Math.round(bH * 0.5)}px ${Math.max(bW, bH)}px rgba(255,255,255,${hlOpacity + 0.1})`,
        `inset ${shDir * Math.round(bW * 0.5)}px ${shDir * bH}px ${Math.max(bW, bH)}px rgba(0,0,0,${shOpacity + 0.1})`,
      ].join(", ");

    case "angle":
      // Diagonal highlight bevel
      return [
        `inset ${hlDir * bW}px ${hlDir * bH}px ${Math.round(Math.max(bW, bH) * 0.5)}px rgba(255,255,255,${hlOpacity + 0.15})`,
        `inset ${shDir * bW}px ${shDir * bH}px ${Math.round(Math.max(bW, bH) * 0.5)}px rgba(0,0,0,${shOpacity + 0.1})`,
      ].join(", ");

    case "softRound":
      // Very soft round bevel — large blur, low opacity
      return [
        `inset ${hlDir * bW}px ${hlDir * bH}px ${Math.max(bW, bH) + 6}px rgba(255,255,255,${hlOpacity})`,
        `inset ${shDir * bW}px ${shDir * bH}px ${Math.max(bW, bH) + 6}px rgba(0,0,0,${shOpacity - 0.05})`,
      ].join(", ");

    case "convex":
      // Convex/pillow bevel — highlight in center, shadow on edges
      return [
        `inset 0 0 ${Math.max(bW, bH) + 3}px rgba(255,255,255,${hlOpacity + 0.05})`,
        `inset ${hlDir * bW}px ${hlDir * bH}px ${Math.max(bW, bH)}px rgba(255,255,255,${hlOpacity})`,
        `inset ${shDir * bW}px ${shDir * bH}px ${Math.max(bW, bH)}px rgba(0,0,0,${shOpacity})`,
      ].join(", ");

    case "slope":
      // Slope bevel — gradual transition
      return [
        `inset ${hlDir * bW}px ${hlDir * bH}px ${Math.max(bW, bH) + 3}px rgba(255,255,255,${hlOpacity + 0.05})`,
        `inset ${shDir * Math.round(bW * 0.7)}px ${shDir * Math.round(bH * 0.7)}px ${Math.max(bW, bH)}px rgba(0,0,0,${shOpacity})`,
      ].join(", ");

    case "divot":
      // Divot — small indentation, looks like a carved groove
      return [
        `inset ${shDir * Math.round(bW * 0.5)}px ${shDir * Math.round(bH * 0.5)}px ${Math.round(Math.max(bW, bH) * 0.5)}px rgba(255,255,255,${hlOpacity + 0.05})`,
        `inset ${hlDir * Math.round(bW * 0.5)}px ${hlDir * Math.round(bH * 0.5)}px ${Math.round(Math.max(bW, bH) * 0.5)}px rgba(0,0,0,${shOpacity + 0.1})`,
      ].join(", ");

    case "riblet":
      // Riblet — horizontal ridge lines
      return [
        `inset 0 ${hlDir * bH}px ${Math.round(bH * 0.5)}px rgba(255,255,255,${hlOpacity})`,
        `inset 0 ${shDir * bH}px ${Math.round(bH * 0.5)}px rgba(0,0,0,${shOpacity})`,
        `inset 0 ${hlDir * Math.round(bH * 2)}px ${bH}px rgba(255,255,255,${hlOpacity * 0.5})`,
      ].join(", ");

    case "artDeco":
      // Art deco — geometric, sharp, multiple layers
      return [
        `inset ${hlDir * bW}px ${hlDir * bH}px 0 rgba(255,255,255,${hlOpacity + 0.1})`,
        `inset ${hlDir * Math.round(bW * 2)}px ${hlDir * Math.round(bH * 2)}px 0 rgba(255,255,255,${hlOpacity * 0.5})`,
        `inset ${shDir * bW}px ${shDir * bH}px 0 rgba(0,0,0,${shOpacity + 0.1})`,
      ].join(", ");

    default:
      // Generic fallback — same as old behaviour
      return [
        `inset ${hlDir * bW}px ${hlDir * bH}px ${Math.max(bW, bH)}px rgba(255,255,255,${hlOpacity})`,
        `inset ${shDir * bW}px ${shDir * bH}px ${Math.max(bW, bH)}px rgba(0,0,0,${shOpacity})`,
      ].join(", ");
  }
}

// ── Extrusion Shadow Generation ──────────────────────────────────────────

/**
 * Darken a hex colour by a factor (0 = black, 1 = unchanged).
 * Used for the deepest extrusion layers to create depth gradient.
 */
function darkenColor(hex: string, factor: number): string {
  const clean = hex.replace("#", "");
  const r = Math.round(parseInt(clean.slice(0, 2), 16) * factor);
  const g = Math.round(parseInt(clean.slice(2, 4), 16) * factor);
  const b = Math.round(parseInt(clean.slice(4, 6), 16) * factor);
  return `rgb(${r},${g},${b})`;
}

/**
 * Compute extrusion shadow direction based on camera rotation.
 * When the camera looks from above, the extrusion extends downward,
 * and vice versa. Returns (dx, dy) unit offsets for shadow placement.
 */
function getExtrusionDirection(
  rotateX: number,
  rotateY: number,
): { dx: number; dy: number } {
  // Default extrusion direction: bottom-right diagonal
  let dx = 1;
  let dy = 1;

  // Adjust based on camera Y rotation (left/right viewing angle)
  if (rotateY > 5) {
    dx = -1; // Camera from left → extrusion goes left
  } else if (rotateY < -5) {
    dx = 1; // Camera from right → extrusion goes right
  }

  // Adjust based on camera X rotation (above/below)
  if (rotateX < -5) {
    dy = 1; // Camera from above → extrusion goes down
  } else if (rotateX > 5) {
    dy = -1; // Camera from below → extrusion goes up
  }

  return { dx, dy };
}

/**
 * Generate box-shadow layers for extrusion depth effect.
 *
 * @param shape3d - Shape 3D properties with extrusion settings.
 * @param cameraRotX - Effective camera X rotation in degrees.
 * @param cameraRotY - Effective camera Y rotation in degrees.
 * @returns Box-shadow CSS string, or undefined if no extrusion.
 */
export function getExtrusionShadow(
  shape3d: Shape3dParams | undefined,
  cameraRotX = 0,
  cameraRotY = 0,
): string | undefined {
  if (!shape3d?.extrusionHeight || shape3d.extrusionHeight <= 0) {
    return undefined;
  }

  const rawDepthPx = Math.round(shape3d.extrusionHeight / EMU_PER_PX);
  if (rawDepthPx <= 0) return undefined;

  // For large depths, use stepping so we still render full depth
  // but limit the total number of CSS box-shadow layers for performance.
  const layerCount = Math.min(rawDepthPx, MAX_EXTRUSION_LAYERS);
  const step = rawDepthPx / layerCount;

  const extColor = shape3d.extrusionColor || "#888888";
  const { dx, dy } = getExtrusionDirection(cameraRotX, cameraRotY);
  const depthShadows: string[] = [];

  for (let i = 1; i <= layerCount; i++) {
    const offset = Math.round(i * step);
    // Gradually darken the colour for deeper layers
    const darkenFactor = 1 - (i / layerCount) * 0.25;
    const layerColor =
      i > layerCount * 0.7 ? darkenColor(extColor, darkenFactor) : extColor;
    // Use a slight spread for stepped layers to fill gaps
    const spread = step > 1.5 ? Math.ceil(step / 2) : 0;
    depthShadows.push(`${dx * offset}px ${dy * offset}px ${spread}px ${layerColor}`);
  }

  // Final soft shadow for depth perception
  const finalOffset = rawDepthPx + 1;
  depthShadows.push(
    `${dx * finalOffset}px ${dy * finalOffset}px ${Math.max(2, Math.round(rawDepthPx / 3))}px rgba(0,0,0,0.2)`,
  );

  return depthShadows.join(", ");
}

// ── Contour Effect ───────────────────────────────────────────────────────

/**
 * Generate contour (outline) shadow for 3D shapes.
 * Contour adds an outline effect around the shape, approximated via box-shadow.
 */
function getContourShadow(shape3d: Shape3dParams | undefined): string | undefined {
  if (!shape3d?.contourWidth || shape3d.contourWidth <= 0) return undefined;
  const widthPx = Math.max(1, Math.round(shape3d.contourWidth / EMU_PER_PX));
  const color = shape3d.contourColor || "#000000";
  return `0 0 0 ${widthPx}px ${color}`;
}

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Compute CSS 3D transform styles from scene camera settings.
 *
 * Maps OOXML camera presets (e.g. "perspectiveFront", "isometricLeftDown")
 * and explicit rotation angles to CSS `perspective` and `transform` properties.
 */
export function get3DTransformStyle(
  scene3d: Scene3dParams | undefined,
  shape3d?: Shape3dParams | undefined,
): React.CSSProperties {
  if (!scene3d && !shape3d) return {};

  const { perspective, rotateX, rotateY, rotateZ } =
    getCameraTransform(scene3d);

  const style: React.CSSProperties = {};

  if (perspective) {
    style.perspective = perspective;
  }

  const hasRotation = rotateX !== 0 || rotateY !== 0 || rotateZ !== 0;
  const has3D = hasRotation || !!perspective || !!shape3d;

  if (hasRotation) {
    const transforms: string[] = [];
    if (rotateX !== 0) transforms.push(`rotateX(${rotateX}deg)`);
    if (rotateY !== 0) transforms.push(`rotateY(${rotateY}deg)`);
    if (rotateZ !== 0) transforms.push(`rotateZ(${rotateZ}deg)`);
    style.transform = transforms.join(" ");
  }

  // Performance: hint the browser about 3D transforms
  if (has3D) {
    style.willChange = "transform";
  }

  return style;
}

/**
 * Compute bevel-related CSS box-shadow inset layers.
 */
export function get3DBevelShadow(
  shape3d: Shape3dParams | undefined,
): string | undefined {
  if (!shape3d) return undefined;

  const parts: string[] = [];

  // Top bevel
  if (shape3d.bevelTopType && shape3d.bevelTopType !== "none") {
    const bW = shape3d.bevelTopWidth
      ? Math.max(1, Math.round(shape3d.bevelTopWidth / EMU_PER_PX))
      : 3;
    const bH = shape3d.bevelTopHeight
      ? Math.max(1, Math.round(shape3d.bevelTopHeight / EMU_PER_PX))
      : 3;
    parts.push(getBevelShadow(shape3d.bevelTopType, bW, bH, false));
  }

  // Bottom bevel
  if (shape3d.bevelBottomType && shape3d.bevelBottomType !== "none") {
    const bW = shape3d.bevelBottomWidth
      ? Math.max(1, Math.round(shape3d.bevelBottomWidth / EMU_PER_PX))
      : 3;
    const bH = shape3d.bevelBottomHeight
      ? Math.max(1, Math.round(shape3d.bevelBottomHeight / EMU_PER_PX))
      : 3;
    parts.push(getBevelShadow(shape3d.bevelBottomType, bW, bH, true));
  }

  return parts.length > 0 ? parts.join(", ") : undefined;
}

/**
 * Compute CSS filter value for material preset.
 */
export function get3DMaterialFilter(
  shape3d: Shape3dParams | undefined,
): string | undefined {
  if (!shape3d?.presetMaterial) return undefined;
  const overrides = getMaterialCssOverrides(
    shape3d.presetMaterial as MaterialPresetType,
  );
  return overrides.filter;
}

/**
 * Apply 3D effects (perspective, rotation, extrusion, bevel, material,
 * light rig) to a mutable CSS properties object.
 *
 * This is the main integration point called by `getShapeVisualStyle`.
 */
export function apply3dEffects(
  base: React.CSSProperties,
  scene3d: Scene3dParams | undefined,
  shape3d: Shape3dParams | undefined,
): void {
  if (!scene3d && !shape3d) return;

  // ── Camera / Perspective ──
  const { perspective, rotateX, rotateY, rotateZ } =
    getCameraTransform(scene3d);

  if (perspective) {
    base.perspective = perspective;
  }

  const hasRotation = rotateX !== 0 || rotateY !== 0 || rotateZ !== 0;

  if (hasRotation) {
    const transforms: string[] = [];
    if (rotateX !== 0) transforms.push(`rotateX(${rotateX}deg)`);
    if (rotateY !== 0) transforms.push(`rotateY(${rotateY}deg)`);
    if (rotateZ !== 0) transforms.push(`rotateZ(${rotateZ}deg)`);
    base.transform = transforms.join(" ");
  }

  // Performance hint for 3D-transformed elements
  if (hasRotation || perspective || shape3d) {
    base.willChange = "transform";
    // Ensure 3D elements create a stacking context for proper z-index layering
    // when multiple 3D shapes overlap on the same slide
    base.transformStyle = "preserve-3d";
  }

  // ── Extrusion depth → stacked box-shadow ──
  const extrusionShadow = getExtrusionShadow(shape3d, rotateX, rotateY);
  if (extrusionShadow) {
    base.boxShadow = base.boxShadow
      ? `${base.boxShadow}, ${extrusionShadow}`
      : extrusionShadow;
  }

  // ── Contour (outline ring) ──
  const contourShadow = getContourShadow(shape3d);
  if (contourShadow) {
    base.boxShadow = base.boxShadow
      ? `${base.boxShadow}, ${contourShadow}`
      : contourShadow;
  }

  // ── Bevel highlights/shadows ──
  const bevelShadow = get3DBevelShadow(shape3d);
  if (bevelShadow) {
    base.boxShadow = base.boxShadow
      ? `${base.boxShadow}, ${bevelShadow}`
      : bevelShadow;
  }

  // ── Backdrop plane → ground-plane shadow ──
  if (scene3d?.hasBackdrop) {
    const backdropShadow = "0px 8px 24px -4px rgba(0,0,0,0.25)";
    base.boxShadow = base.boxShadow
      ? `${base.boxShadow}, ${backdropShadow}`
      : backdropShadow;
  }

  // ── Material preset → CSS filter/opacity ──
  if (shape3d?.presetMaterial) {
    const matOverrides = getMaterialCssOverrides(
      shape3d.presetMaterial as MaterialPresetType,
    );
    if (matOverrides.filter) {
      base.filter = base.filter
        ? `${base.filter} ${matOverrides.filter}`
        : matOverrides.filter;
    }
    if (matOverrides.opacity !== undefined) {
      base.opacity = matOverrides.opacity;
    }
    if (matOverrides.boxShadow) {
      base.boxShadow = base.boxShadow
        ? `${base.boxShadow}, ${matOverrides.boxShadow}`
        : matOverrides.boxShadow;
    }
  }

  // ── Light rig → gradient overlay and filter adjustment ──
  const lightRig = getLightRigCss(
    scene3d?.lightRigType,
    scene3d?.lightRigDirection,
  );
  if (lightRig.filter) {
    base.filter = base.filter
      ? `${base.filter} ${lightRig.filter}`
      : lightRig.filter;
  }
  if (lightRig.backgroundImage) {
    // Layer the light gradient on top of existing background
    base.backgroundImage = base.backgroundImage
      ? `${lightRig.backgroundImage}, ${base.backgroundImage}`
      : lightRig.backgroundImage;
  }
}
