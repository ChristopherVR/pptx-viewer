/**
 * SVG path generators for WordArt text warp presets.
 *
 * Each generator produces an SVG path `d` attribute for a single text line
 * at a given normalised vertical position (t: 0 = top, 1 = bottom).
 */
import type { PptxTextWarpPreset } from "pptx-viewer-core";
import { cascadeUpPath, cascadeDownPath } from "./warp-path-cascade";

/** Produces an SVG path `d` attribute for a single text line. */
export type WarpPathGenerator = (w: number, h: number, t: number) => string;

/** Presets that require SVG textPath rendering (all others fall back to CSS). */
export const SVG_WARP_PRESETS: ReadonlySet<string> = new Set([
  // Priority 1
  "textArchUp",
  "textArchDown",
  "textCircle",
  "textWave1",
  "textInflate",
  "textDeflate",
  "textCurveUp",
  "textCurveDown",
  // Priority 2
  "textWave2",
  "textWave4",
  "textDoubleWave1",
  "textCanUp",
  "textCanDown",
  "textButton",
  "textRingInside",
  "textRingOutside",
  "textCascadeUp",
  "textCascadeDown",
  // Priority 3
  "textTriangle",
  "textTriangleInverted",
  "textStop",
  "textChevron",
  "textChevronInverted",
  "textInflateBottom",
  "textInflateTop",
  "textDeflateBottom",
  "textDeflateTop",
  // Priority 4 – slant, fade, pour, and compound deflate/inflate
  "textSlantUp",
  "textSlantDown",
  "textFadeRight",
  "textFadeLeft",
  "textFadeUp",
  "textFadeDown",
  "textArchUpPour",
  "textArchDownPour",
  "textCirclePour",
  "textButtonPour",
  "textDeflateInflate",
  "textDeflateInflateDeflate",
]);

// ── Priority 1 path generators ─────────────────────────────────────────

/** Concentric upward arcs from (0, h) → (w, h).  t=0 is the tallest arch. */
function archUpPath(w: number, h: number, t: number): string {
  const archH = h * (0.85 - t * 0.7);
  if (archH < 1) return `M 0,${h} L ${w},${h}`;
  return `M 0,${h} A ${w / 2},${archH} 0 0,1 ${w},${h}`;
}

/** Concentric downward arcs from (0, 0) → (w, 0).  t=1 is the deepest. */
function archDownPath(w: number, h: number, t: number): string {
  const archH = h * (0.15 + t * 0.7);
  if (archH < 1) return `M 0,0 L ${w},0`;
  return `M 0,0 A ${w / 2},${archH} 0 0,0 ${w},0`;
}

/** Full ellipse - concentric ellipses shrink towards centre. */
function circlePath(w: number, h: number, t: number): string {
  const cx = w / 2;
  const cy = h / 2;
  const scale = 1 - t * 0.55;
  const rx = Math.max(1, (w / 2) * scale);
  const ry = Math.max(1, (h / 2) * scale);
  return (
    `M ${cx},${cy - ry} ` +
    `A ${rx},${ry} 0 1,1 ${cx},${cy + ry} ` +
    `A ${rx},${ry} 0 1,1 ${cx},${cy - ry}`
  );
}

/** Single sine-wave from left to right using a cubic Bézier. */
function wave1Path(w: number, h: number, t: number): string {
  const yMid = h * (0.25 + t * 0.5);
  const amp = h * 0.2;
  return (
    `M 0,${yMid} ` +
    `C ${w / 3},${yMid - amp} ${(2 * w) / 3},${yMid + amp} ${w},${yMid}`
  );
}

/** Inflate - top lines bow upward, bottom lines bow downward. */
function inflatePath(w: number, h: number, t: number): string {
  const yBase = h * (0.15 + t * 0.7);
  const bulge = h * 0.3 * (1 - 2 * t);
  return `M 0,${yBase} Q ${w / 2},${yBase - bulge} ${w},${yBase}`;
}

