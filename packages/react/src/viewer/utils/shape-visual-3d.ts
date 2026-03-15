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

/**
 * Maximum cap on rendered extrusion depth (in px) for side-panel 3D mode.
 * Prevents excessively tall panels from breaking layout.
 */
const MAX_EXTRUSION_DEPTH_PX = 80;

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
  // 3-point lighting: key light top-left, fill right, back bottom — the most common setup
  threePt: {
    backgroundImage: [
      "linear-gradient(135deg, rgba(255,255,255,0.14) 0%, transparent 35%)",
      "linear-gradient(315deg, rgba(255,255,255,0.05) 0%, transparent 25%)",
      "linear-gradient(0deg, rgba(0,0,0,0.06) 0%, transparent 20%)",
    ].join(", "),
  },
  // Balanced: even soft illumination from multiple directions
  balanced: {
    backgroundImage: [
      "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 40%)",
      "linear-gradient(0deg, rgba(255,255,255,0.03) 0%, transparent 30%)",
      "linear-gradient(90deg, rgba(255,255,255,0.02) 0%, transparent 20%)",
    ].join(", "),
  },
  // Harsh: strong directional with deep shadows, high-contrast drama
  harsh: {
    backgroundImage: [
      "linear-gradient(135deg, rgba(255,255,255,0.22) 0%, transparent 28%)",
      "linear-gradient(315deg, rgba(0,0,0,0.12) 0%, transparent 40%)",
    ].join(", "),
    filter: "contrast(1.08)",
  },
  // Flat: no directional light — uniform ambient
  flat: {},
  // Flood: bright, even illumination — washes out shadows
  flood: {
    backgroundImage:
      "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.03) 50%, transparent 100%)",
    filter: "brightness(1.08)",
  },
  // Contrasting: strong key and fill with visible shadow transition
  contrasting: {
    backgroundImage: [
      "linear-gradient(120deg, rgba(255,255,255,0.2) 0%, transparent 30%)",
      "linear-gradient(300deg, rgba(0,0,0,0.1) 0%, transparent 35%)",
    ].join(", "),
    filter: "contrast(1.1)",
  },
  // Morning: warm, low-angle light from the left
  morning: {
    backgroundImage: [
      "linear-gradient(90deg, rgba(255,240,200,0.16) 0%, transparent 45%)",
      "linear-gradient(270deg, rgba(0,0,0,0.04) 0%, transparent 30%)",
    ].join(", "),
  },
  // Sunrise: warm golden light from below-left
  sunrise: {
    backgroundImage: [
      "linear-gradient(45deg, rgba(255,220,180,0.16) 0%, transparent 40%)",
      "radial-gradient(ellipse at 20% 80%, rgba(255,200,140,0.08) 0%, transparent 50%)",
    ].join(", "),
  },
  // Sunset: warm orange tint from the right
  sunset: {
    backgroundImage: [
      "linear-gradient(270deg, rgba(255,180,100,0.14) 0%, transparent 45%)",
      "radial-gradient(ellipse at 85% 50%, rgba(255,160,60,0.06) 0%, transparent 40%)",
    ].join(", "),
  },
  // Chilly: cool blue tint — cold ambient
  chilly: {
    backgroundImage: [
      "linear-gradient(180deg, rgba(180,200,255,0.1) 0%, transparent 50%)",
      "radial-gradient(ellipse at center, rgba(200,220,255,0.04) 0%, transparent 60%)",
    ].join(", "),
  },
  // Freezing: strong cold tint — icy environment
  freezing: {
    backgroundImage: [
      "linear-gradient(180deg, rgba(160,190,255,0.16) 0%, transparent 40%)",
      "linear-gradient(0deg, rgba(140,170,255,0.06) 0%, transparent 25%)",
    ].join(", "),
    filter: "saturate(0.9)",
  },
  // Glow: soft ambient glow from center
  glow: {
    backgroundImage:
      "radial-gradient(ellipse at center, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 40%, transparent 70%)",
  },
  // Bright room: well-lit interior — overhead and ambient
  brightRoom: {
    backgroundImage: [
      "linear-gradient(180deg, rgba(255,255,255,0.1) 0%, transparent 50%)",
      "radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.06) 0%, transparent 60%)",
    ].join(", "),
    filter: "brightness(1.05)",
  },
  // Soft: diffused, low-contrast light — overcast feel
  soft: {
    backgroundImage: [
      "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 40%)",
      "radial-gradient(ellipse at center, rgba(255,255,255,0.03) 0%, transparent 60%)",
    ].join(", "),
    filter: "contrast(0.95)",
  },
  // Two-point: key from left, fill from right — even bilateral lighting
  twoPt: {
    backgroundImage: [
      "linear-gradient(90deg, rgba(255,255,255,0.12) 0%, transparent 35%)",
      "linear-gradient(270deg, rgba(255,255,255,0.07) 0%, transparent 30%)",
    ].join(", "),
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
    backgroundImage: [
      "linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 28%)",
      "linear-gradient(315deg, rgba(0,0,0,0.1) 0%, transparent 35%)",
    ].join(", "),
    filter: "contrast(1.1)",
  },
  legacyHarsh2: {
    backgroundImage: [
      "linear-gradient(135deg, rgba(255,255,255,0.16) 0%, transparent 28%)",
      "linear-gradient(315deg, rgba(0,0,0,0.08) 0%, transparent 35%)",
    ].join(", "),
    filter: "contrast(1.08)",
  },
  legacyHarsh3: {
    backgroundImage: [
      "linear-gradient(120deg, rgba(255,255,255,0.2) 0%, transparent 28%)",
      "linear-gradient(300deg, rgba(0,0,0,0.1) 0%, transparent 35%)",
    ].join(", "),
    filter: "contrast(1.1)",
  },
  legacyHarsh4: {
    backgroundImage: [
      "linear-gradient(150deg, rgba(255,255,255,0.2) 0%, transparent 28%)",
      "linear-gradient(330deg, rgba(0,0,0,0.1) 0%, transparent 35%)",
    ].join(", "),
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
 * Rotate all linear-gradient angles in a background-image string by a
 * given offset. Radial gradients are left untouched since they have no
 * inherent direction. Each `linear-gradient(Ndeg` is shifted.
 */
function rotateGradientAngles(
  backgroundImage: string,
  angleDelta: number,
): string {
  if (angleDelta === 0) return backgroundImage;
  return backgroundImage.replace(
    /linear-gradient\((\d+)deg/g,
    (_match, degStr) => {
      const newAngle = (parseInt(degStr, 10) + angleDelta + 360) % 360;
      return `linear-gradient(${newAngle}deg`;
    },
  );
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

  // If the config has gradients and a custom direction, rotate all gradient angles
  if (config.backgroundImage && lightRigDirection) {
    const targetAngle = getLightDirectionAngle(lightRigDirection);
    // Default direction is 135deg (top-left), so compute delta
    const delta = targetAngle - 135;
    if (delta !== 0) {
      return {
        ...config,
        backgroundImage: rotateGradientAngles(config.backgroundImage, delta),
      };
    }
  }

  return config;
}

// ── Bevel Preset Mapping ─────────────────────────────────────────────────

/**
 * Bevel CSS configuration per preset type. Returns the inset box-shadow
 * layers that approximate the bevel appearance. Each bevel type produces
 * a distinct visual:
 * - highlight layer(s) on the lit edge (top-left by default)
 * - shadow layer(s) on the opposite edge
 * - optional inner glow, ridge, or geometric accent layers
 *
 * The `isBottom` flag reverses the lighting direction so that bottom
 * bevels appear lit from the opposite direction.
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
  const maxDim = Math.max(bW, bH);

  switch (bevelType) {
    case "circle":
      // Rounded smooth bevel — soft highlight edge with inner glow
      return [
        `inset ${hlDir * bW}px ${hlDir * bH}px ${maxDim + 2}px rgba(255,255,255,${hlOpacity + 0.12})`,
        `inset ${hlDir * Math.round(bW * 0.5)}px ${hlDir * Math.round(bH * 0.5)}px ${maxDim + 4}px rgba(255,255,255,${hlOpacity * 0.4})`,
        `inset ${shDir * bW}px ${shDir * bH}px ${maxDim + 2}px rgba(0,0,0,${shOpacity + 0.06})`,
        `inset ${shDir * Math.round(bW * 0.5)}px ${shDir * Math.round(bH * 0.5)}px ${maxDim + 4}px rgba(0,0,0,${shOpacity * 0.3})`,
      ].join(", ");

    case "relaxedInset":
      // Soft inset — very subtle, low-contrast, wide blur
      return [
        `inset ${hlDir * bW}px ${hlDir * bH}px ${maxDim + 5}px rgba(255,255,255,${hlOpacity - 0.04})`,
        `inset ${shDir * bW}px ${shDir * bH}px ${maxDim + 5}px rgba(0,0,0,${shOpacity - 0.04})`,
        `inset 0 0 ${maxDim + 8}px rgba(0,0,0,${shOpacity * 0.15})`,
      ].join(", ");

    case "hardEdge":
      // Sharp bevel — zero blur, crisp edge, high contrast
      return [
        `inset ${hlDir * bW}px ${hlDir * bH}px 0 rgba(255,255,255,${hlOpacity + 0.18})`,
        `inset ${shDir * bW}px ${shDir * bH}px 0 rgba(0,0,0,${shOpacity + 0.18})`,
        `inset ${hlDir * Math.round(bW * 0.4)}px ${hlDir * Math.round(bH * 0.4)}px 0 rgba(255,255,255,${hlOpacity * 0.3})`,
      ].join(", ");

    case "cross":
      // Cross bevel — dual axis highlight/shadow creating a cross-hatch emboss
      return [
        `inset ${hlDir * bW}px 0 ${bW}px rgba(255,255,255,${hlOpacity})`,
        `inset 0 ${hlDir * bH}px ${bH}px rgba(255,255,255,${hlOpacity})`,
        `inset ${shDir * bW}px 0 ${bW}px rgba(0,0,0,${shOpacity})`,
        `inset 0 ${shDir * bH}px ${bH}px rgba(0,0,0,${shOpacity})`,
        `inset 0 0 ${Math.round(maxDim * 0.5)}px rgba(0,0,0,${shOpacity * 0.2})`,
      ].join(", ");

    case "coolSlant":
      // Slanted bevel — asymmetric highlight, creates a swept-back look
      return [
        `inset ${hlDir * bW}px ${hlDir * Math.round(bH * 0.4)}px ${maxDim}px rgba(255,255,255,${hlOpacity + 0.12})`,
        `inset ${hlDir * Math.round(bW * 0.6)}px 0 ${Math.round(maxDim * 0.6)}px rgba(255,255,255,${hlOpacity * 0.4})`,
        `inset ${shDir * Math.round(bW * 0.4)}px ${shDir * bH}px ${maxDim}px rgba(0,0,0,${shOpacity + 0.1})`,
      ].join(", ");

    case "angle":
      // Diagonal highlight bevel — strong directional cut
      return [
        `inset ${hlDir * bW}px ${hlDir * bH}px ${Math.round(maxDim * 0.4)}px rgba(255,255,255,${hlOpacity + 0.16})`,
        `inset ${hlDir * Math.round(bW * 0.5)}px ${hlDir * Math.round(bH * 0.5)}px 0 rgba(255,255,255,${hlOpacity * 0.5})`,
        `inset ${shDir * bW}px ${shDir * bH}px ${Math.round(maxDim * 0.4)}px rgba(0,0,0,${shOpacity + 0.12})`,
      ].join(", ");

    case "softRound":
      // Very soft round bevel — large blur, low opacity, pillow-like
      return [
        `inset ${hlDir * bW}px ${hlDir * bH}px ${maxDim + 7}px rgba(255,255,255,${hlOpacity + 0.02})`,
        `inset ${hlDir * Math.round(bW * 0.3)}px ${hlDir * Math.round(bH * 0.3)}px ${maxDim + 10}px rgba(255,255,255,${hlOpacity * 0.3})`,
        `inset ${shDir * bW}px ${shDir * bH}px ${maxDim + 7}px rgba(0,0,0,${shOpacity - 0.04})`,
      ].join(", ");

    case "convex":
      // Convex/pillow bevel — central highlight, edge shadow, raised appearance
      return [
        `inset 0 0 ${maxDim + 4}px rgba(255,255,255,${hlOpacity + 0.06})`,
        `inset ${hlDir * bW}px ${hlDir * bH}px ${maxDim}px rgba(255,255,255,${hlOpacity + 0.02})`,
        `inset ${shDir * bW}px ${shDir * bH}px ${maxDim}px rgba(0,0,0,${shOpacity})`,
        `inset ${shDir * Math.round(bW * 1.5)}px ${shDir * Math.round(bH * 1.5)}px ${maxDim + 2}px rgba(0,0,0,${shOpacity * 0.3})`,
      ].join(", ");

    case "slope":
      // Slope bevel — gradual lit-to-shadow transition, wider spread
      return [
        `inset ${hlDir * bW}px ${hlDir * bH}px ${maxDim + 4}px rgba(255,255,255,${hlOpacity + 0.06})`,
        `inset ${hlDir * Math.round(bW * 0.5)}px ${hlDir * Math.round(bH * 0.5)}px ${maxDim + 6}px rgba(255,255,255,${hlOpacity * 0.35})`,
        `inset ${shDir * Math.round(bW * 0.7)}px ${shDir * Math.round(bH * 0.7)}px ${maxDim}px rgba(0,0,0,${shOpacity})`,
      ].join(", ");

    case "divot":
      // Divot — small indentation, carved groove effect (shadow on lit side)
      return [
        `inset ${shDir * Math.round(bW * 0.5)}px ${shDir * Math.round(bH * 0.5)}px ${Math.round(maxDim * 0.5)}px rgba(255,255,255,${hlOpacity + 0.06})`,
        `inset ${hlDir * Math.round(bW * 0.5)}px ${hlDir * Math.round(bH * 0.5)}px ${Math.round(maxDim * 0.5)}px rgba(0,0,0,${shOpacity + 0.12})`,
        `inset 0 0 ${Math.round(maxDim * 0.3)}px rgba(0,0,0,${shOpacity * 0.3})`,
      ].join(", ");

    case "riblet":
      // Riblet — horizontal ridge lines with alternating highlight/shadow
      return [
        `inset 0 ${hlDir * bH}px ${Math.round(bH * 0.4)}px rgba(255,255,255,${hlOpacity + 0.02})`,
        `inset 0 ${shDir * bH}px ${Math.round(bH * 0.4)}px rgba(0,0,0,${shOpacity})`,
        `inset 0 ${hlDir * Math.round(bH * 2)}px ${bH}px rgba(255,255,255,${hlOpacity * 0.45})`,
        `inset 0 ${shDir * Math.round(bH * 2)}px ${bH}px rgba(0,0,0,${shOpacity * 0.25})`,
      ].join(", ");

    case "artDeco":
      // Art deco — geometric, sharp, nested rectangular insets
      return [
        `inset ${hlDir * bW}px ${hlDir * bH}px 0 rgba(255,255,255,${hlOpacity + 0.12})`,
        `inset ${hlDir * Math.round(bW * 2)}px ${hlDir * Math.round(bH * 2)}px 0 rgba(255,255,255,${hlOpacity * 0.45})`,
        `inset ${hlDir * Math.round(bW * 3)}px ${hlDir * Math.round(bH * 3)}px 0 rgba(255,255,255,${hlOpacity * 0.2})`,
        `inset ${shDir * bW}px ${shDir * bH}px 0 rgba(0,0,0,${shOpacity + 0.12})`,
        `inset ${shDir * Math.round(bW * 2)}px ${shDir * Math.round(bH * 2)}px 0 rgba(0,0,0,${shOpacity * 0.4})`,
      ].join(", ");

    default:
      // Generic fallback
      return [
        `inset ${hlDir * bW}px ${hlDir * bH}px ${maxDim}px rgba(255,255,255,${hlOpacity})`,
        `inset ${shDir * bW}px ${shDir * bH}px ${maxDim}px rgba(0,0,0,${shOpacity})`,
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

// ── 3D Extrusion Panel Data ──────────────────────────────────────────────

/**
 * Describes one side face (panel) of a CSS 3D extrusion.
 * Each panel is a div positioned using CSS 3D transforms to form
 * the sides of the extruded shape.
 */
export interface ExtrusionPanel {
  /** Which side of the shape this panel represents. */
  side: "top" | "bottom" | "left" | "right";
  /** CSS styles for the panel (transform, width, height, background, etc.). */
  style: React.CSSProperties;
}

/**
 * Complete data for rendering a CSS 3D extrusion effect.
 */
export interface Extrusion3DData {
  /** Whether extrusion should be rendered (has depth and is valid). */
  hasExtrusion: boolean;
  /** Styles to apply to the outer wrapper that establishes the 3D context. */
  wrapperStyle: React.CSSProperties;
  /** Styles to apply to the front face (the original shape content). */
  frontFaceStyle: React.CSSProperties;
  /** Side panels that form the extrusion depth. */
  panels: ExtrusionPanel[];
  /** Material gradient overlay for front face (CSS backgroundImage). */
  materialOverlay?: string;
}

/**
 * Compute the lighting angle in CSS degrees based on camera rotation.
 * When the camera rotates right (rotateY < 0), the specular highlight
 * should shift left to remain consistent with the viewer's perspective.
 * Returns a gradient angle in CSS degrees (0 = upward, 90 = rightward).
 */
function getLightAngleFromCamera(rotateX: number, rotateY: number): number {
  // Base angle: 135deg = light from top-left
  let angle = 135;
  // Shift by camera Y rotation (yaw) — looking from right means highlight moves left
  angle -= rotateY * 0.6;
  // Shift by camera X rotation (pitch) — looking from above means highlight moves up
  angle += rotateX * 0.4;
  // Normalise to [0, 360)
  return ((angle % 360) + 360) % 360;
}

/**
 * Map camera rotation to a gradient angle for material simulation.
 * This creates a directional light feel on the front face.
 * The gradient direction adapts to the camera rotation so the specular
 * highlight appears to track the light source relative to the viewer.
 */
function getMaterialGradientOverlay(
  material: string | undefined,
  rotateX: number,
  rotateY: number,
): string | undefined {
  if (!material) return undefined;

  const angle = Math.round(getLightAngleFromCamera(rotateX, rotateY));
  const oppositeAngle = (angle + 180) % 360;

  switch (material) {
    case "plastic":
      return `linear-gradient(${angle}deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.05) 30%, transparent 60%, rgba(0,0,0,0.06) 100%)`;
    case "metal":
      return [
        `linear-gradient(${angle}deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.1) 20%, transparent 50%, rgba(0,0,0,0.1) 80%, rgba(255,255,255,0.08) 100%)`,
        `linear-gradient(${oppositeAngle}deg, rgba(255,255,255,0.06) 0%, transparent 30%)`,
      ].join(", ");
    case "softmetal":
      return `linear-gradient(${angle}deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.06) 25%, transparent 55%, rgba(0,0,0,0.06) 100%)`;
    case "warmMatte":
      return `linear-gradient(${angle}deg, rgba(255,240,220,0.08) 0%, transparent 60%, rgba(0,0,0,0.04) 100%)`;
    case "matte":
      return `linear-gradient(${angle}deg, rgba(255,255,255,0.04) 0%, transparent 50%, rgba(0,0,0,0.04) 100%)`;
    case "dkEdge":
      return `linear-gradient(${angle}deg, transparent 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.15) 100%)`;
    case "softEdge":
      return `radial-gradient(ellipse at center, rgba(255,255,255,0.06) 0%, transparent 55%, rgba(0,0,0,0.04) 100%)`;
    case "clear":
    case "translucentPowder":
      return `linear-gradient(${angle}deg, rgba(255,255,255,0.15) 0%, transparent 50%, rgba(0,0,0,0.05) 100%)`;
    case "powder":
      return `linear-gradient(${angle}deg, rgba(255,255,255,0.08) 0%, transparent 60%)`;
    default:
      return undefined;
  }
}

/**
 * Build complete 3D extrusion data for rendering side face panels.
 *
 * This generates CSS 3D transform data that creates real depth by positioning
 * div elements along the sides of the shape in 3D space. The front face is
 * translated forward by half the extrusion depth, and side panels connect
 * the front face to the back face.
 *
 * @param shape3d - Shape 3D extrusion/bevel properties.
 * @param scene3d - Scene camera/lighting properties.
 * @param fillColor - The resolved fill colour of the shape (hex string).
 * @param elementWidth - Width of the shape element in pixels.
 * @param elementHeight - Height of the shape element in pixels.
 * @returns Extrusion data including wrapper styles, front face styles, and panels.
 */
export function build3DExtrusionData(
  shape3d: Shape3dParams | undefined,
  scene3d: Scene3dParams | undefined,
  fillColor: string | undefined,
  elementWidth: number,
  elementHeight: number,
): Extrusion3DData {
  const empty: Extrusion3DData = {
    hasExtrusion: false,
    wrapperStyle: {},
    frontFaceStyle: {},
    panels: [],
  };

  if (!shape3d?.extrusionHeight || shape3d.extrusionHeight <= 0) {
    return empty;
  }

  const depthPx = Math.max(1, Math.round(shape3d.extrusionHeight / EMU_PER_PX));
  // Cap depth for visual sanity — very deep extrusions can break layouts
  const clampedDepth = Math.min(depthPx, MAX_EXTRUSION_DEPTH_PX);

  if (clampedDepth <= 0) return empty;

  const { perspective, rotateX, rotateY, rotateZ } = getCameraTransform(scene3d);

  // Use extrusion colour or darken the fill colour for side faces
  const extColor = shape3d.extrusionColor || fillColor || "#888888";
  const safeColor = extColor.startsWith("#") ? extColor : "#888888";
  // Side faces are darker than the front — lit side vs shadowed side
  const sideColorLit = darkenColor(safeColor, 0.75);
  const sideColor = darkenColor(safeColor, 0.65);
  const sideColorDeep = darkenColor(safeColor, 0.5);

  // Half-depth offset: front face is pushed forward by half the depth
  const halfDepth = clampedDepth / 2;

  // Wrapper style: establishes the 3D perspective context
  const wrapperStyle: React.CSSProperties = {
    position: "absolute" as const,
    inset: 0,
    transformStyle: "preserve-3d" as const,
    perspective: perspective || "800px",
    pointerEvents: "none" as const,
  };

  // Front face: translate forward in Z to sit at the front of the extrusion
  const frontFaceTransforms: string[] = [`translateZ(${halfDepth}px)`];
  if (rotateX !== 0) frontFaceTransforms.unshift(`rotateX(${rotateX}deg)`);
  if (rotateY !== 0) frontFaceTransforms.unshift(`rotateY(${rotateY}deg)`);
  if (rotateZ !== 0) frontFaceTransforms.unshift(`rotateZ(${rotateZ}deg)`);

  const frontFaceStyle: React.CSSProperties = {
    transform: frontFaceTransforms.join(" "),
    transformStyle: "preserve-3d" as const,
    backfaceVisibility: "hidden" as const,
  };

  // Build side panels
  const panels: ExtrusionPanel[] = [];

  // Determine which panels to show based on camera angle.
  // When looking from above (rotateX < 0), the bottom panel is visible.
  // When looking from below (rotateX > 0), the top panel is visible.
  // When looking from the left (rotateY > 0), the right panel is visible.
  // When looking from the right (rotateY < 0), the left panel is visible.
  // We also show panels for straight-on views to give depth perception.

  const showBottom = rotateX <= 2;
  const showTop = rotateX >= -2;
  const showRight = rotateY <= 5;
  const showLeft = rotateY >= -5;

  // Common side panel base styles
  const panelBase: React.CSSProperties = {
    position: "absolute" as const,
    backfaceVisibility: "hidden" as const,
    transformStyle: "preserve-3d" as const,
  };

  // Direction-aware gradients for side faces: panels facing the light
  // source get a lighter gradient, those facing away get darker.
  // For top-left default lighting, bottom and right panels are more lit.
  const isLitFromTop = rotateX <= 0; // camera above → bottom panel lit
  const isLitFromLeft = rotateY >= 0; // camera left → right panel lit

  // Vertical panels (top/bottom): front edge → back edge gradient
  const bottomGradient = isLitFromTop
    ? `linear-gradient(to bottom, ${sideColorLit}, ${sideColor})`
    : `linear-gradient(to bottom, ${sideColor}, ${sideColorDeep})`;
  const topGradient = isLitFromTop
    ? `linear-gradient(to bottom, ${sideColor}, ${sideColorDeep})`
    : `linear-gradient(to bottom, ${sideColorLit}, ${sideColor})`;

  // Horizontal panels (left/right): front edge → back edge gradient
  const rightGradient = isLitFromLeft
    ? `linear-gradient(to right, ${sideColor}, ${sideColorLit})`
    : `linear-gradient(to right, ${sideColorLit}, ${sideColorDeep})`;
  const leftGradient = isLitFromLeft
    ? `linear-gradient(to right, ${sideColorDeep}, ${sideColor})`
    : `linear-gradient(to right, ${sideColor}, ${sideColorLit})`;

  // ── Bottom panel ──
  // Positioned at the bottom edge of the shape, rotated 90deg around X axis
  if (showBottom) {
    const rotations: string[] = [];
    if (rotateX !== 0) rotations.push(`rotateX(${rotateX}deg)`);
    if (rotateY !== 0) rotations.push(`rotateY(${rotateY}deg)`);
    if (rotateZ !== 0) rotations.push(`rotateZ(${rotateZ}deg)`);
    panels.push({
      side: "bottom",
      style: {
        ...panelBase,
        width: elementWidth,
        height: clampedDepth,
        left: 0,
        top: elementHeight,
        transformOrigin: "top center",
        transform: [
          ...rotations,
          "rotateX(-90deg)",
          `translateZ(${-halfDepth}px)`,
        ].join(" "),
        background: bottomGradient,
      },
    });
  }

  // ── Top panel ──
  if (showTop) {
    const rotations: string[] = [];
    if (rotateX !== 0) rotations.push(`rotateX(${rotateX}deg)`);
    if (rotateY !== 0) rotations.push(`rotateY(${rotateY}deg)`);
    if (rotateZ !== 0) rotations.push(`rotateZ(${rotateZ}deg)`);
    panels.push({
      side: "top",
      style: {
        ...panelBase,
        width: elementWidth,
        height: clampedDepth,
        left: 0,
        top: 0,
        transformOrigin: "bottom center",
        transform: [
          ...rotations,
          "rotateX(90deg)",
          `translateZ(${-halfDepth}px)`,
        ].join(" "),
        background: topGradient,
      },
    });
  }

  // ── Right panel ──
  if (showRight) {
    const rotations: string[] = [];
    if (rotateX !== 0) rotations.push(`rotateX(${rotateX}deg)`);
    if (rotateY !== 0) rotations.push(`rotateY(${rotateY}deg)`);
    if (rotateZ !== 0) rotations.push(`rotateZ(${rotateZ}deg)`);
    panels.push({
      side: "right",
      style: {
        ...panelBase,
        width: clampedDepth,
        height: elementHeight,
        left: elementWidth,
        top: 0,
        transformOrigin: "left center",
        transform: [
          ...rotations,
          "rotateY(90deg)",
          `translateZ(${-halfDepth}px)`,
        ].join(" "),
        background: rightGradient,
      },
    });
  }

  // ── Left panel ──
  if (showLeft) {
    const rotations: string[] = [];
    if (rotateX !== 0) rotations.push(`rotateX(${rotateX}deg)`);
    if (rotateY !== 0) rotations.push(`rotateY(${rotateY}deg)`);
    if (rotateZ !== 0) rotations.push(`rotateZ(${rotateZ}deg)`);
    panels.push({
      side: "left",
      style: {
        ...panelBase,
        width: clampedDepth,
        height: elementHeight,
        left: 0,
        top: 0,
        transformOrigin: "right center",
        transform: [
          ...rotations,
          "rotateY(-90deg)",
          `translateZ(${-halfDepth}px)`,
        ].join(" "),
        background: leftGradient,
      },
    });
  }

  // Material overlay for front face
  const materialOverlay = getMaterialGradientOverlay(
    shape3d.presetMaterial,
    rotateX,
    rotateY,
  );

  return {
    hasExtrusion: true,
    wrapperStyle,
    frontFaceStyle,
    panels,
    materialOverlay,
  };
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
    const rotation3d = transforms.join(" ");
    // Compose with any existing transform (e.g. flip/rotation from getElementTransform)
    base.transform = base.transform
      ? `${base.transform} ${rotation3d}`
      : rotation3d;
  }

  // When extrusion is active, push the front face forward in Z-space so the
  // stacked box-shadow extrusion appears behind it.  This is a lightweight
  // complement to the full Extrusion3DOverlay panel rendering.
  if (shape3d?.extrusionHeight && shape3d.extrusionHeight > 0) {
    const depthPx = Math.max(1, Math.round(shape3d.extrusionHeight / EMU_PER_PX));
    const halfDepth = Math.min(depthPx, 80) / 2;
    const zTranslate = `translateZ(${halfDepth}px)`;
    base.transform = base.transform
      ? `${base.transform} ${zTranslate}`
      : zTranslate;
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

  // ── Material preset → CSS filter/opacity/gradient ──
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
    // Material background gradient (specular/environment simulation)
    if (matOverrides.backgroundImage) {
      base.backgroundImage = base.backgroundImage
        ? `${matOverrides.backgroundImage}, ${base.backgroundImage}`
        : matOverrides.backgroundImage;
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