/** Deflate - opposite of inflate. */
function deflatePath(w: number, h: number, t: number): string {
  const yBase = h * (0.15 + t * 0.7);
  const pinch = h * 0.3 * (2 * t - 1);
  return `M 0,${yBase} Q ${w / 2},${yBase - pinch} ${w},${yBase}`;
}

/** Gentle upward curve. */
function curveUpPath(w: number, h: number, t: number): string {
  const yBase = h * (0.35 + t * 0.55);
  const curve = h * 0.4 * (1 - t * 0.3);
  return `M 0,${yBase} Q ${w / 2},${yBase - curve} ${w},${yBase}`;
}

/** Gentle downward curve. */
function curveDownPath(w: number, h: number, t: number): string {
  const yBase = h * (0.1 + t * 0.55);
  const curve = h * 0.4 * (1 - (1 - t) * 0.3);
  return `M 0,${yBase} Q ${w / 2},${yBase + curve} ${w},${yBase}`;
}

// ── Priority 2 path generators ─────────────────────────────────────────

/** Inverted single wave (phase-shifted wave1). */
function wave2Path(w: number, h: number, t: number): string {
  const yMid = h * (0.25 + t * 0.5);
  const amp = h * 0.2;
  return (
    `M 0,${yMid} ` +
    `C ${w / 3},${yMid + amp} ${(2 * w) / 3},${yMid - amp} ${w},${yMid}`
  );
}

/** Double wave - two full wave cycles across the width. */
function wave4Path(w: number, h: number, t: number): string {
  const yMid = h * (0.25 + t * 0.5);
  const amp = h * 0.15;
  const q = w / 4;
  return (
    `M 0,${yMid} ` +
    `C ${q},${yMid - amp} ${2 * q},${yMid + amp} ${w / 2},${yMid} ` +
    `C ${w / 2 + q},${yMid - amp} ${w - q},${yMid + amp} ${w},${yMid}`
  );
}

/** Double wave with alternating rhythm. */
function doubleWave1Path(w: number, h: number, t: number): string {
  const yMid = h * (0.25 + t * 0.5);
  const amp = h * 0.18;
  const q = w / 4;
  return (
    `M 0,${yMid} ` +
    `C ${q},${yMid - amp} ${2 * q},${yMid + amp} ${w / 2},${yMid} ` +
    `C ${w / 2 + q},${yMid + amp} ${w - q},${yMid - amp} ${w},${yMid}`
  );
}

/** Cylindrical text - upward. */
function canUpPath(w: number, h: number, t: number): string {
  const archH = h * (0.35 - t * 0.25);
  if (archH < 1) return `M 0,${h} L ${w},${h}`;
  return `M 0,${h} A ${w / 2},${archH} 0 0,1 ${w},${h}`;
}

/** Cylindrical text - downward. */
function canDownPath(w: number, h: number, t: number): string {
  const archH = h * (0.1 + t * 0.25);
  if (archH < 1) return `M 0,0 L ${w},0`;
  return `M 0,0 A ${w / 2},${archH} 0 0,0 ${w},0`;
}

/** Button shape - convex top / concave bottom. */
function buttonPath(w: number, h: number, t: number): string {
  const yBase = h * (0.1 + t * 0.8);
  const bulge = h * 0.15 * (1 - 2 * t);
  return `M 0,${yBase} Q ${w / 2},${yBase - bulge} ${w},${yBase}`;
}

/** Ring inside - concentric ellipses scaled inward. */
function ringInsidePath(w: number, h: number, t: number): string {
  const cx = w / 2;
  const cy = h / 2;
  const scale = 0.7 - t * 0.35;
  const rx = Math.max(1, (w / 2) * scale);
  const ry = Math.max(1, (h / 2) * scale);
  return (
    `M ${cx},${cy - ry} ` +
    `A ${rx},${ry} 0 1,1 ${cx},${cy + ry} ` +
    `A ${rx},${ry} 0 1,1 ${cx},${cy - ry}`
  );
}

/** Ring outside - concentric ellipses scaled outward. */
function ringOutsidePath(w: number, h: number, t: number): string {
  const cx = w / 2;
  const cy = h / 2;
  const scale = 1 - t * 0.35;
  const rx = Math.max(1, (w / 2) * scale);
  const ry = Math.max(1, (h / 2) * scale);
  return (
    `M ${cx},${cy - ry} ` +
    `A ${rx},${ry} 0 1,1 ${cx},${cy + ry} ` +
    `A ${rx},${ry} 0 1,1 ${cx},${cy - ry}`
  );
}

// ── Priority 3 path generators ─────────────────────────────────────────

/** Triangle / trapezoid - top line narrow, bottom line full width. */
function trianglePath(w: number, h: number, t: number): string {
  const narrowW = w * 0.15;
  const lineW = narrowW + t * (w - narrowW);
  const xStart = (w - lineW) / 2;
  const yBase = h * (0.1 + t * 0.8);
  return `M ${xStart},${yBase} L ${xStart + lineW},${yBase}`;
}

/** Inverted triangle - top line full width, bottom line narrow. */
function triangleInvertedPath(w: number, h: number, t: number): string {
  const narrowW = w * 0.15;
  const lineW = w - t * (w - narrowW);
  const xStart = (w - lineW) / 2;
  const yBase = h * (0.1 + t * 0.8);
  return `M ${xStart},${yBase} L ${xStart + lineW},${yBase}`;
}

/** Stop / octagon - lines narrow at top and bottom, widest in centre. */
function stopPath(w: number, h: number, t: number): string {
  const inset = w * 0.15 * (1 - Math.pow(1 - 2 * Math.abs(t - 0.5), 2));
  const yBase = h * (0.1 + t * 0.8);
  return `M ${inset},${yBase} L ${w - inset},${yBase}`;
}

/** Chevron - V-shape pointing down. */
function chevronPath(w: number, h: number, t: number): string {
  const yBase = h * (0.15 + t * 0.7);
  const dip = h * 0.2 * (1 - t);
  return `M 0,${yBase} L ${w / 2},${yBase + dip} L ${w},${yBase}`;
}

/** Inverted chevron - V-shape pointing up. */
function chevronInvertedPath(w: number, h: number, t: number): string {
  const yBase = h * (0.15 + t * 0.7);
  const rise = h * 0.2 * t;
  return `M 0,${yBase} L ${w / 2},${yBase - rise} L ${w},${yBase}`;
}

/** Inflate bottom only. */
function inflateBottomPath(w: number, h: number, t: number): string {
  const yBase = h * (0.15 + t * 0.7);
  const bulge = t > 0.4 ? h * 0.25 * ((t - 0.4) / 0.6) : 0;
  return `M 0,${yBase} Q ${w / 2},${yBase + bulge} ${w},${yBase}`;
}

/** Inflate top only. */
function inflateTopPath(w: number, h: number, t: number): string {
  const yBase = h * (0.15 + t * 0.7);
  const bulge = t < 0.6 ? h * 0.25 * ((0.6 - t) / 0.6) : 0;
  return `M 0,${yBase} Q ${w / 2},${yBase - bulge} ${w},${yBase}`;
}

/** Deflate bottom only. */
function deflateBottomPath(w: number, h: number, t: number): string {
  const yBase = h * (0.15 + t * 0.7);
  const pinch = t > 0.4 ? h * 0.2 * ((t - 0.4) / 0.6) : 0;
  return `M 0,${yBase} Q ${w / 2},${yBase - pinch} ${w},${yBase}`;
}

/** Deflate top only. */
function deflateTopPath(w: number, h: number, t: number): string {
  const yBase = h * (0.15 + t * 0.7);
  const pinch = t < 0.6 ? h * 0.2 * ((0.6 - t) / 0.6) : 0;
  return `M 0,${yBase} Q ${w / 2},${yBase + pinch} ${w},${yBase}`;
}

// ── Priority 4 path generators ─────────────────────────────────────────

/** Slant up — baseline rises from left to right. */
function slantUpPath(w: number, h: number, t: number): string {
  const yStart = h * (0.3 + t * 0.55);
  const yEnd = h * (0.05 + t * 0.55);
  return `M 0,${yStart} L ${w},${yEnd}`;
}

/** Slant down — baseline falls from left to right. */
function slantDownPath(w: number, h: number, t: number): string {
  const yStart = h * (0.05 + t * 0.55);
  const yEnd = h * (0.3 + t * 0.55);
  return `M 0,${yStart} L ${w},${yEnd}`;
}

/** Fade right — text narrows towards the right (trapezoid). */
function fadeRightPath(w: number, h: number, t: number): string {
  const yLeft = h * (0.1 + t * 0.8);
  const squeeze = 0.35 * (1 - 2 * t);
  const yRight = h * (0.5 + squeeze * 0.4);
  return `M 0,${yLeft} L ${w},${yRight}`;
}

/** Fade left — text narrows towards the left (trapezoid). */
function fadeLeftPath(w: number, h: number, t: number): string {
  const squeeze = 0.35 * (1 - 2 * t);
  const yLeft = h * (0.5 + squeeze * 0.4);
  const yRight = h * (0.1 + t * 0.8);
  return `M 0,${yLeft} L ${w},${yRight}`;
}

/** Fade up — text narrows towards the top. */
function fadeUpPath(w: number, h: number, t: number): string {
  const narrowW = w * 0.3;
  const lineW = narrowW + t * (w - narrowW);
  const xStart = (w - lineW) / 2;
  const yBase = h * (0.1 + t * 0.8);
  return `M ${xStart},${yBase} L ${xStart + lineW},${yBase}`;
}

/** Fade down — text narrows towards the bottom. */
function fadeDownPath(w: number, h: number, t: number): string {
  const narrowW = w * 0.3;
  const lineW = w - t * (w - narrowW);
  const xStart = (w - lineW) / 2;
  const yBase = h * (0.1 + t * 0.8);
  return `M ${xStart},${yBase} L ${xStart + lineW},${yBase}`;
}

/** Arch up pour — hollowed arch upward (like archUp but with inner hole). */
function archUpPourPath(w: number, h: number, t: number): string {
  const archH = h * (0.7 - t * 0.5);
  if (archH < 1) return `M 0,${h} L ${w},${h}`;
  return `M 0,${h} A ${w / 2},${archH} 0 0,1 ${w},${h}`;
}

/** Arch down pour — hollowed arch downward. */
function archDownPourPath(w: number, h: number, t: number): string {
  const archH = h * (0.2 + t * 0.5);
  if (archH < 1) return `M 0,0 L ${w},0`;
  return `M 0,0 A ${w / 2},${archH} 0 0,0 ${w},0`;
}

/** Circle pour — concentric ellipses (like circle but with an inner gap). */
function circlePourPath(w: number, h: number, t: number): string {
  const cx = w / 2;
  const cy = h / 2;
  const scale = 0.85 - t * 0.45;
  const rx = Math.max(1, (w / 2) * scale);
  const ry = Math.max(1, (h / 2) * scale);
  return (
    `M ${cx},${cy - ry} ` +
    `A ${rx},${ry} 0 1,1 ${cx},${cy + ry} ` +
    `A ${rx},${ry} 0 1,1 ${cx},${cy - ry}`
  );
}

/** Button pour — convex top / concave bottom with larger margins. */
function buttonPourPath(w: number, h: number, t: number): string {
  const yBase = h * (0.15 + t * 0.7);
  const bulge = h * 0.12 * (1 - 2 * t);
  return `M 0,${yBase} Q ${w / 2},${yBase - bulge} ${w},${yBase}`;
}

/** Deflate-inflate — pinched in centre top/bottom, expanded at edges. */
function deflateInflatePath(w: number, h: number, t: number): string {
  const yBase = h * (0.15 + t * 0.7);
  const factor = Math.sin(t * Math.PI);
  const bulge = h * 0.2 * (factor - 0.5);
  return `M 0,${yBase} Q ${w / 2},${yBase - bulge} ${w},${yBase}`;
}

/** Deflate-inflate-deflate — triple oscillation. */
function deflateInflateDeflatePath(
  w: number,
  h: number,
  t: number,
): string {
  const yBase = h * (0.15 + t * 0.7);
  const factor = Math.sin(t * Math.PI * 2);
  const bulge = h * 0.15 * factor;
  const q1 = w / 3;
  const q2 = (2 * w) / 3;
  return (
    `M 0,${yBase} ` +
    `Q ${q1},${yBase - bulge} ${w / 2},${yBase} ` +
    `Q ${q2},${yBase + bulge} ${w},${yBase}`
  );
}

// ── Generator look-up table ────────────────────────────────────────────

export const WARP_PATH_GENERATORS: Readonly<Record<string, WarpPathGenerator>> =
  {
    textArchUp: archUpPath,
    textArchDown: archDownPath,
    textCircle: circlePath,
    textWave1: wave1Path,
    textInflate: inflatePath,
    textDeflate: deflatePath,
    textCurveUp: curveUpPath,
    textCurveDown: curveDownPath,
    textWave2: wave2Path,
    textWave4: wave4Path,
    textDoubleWave1: doubleWave1Path,
    textCanUp: canUpPath,
    textCanDown: canDownPath,
    textButton: buttonPath,
    textRingInside: ringInsidePath,
    textRingOutside: ringOutsidePath,
    textCascadeUp: cascadeUpPath,
    textCascadeDown: cascadeDownPath,
    textTriangle: trianglePath,
    textTriangleInverted: triangleInvertedPath,
    textStop: stopPath,
    textChevron: chevronPath,
    textChevronInverted: chevronInvertedPath,
    textInflateBottom: inflateBottomPath,
    textInflateTop: inflateTopPath,
    textDeflateBottom: deflateBottomPath,
    textDeflateTop: deflateTopPath,
    textSlantUp: slantUpPath,
    textSlantDown: slantDownPath,
    textFadeRight: fadeRightPath,
    textFadeLeft: fadeLeftPath,
    textFadeUp: fadeUpPath,
    textFadeDown: fadeDownPath,
    textArchUpPour: archUpPourPath,
    textArchDownPour: archDownPourPath,
    textCirclePour: circlePourPath,
    textButtonPour: buttonPourPath,
    textDeflateInflate: deflateInflatePath,
    textDeflateInflateDeflate: deflateInflateDeflatePath,
  };

// ── Public API ─────────────────────────────────────────────────────────

/** Returns `true` when the preset should use SVG `<textPath>` rendering. */
export function shouldUseSvgWarp(
  preset: PptxTextWarpPreset | undefined,
): boolean {
  if (!preset || preset === "textNoShape" || preset === "textPlain") {
    return false;
  }
  return SVG_WARP_PRESETS.has(preset);
}

/** Generate an SVG path `d` attribute for a warp preset at a given line position. */
export function getWarpPath(
  preset: PptxTextWarpPreset,
  width: number,
  height: number,
  lineIndex: number,
  lineCount: number,
): string {
  const t = lineCount <= 1 ? 0.5 : lineIndex / (lineCount - 1);
  const generator = WARP_PATH_GENERATORS[preset];
  if (generator) {
    return generator(width, height, t);
  }
  const y = height * (0.2 + t * 0.6);
  return `M 0,${y} L ${width},${y}`;
}
